let functions;
try {
  functions = require('firebase-functions');
} catch (e) {
  functions = null;
}

const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Root health check endpoint for Render / Uptime monitors
app.get('/', (req, res) => {
  res.send('WhatsApp CRM Webhook Server is running!');
});

// ----------------------------------------------------------------------
// 1. GET /webhook (Meta Webhook Challenge Verification)
// ----------------------------------------------------------------------
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN || 'my_secure_token_123';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('WEBHOOK_VERIFIED successfully!');
    return res.status(200).send(challenge);
  }
  
  console.log('Webhook verification failed. Expected:', expectedToken, 'Received:', token);
  return res.sendStatus(403);
});

// ----------------------------------------------------------------------
// 2. POST /webhook (Meta Webhook Inbound Message & Status Handler)
// ----------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // A) Process Inbound Messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              // Sanitize timestamp: Meta test payloads send ancient sample timestamps like 1504902988 (2017).
              // If timestamp is invalid or older than 2024, default to current server time Date.now()
              let parsedTime = parseInt(message.timestamp, 10) * 1000;
              const timestamp = (!isNaN(parsedTime) && parsedTime > 1704067200000) ? parsedTime : Date.now();
              const messageId = message.id;
              const msgType = message.type;

              let msgBody = '';
              let buttonPayload = null;

              if (msgType === 'text') {
                msgBody = message.text?.body || '';
              } else if (msgType === 'interactive' && message.interactive?.type === 'button_reply') {
                msgBody = message.interactive.button_reply.title;
                buttonPayload = message.interactive.button_reply.id;
              } else if (msgType === 'button') {
                msgBody = message.button?.text || '';
                buttonPayload = message.button?.payload || null;
              } else if (msgType === 'image') {
                msgBody = `[Image Received] ${message.image?.caption || ''}`;
              } else {
                msgBody = `[${msgType.toUpperCase()} Message Received]`;
              }

              // 1. Auto-upsert Contact document into Firestore contacts/{phone}
              const contactRef = db.collection('contacts').doc(phone);
              const contactSnap = await contactRef.get();
              const windowExpiry = timestamp + (24 * 60 * 60 * 1000); // 24 Hours from now

              if (!contactSnap.exists) {
                await contactRef.set({
                  name: profileName,
                  phone: phone,
                  lastMessage: msgBody,
                  lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(timestamp),
                  unreadCount: 1,
                  is24hActive: true,
                  windowExpiry: windowExpiry,
                  tags: ['New Lead', 'Inbound'],
                  optedOut: false,
                  notes: 'Auto-registered via inbound WhatsApp webhook.'
                });
              } else {
                const currentUnread = contactSnap.data().unreadCount || 0;
                await contactRef.update({
                  name: profileName,
                  lastMessage: msgBody,
                  lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(timestamp),
                  unreadCount: currentUnread + 1,
                  is24hActive: true,
                  windowExpiry: windowExpiry
                });
              }

              // 2. Save Message document into Firestore chats/{phone}/messages/{messageId}
              const messageRef = db.collection('chats').doc(phone).collection('messages').doc(messageId);
              await messageRef.set({
                id: messageId,
                from: phone,
                to: 'business',
                type: msgType === 'interactive' || msgType === 'button' ? 'button_reply' : msgType,
                body: msgBody,
                buttonPayload: buttonPayload,
                status: 'read',
                timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
                direction: 'inbound'
              });

              console.log(`Inbound message saved for ${phone} (${profileName}): ${msgBody}`);
            }
          }

          // B) Process Delivery Status Updates (sent, delivered, read, failed)
          if (value.statuses && value.statuses.length > 0) {
            for (const statusUpdate of value.statuses) {
              const statusMessageId = statusUpdate.id;
              const recipientPhone = statusUpdate.recipient_id;
              const newStatus = statusUpdate.status; // 'sent' | 'delivered' | 'read' | 'failed'

              let updated = false;

              // Direct path update if recipient_id is available
              if (recipientPhone && statusMessageId) {
                try {
                  const msgRef = db.collection('chats').doc(recipientPhone).collection('messages').doc(statusMessageId);
                  await msgRef.update({
                    status: newStatus,
                    statusTimestamp: admin.firestore.Timestamp.now()
                  });
                  updated = true;
                } catch (e) {
                  // Direct doc update failed, fallback to collection group query
                }
              }

              // Collection group query fallback if direct update didn't run or failed
              if (!updated && statusMessageId) {
                try {
                  const querySnap = await db.collectionGroup('messages').where('id', '==', statusMessageId).get();
                  const batch = db.batch();
                  querySnap.forEach(docSnap => {
                    batch.update(docSnap.ref, {
                      status: newStatus,
                      statusTimestamp: admin.firestore.Timestamp.now()
                    });
                  });
                  await batch.commit();
                  console.log(`Status updated via Collection Group for ${statusMessageId}: ${newStatus}`);
                } catch (err) {
                  console.warn(`Could not update status for message ${statusMessageId}:`, err.message);
                }
              } else if (updated) {
                console.log(`Status updated for message ${statusMessageId}: ${newStatus}`);
              }
            }
          }
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Error processing Meta Webhook payload:', error);
      return res.status(500).send('INTERNAL_SERVER_ERROR');
    }
  } else {
    return res.sendStatus(404);
  }
});

// ----------------------------------------------------------------------
// 3. POST /api/send-message (Outbound Messaging Engine via Meta Graph API)
// ----------------------------------------------------------------------
app.post('/api/send-message', async (req, res) => {
  const { phone, body, type = 'text', templateName = null, templateComponents = [] } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Missing recipient phone number' });
  }

  try {
    // 1. Fetch Meta WABA credentials from Firestore settings/metaConfig
    const configSnap = await db.doc('settings/metaConfig').get();
    if (!configSnap.exists) {
      return res.status(500).json({ error: 'Meta Cloud API credentials not configured in settings/metaConfig' });
    }
    const { phoneNumberId, accessToken } = configSnap.data();

    if (!phoneNumberId || !accessToken) {
      return res.status(500).json({ error: 'phoneNumberId or accessToken missing in metaConfig' });
    }

    // 2. Construct Meta Graph API payload
    let metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone
    };

    if (type === 'template') {
      metaPayload.type = 'template';
      metaPayload.template = {
        name: templateName,
        language: { code: 'en_US' },
        components: templateComponents
      };
    } else {
      metaPayload.type = 'text';
      metaPayload.text = { preview_url: false, body: body };
    }

    // 3. Dispatch POST request to Meta Graph API
    const metaRes = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      metaPayload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const metaMsgId = metaRes.data?.messages?.[0]?.id || `wamid_out_${Date.now()}`;
    const timestamp = Date.now();

    // 4. Save outbound message to Firestore
    const msgRef = db.collection('chats').doc(phone).collection('messages').doc(metaMsgId);
    await msgRef.set({
      id: metaMsgId,
      from: 'business',
      to: phone,
      type: type,
      body: body,
      templateName: templateName,
      status: 'sent',
      timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
      direction: 'outbound'
    });

    // 5. Update contact summary
    const contactRef = db.collection('contacts').doc(phone);
    await contactRef.update({
      lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
      lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(timestamp)
    });

    return res.status(200).json({ success: true, messageId: metaMsgId });
  } catch (error) {
    console.error('Outbound Meta API error:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to send WhatsApp message via Meta Cloud API',
      details: error.response?.data || error.message
    });
  }
});

// Start Express server on PORT for Render / standalone Node execution
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Firebase Cloud Function export (if running in Firebase environment)
if (functions) {
  exports.api = functions.https.onRequest(app);
}

module.exports = app;



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

// Helper function to dispatch outbound WhatsApp messages via Meta Graph API & store in Firestore
async function dispatchOutboundWhatsAppMessage({ phone, body, type = 'text', templateName = null, templateComponents = [] }) {
  let phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  let accessToken = process.env.META_ACCESS_TOKEN;

  // Try to load credentials from Firestore settings/metaConfig if not in env
  try {
    const configSnap = await db.doc('settings/metaConfig').get();
    if (configSnap.exists) {
      const configData = configSnap.data();
      if (configData.phoneNumberId) phoneNumberId = configData.phoneNumberId;
      if (configData.accessToken) accessToken = configData.accessToken;
    }
  } catch (e) {
    console.warn('Could not read settings/metaConfig from Firestore');
  }

  const nowMs = Date.now();
  let metaMsgId = `wamid_out_${nowMs}_${Math.random().toString(36).substr(2, 4)}`;

  if (phoneNumberId && accessToken) {
    try {
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

      metaMsgId = metaRes.data?.messages?.[0]?.id || metaMsgId;
      console.log(`Successfully dispatched Meta WhatsApp message to ${phone}: ${metaMsgId}`);
    } catch (err) {
      console.error('Error sending WhatsApp message via Meta Graph API:', err.response?.data || err.message);
    }
  } else {
    console.warn('Meta credentials (phoneNumberId / accessToken) not found. Saving outbound message in Firestore only.');
  }

  // Store outbound message in Firestore chats/{phone}/messages/{metaMsgId}
  const messageRef = db.collection('chats').doc(phone).collection('messages').doc(metaMsgId);
  await messageRef.set({
    id: metaMsgId,
    from: 'business',
    to: phone,
    type: type,
    body: body,
    templateName: templateName,
    status: 'sent',
    timestamp: admin.firestore.Timestamp.fromMillis(nowMs),
    direction: 'outbound'
  });

  // Update contact document lastMessage and lastMessageTimestamp
  const contactRef = db.collection('contacts').doc(phone);
  await contactRef.set({
    lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
    lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(nowMs)
  }, { merge: true }).catch(() => {});

  return metaMsgId;
}

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
              const contactInfo = value.contacts?.find(c => c.wa_id === message.from) || value.contacts?.[0];
              const phone = message.from; // Sender WhatsApp phone
              const profileName = contactInfo?.profile?.name || `Customer ${phone ? phone.slice(-4) : ''}`;

              // Sanitize timestamp: Meta test payloads send ancient sample timestamps like 1504902988 (2017).
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

              // 3. Automated Trigger Check for "get investment details" (case-insensitive)
              const incomingText = `${msgBody || ''} ${buttonPayload || ''}`.toLowerCase();
              if (incomingText.includes('get investment details')) {
                console.log(`Triggering automated Yas Island investment details reply for ${phone}`);
                const autoReplyText = `Thanks for your interest in Yas Island! 🌴\n\nWe’ve received your response — one of our specialists will contact you shortly with full investment details.\n\nTo help us tailor the best options, feel free to share your budget, and preferred unit type below 🤝`;

                await dispatchOutboundWhatsAppMessage({
                  phone,
                  body: autoReplyText,
                  type: 'text'
                });
              }
            }
          }

          // B) Process Delivery Status Updates (sent, delivered, read, failed)
          if (value.statuses && value.statuses.length > 0) {
            for (const statusUpdate of value.statuses) {
              const statusMessageId = statusUpdate.id;
              const recipientPhone = statusUpdate.recipient_id ? statusUpdate.recipient_id.replace(/^\+/, '') : null;
              const newStatus = statusUpdate.status; // 'sent' | 'delivered' | 'read' | 'failed'
              
              let statusTime = admin.firestore.Timestamp.now();
              if (statusUpdate.timestamp) {
                const parsed = parseInt(statusUpdate.timestamp, 10) * 1000;
                if (!isNaN(parsed) && parsed > 1704067200000) {
                  statusTime = admin.firestore.Timestamp.fromMillis(parsed);
                }
              }
              const nowTimestamp = admin.firestore.Timestamp.now();

              if (recipientPhone && statusMessageId) {
                try {
                  // 1. Check & Auto-create Contact/Lead document if it does not exist
                  const contactRef = db.collection('contacts').doc(recipientPhone);
                  const contactSnap = await contactRef.get();

                  if (!contactSnap.exists) {
                    await contactRef.set({
                      name: `Lead +${recipientPhone}`,
                      phone: recipientPhone,
                      leadClass: 'Inbound',
                      leadRating: 'New Lead',
                      createdAt: nowTimestamp,
                      lastMessage: 'Template Sent',
                      lastMessageTimestamp: statusTime,
                      unreadCount: 0,
                      is24hActive: false,
                      windowExpiry: 0,
                      tags: ['Broadcast Lead', 'External Outreach'],
                      optedOut: false,
                      notes: 'Auto-registered via outbound template status webhook.'
                    }, { merge: true });
                    console.log(`Auto-registered lead document for recipient +${recipientPhone}`);
                  } else {
                    // Update contact summary for existing lead
                    await contactRef.set({
                      lastMessage: contactSnap.data()?.lastMessage || 'Template Sent',
                      lastMessageTimestamp: statusTime
                    }, { merge: true });
                  }

                  // 2. Create/Merge message in chats/{recipientPhone}/messages/{statusMessageId}
                  const msgRef = db.collection('chats').doc(recipientPhone).collection('messages').doc(statusMessageId);
                  await msgRef.set({
                    id: statusMessageId,
                    from: 'business',
                    to: recipientPhone,
                    sender: 'agent',
                    type: 'template',
                    body: '[Template Message Sent]',
                    status: newStatus,
                    timestamp: statusTime,
                    direction: 'outbound',
                    statusTimestamp: nowTimestamp
                  }, { merge: true });

                  console.log(`Status merged for message ${statusMessageId} (${recipientPhone}): ${newStatus}`);
                } catch (err) {
                  console.warn(`Error updating status for ${statusMessageId}:`, err.message);
                }
              }

              // 3. Collection Group query fallback to update any existing docs matching statusMessageId
              if (statusMessageId) {
                try {
                  const querySnap = await db.collectionGroup('messages').where('id', '==', statusMessageId).get();
                  if (!querySnap.empty) {
                    const batch = db.batch();
                    querySnap.forEach(docSnap => {
                      batch.set(docSnap.ref, {
                        status: newStatus,
                        statusTimestamp: nowTimestamp
                      }, { merge: true });
                    });
                    await batch.commit();
                  }
                } catch (err) {
                  console.warn(`Collection group status update failed for ${statusMessageId}:`, err.message);
                }
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
    const metaMsgId = await dispatchOutboundWhatsAppMessage({
      phone,
      body,
      type,
      templateName,
      templateComponents
    });
    return res.status(200).json({ success: true, messageId: metaMsgId });
  } catch (error) {
    console.error('Outbound Meta API error:', error.message);
    return res.status(500).json({
      error: 'Failed to send WhatsApp message via Meta Cloud API',
      details: error.message
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

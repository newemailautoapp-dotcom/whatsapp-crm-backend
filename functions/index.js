const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ----------------------------------------------------------------------
// 1. GET /webhook (Meta Webhook Challenge Verification)
// ----------------------------------------------------------------------
app.get('/webhook', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Retrieve verify token from Firestore settings or process.env
  let expectedToken = process.env.META_VERIFY_TOKEN || 'my_secret_wa_webhook_token_2026';
  try {
    const configSnap = await db.doc('settings/metaConfig').get();
    if (configSnap.exists && configSnap.data().verifyToken) {
      expectedToken = configSnap.data().verifyToken;
    }
  } catch (e) {
    console.warn('Could not read verifyToken from Firestore, using default fallback.');
  }

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('WEBHOOK_VERIFIED successfully');
    return res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed. Token mismatch.');
    return res.sendStatus(403);
  }
});

// ----------------------------------------------------------------------
// 2. POST /webhook (Meta Webhook Inbound Message & Status Handler)
// ----------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value) return res.status(200).send('EVENT_RECEIVED');

      // A) Process Inbound Messages
      if (value.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const contactInfo = value.contacts?.[0];

        const phone = message.from; // Sender WhatsApp phone
        const profileName = contactInfo?.profile?.name || `Customer ${phone.slice(-4)}`;
        const timestamp = parseInt(message.timestamp, 10) * 1000 || Date.now();
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

        // Auto-upsert Contact document into Firestore contacts/{phone}
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

        // Save Message document into Firestore chats/{phone}/messages/{messageId}
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

        console.log(`Inbound message saved from ${phone} (${profileName}): ${msgBody}`);
      }

      // B) Process Delivery Status Updates (sent, delivered, read, failed)
      if (value.statuses && value.statuses.length > 0) {
        const statusUpdate = value.statuses[0];
        const statusMessageId = statusUpdate.id;
        const recipientPhone = statusUpdate.recipient_id;
        const newStatus = statusUpdate.status; // 'sent' | 'delivered' | 'read' | 'failed'

        if (recipientPhone && statusMessageId) {
          const msgRef = db.collection('chats').doc(recipientPhone).collection('messages').doc(statusMessageId);
          await msgRef.update({
            status: newStatus,
            statusTimestamp: admin.firestore.Timestamp.now()
          }).catch(err => {
            console.warn(`Could not update message status for ${statusMessageId}:`, err);
          });
          console.log(`Status updated for message ${statusMessageId}: ${newStatus}`);
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

exports.api = functions.https.onRequest(app);

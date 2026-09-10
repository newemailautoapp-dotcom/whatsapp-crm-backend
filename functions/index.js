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
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Helper function to dispatch instant lead alert emails via SendGrid / Resend / Nodemailer
async function sendLeadEmailNotification({ leadName, leadPhone }) {
  const recipient = process.env.LEAD_ALERT_EMAIL || 'Mitchellhayles@gmail.com';
  const cleanPhone = (leadPhone || '').replace(/^\+/, '');
  const subject = `🚨 New Pre-Registration Lead Captured: ${leadName || 'Valued Lead'}`;
  const bodyText = `Name: ${leadName || 'Valued Lead'}
Phone: +${cleanPhone}
Direct WhatsApp link: https://wa.me/${cleanPhone}`;

  console.log(`[EMAIL ALERT] Preparing pre-registration lead notification for ${leadName} (+${cleanPhone}) to ${recipient}`);

  // 1. Resend API support if RESEND_API_KEY is configured
  if (process.env.RESEND_API_KEY) {
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: process.env.EMAIL_FROM || 'CRM Lead Alerts <onboarding@resend.dev>',
          to: [recipient],
          subject: subject,
          text: bodyText
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`[EMAIL ALERT SUCCESS] Sent email via Resend to ${recipient}`);
      return;
    } catch (resendErr) {
      console.error(`[RESEND ERROR]`, resendErr.response?.data || resendErr.message);
    }
  }

  // 2. SendGrid API support if SENDGRID_API_KEY is configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: recipient }] }],
          from: { email: process.env.EMAIL_FROM || 'alerts@whatsapp-crm.com', name: 'CRM Lead Alerts' },
          subject: subject,
          content: [{ type: 'text/plain', value: bodyText }]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`[EMAIL ALERT SUCCESS] Sent email via SendGrid to ${recipient}`);
      return;
    } catch (sgErr) {
      console.error(`[SENDGRID ERROR]`, sgErr.response?.data || sgErr.message);
    }
  }

  // 3. Nodemailer SMTP Transporter
  try {
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM || `"CRM Lead Alerts" <${smtpUser}>`,
        to: recipient,
        subject: subject,
        text: bodyText
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL ALERT SUCCESS] Sent email to ${recipient} via SMTP: ${info.messageId}`);
    } else {
      console.warn(`[EMAIL ALERT NOT DISPATCHED TO INBOX] Missing email provider keys on Render!\nTo deliver emails to ${recipient}, please add ONE of these environment variables on Render:\n1. SENDGRID_API_KEY (SendGrid)\n2. RESEND_API_KEY (Resend)\n3. SMTP_USER & SMTP_PASS (Gmail App Password / Custom SMTP)`);
      console.log(`Payload content prepared:\nTo: ${recipient}\nSubject: ${subject}\nBody:\n${bodyText}`);
    }
  } catch (err) {
    console.error(`[EMAIL ALERT ERROR] Failed to send email to ${recipient}:`, err.message);
  }
}

// Root health check endpoint for Render / Uptime monitors
app.get('/', (req, res) => {
  res.send('WhatsApp CRM Webhook Server is running!');
});

// Helper function to dispatch outbound WhatsApp messages via Meta Graph API & store in Firestore
async function dispatchOutboundWhatsAppMessage({ phone, body, type = 'text', templateName = null, templateComponents = [] }) {
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || process.env.META_PHONE_NUMBER_ID;
  let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || process.env.META_ACCESS_TOKEN;

  // Only fallback to Firestore settings/metaConfig if credentials are missing in process.env
  if (!phoneNumberId || !accessToken) {
    try {
      const configSnap = await db.doc('settings/metaConfig').get();
      if (configSnap.exists) {
        const configData = configSnap.data();
        if (!phoneNumberId && configData.phoneNumberId) phoneNumberId = configData.phoneNumberId;
        if (!accessToken && configData.accessToken && !configData.accessToken.includes('demo')) {
          accessToken = configData.accessToken;
        }
      }
    } catch (e) {
      console.warn('Could not read settings/metaConfig from Firestore');
    }
  }

  const nowMs = Date.now();
  let metaMsgId = `wamid_out_${nowMs}_${Math.random().toString(36).substr(2, 4)}`;

  if (phoneNumberId && accessToken) {
    console.log(`Dispatching Meta WhatsApp msg to ${phone} using PhoneID: ${phoneNumberId}, Token: ${accessToken.substring(0, 12)}...`);
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

// Global In-Memory Idempotency Cache for Deduplicating Webhook Events
const processedMessageIds = new Set();

// ----------------------------------------------------------------------
// 2. POST /webhook (Meta Webhook Inbound Message & Status Handler)
// ----------------------------------------------------------------------
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Immediately respond 200 OK to Meta to prevent webhook HTTP retries
  res.status(200).send('EVENT_RECEIVED');

  if (body.object === 'whatsapp_business_account') {
    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (!value) continue;

          // A) Process Inbound Messages (User clicks & text replies ONLY)
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const messageId = message.id;

              // 1. Idempotency Check: Skip duplicate webhooks for the exact same message ID (wamid)
              if (messageId && processedMessageIds.has(messageId)) {
                console.log(`[DEDUP GUARD] Skipping already processed message ID: ${messageId}`);
                continue;
              }
              if (messageId) {
                processedMessageIds.add(messageId);
                if (processedMessageIds.size > 5000) {
                  const firstKey = processedMessageIds.values().next().value;
                  processedMessageIds.delete(firstKey);
                }
              }

              const rawPhone = message.from; // Sender WhatsApp phone
              const cleanPhone = (rawPhone || '').replace(/^\+/, '');
              const mitchellPhone = (process.env.MITCHELL_PHONE || '971585687075').replace(/^\+/, '');
              const businessPhone = (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || '1293265723876318').replace(/^\+/, '');

              // 2. SENDER GUARD: Completely ignore events originating from Mitchell's number or Business Sender ID
              if (cleanPhone === mitchellPhone || cleanPhone === '971585687075' || cleanPhone === businessPhone || cleanPhone.includes('1293265723876318')) {
                console.log(`[SENDER GUARD] Ignoring incoming webhook event/message from Mitchell or Business ID (${cleanPhone})`);
                continue;
              }

              const contactInfo = value.contacts?.find(c => c.wa_id === message.from) || value.contacts?.[0];
              const profileName = contactInfo?.profile?.name || `Customer ${cleanPhone ? cleanPhone.slice(-4) : ''}`;

              let parsedTime = parseInt(message.timestamp, 10) * 1000;
              const timestamp = (!isNaN(parsedTime) && parsedTime > 1704067200000) ? parsedTime : Date.now();
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
              const contactRef = db.collection('contacts').doc(cleanPhone);
              const contactSnap = await contactRef.get();
              const windowExpiry = timestamp + (24 * 60 * 60 * 1000); // 24 Hours from now

              if (!contactSnap.exists) {
                await contactRef.set({
                  name: profileName,
                  phone: cleanPhone,
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
              const messageRef = db.collection('chats').doc(cleanPhone).collection('messages').doc(messageId);
              await messageRef.set({
                id: messageId,
                from: cleanPhone,
                to: 'business',
                type: msgType === 'interactive' || msgType === 'button' ? 'button_reply' : msgType,
                body: msgBody,
                buttonPayload: buttonPayload,
                status: 'read',
                timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
                direction: 'inbound'
              });

              console.log(`Inbound message saved for ${cleanPhone} (${profileName}): ${msgBody}`);

              // Automated Trigger Check for "get investment details" (case-insensitive)
              const incomingText = `${msgBody || ''} ${buttonPayload || ''}`.toLowerCase();
              if (incomingText.includes('get investment details')) {
                console.log(`Triggering automated Yas Island investment details reply for ${cleanPhone}`);
                const autoReplyText = `Thanks for your interest in Yas Island! 🌴\n\nWe’ve received your response — one of our specialists will contact you shortly with full investment details.\n\nTo help us tailor the best options, feel free to share your budget, and preferred unit type below 🤝`;

                await dispatchOutboundWhatsAppMessage({
                  phone: cleanPhone,
                  body: autoReplyText,
                  type: 'text'
                });
              }

              // Automated Trigger Check for "Pre Register" (case-insensitive)
              if (incomingText.includes('pre register') || incomingText.includes('pre-register') || incomingText.includes('preregister')) {
                console.log(`Triggering automated Sei Saadiyat Pre Register reply & single WhatsApp lead alert to Mitchell (${mitchellPhone}) for lead ${cleanPhone} (${profileName})`);

                const seiSaadiyatAutoReply = `Thank you for your interest in Sei Saadiyat. \n\nYour pre-registration has been successfully received. \n\nOur Co-Founder, Mitchell, will be handling your inquiry directly. You can also connect with him immediately via WhatsApp or call for priority allocations, floor plans, and pricing details:\n\n📱 Direct Line: +971 58 568 7075\n\nWe look forward to assisting you.`;

                const mitchellLeadNotification = `🚨 *New Lead Captured!*\nName: ${profileName || 'Valued Lead'}\nPhone: +${cleanPhone}\nWhatsApp Link: https://wa.me/${cleanPhone}`;

                // Fire outbound responses concurrently
                await Promise.all([
                  dispatchOutboundWhatsAppMessage({
                    phone: cleanPhone,
                    body: seiSaadiyatAutoReply,
                    type: 'text'
                  }),
                  dispatchOutboundWhatsAppMessage({
                    phone: mitchellPhone,
                    body: mitchellLeadNotification,
                    type: 'text'
                  }),
                  sendLeadEmailNotification({
                    leadName: profileName,
                    leadPhone: cleanPhone
                  })
                ]);
              }
            }
          }

          // B) Process Delivery Status Updates ONLY (Updates ticks in Firestore, NO AUTO-REPLIES OR ALERTS FIRED)
          if (value.statuses && value.statuses.length > 0) {
            for (const statusUpdate of value.statuses) {
              const statusMessageId = statusUpdate.id;
              const recipientPhone = statusUpdate.recipient_id ? statusUpdate.recipient_id.replace(/^\+/, '') : null;
              const newStatus = statusUpdate.status;

              console.log(`[STATUS UPDATE] Message to ${statusUpdate.recipient_id || recipientPhone} is now: ${newStatus}`);

              if (newStatus === 'failed') {
                console.log('FAILED_ERROR:', JSON.stringify(statusUpdate.errors || statusUpdate.error || statusUpdate));
              }

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
                  } else {
                    await contactRef.set({
                      lastMessage: contactSnap.data()?.lastMessage || 'Template Sent',
                      lastMessageTimestamp: statusTime
                    }, { merge: true });
                  }

                  const msgRef = db.collection('chats').doc(recipientPhone).collection('messages').doc(statusMessageId);
                  const msgSnap = await msgRef.get();

                  if (msgSnap.exists) {
                    await msgRef.update({
                      status: newStatus,
                      statusTimestamp: nowTimestamp
                    });
                  } else {
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
                    });
                  }
                } catch (err) {
                  console.warn(`Error updating status for ${statusMessageId}:`, err.message);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing Meta Webhook payload:', error);
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

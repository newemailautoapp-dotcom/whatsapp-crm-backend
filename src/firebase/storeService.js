import { db, BACKEND_URL } from './config';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  getDoc 
} from 'firebase/firestore';
import { INITIAL_CONTACTS, INITIAL_MESSAGES } from '../data/mockContacts';

// Store state in localStorage for persistence during demo
const STORAGE_KEY_CONTACTS = 'wa_crm_contacts_v1';
const STORAGE_KEY_MESSAGES = 'wa_crm_messages_v1';
const STORAGE_KEY_CONFIG = 'wa_crm_meta_config_v1';

// Check if live Firebase project is configured
const isLiveFirebase = true; // Connected to live Firebase project whatsapp-crm-app-904e8

// Global Event Target for internal state updates when in demo mode
const eventHub = new EventTarget();

function getStoredContacts() {
  const data = localStorage.getItem(STORAGE_KEY_CONTACTS);
  if (data) {
    try { return JSON.parse(data); } catch (e) { /* fallback */ }
  }
  localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(INITIAL_CONTACTS));
  return INITIAL_CONTACTS;
}

function saveStoredContacts(contacts) {
  localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  eventHub.dispatchEvent(new CustomEvent('contacts_updated', { detail: contacts }));
}

function getStoredMessages() {
  const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
  if (data) {
    try { return JSON.parse(data); } catch (e) { /* fallback */ }
  }
  localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(INITIAL_MESSAGES));
  return INITIAL_MESSAGES;
}

function saveStoredMessages(messages) {
  localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  eventHub.dispatchEvent(new CustomEvent('messages_updated', { detail: messages }));
}

// Default Meta Config
const DEFAULT_META_CONFIG = {
  phoneNumberId: import.meta.env.VITE_META_PHONE_NUMBER_ID || '109823471092834',
  wabaId: import.meta.env.VITE_META_WABA_ID || '992837410293847',
  accessToken: import.meta.env.VITE_META_ACCESS_TOKEN || 'EAAG...demo_access_token',
  verifyToken: import.meta.env.VITE_META_VERIFY_TOKEN || 'my_secure_token_123'
};

export function getStoredConfig() {
  const data = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (data) {
    try { return JSON.parse(data); } catch (e) {}
  }
  return DEFAULT_META_CONFIG;
}

// ----------------------------------------------------
// Realtime Contacts Subscription
// ----------------------------------------------------
export function subscribeToContacts(callback) {
  if (isLiveFirebase) {
    const q = query(collection(db, 'contacts'), orderBy('lastMessageTimestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(contacts);
    }, (err) => {
      console.warn('Firestore subscription fallback to local store:', err);
      callback(getStoredContacts());
    });
  }

  // Demo Local Storage mode
  const handler = () => callback(getStoredContacts());
  eventHub.addEventListener('contacts_updated', handler);
  // Initial call
  callback(getStoredContacts());

  return () => {
    eventHub.removeEventListener('contacts_updated', handler);
  };
}

// ----------------------------------------------------
// Realtime Messages Subscription for a specific phone
// ----------------------------------------------------
export function subscribeToMessages(phone, callback) {
  if (!phone) return () => {};

  if (isLiveFirebase) {
    const q = query(collection(db, 'chats', phone, 'messages'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(msgs);
    }, (err) => {
      console.warn('Firestore messages fallback:', err);
      const allMsgs = getStoredMessages();
      callback(allMsgs[phone] || []);
    });
  }

  // Local demo mode
  const handler = () => {
    const allMsgs = getStoredMessages();
    callback(allMsgs[phone] || []);
  };
  eventHub.addEventListener('messages_updated', handler);
  handler();

  return () => {
    eventHub.removeEventListener('messages_updated', handler);
  };
}

// ----------------------------------------------------
// Send Outbound Message (Direct or Template)
// ----------------------------------------------------
export async function sendOutboundMessage({ phone, body, type = 'text', templateName = null }) {
  const timestamp = Date.now();
  const messageId = `msg_out_${timestamp}_${Math.random().toString(36).substr(2, 4)}`;

  const newMsg = {
    id: messageId,
    from: 'business',
    to: phone,
    type,
    body,
    templateName,
    status: 'sent', // initial status
    timestamp,
    direction: 'outbound'
  };

  // Dispatch outbound message to Render Backend API (https://whatsapp-crm-backend-enzj.onrender.com/api/send-message)
  try {
    fetch(`${BACKEND_URL}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        body,
        type,
        templateName
      })
    }).then(res => res.json()).then(data => {
      console.log('Render backend message dispatched:', data);
    }).catch(err => {
      console.warn('Render backend call warning:', err);
    });
  } catch (e) {
    console.warn('Backend fetch error:', e);
  }

  if (isLiveFirebase) {
    try {
      // 1. Save to subcollection chats/{phone}/messages
      const msgRef = doc(db, 'chats', phone, 'messages', messageId);
      await setDoc(msgRef, {
        ...newMsg,
        timestamp: serverTimestamp()
      });

      // 2. Update contact summary
      const contactRef = doc(db, 'contacts', phone);
      await updateDoc(contactRef, {
        lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
        lastMessageTimestamp: serverTimestamp(),
        unreadCount: 0
      });
    } catch (err) {
      console.error('Error writing to Firestore:', err);
    }
  }

  // Local store update for instant reactivity
  const allMsgs = getStoredMessages();
  const phoneMsgs = [...(allMsgs[phone] || []), newMsg];
  allMsgs[phone] = phoneMsgs;
  saveStoredMessages(allMsgs);

  // Update contact summary
  const contacts = getStoredContacts();
  const idx = contacts.findIndex(c => c.phone === phone);
  if (idx !== -1) {
    contacts[idx] = {
      ...contacts[idx],
      lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
      lastMessageTimestamp: timestamp,
      unreadCount: 0
    };
    saveStoredContacts(contacts);
  }

  // Simulate delivery status sequence: sent -> delivered (1.5s) -> read (3s)
  setTimeout(() => {
    updateMessageStatus(phone, messageId, 'delivered');
  }, 1500);

  setTimeout(() => {
    updateMessageStatus(phone, messageId, 'read');
  }, 3500);

  return newMsg;
}

// ----------------------------------------------------
// Simulate Inbound Message (from Customer)
// ----------------------------------------------------
export async function simulateInboundMessage({ phone, name, body, type = 'text', buttonPayload = null }) {
  const timestamp = Date.now();
  const messageId = `msg_in_${timestamp}_${Math.random().toString(36).substr(2, 4)}`;

  const newMsg = {
    id: messageId,
    from: phone,
    to: 'business',
    type,
    body,
    buttonPayload,
    status: 'read',
    timestamp,
    direction: 'inbound'
  };

  const contacts = getStoredContacts();
  let contact = contacts.find(c => c.phone === phone);

  if (!contact) {
    // Auto-upsert new contact
    contact = {
      phone,
      name: name || `Customer ${phone.slice(-4)}`,
      lastMessage: body,
      lastMessageTimestamp: timestamp,
      unreadCount: 1,
      is24hActive: true,
      windowExpiry: timestamp + (24 * 60 * 60 * 1000), // 24 hours
      tags: ['New Lead', 'Inbound'],
      optedOut: false,
      notes: 'Auto-upserted from inbound WhatsApp message.'
    };
    contacts.unshift(contact);
  } else {
    // Reset/extend 24h window upon inbound customer message
    contact.lastMessage = body;
    contact.lastMessageTimestamp = timestamp;
    contact.unreadCount = (contact.unreadCount || 0) + 1;
    contact.is24hActive = true;
    contact.windowExpiry = timestamp + (24 * 60 * 60 * 1000);
  }

  saveStoredContacts(contacts);

  const allMsgs = getStoredMessages();
  allMsgs[phone] = [...(allMsgs[phone] || []), newMsg];
  saveStoredMessages(allMsgs);

  if (isLiveFirebase) {
    try {
      const msgRef = doc(db, 'chats', phone, 'messages', messageId);
      await setDoc(msgRef, { ...newMsg, timestamp: serverTimestamp() });

      const contactRef = doc(db, 'contacts', phone);
      await setDoc(contactRef, {
        name: contact.name,
        phone: contact.phone,
        lastMessage: body,
        lastMessageTimestamp: serverTimestamp(),
        unreadCount: contact.unreadCount,
        is24hActive: true,
        windowExpiry: contact.windowExpiry,
        tags: contact.tags
      }, { merge: true });
    } catch (e) {
      console.warn('Firestore inbound update error:', e);
    }
  }

  return newMsg;
}

// ----------------------------------------------------
// Update Message Status (sent, delivered, read, failed)
// ----------------------------------------------------
export function updateMessageStatus(phone, messageId, newStatus) {
  const allMsgs = getStoredMessages();
  if (allMsgs[phone]) {
    allMsgs[phone] = allMsgs[phone].map(m => {
      if (m.id === messageId) return { ...m, status: newStatus };
      return m;
    });
    saveStoredMessages(allMsgs);
  }

  if (isLiveFirebase) {
    try {
      const msgRef = doc(db, 'chats', phone, 'messages', messageId);
      updateDoc(msgRef, { status: newStatus });
    } catch (e) {}
  }
}

// ----------------------------------------------------
// Update Contact Details (Tags, Notes, 24h expiry trigger, etc.)
// ----------------------------------------------------
export function updateContact(phone, updateData) {
  const contacts = getStoredContacts();
  const idx = contacts.findIndex(c => c.phone === phone);
  if (idx !== -1) {
    contacts[idx] = { ...contacts[idx], ...updateData };
    saveStoredContacts(contacts);
  }

  if (isLiveFirebase) {
    try {
      const contactRef = doc(db, 'contacts', phone);
      updateDoc(contactRef, updateData);
    } catch (e) {}
  }
}

// Mark contact messages as read
export function markContactAsRead(phone) {
  updateContact(phone, { unreadCount: 0 });
}

// Toggle 24-hour Session Window for testing
export function toggle24hWindow(phone, setActive) {
  const now = Date.now();
  const updateData = {
    is24hActive: setActive,
    windowExpiry: setActive ? now + (24 * 60 * 60 * 1000) : now - 1000
  };
  updateContact(phone, updateData);
}

// ----------------------------------------------------
// Meta API Settings configuration
// ----------------------------------------------------
export function saveMetaConfig(config) {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  if (isLiveFirebase) {
    try {
      setDoc(doc(db, 'settings', 'metaConfig'), config, { merge: true });
    } catch (e) {}
  }
  eventHub.dispatchEvent(new CustomEvent('config_updated', { detail: config }));
}

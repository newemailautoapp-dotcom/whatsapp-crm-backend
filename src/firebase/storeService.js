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
  getDoc,
  getDocs,
  where
} from 'firebase/firestore';
import { INITIAL_CONTACTS, INITIAL_MESSAGES } from '../data/mockContacts';

export const DEFAULT_TENANT_ID = 'usca_academy';

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
  phoneNumberId: import.meta.env.VITE_META_PHONE_NUMBER_ID || '1308538339013180',
  wabaId: import.meta.env.VITE_META_WABA_ID || '2126714',
  accessToken: import.meta.env.VITE_META_ACCESS_TOKEN || 'EAAG...demo_access_token',
  verifyToken: import.meta.env.VITE_META_VERIFY_TOKEN || 'whatsapp_crm_verify_token_2026'
};

export async function getStoredConfig(tenantId = DEFAULT_TENANT_ID) {
  if (typeof tenantId === 'object') tenantId = DEFAULT_TENANT_ID;
  tenantId = tenantId || DEFAULT_TENANT_ID;

  if (isLiveFirebase) {
    try {
      const snap = await getDoc(doc(db, 'tenants', tenantId));
      if (snap.exists()) {
        return snap.data();
      }
    } catch (e) {
      console.warn('Error fetching tenant config from Firestore:', e);
    }
  }

  const data = localStorage.getItem(`${STORAGE_KEY_CONFIG}_${tenantId}`);
  if (data) {
    try { return JSON.parse(data); } catch (e) {}
  }
  return DEFAULT_META_CONFIG;
}

// ----------------------------------------------------
// User Tenant Mapping & Provisioning Helper
// ----------------------------------------------------
export async function ensureUserTenant(authUser) {
  if (!authUser || !authUser.uid) return { ...authUser, tenantId: DEFAULT_TENANT_ID };

  const cleanEmail = (authUser.email || '').toLowerCase().trim();

  // Super admin override
  if (cleanEmail === 'sciencehasara@gmail.com') {
    return {
      ...authUser,
      tenantId: 'system_admin',
      role: 'super_admin'
    };
  }

  if (isLiveFirebase) {
    try {
      // 1. Direct document check by uid
      const userRef = doc(db, 'users', authUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data()?.tenantId) {
        const tenantId = userSnap.data().tenantId;
        return {
          ...authUser,
          tenantId,
          name: userSnap.data().name || authUser.name || authUser.email?.split('@')[0] || 'Agent'
        };
      }

      // 2. Secondary lookup in users collection by email
      if (cleanEmail) {
        const usersQ = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const usersSnap = await getDocs(usersQ);
        if (!usersSnap.empty) {
          const matchedUser = usersSnap.docs[0].data();
          if (matchedUser.tenantId) {
            await setDoc(userRef, {
              uid: authUser.uid,
              email: cleanEmail,
              name: matchedUser.name || authUser.name || cleanEmail.split('@')[0],
              tenantId: matchedUser.tenantId,
              updatedAt: serverTimestamp()
            }, { merge: true });

            return {
              ...authUser,
              tenantId: matchedUser.tenantId,
              name: matchedUser.name || authUser.name || cleanEmail.split('@')[0]
            };
          }
        }

        // 3. Lookup in tenants collection by clientEmail
        const tenantsQ = query(collection(db, 'tenants'), where('clientEmail', '==', cleanEmail));
        const tenantsSnap = await getDocs(tenantsQ);
        if (!tenantsSnap.empty) {
          const matchedTenant = tenantsSnap.docs[0].data();
          const foundTenantId = matchedTenant.tenantId || tenantsSnap.docs[0].id;
          await setDoc(userRef, {
            uid: authUser.uid,
            email: cleanEmail,
            name: matchedTenant.name || cleanEmail.split('@')[0],
            tenantId: foundTenantId,
            role: 'client_admin',
            createdAt: serverTimestamp()
          }, { merge: true });

          return {
            ...authUser,
            tenantId: foundTenantId,
            name: matchedTenant.name || cleanEmail.split('@')[0]
          };
        }

        // 4. Pattern check if email is admin@<slug>.com or <slug>@...
        const emailSlug = cleanEmail.split('@')[0].replace(/^admin[_\.\-]?/, '');
        if (emailSlug) {
          const tenantRef = doc(db, 'tenants', emailSlug);
          const tenantSnap = await getDoc(tenantRef);
          if (tenantSnap.exists()) {
            await setDoc(userRef, {
              uid: authUser.uid,
              email: cleanEmail,
              name: tenantSnap.data().name || cleanEmail.split('@')[0],
              tenantId: emailSlug,
              role: 'client_admin',
              createdAt: serverTimestamp()
            }, { merge: true });

            return {
              ...authUser,
              tenantId: emailSlug
            };
          }
        }
      }

      // 5. Default fallback tenant 'usca_academy'
      const assignedTenantId = DEFAULT_TENANT_ID;
      await setDoc(userRef, {
        uid: authUser.uid,
        email: cleanEmail,
        name: authUser.name || cleanEmail.split('@')[0] || 'Agent',
        tenantId: assignedTenantId,
        createdAt: serverTimestamp()
      }, { merge: true });

      return {
        ...authUser,
        tenantId: assignedTenantId
      };
    } catch (err) {
      console.warn('Error in ensureUserTenant:', err);
    }
  }

  return {
    ...authUser,
    tenantId: DEFAULT_TENANT_ID
  };
}

// ----------------------------------------------------
// Realtime Contacts Subscription (Multi-Tenant)
// ----------------------------------------------------
export function subscribeToContacts(tenantId, callback) {
  if (typeof tenantId === 'function') {
    callback = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  tenantId = tenantId || DEFAULT_TENANT_ID;

  if (isLiveFirebase) {
    const q = query(collection(db, 'tenants', tenantId, 'contacts'), orderBy('lastMessageTimestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(contacts);
    }, (err) => {
      console.warn('Firestore tenant contacts subscription fallback to local store:', err);
      // Fallback to legacy root collection if tenant subcollection empty/error
      const legacyQ = query(collection(db, 'contacts'), orderBy('lastMessageTimestamp', 'desc'));
      return onSnapshot(legacyQ, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => callback(getStoredContacts()));
    });
  }

  // Demo Local Storage mode
  const handler = () => callback(getStoredContacts());
  eventHub.addEventListener('contacts_updated', handler);
  callback(getStoredContacts());

  return () => {
    eventHub.removeEventListener('contacts_updated', handler);
  };
}

// ----------------------------------------------------
// Realtime Messages Subscription for a specific phone (Multi-Tenant)
// ----------------------------------------------------
export function subscribeToMessages(tenantId, phone, callback) {
  if (typeof phone === 'function') {
    callback = phone;
    phone = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  tenantId = tenantId || DEFAULT_TENANT_ID;

  if (!phone) return () => {};

  if (isLiveFirebase) {
    const q = query(collection(db, 'tenants', tenantId, 'contacts', phone, 'messages'), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(msgs);
    }, (err) => {
      console.warn('Firestore tenant messages fallback to legacy root chats:', err);
      const legacyQ = query(collection(db, 'chats', phone, 'messages'), orderBy('timestamp', 'asc'));
      return onSnapshot(legacyQ, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => {
        const allMsgs = getStoredMessages();
        callback(allMsgs[phone] || []);
      });
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
// Send Outbound Message (Direct or Template, Multi-Tenant)
// ----------------------------------------------------
export async function sendOutboundMessage({ tenantId = DEFAULT_TENANT_ID, phone, body, type = 'text', templateName = null }) {
  const timestamp = Date.now();
  const messageId = `msg_out_${timestamp}_${Math.random().toString(36).substr(2, 4)}`;

  const newMsg = {
    id: messageId,
    tenantId,
    from: 'business',
    to: phone,
    type,
    body,
    templateName,
    status: 'sent', // initial status
    timestamp,
    direction: 'outbound'
  };

  // Dispatch outbound message to Render Backend API with tenantId
  try {
    fetch(`${BACKEND_URL}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
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
      // 1. Save to tenants/{tenantId}/contacts/{phone}/messages subcollection
      const tenantMsgRef = doc(db, 'tenants', tenantId, 'contacts', phone, 'messages', messageId);
      await setDoc(tenantMsgRef, {
        ...newMsg,
        timestamp: serverTimestamp()
      });

      // Update tenant contact summary
      const tenantContactRef = doc(db, 'tenants', tenantId, 'contacts', phone);
      await setDoc(tenantContactRef, {
        phone,
        lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
        lastMessageTimestamp: serverTimestamp(),
        unreadCount: 0
      }, { merge: true });

      // Fallback: Also save to legacy root collection for backwards compatibility
      const legacyMsgRef = doc(db, 'chats', phone, 'messages', messageId);
      await setDoc(legacyMsgRef, { ...newMsg, timestamp: serverTimestamp() }).catch(() => {});
      const legacyContactRef = doc(db, 'contacts', phone);
      await updateDoc(legacyContactRef, {
        lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
        lastMessageTimestamp: serverTimestamp(),
        unreadCount: 0
      }).catch(() => {});
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

  // Simulate delivery status sequence: sent -> delivered (1.5s) -> read (3.5s)
  setTimeout(() => {
    updateMessageStatus(tenantId, phone, messageId, 'delivered');
  }, 1500);

  setTimeout(() => {
    updateMessageStatus(tenantId, phone, messageId, 'read');
  }, 3500);

  return newMsg;
}

// ----------------------------------------------------
// Simulate Inbound Message (from Customer, Multi-Tenant)
// ----------------------------------------------------
export async function simulateInboundMessage({ tenantId = DEFAULT_TENANT_ID, phone, name, body, type = 'text', buttonPayload = null }) {
  const timestamp = Date.now();
  const messageId = `msg_in_${timestamp}_${Math.random().toString(36).substr(2, 4)}`;

  const newMsg = {
    id: messageId,
    tenantId,
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
    contact = {
      phone,
      name: name || `Customer ${phone.slice(-4)}`,
      lastMessage: body,
      lastMessageTimestamp: timestamp,
      unreadCount: 1,
      is24hActive: true,
      windowExpiry: timestamp + (24 * 60 * 60 * 1000),
      tags: ['New Lead', 'Inbound'],
      optedOut: false,
      notes: 'Auto-upserted from inbound WhatsApp message.'
    };
    contacts.unshift(contact);
  } else {
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
      const msgRef = doc(db, 'tenants', tenantId, 'contacts', phone, 'messages', messageId);
      await setDoc(msgRef, { ...newMsg, timestamp: serverTimestamp() });

      const contactRef = doc(db, 'tenants', tenantId, 'contacts', phone);
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
export function updateMessageStatus(tenantId = DEFAULT_TENANT_ID, phone, messageId, newStatus) {
  if (arguments.length === 3) {
    newStatus = messageId;
    messageId = phone;
    phone = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  tenantId = tenantId || DEFAULT_TENANT_ID;

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
      const msgRef = doc(db, 'tenants', tenantId, 'contacts', phone, 'messages', messageId);
      updateDoc(msgRef, { status: newStatus }).catch(() => {
        // Fallback root collection
        const legacyRef = doc(db, 'chats', phone, 'messages', messageId);
        updateDoc(legacyRef, { status: newStatus }).catch(() => {});
      });
    } catch (e) {}
  }
}

// ----------------------------------------------------
// Update Contact Details (Tags, Notes, 24h expiry trigger, etc.)
// ----------------------------------------------------
export function updateContact(tenantId = DEFAULT_TENANT_ID, phone, updateData) {
  if (typeof phone === 'object') {
    updateData = phone;
    phone = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  tenantId = tenantId || DEFAULT_TENANT_ID;

  const contacts = getStoredContacts();
  const idx = contacts.findIndex(c => c.phone === phone);
  if (idx !== -1) {
    contacts[idx] = { ...contacts[idx], ...updateData };
    saveStoredContacts(contacts);
  }

  if (isLiveFirebase) {
    try {
      const contactRef = doc(db, 'tenants', tenantId, 'contacts', phone);
      setDoc(contactRef, updateData, { merge: true }).catch(() => {
        const legacyRef = doc(db, 'contacts', phone);
        updateDoc(legacyRef, updateData).catch(() => {});
      });
    } catch (e) {}
  }
}

// Mark contact messages as read
export function markContactAsRead(tenantId = DEFAULT_TENANT_ID, phone) {
  if (!phone) {
    phone = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  updateContact(tenantId, phone, { unreadCount: 0 });
}

// Toggle 24-hour Session Window for testing
export function toggle24hWindow(tenantId = DEFAULT_TENANT_ID, phone, setActive) {
  if (typeof phone === 'boolean') {
    setActive = phone;
    phone = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  tenantId = tenantId || DEFAULT_TENANT_ID;

  const now = Date.now();
  const updateData = {
    is24hActive: setActive,
    windowExpiry: setActive ? now + (24 * 60 * 60 * 1000) : now - 1000
  };
  updateContact(tenantId, phone, updateData);
}

// ----------------------------------------------------
// Meta API Settings configuration per Tenant
// ----------------------------------------------------
export function saveMetaConfig(tenantId = DEFAULT_TENANT_ID, config) {
  if (typeof tenantId === 'object') {
    config = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  tenantId = tenantId || DEFAULT_TENANT_ID;

  localStorage.setItem(`${STORAGE_KEY_CONFIG}_${tenantId}`, JSON.stringify(config));
  
  if (isLiveFirebase) {
    try {
      setDoc(doc(db, 'tenants', tenantId), {
        ...config,
        tenantId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('Error saving tenant config to Firestore:', e);
    }
  }

  // Also sync to backend API endpoint /api/tenant-config
  try {
    fetch(`${BACKEND_URL}/api/tenant-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        phoneNumberId: config.phoneNumberId,
        wabaId: config.wabaId,
        permanentToken: config.accessToken || config.permanentToken,
        verifyToken: config.verifyToken,
        name: config.name || 'USCA Academy'
      })
    }).then(res => res.json()).then(data => {
      console.log('Backend tenant config saved:', data);
    }).catch(err => {
      console.warn('Backend tenant-config call error:', err);
    });
  } catch (e) {}

  eventHub.dispatchEvent(new CustomEvent('config_updated', { detail: { tenantId, config } }));
}

// ----------------------------------------------------
// Super Admin Tenant Provisioning & Management Helpers
// ----------------------------------------------------

export function subscribeToAllTenants(callback) {
  if (isLiveFirebase) {
    const q = query(collection(db, 'tenants'));
    return onSnapshot(q, (snapshot) => {
      let tenantsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (tenantsList.length === 0) {
        // Fallback default tenant
        tenantsList = [{
          id: DEFAULT_TENANT_ID,
          tenantId: DEFAULT_TENANT_ID,
          name: 'USCA Academy',
          phoneNumberId: import.meta.env.VITE_META_PHONE_NUMBER_ID || '1308538339013180',
          wabaId: import.meta.env.VITE_META_WABA_ID || '2126714',
          status: 'active',
          createdAt: Date.now()
        }];
      }
      callback(tenantsList);
    }, (err) => {
      console.warn('Error subscribing to all tenants:', err);
      callback([{
        id: DEFAULT_TENANT_ID,
        tenantId: DEFAULT_TENANT_ID,
        name: 'USCA Academy',
        phoneNumberId: '1308538339013180',
        wabaId: '2126714',
        status: 'active'
      }]);
    });
  }

  callback([{
    id: DEFAULT_TENANT_ID,
    tenantId: DEFAULT_TENANT_ID,
    name: 'USCA Academy',
    phoneNumberId: '1308538339013180',
    wabaId: '2126714',
    status: 'active'
  }]);

  return () => {};
}

export async function provisionNewTenant({
  name,
  tenantId,
  email,
  password,
  phoneNumberId,
  wabaId,
  permanentToken,
  verifyToken
}) {
  const cleanTenantId = (tenantId || name.toLowerCase().replace(/[^a-z0-9]/g, '_')).trim();
  const cleanEmail = (email || '').toLowerCase().trim();
  const activePhoneNumberId = phoneNumberId || import.meta.env.VITE_META_PHONE_NUMBER_ID || '1308538339013180';
  const activeWabaId = wabaId || import.meta.env.VITE_META_WABA_ID || '2126714';
  const activeVerifyToken = verifyToken || `verify_token_${cleanTenantId}_${Math.random().toString(36).substr(2, 6)}`;

  let createdUid = null;

  // 1. Create client auth user via secondary app instance to avoid logging out super admin
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getAuth, createUserWithEmailAndPassword, signOut } = await import('firebase/auth');

    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDJ8U0aXHg40bBZsU82vtg_KJuJIgWsZC4",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "whatsapp-crm-app-904e8.firebaseapp.com",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "whatsapp-crm-app-904e8",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "whatsapp-crm-app-904e8.firebasestorage.app",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "214685513606",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:214685513606:web:4d5fc5e67ff988351dde07"
    };

    const secondaryApp = getApps().find(a => a.name === 'SecondaryAdminProvision') || initializeApp(firebaseConfig, 'SecondaryAdminProvision');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      createdUid = userCred.user.uid;
      await signOut(secondaryAuth);
    } catch (authErr) {
      console.warn('Secondary auth creation message:', authErr);
      createdUid = `client_${cleanTenantId}_${Date.now()}`;
    }
  } catch (e) {
    console.warn('Secondary Firebase setup fallback:', e);
    createdUid = `client_${cleanTenantId}_${Date.now()}`;
  }

  // 2. Save Tenant configuration to Firestore tenants/{cleanTenantId}
  const tenantData = {
    tenantId: cleanTenantId,
    name,
    clientEmail: cleanEmail,
    phoneNumberId: activePhoneNumberId,
    wabaId: activeWabaId,
    permanentToken: permanentToken || '',
    verifyToken: activeVerifyToken,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (isLiveFirebase) {
    try {
      await setDoc(doc(db, 'tenants', cleanTenantId), tenantData, { merge: true });

      if (createdUid) {
        await setDoc(doc(db, 'users', createdUid), {
          uid: createdUid,
          email: cleanEmail,
          name,
          tenantId: cleanTenantId,
          role: 'client_admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (err) {
      console.error('Error writing provisioned tenant to Firestore:', err);
    }
  }

  // 3. Sync to Render Backend API
  try {
    fetch(`${BACKEND_URL}/api/tenant-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: cleanTenantId,
        phoneNumberId: activePhoneNumberId,
        wabaId: activeWabaId,
        permanentToken: permanentToken || '',
        verifyToken: activeVerifyToken,
        name
      })
    }).then(res => res.json()).then(data => {
      console.log('Backend registered new tenant:', data);
    }).catch(err => {
      console.warn('Backend call warning on provisioning:', err);
    });
  } catch (e) {}

  return {
    success: true,
    tenantId: cleanTenantId,
    email: cleanEmail,
    password,
    name,
    uid: createdUid,
    phoneNumberId: activePhoneNumberId,
    wabaId: activeWabaId,
    permanentToken: permanentToken || '',
    verifyToken: activeVerifyToken,
    webhookUrl: 'https://whatsapp-crm-backend-enzj.onrender.com/webhook',
    loginUrl: 'https://whatsapp-crm-app-904e8.web.app'
  };
}

export async function toggleTenantStatus(tenantId, isActive) {
  if (isLiveFirebase) {
    try {
      await updateDoc(doc(db, 'tenants', tenantId), {
        status: isActive ? 'active' : 'inactive',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Error toggling tenant status:', e);
    }
  }
}

export async function updateTenantConfig(tenantId, updateData) {
  if (isLiveFirebase) {
    try {
      await setDoc(doc(db, 'tenants', tenantId), {
        ...updateData,
        updatedAt: serverTimestamp()
      }, { merge: true });

      fetch(`${BACKEND_URL}/api/tenant-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          phoneNumberId: updateData.phoneNumberId,
          wabaId: updateData.wabaId,
          permanentToken: updateData.permanentToken || updateData.accessToken,
          verifyToken: updateData.verifyToken,
          name: updateData.name
        })
      }).catch(() => {});
    } catch (e) {
      console.warn('Error updating tenant config:', e);
    }
  }
}



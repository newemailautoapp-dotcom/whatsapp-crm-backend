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
// ----------------------------------------------------
// Realtime Contacts Subscription (Multi-Tenant)
// ----------------------------------------------------
export function subscribeToContacts(tenantId, callback) {
  if (typeof tenantId === 'function') {
    callback = tenantId;
    tenantId = DEFAULT_TENANT_ID;
  }
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;

  if (isLiveFirebase) {
    const q = query(collection(db, 'tenants', activeTenantId, 'contacts'), orderBy('lastMessageTimestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const contacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(contacts);
      } else {
        // Fallback to legacy root collection if tenant subcollection empty
        const legacyQ = query(collection(db, 'contacts'), orderBy('lastMessageTimestamp', 'desc'));
        getDocs(legacyQ).then((legacySnap) => {
          if (!legacySnap.empty) {
            callback(legacySnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } else {
            callback(getStoredContacts());
          }
        }).catch(() => callback(getStoredContacts()));
      }
    }, (err) => {
      console.warn('Firestore tenant contacts subscription fallback to local store:', err);
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
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;

  if (!phone) {
    callback([]);
    return () => {};
  }

  const rawPhone = String(phone).trim();
  const cleanPhone = rawPhone.replace(/^\+/, '');

  if (isLiveFirebase) {
    const parseTime = (t) => {
      if (!t) return 0;
      if (typeof t.toMillis === 'function') return t.toMillis();
      if (typeof t.seconds === 'number') return t.seconds * 1000;
      if (typeof t === 'number') return t;
      const parsed = new Date(t).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    const processSnapshot = (docs) => {
      return docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp));
    };

    // Query without orderBy constraint so Firestore never omits documents or throws index errors
    const primaryRef = collection(db, 'tenants', activeTenantId, 'contacts', cleanPhone, 'messages');
    
    let isFallbackActive = false;
    let fallbackUnsubscribe = null;

    const primaryUnsubscribe = onSnapshot(primaryRef, (snapshot) => {
      if (!snapshot.empty) {
        isFallbackActive = false;
        if (fallbackUnsubscribe) {
          fallbackUnsubscribe();
          fallbackUnsubscribe = null;
        }
        callback(processSnapshot(snapshot.docs));
        return;
      }

      // If cleanPhone collection has no messages, check alternate paths:
      // 1. chats/{cleanPhone}/messages (legacy root)
      // 2. tenants/{activeTenantId}/contacts/{rawPhone}/messages (if rawPhone has +)
      // 3. Local stored messages
      if (!isFallbackActive) {
        isFallbackActive = true;
        const legacyRef = collection(db, 'chats', cleanPhone, 'messages');
        fallbackUnsubscribe = onSnapshot(legacyRef, (legSnap) => {
          if (!legSnap.empty) {
            callback(processSnapshot(legSnap.docs));
          } else if (rawPhone !== cleanPhone) {
            const altRef = collection(db, 'tenants', activeTenantId, 'contacts', rawPhone, 'messages');
            getDocs(altRef).then(altSnap => {
              if (!altSnap.empty) {
                callback(processSnapshot(altSnap.docs));
              } else {
                const allMsgs = getStoredMessages();
                callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
              }
            }).catch(() => {
              const allMsgs = getStoredMessages();
              callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
            });
          } else {
            const allMsgs = getStoredMessages();
            callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
          }
        }, () => {
          const allMsgs = getStoredMessages();
          callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
        });
      } else {
        const allMsgs = getStoredMessages();
        callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
      }
    }, (err) => {
      console.warn('Firestore primary messages query error, trying legacy fallback:', err);
      const legacyRef = collection(db, 'chats', cleanPhone, 'messages');
      fallbackUnsubscribe = onSnapshot(legacyRef, (legSnap) => {
        callback(processSnapshot(legSnap.docs));
      }, () => {
        const allMsgs = getStoredMessages();
        callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
      });
    });

    return () => {
      if (primaryUnsubscribe) primaryUnsubscribe();
      if (fallbackUnsubscribe) fallbackUnsubscribe();
    };
  }

  // Local demo mode
  const handler = () => {
    const allMsgs = getStoredMessages();
    callback(allMsgs[cleanPhone] || allMsgs[rawPhone] || []);
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
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;
  const cleanPhone = String(phone).replace(/^\+/, '').trim();
  const timestamp = Date.now();
  const messageId = `msg_out_${timestamp}_${Math.random().toString(36).substr(2, 4)}`;

  const newMsg = {
    id: messageId,
    tenantId: activeTenantId,
    from: 'business',
    to: cleanPhone,
    type,
    body,
    templateName,
    status: 'sent', // initial status
    timestamp,
    direction: 'outbound'
  };

  // Dispatch outbound message to Render Backend API with activeTenantId
  try {
    fetch(`${BACKEND_URL}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: activeTenantId,
        phone: cleanPhone,
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
      // 1. Save to tenants/{tenantId}/contacts/{cleanPhone}/messages subcollection
      const tenantMsgRef = doc(db, 'tenants', activeTenantId, 'contacts', cleanPhone, 'messages', messageId);
      await setDoc(tenantMsgRef, {
        ...newMsg,
        timestamp: serverTimestamp()
      });

      // Update tenant contact summary
      const tenantContactRef = doc(db, 'tenants', activeTenantId, 'contacts', cleanPhone);
      await setDoc(tenantContactRef, {
        phone: cleanPhone,
        lastMessage: type === 'template' ? `[Template] ${templateName}` : body,
        lastMessageTimestamp: serverTimestamp(),
        unreadCount: 0
      }, { merge: true });

      // Fallback: Also save to legacy root collection for backwards compatibility
      const legacyMsgRef = doc(db, 'chats', cleanPhone, 'messages', messageId);
      await setDoc(legacyMsgRef, { ...newMsg, timestamp: serverTimestamp() }).catch(() => {});
      const legacyContactRef = doc(db, 'contacts', cleanPhone);
      await updateDoc(legacyContactRef, {
        phone: cleanPhone,
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
  allMsgs[cleanPhone] = [...(allMsgs[cleanPhone] || []), newMsg];
  saveStoredMessages(allMsgs);

  // Update contact summary
  const contacts = getStoredContacts();
  const idx = contacts.findIndex(c => c.phone === cleanPhone || c.phone === phone);
  if (idx !== -1) {
    contacts[idx] = {
      ...contacts[idx],
      phone: cleanPhone,
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
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;
  const cleanPhone = String(phone).replace(/^\+/, '').trim();
  const timestamp = Date.now();
  const messageId = `msg_in_${timestamp}_${Math.random().toString(36).substr(2, 4)}`;

  const newMsg = {
    id: messageId,
    tenantId: activeTenantId,
    from: cleanPhone,
    to: 'business',
    type,
    body,
    buttonPayload,
    status: 'read',
    timestamp,
    direction: 'inbound'
  };

  const contacts = getStoredContacts();
  let contact = contacts.find(c => c.phone === cleanPhone || c.phone === phone);

  if (!contact) {
    contact = {
      phone: cleanPhone,
      name: name || `Customer ${cleanPhone.slice(-4)}`,
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
  allMsgs[cleanPhone] = [...(allMsgs[cleanPhone] || []), newMsg];
  saveStoredMessages(allMsgs);

  if (isLiveFirebase) {
    try {
      const msgRef = doc(db, 'tenants', activeTenantId, 'contacts', cleanPhone, 'messages', messageId);
      await setDoc(msgRef, { ...newMsg, timestamp: serverTimestamp() });

      const contactRef = doc(db, 'tenants', activeTenantId, 'contacts', cleanPhone);
      await setDoc(contactRef, {
        name: contact.name,
        phone: cleanPhone,
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
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;
  const cleanPhone = String(phone).replace(/^\+/, '').trim();

  const allMsgs = getStoredMessages();
  if (allMsgs[cleanPhone]) {
    allMsgs[cleanPhone] = allMsgs[cleanPhone].map(m => {
      if (m.id === messageId) return { ...m, status: newStatus };
      return m;
    });
    saveStoredMessages(allMsgs);
  }

  if (isLiveFirebase) {
    try {
      const msgRef = doc(db, 'tenants', activeTenantId, 'contacts', cleanPhone, 'messages', messageId);
      updateDoc(msgRef, { status: newStatus }).catch(() => {
        // Fallback root collection
        const legacyRef = doc(db, 'chats', cleanPhone, 'messages', messageId);
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
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;
  const cleanPhone = String(phone).replace(/^\+/, '').trim();

  const contacts = getStoredContacts();
  const idx = contacts.findIndex(c => c.phone === cleanPhone || c.phone === phone);
  if (idx !== -1) {
    contacts[idx] = { ...contacts[idx], ...updateData };
    saveStoredContacts(contacts);
  }

  if (isLiveFirebase) {
    try {
      const contactRef = doc(db, 'tenants', activeTenantId, 'contacts', cleanPhone);
      setDoc(contactRef, updateData, { merge: true }).catch(() => {
        const legacyRef = doc(db, 'contacts', cleanPhone);
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
  const activeTenantId = (!tenantId || tenantId === 'system_admin') ? DEFAULT_TENANT_ID : tenantId;
  const cleanPhone = String(phone).replace(/^\+/, '').trim();

  const now = Date.now();
  const updateData = {
    is24hActive: setActive,
    windowExpiry: setActive ? now + (24 * 60 * 60 * 1000) : now - 1000
  };
  updateContact(activeTenantId, cleanPhone, updateData);
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



import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDJ8U0aXHg40bBZsU82vtg_KJuJIgWsZC4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "whatsapp-crm-app-904e8.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "whatsapp-crm-app-904e8",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "whatsapp-crm-app-904e8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "214685513606",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:214685513606:web:4d5fc5e67ff988351dde07",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-586HTEJEYS"
};

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://whatsapp-crm-backend-enzj.onrender.com";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;

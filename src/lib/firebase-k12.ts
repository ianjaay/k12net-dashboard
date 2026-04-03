import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * K12net Dashboard — New Firebase project configuration.
 *
 * Create a new Firebase project at https://console.firebase.google.com
 * and set these environment variables in your .env file:
 *
 *   VITE_K12_FIREBASE_API_KEY=...
 *   VITE_K12_FIREBASE_AUTH_DOMAIN=...
 *   VITE_K12_FIREBASE_PROJECT_ID=...
 *   VITE_K12_FIREBASE_STORAGE_BUCKET=...
 *   VITE_K12_FIREBASE_MESSAGING_SENDER_ID=...
 *   VITE_K12_FIREBASE_APP_ID=...
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_K12_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_K12_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_K12_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_K12_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_K12_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_K12_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_K12_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch(() => {
  // Fails if multiple tabs open — safe to ignore
});

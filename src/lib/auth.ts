import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider('microsoft.com');

// Demo account credentials
const DEMO_EMAIL = 'demo@emsp.ci';
const DEMO_PASSWORD = 'demo2024emsp';

export async function loginWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user);
  return cred;
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDoc(cred.user);
   return cred;
}

export async function loginWithMicrosoft() {
  const cred = await signInWithPopup(auth, microsoftProvider);
  await ensureUserDoc(cred.user);
  return cred;
}

export async function loginAsGuest() {
  const cred = await signInAnonymously(auth);
  return cred;
}

export async function loginAsDemo() {
  try {
    return await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
  } catch {
    // If demo account doesn't exist, create it
    const cred = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
    await updateProfile(cred.user, { displayName: 'Compte Démo' });
    await ensureUserDoc(cred.user);
    return cred;
  }
}

export async function logout() {
  return signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

async function ensureUserDoc(user: User) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email,
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? null,
      role: 'user',
      status: 'active',
      createdAt: serverTimestamp(),
    });
  } else {
    // Migrate existing docs that lack role/status fields
    const data = snap.data() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (!data.role) updates.role = 'user';
    if (!data.status) updates.status = 'active';
    if (Object.keys(updates).length > 0) {
      await updateDoc(ref, updates);
    }
  }
}

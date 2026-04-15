// ─── IndexedDB + Firebase Storage persistence for K12 session data ─────────
// K12AppData can be large (33 classes × ~50 students × subject grades),
// exceeding Firestore's 1MB doc limit. We use IndexedDB as a local cache
// and Firebase Storage as shared cloud storage for collaboration.
// Cloud reads use getBytes() to avoid CORS issues with getDownloadURL.

import { ref, uploadBytes, getBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import type { K12AppData } from '../types/k12';

const DB_NAME = 'k12net-sessions';
const DB_VERSION = 1;
const STORE_NAME = 'sessionData';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Local IndexedDB (cache) ────────────────────────────────────────────────

async function saveLocal(sessionId: string, data: K12AppData): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadLocal(sessionId: string): Promise<K12AppData | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(sessionId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteLocal(sessionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Firebase Storage (shared cloud) ────────────────────────────────────────

function cloudPath(sessionId: string): string {
  return `sessions/${sessionId}/k12data.json`;
}

async function saveCloud(sessionId: string, data: K12AppData): Promise<void> {
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const storageRef = ref(storage, cloudPath(sessionId));
  console.log('[sessionStorage] Uploading to cloud:', cloudPath(sessionId), 'size:', json.length);
  await uploadBytes(storageRef, blob);
  console.log('[sessionStorage] Upload completed for:', cloudPath(sessionId));
}

async function loadCloud(sessionId: string): Promise<K12AppData | null> {
  const storageRef = ref(storage, cloudPath(sessionId));
  console.log('[sessionStorage] Attempting cloud load from:', cloudPath(sessionId));

  // Strategy 1: getBytes (SDK direct, works without CORS but may fail on some setups)
  try {
    const bytes = await Promise.race([
      getBytes(storageRef),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getBytes timeout')), 15000)),
    ]);
    console.log('[sessionStorage] getBytes succeeded, bytes:', bytes.byteLength);
    const text = new TextDecoder().decode(bytes);
    return JSON.parse(text) as K12AppData;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[sessionStorage] getBytes failed, trying getDownloadURL fallback:', errMsg);
  }

  // Strategy 2: getDownloadURL + fetch (requires CORS but more reliable)
  try {
    const url = await getDownloadURL(storageRef);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log('[sessionStorage] getDownloadURL fallback succeeded');
    return data as K12AppData;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errCode = (err as { code?: string })?.code;
    console.error('[sessionStorage] Cloud load completely failed:', { code: errCode, message: errMsg });
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Save K12AppData to both local cache and cloud storage */
export async function saveSessionAppData(sessionId: string, data: K12AppData): Promise<void> {
  // Save locally first (fast)
  await saveLocal(sessionId, data);
  // Cloud upload — await so shared users can access it
  try {
    await saveCloud(sessionId, data);
    console.log('[sessionStorage] Cloud save succeeded');
  } catch (err) {
    console.error('[sessionStorage] Cloud save FAILED — shared users will not see this data:', err);
  }
}

/** Load K12AppData: local cache first, then cloud fallback.
 *  If data is found locally but not in cloud, syncs to cloud for shared users. */
export async function loadSessionAppData(sessionId: string): Promise<K12AppData | null> {
  // Try local cache first (instant)
  let local: K12AppData | null = null;
  try {
    local = await loadLocal(sessionId);
  } catch (err) {
    console.warn('[sessionStorage] Local load failed:', err);
  }

  if (local) {
    // Ensure cloud copy exists (async, non-blocking) so shared users can access it
    ensureCloudCopy(sessionId, local);
    return local;
  }

  // Fall back to cloud (shared sessions)
  console.log('[sessionStorage] No local data, trying cloud...');
  const cloud = await loadCloud(sessionId);
  if (cloud) {
    console.log('[sessionStorage] Loaded from cloud storage');
    // Cache locally for next time
    await saveLocal(sessionId, cloud).catch(() => {});
    return cloud;
  }

  console.log('[sessionStorage] No data found (local or cloud)');
  return null;
}

/** Ensure cloud copy exists — called when we have local data.
 *  Checks if cloud file exists; if not, uploads it. */
async function ensureCloudCopy(sessionId: string, data: K12AppData): Promise<void> {
  try {
    const storageRef = ref(storage, cloudPath(sessionId));
    // Quick check: try to get metadata (getDownloadURL is fast and tells us if file exists)
    await getDownloadURL(storageRef);
    // File exists, nothing to do
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'storage/object-not-found') {
      console.log('[sessionStorage] Cloud copy missing, uploading...');
      try {
        await saveCloud(sessionId, data);
        console.log('[sessionStorage] Cloud copy synced successfully');
      } catch (uploadErr) {
        console.error('[sessionStorage] Cloud sync failed:', uploadErr);
      }
    }
  }
}

/** Delete K12AppData from local cache only (cloud stays for shared users) */
export async function deleteSessionAppData(sessionId: string): Promise<void> {
  await deleteLocal(sessionId);
}

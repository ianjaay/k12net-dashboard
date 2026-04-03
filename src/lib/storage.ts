import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadFile(
  uid: string,
  sessionId: string,
  file: File,
  type: 'grade' | 'course',
): Promise<string> {
  const timestamp = Date.now();
  const path = `users/${uid}/sessions/${sessionId}/files/${type}_${timestamp}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function listSessionFiles(
  uid: string,
  sessionId: string,
): Promise<Array<{ name: string; fullPath: string }>> {
  const folderRef = ref(storage, `users/${uid}/sessions/${sessionId}/files`);
  try {
    const result = await listAll(folderRef);
    return result.items.map(item => ({
      name: item.name,
      fullPath: item.fullPath,
    }));
  } catch {
    return [];
  }
}

export async function getFileDownloadURL(fullPath: string): Promise<string> {
  return getDownloadURL(ref(storage, fullPath));
}

export async function deleteSessionFiles(uid: string, sessionId: string) {
  const folderRef = ref(storage, `users/${uid}/sessions/${sessionId}/files`);
  try {
    const result = await listAll(folderRef);
    await Promise.all(result.items.map(item => deleteObject(item)));
  } catch {
    // Folder may not exist — safe to ignore
  }
}

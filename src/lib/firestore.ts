import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc,
  query, where, orderBy, serverTimestamp, writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  SessionDoc, SessionRole, ClassDoc, SnapshotDoc,
  CourseStructure, CreditOverride, ClassInfo, TermConfig,
  UserProfile, AppRole, UserStatus,
} from '../types';
import type { GlobalAppSettings } from '../contexts/GlobalSettingsContext';

// ─── Global Settings ────────────────────────────────────────────────────────

const GLOBAL_SETTINGS_DOC = doc(db, 'globalSettings', 'default');

export async function loadGlobalSettings(): Promise<GlobalAppSettings | null> {
  const snap = await getDoc(GLOBAL_SETTINGS_DOC);
  if (!snap.exists()) return null;
  return snap.data() as GlobalAppSettings;
}

export async function saveGlobalSettings(settings: GlobalAppSettings): Promise<void> {
  await setDoc(GLOBAL_SETTINGS_DOC, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── Sessions CRUD ──────────────────────────────────────────────────────────

export async function createSession(uid: string, email: string, name: string, description: string): Promise<string> {
  const ref = await addDoc(collection(db, 'sessions'), {
    name,
    description,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ownerId: uid,
    members: { [uid]: 'owner' },
    memberEmails: [email],
    data: null,
  } satisfies Omit<SessionDoc, 'createdAt' | 'updatedAt'> & { createdAt: unknown; updatedAt: unknown });
  return ref.id;
}

export async function getUserSessions(uid: string, email: string): Promise<Array<{ id: string } & SessionDoc>> {
  // Query owned sessions
  const ownedQ = query(collection(db, 'sessions'), where('ownerId', '==', uid));
  // Query shared sessions by email
  const sharedQ = query(collection(db, 'sessions'), where('memberEmails', 'array-contains', email));

  const [ownedSnap, sharedSnap] = await Promise.all([getDocs(ownedQ), getDocs(sharedQ)]);

  const map = new Map<string, { id: string } & SessionDoc>();
  for (const s of [...ownedSnap.docs, ...sharedSnap.docs]) {
    if (!map.has(s.id)) {
      map.set(s.id, { id: s.id, ...(s.data() as SessionDoc) });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ta = (a.updatedAt as { seconds?: number })?.seconds ?? 0;
    const tb = (b.updatedAt as { seconds?: number })?.seconds ?? 0;
    return tb - ta;
  });
}

export async function getSession(sessionId: string): Promise<({ id: string } & SessionDoc) | null> {
  const snap = await getDoc(doc(db, 'sessions', sessionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as SessionDoc) };
}

export async function updateSession(sessionId: string, updates: Partial<Pick<SessionDoc, 'name' | 'description'>>) {
  await updateDoc(doc(db, 'sessions', sessionId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSession(sessionId: string) {
  // Delete subcollections first
  //const classesSnap = await getDocs(collection(db, 'sessions', sessionId, 'classes'));
  //const snapshotsSnap = await getDocs(collection(db, 'sessions', sessionId, 'snapshots'));

  const batch = writeBatch(db);
  //classesSnap.docs.forEach(d => batch.delete(d.ref));
  //snapshotsSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'sessions', sessionId));
  await batch.commit();
}

// ─── Class Data Operations ──────────────────────────────────────────────────

function classDocId(sheetName: string): string {
  return sheetName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
}

export async function saveSessionData(
  sessionId: string,
  courses: CourseStructure,
  creditOverrides: CreditOverride[],
  classes: ClassInfo[],
  termConfig?: TermConfig,
) {
  // Update session-level data
  const sessionData: Record<string, unknown> = { courses, creditOverrides };
  if (termConfig) sessionData.termConfig = termConfig;
  await updateDoc(doc(db, 'sessions', sessionId), {
    data: sessionData,
    updatedAt: serverTimestamp(),
  });

  // Delete existing classes
  const existingClasses = await getDocs(collection(db, 'sessions', sessionId, 'classes'));
  const batch = writeBatch(db);
  existingClasses.docs.forEach(d => batch.delete(d.ref));

  // Write new classes
  for (const cls of classes) {
    const classId = classDocId(cls.sheetName);
    const classDoc: ClassDoc = {
      sheetName: cls.sheetName,
      groupName: cls.groupName,
      niveau: cls.niveau,
      filiere: cls.filiere,
      semester: cls.semester,
      date: cls.date,
      level: cls.level,
      parsedExcel: cls.parsedExcel,
      students: cls.students,
    };
    batch.set(doc(db, 'sessions', sessionId, 'classes', classId), classDoc as unknown as DocumentData);
  }

  await batch.commit();
}

export async function loadSessionClasses(sessionId: string): Promise<ClassDoc[]> {
  const snap = await getDocs(collection(db, 'sessions', sessionId, 'classes'));
  return snap.docs.map(d => d.data() as ClassDoc);
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

export async function createSnapshot(sessionId: string, label?: string) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session not found');

  const classes = await loadSessionClasses(sessionId);

  const snapshotData: Omit<SnapshotDoc, 'createdAt'> & { createdAt: unknown } = {
    createdAt: serverTimestamp(),
    label: label ?? `Snapshot du ${new Date().toLocaleDateString('fr-FR')}`,
    data: {
      courses: session.data?.courses ?? null,
      classes,
      creditOverrides: session.data?.creditOverrides ?? [],
      termConfig: session.data?.termConfig,
    },
  };

  await addDoc(collection(db, 'sessions', sessionId, 'snapshots'), snapshotData);
}

export async function listSnapshots(sessionId: string): Promise<Array<{ id: string } & SnapshotDoc>> {
  const q = query(
    collection(db, 'sessions', sessionId, 'snapshots'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as SnapshotDoc) }));
}

export async function getSnapshot(sessionId: string, snapshotId: string): Promise<SnapshotDoc | null> {
  const snap = await getDoc(doc(db, 'sessions', sessionId, 'snapshots', snapshotId));
  if (!snap.exists()) return null;
  return snap.data() as SnapshotDoc;
}

export async function restoreSnapshot(sessionId: string, snapshotId: string) {
  // Create backup snapshot before restoring
  await createSnapshot(sessionId, 'Avant restauration');

  const snapshot = await getSnapshot(sessionId, snapshotId);
  if (!snapshot) throw new Error('Snapshot not found');

  // Restore session data
  await updateDoc(doc(db, 'sessions', sessionId), {
    data: {
      courses: snapshot.data.courses,
      creditOverrides: snapshot.data.creditOverrides,
      termConfig: snapshot.data.termConfig,
    },
    updatedAt: serverTimestamp(),
  });

  // Delete existing classes and write snapshot classes
  const existingClasses = await getDocs(collection(db, 'sessions', sessionId, 'classes'));
  const batch = writeBatch(db);
  existingClasses.docs.forEach(d => batch.delete(d.ref));

  for (const cls of snapshot.data.classes) {
    const classId = classDocId(cls.sheetName);
    batch.set(doc(db, 'sessions', sessionId, 'classes', classId), cls as unknown as DocumentData);
  }

  await batch.commit();
}

// ─── Sharing ────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<{ uid: string; displayName: string } | null> {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, displayName: (d.data() as { displayName: string }).displayName };
}

export async function shareSession(sessionId: string, targetEmail: string, role: SessionRole) {
  const user = await findUserByEmail(targetEmail);
  if (!user) throw new Error('Utilisateur non trouvé');

  const session = await getSession(sessionId);
  if (!session) throw new Error('Session non trouvée');

  const members = { ...session.members, [user.uid]: role };
  const memberEmails = [...new Set([...session.memberEmails, targetEmail])];

  await updateDoc(doc(db, 'sessions', sessionId), { members, memberEmails });
}

export async function removeSharing(sessionId: string, targetUid: string, targetEmail: string) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session non trouvée');

  const members = { ...session.members };
  delete members[targetUid];
  const memberEmails = session.memberEmails.filter(e => e !== targetEmail);

  await updateDoc(doc(db, 'sessions', sessionId), { members, memberEmails });
}

export async function updateRole(sessionId: string, targetUid: string, role: SessionRole) {
  const session = await getSession(sessionId);
  if (!session) throw new Error('Session non trouvée');

  await updateDoc(doc(db, 'sessions', sessionId), {
    [`members.${targetUid}`]: role,
  });
}

export async function getSessionMembers(sessionId: string): Promise<Array<{ uid: string; email: string; displayName: string; role: SessionRole }>> {
  const session = await getSession(sessionId);
  if (!session) return [];

  const members: Array<{ uid: string; email: string; displayName: string; role: SessionRole }> = [];
  for (const [uid, role] of Object.entries(session.members)) {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data() as { email: string; displayName: string };
      members.push({ uid, email: data.email, displayName: data.displayName, role });
    }
  }
  return members;
}

// ─── User Management ────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => {
    const data = d.data() as Omit<UserProfile, 'uid'>;
    return {
      uid: d.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      photoURL: data.photoURL ?? null,
      role: data.role ?? 'user',
      status: data.status ?? 'active',
      createdAt: data.createdAt,
      deleted: data.deleted ?? false,
      deletedAt: data.deletedAt,
    };
  }).filter(user => !user.deleted).sort((a, b) => {
    const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
    const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
    return ta - tb;
  });
}

export async function updateUserStatus(uid: string, status: UserStatus): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { status });
}

export async function updateUserAppRole(uid: string, role: AppRole): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role });
}

export async function createPendingUser(email: string, displayName: string): Promise<void> {
  // Check if a user with this email already exists
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Un utilisateur avec cet email existe déjà');

  // Create a placeholder doc in the users collection (will be linked on first login)
  const ref = doc(collection(db, 'users'));
  await setDoc(ref, {
    email,
    displayName,
    photoURL: null,
    role: 'user' as AppRole,
    status: 'pending' as UserStatus,
    createdAt: serverTimestamp(),
    pendingInvite: true,
  });
}

export async function deleteUserAccount(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('Utilisateur introuvable');

  const userData = userSnap.data() as UserProfile;
  const email = userData.email ?? '';

  const ownedSessionsSnap = await getDocs(query(collection(db, 'sessions'), where('ownerId', '==', uid)));
  if (!ownedSessionsSnap.empty) {
    throw new Error('Impossible de supprimer cet utilisateur : il possède encore une ou plusieurs sessions.');
  }

  const sharedSessionsSnap = email
    ? await getDocs(query(collection(db, 'sessions'), where('memberEmails', 'array-contains', email)))
    : await getDocs(collection(db, 'sessions'));

  const batch = writeBatch(db);

  sharedSessionsSnap.docs.forEach(sessionDoc => {
    const session = sessionDoc.data() as SessionDoc;
    const members = { ...session.members };
    delete members[uid];
    const memberEmails = session.memberEmails.filter(memberEmail => memberEmail !== email);
    batch.update(sessionDoc.ref, {
      members,
      memberEmails,
      updatedAt: serverTimestamp(),
    });
  });

  batch.update(userRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    status: 'suspended' as UserStatus,
    role: 'user' as AppRole,
  });

  await batch.commit();
}

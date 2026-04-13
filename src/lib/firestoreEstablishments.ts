import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, setDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Establishment,
  EstablishmentCreateData,
  EstablishmentUpdateData,
  EstablishmentMember,
  EstablishmentMemberData,
  EstablishmentRole,
} from '../types/establishment';

// ─── Collection references ──────────────────────────────────────────────────

const ESTABLISHMENTS_COL = 'establishments';

function membersCol(establishmentId: string) {
  return collection(db, ESTABLISHMENTS_COL, establishmentId, 'members');
}

// ─── Establishment CRUD ─────────────────────────────────────────────────────

export async function createEstablishment(
  data: EstablishmentCreateData,
  creatorUid: string,
  creatorEmail: string,
  creatorDisplayName: string,
): Promise<string> {
  const ref = await addDoc(collection(db, ESTABLISHMENTS_COL), {
    ...data,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Add creator as admin member
  await setDoc(doc(membersCol(ref.id), creatorUid), {
    uid: creatorUid,
    email: creatorEmail,
    displayName: creatorDisplayName,
    role: 'admin' as EstablishmentRole,
    joinedAt: serverTimestamp(),
  });

  // Add establishment to creator's profile
  const userRef = doc(db, 'users', creatorUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const establishments: string[] = userData.establishments ?? [];
    if (!establishments.includes(ref.id)) {
      await updateDoc(userRef, { establishments: [...establishments, ref.id] });
    }
  }

  return ref.id;
}

export async function getEstablishment(id: string): Promise<Establishment | null> {
  const snap = await getDoc(doc(db, ESTABLISHMENTS_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Establishment;
}

export async function updateEstablishment(id: string, data: EstablishmentUpdateData): Promise<void> {
  await updateDoc(doc(db, ESTABLISHMENTS_COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEstablishment(id: string): Promise<void> {
  // Remove members subcollection
  const membersSnap = await getDocs(membersCol(id));
  const batch = writeBatch(db);

  // Remove establishment from each member's profile
  for (const memberDoc of membersSnap.docs) {
    const memberData = memberDoc.data() as EstablishmentMember;
    const userRef = doc(db, 'users', memberData.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const establishments: string[] = (userData.establishments ?? []).filter((eid: string) => eid !== id);
      batch.update(userRef, { establishments });
    }
    batch.delete(memberDoc.ref);
  }

  batch.delete(doc(db, ESTABLISHMENTS_COL, id));
  await batch.commit();
}

export async function listAllEstablishments(): Promise<Establishment[]> {
  const snap = await getDocs(collection(db, ESTABLISHMENTS_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Establishment));
}

export async function listUserEstablishments(uid: string): Promise<Establishment[]> {
  // Get establishment IDs from user profile
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return [];

  const userData = userSnap.data();
  const establishmentIds: string[] = userData.establishments ?? [];

  // Also check all establishments for membership (in case user profile is out of sync)
  const allEstSnap = await getDocs(collection(db, ESTABLISHMENTS_COL));
  const memberEstIds = new Set(establishmentIds);

  const memberChecks = allEstSnap.docs.map(async (estDoc) => {
    if (memberEstIds.has(estDoc.id)) return;
    const memberSnap = await getDoc(doc(db, ESTABLISHMENTS_COL, estDoc.id, 'members', uid));
    if (memberSnap.exists()) {
      memberEstIds.add(estDoc.id);
    }
  });
  await Promise.all(memberChecks);

  if (memberEstIds.size === 0) return [];

  // Sync back to user profile if we found extra memberships
  if (memberEstIds.size > establishmentIds.length) {
    const allIds = [...memberEstIds];
    updateDoc(doc(db, 'users', uid), { establishments: allIds }).catch(() => {});
  }

  // Fetch each establishment
  const results: Establishment[] = [];
  for (const eid of memberEstIds) {
    const cached = allEstSnap.docs.find(d => d.id === eid);
    if (cached) {
      results.push({ id: cached.id, ...cached.data() } as Establishment);
    } else {
      const est = await getEstablishment(eid);
      if (est) results.push(est);
    }
  }
  return results;
}

// ─── Members Management ─────────────────────────────────────────────────────

export async function addEstablishmentMember(
  establishmentId: string,
  member: EstablishmentMemberData,
): Promise<void> {
  const normalizedMember = { ...member, email: member.email.toLowerCase().trim() };
  await setDoc(doc(membersCol(establishmentId), member.uid), {
    ...normalizedMember,
    joinedAt: serverTimestamp(),
  });

  // Add establishment to user's profile
  const userRef = doc(db, 'users', member.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const establishments: string[] = userData.establishments ?? [];
    if (!establishments.includes(establishmentId)) {
      await updateDoc(userRef, { establishments: [...establishments, establishmentId] });
    }
  }
}

export async function removeEstablishmentMember(
  establishmentId: string,
  uid: string,
): Promise<void> {
  await deleteDoc(doc(membersCol(establishmentId), uid));

  // Remove establishment from user's profile
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    const establishments: string[] = (userData.establishments ?? []).filter((eid: string) => eid !== establishmentId);
    await updateDoc(userRef, { establishments });
  }
}

export async function updateMemberRole(
  establishmentId: string,
  uid: string,
  role: EstablishmentRole,
): Promise<void> {
  await updateDoc(doc(membersCol(establishmentId), uid), { role });
}

export async function listEstablishmentMembers(
  establishmentId: string,
): Promise<EstablishmentMember[]> {
  const snap = await getDocs(membersCol(establishmentId));
  return snap.docs.map(d => d.data() as EstablishmentMember);
}

export async function getEstablishmentMember(
  establishmentId: string,
  uid: string,
): Promise<EstablishmentMember | null> {
  const snap = await getDoc(doc(membersCol(establishmentId), uid));
  if (!snap.exists()) return null;
  return snap.data() as EstablishmentMember;
}

// ─── User establishment role helper ─────────────────────────────────────────

export async function getUserRoleInEstablishment(
  establishmentId: string,
  uid: string,
): Promise<EstablishmentRole | null> {
  const member = await getEstablishmentMember(establishmentId, uid);
  return member?.role ?? null;
}

// ─── Session helpers (establishment-scoped) ─────────────────────────────────

export async function getEstablishmentSessions(
  establishmentId: string,
  uid: string,
  email: string,
): Promise<string[]> {
  // Sessions for this establishment that the user can access
  const q1 = query(
    collection(db, 'sessions'),
    where('establishmentId', '==', establishmentId),
    where('ownerId', '==', uid),
  );
  const q2 = query(
    collection(db, 'sessions'),
    where('establishmentId', '==', establishmentId),
    where('memberEmails', 'array-contains', email),
  );

  const [owned, shared] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const ids = new Set<string>();
  for (const d of [...owned.docs, ...shared.docs]) {
    ids.add(d.id);
  }
  return [...ids];
}

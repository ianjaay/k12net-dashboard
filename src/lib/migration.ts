/**
 * Migration script: Convert single-tenant data to multi-establishment structure.
 * 
 * This script:
 * 1. Reads globalSettings/default
 * 2. Creates a default establishment with those settings
 * 3. Links all existing sessions to the default establishment
 * 4. Assigns all existing users to the default establishment
 * 5. Sets the first admin user as super-admin
 * 
 * Run from browser console or as a one-time admin action.
 */

import {
  collection, doc, getDocs, getDoc, updateDoc, setDoc,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createEstablishment } from '../lib/firestoreEstablishments';
import type { EstablishmentCreateData } from '../types/establishment';

export async function migrateToMultiEstablishment(): Promise<{ establishmentId: string; usersUpdated: number; sessionsUpdated: number }> {
  console.log('[Migration] Starting multi-establishment migration...');

  // 1. Read globalSettings/default
  const settingsSnap = await getDoc(doc(db, 'globalSettings', 'default'));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};

  // 2. Find a super-admin (first admin user, or first user)
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const adminUser = users.find((u: Record<string, unknown>) => u.role === 'admin' || u.role === 'super-admin')
    || users[0];

  if (!adminUser) {
    throw new Error('[Migration] No users found. Cannot create establishment without a creator.');
  }

  // 3. Create default establishment
  const estData: EstablishmentCreateData = {
    name: (settings.schoolName as string) || 'Établissement par défaut',
    code: 'DEFAULT',
    type: 'college-lycee',
    cycle: 'both',
    logo: settings.logo as string | undefined,
    schoolName: settings.schoolName as string | undefined,
    photoBaseUrl: settings.photoBaseUrl as string | undefined,
    academicYear: settings.academicYear as EstablishmentCreateData['academicYear'],
    rulesConfig: settings.rulesConfig as EstablishmentCreateData['rulesConfig'],
    yearConfigs: settings.yearConfigs as EstablishmentCreateData['yearConfigs'],
    courseCatalog: settings.courseCatalog as EstablishmentCreateData['courseCatalog'],
    createdBy: adminUser.uid,
  };

  const establishmentId = await createEstablishment(
    estData,
    adminUser.uid,
    (adminUser as Record<string, unknown>).email as string || '',
    (adminUser as Record<string, unknown>).displayName as string || '',
  );
  console.log(`[Migration] Created establishment: ${establishmentId}`);

  // 4. Add all users to the establishment and update their profiles
  let usersUpdated = 0;
  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const batch = writeBatch(db);

    // Add as member of default establishment
    const memberRef = doc(db, 'establishments', establishmentId, 'members', userDoc.id);
    batch.set(memberRef, {
      uid: userDoc.id,
      email: userData.email || '',
      displayName: userData.displayName || '',
      role: (userData.role === 'admin' || userData.role === 'super-admin') ? 'admin' : 'user',
      joinedAt: serverTimestamp(),
    });

    // Update user profile
    const updates: Record<string, unknown> = {
      establishments: [establishmentId],
      currentEstablishment: establishmentId,
    };

    // Promote the first admin to super-admin
    if (userDoc.id === adminUser.uid) {
      updates.role = 'super-admin';
    }

    batch.update(doc(db, 'users', userDoc.id), updates);
    await batch.commit();
    usersUpdated++;
  }
  console.log(`[Migration] Updated ${usersUpdated} users`);

  // 5. Link all sessions to the default establishment
  const sessionsSnap = await getDocs(collection(db, 'sessions'));
  let sessionsUpdated = 0;
  for (const sessionDoc of sessionsSnap.docs) {
    const data = sessionDoc.data();
    if (!data.establishmentId) {
      await updateDoc(doc(db, 'sessions', sessionDoc.id), {
        establishmentId,
      });
      sessionsUpdated++;
    }
  }
  console.log(`[Migration] Updated ${sessionsUpdated} sessions`);

  // 6. Mark migration as complete in globalSettings
  await setDoc(doc(db, 'globalSettings', 'default'), {
    migratedToMultiEstablishment: true,
    migrationDate: serverTimestamp(),
    defaultEstablishmentId: establishmentId,
  }, { merge: true });

  console.log('[Migration] Complete!');
  return { establishmentId, usersUpdated, sessionsUpdated };
}

/** Check if migration has been performed */
export async function isMigrationDone(): Promise<boolean> {
  const snap = await getDoc(doc(db, 'globalSettings', 'default'));
  if (!snap.exists()) return false;
  return snap.data().migratedToMultiEstablishment === true;
}

/**
 * Student enrichment: fetches personal info (date de naissance, sexe, nationalité)
 * from a OneRoster API and merges it into K12Student records.
 *
 * Flow:
 * 1. Load API config from IndexedDB
 * 2. Create OneRosterService instance
 * 3. Fetch all students from the configured school
 * 4. Match by matricule (identifier) and enrich K12Student fields
 */
import { OneRosterService } from './oneRosterService';
import { getApiConfig } from './educationDB';
import type { OneRosterUser } from '../types/oneRoster';
import type { K12Student, K12AppData } from '../types/k12';

/** Enrich K12AppData students with personal info from the OneRoster API.
 *  Returns the enriched data (same reference mutated for performance). */
export async function enrichStudentsFromApi(
  data: K12AppData,
  schoolId?: string,
): Promise<{ enriched: number; total: number; error?: string }> {
  const config = await getApiConfig();
  if (!config) {
    return { enriched: 0, total: data.students.length, error: 'Aucune configuration API trouvée. Configurez l\'API OneRoster dans le module multi-niveaux.' };
  }

  const service = new OneRosterService(config);

  // Test connection
  const test = await service.testConnection();
  if (!test.success) {
    return { enriched: 0, total: data.students.length, error: `Connexion API échouée: ${test.error}` };
  }

  // Get school ID — try to find the right school
  let apiStudents: OneRosterUser[];
  try {
    if (schoolId) {
      apiStudents = await service.getStudentsBySchool(schoolId);
    } else {
      // Try to find the school from available schools
      const schools = await service.getSchools();
      if (schools.length === 0) {
        return { enriched: 0, total: data.students.length, error: 'Aucun établissement trouvé via l\'API.' };
      }
      // Fetch students from all schools and merge
      apiStudents = [];
      for (const school of schools) {
        try {
          const students = await service.getStudentsBySchool(school.sourcedId);
          apiStudents.push(...students);
        } catch {
          console.warn(`[enrichment] Failed to fetch students from school ${school.name}`);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { enriched: 0, total: data.students.length, error: `Erreur lors de la récupération des élèves: ${msg}` };
  }

  if (apiStudents.length === 0) {
    return { enriched: 0, total: data.students.length, error: 'Aucun élève trouvé via l\'API.' };
  }

  // Build lookup map by identifier (matricule)
  const byMatricule = new Map<string, OneRosterUser>();
  for (const u of apiStudents) {
    const key = (u.identifier || u.username || '').trim();
    if (key) byMatricule.set(key, u);
  }

  // Also build by full name as fallback
  const byName = new Map<string, OneRosterUser>();
  for (const u of apiStudents) {
    const key = `${u.familyName} ${u.givenName}`.trim().toLowerCase();
    if (key) byName.set(key, u);
  }

  // Enrich each student
  let enriched = 0;
  const allStudents = data.students;
  for (const student of allStudents) {
    const match = byMatricule.get(student.matricule.trim())
      ?? byName.get(student.fullName.trim().toLowerCase());

    if (match) {
      applyPersonalInfo(student, match);
      enriched++;
    }
  }

  // Also update students inside classes
  for (const cls of data.classes) {
    for (const student of cls.students) {
      const match = byMatricule.get(student.matricule.trim())
        ?? byName.get(student.fullName.trim().toLowerCase());
      if (match) {
        applyPersonalInfo(student, match);
      }
    }
  }

  console.log(`[enrichment] Enriched ${enriched}/${allStudents.length} students from API`);
  return { enriched, total: allStudents.length };
}

function applyPersonalInfo(student: K12Student, apiUser: OneRosterUser): void {
  // identifier is the matricule — use the API version if more reliable
  if (apiUser.identifier && !student.matricule) {
    student.matricule = apiUser.identifier;
  }

  // OneRoster doesn't have dateNaissance/sexe directly in the standard fields,
  // but K12net's implementation may include them as extensions.
  // We extract what's available from the user metadata.
  const meta = apiUser as unknown as Record<string, unknown>;

  // K12net extensions (common field names used by K12net API)
  if (meta.birthDate || meta.dateOfBirth) {
    student.dateNaissance = String(meta.birthDate || meta.dateOfBirth);
  }
  if (meta.sex || meta.gender) {
    const raw = String(meta.sex || meta.gender).toLowerCase();
    student.sexe = raw.startsWith('f') ? 'Féminin' : 'Masculin';
  }
  if (meta.nationality) {
    student.nationalite = String(meta.nationality);
  }
  if (meta.birthPlace || meta.placeOfBirth) {
    student.lieuNaissance = String(meta.birthPlace || meta.placeOfBirth);
  }

  // Also check metadata/userProfiles extensions (OneRoster v1.1)
  const profiles = meta.userProfiles as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(profiles)) {
    for (const profile of profiles) {
      const creds = profile.credentials as Record<string, unknown> | undefined;
      if (creds?.birthDate && !student.dateNaissance) {
        student.dateNaissance = String(creds.birthDate);
      }
    }
  }
}

/** Check if the OneRoster API is configured */
export async function isApiConfigured(): Promise<boolean> {
  const config = await getApiConfig();
  return !!config?.baseUrl && !!config?.clientId;
}

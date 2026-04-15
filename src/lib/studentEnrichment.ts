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
import { getApiConfig, getElevesByEtablissement, getAllEtablissements } from './educationDB';
import type { OneRosterUser } from '../types/oneRoster';
import type { K12Student, K12AppData } from '../types/k12';
import type { EleveML } from '../types/multiLevel';

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

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL DB ENRICHMENT — use synced educationDB data (no API call needed)
// ═══════════════════════════════════════════════════════════════════════════

/** Normalize a class name for comparison: strip accents, uppercase, collapse whitespace.
 *  e.g. "1ère A2" → "1ere a2", "1ERE  A2" → "1ere a2" */
function normalizeClassName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Returns true if the matricule looks like a rank-based placeholder ("0", "1", "23") */
function isPlaceholderMatricule(mat: string): boolean {
  return !mat || /^\d{1,3}$/.test(mat.trim());
}

/**
 * Enrich K12AppData students from locally synced data in educationDB.
 * This is faster and works offline — uses the data already synced via SuperAdmin.
 */
export async function enrichStudentsFromLocalDB(
  data: K12AppData,
): Promise<{ enriched: number; total: number; error?: string }> {
  // Gather all synced students from all establishments
  let allEleves: EleveML[] = [];
  try {
    const etablissements = await getAllEtablissements();
    if (etablissements.length === 0) {
      return { enriched: 0, total: data.students.length, error: 'Aucun établissement synchronisé.' };
    }
    const results = await Promise.all(
      etablissements.map(e => getElevesByEtablissement(e.id)),
    );
    allEleves = results.flat();
  } catch (err) {
    return { enriched: 0, total: data.students.length, error: `Erreur lecture BD: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (allEleves.length === 0) {
    return { enriched: 0, total: data.students.length, error: 'Aucun élève synchronisé. Synchronisez d\'abord les données dans Super Admin.' };
  }

  // Build lookup maps
  const byMatricule = new Map<string, EleveML>();
  // Name-based maps use composite key "name|normalizedClass" for same-class verification
  const byNameAndClass = new Map<string, EleveML>();
  const byNormalizedAndClass = new Map<string, EleveML>();
  for (const e of allEleves) {
    const mat = (e.matricule || '').trim();
    if (mat) byMatricule.set(mat, e);
    const cls = normalizeClassName(e.salle_de_classe || '');
    // "NOM PRENOM|classe" and "PRENOM NOM|classe"
    const name = `${e.nom} ${e.prenom}`.trim().toLowerCase();
    if (name && cls) {
      byNameAndClass.set(`${name}|${cls}`, e);
      byNameAndClass.set(`${e.prenom} ${e.nom}`.trim().toLowerCase() + `|${cls}`, e);
    }
    // Normalized (order-independent): sorted parts + class
    const normalized = `${e.nom} ${e.prenom}`.trim().toLowerCase().split(/\s+/).sort().join(' ');
    if (normalized && cls) byNormalizedAndClass.set(`${normalized}|${cls}`, e);
  }

  // Enrich each student
  let enriched = 0;

  function tryEnrich(student: K12Student): boolean {
    // 1. By matricule (exact — unique, no class check needed)
    // Skip placeholder matricules (rank-based "0", "1", etc.)
    if (student.matricule.trim() && !isPlaceholderMatricule(student.matricule)) {
      const match = byMatricule.get(student.matricule.trim());
      if (match) { applyLocalInfo(student, match); return true; }
    }
    // 2. By full name + same class (normalized class name for accent-insensitive matching)
    const fullLower = student.fullName.trim().toLowerCase();
    const clsNorm = normalizeClassName(student.className || '');
    if (clsNorm) {
      const matchName = byNameAndClass.get(`${fullLower}|${clsNorm}`)
        ?? byNameAndClass.get(`${student.lastName} ${student.firstName}`.trim().toLowerCase() + `|${clsNorm}`);
      if (matchName) { applyLocalInfo(student, matchName); return true; }
      // 3. By normalized name + same class (order-independent)
      const normalizedStudent = fullLower.split(/\s+/).sort().join(' ');
      const matchNorm = byNormalizedAndClass.get(`${normalizedStudent}|${clsNorm}`);
      if (matchNorm) { applyLocalInfo(student, matchNorm); return true; }
    }
    return false;
  }

  for (const student of data.students) {
    if (tryEnrich(student)) enriched++;
  }

  // Also update students inside classes
  for (const cls of data.classes) {
    for (const student of cls.students) {
      tryEnrich(student);
    }
  }

  console.log(`[enrichment] Enriched ${enriched}/${data.students.length} students from local DB`);
  return { enriched, total: data.students.length };
}

function applyLocalInfo(student: K12Student, eleve: EleveML): void {
  // Replace matricule if the student has none or a rank-based placeholder ("0", "1", etc.)
  if (eleve.matricule && isPlaceholderMatricule(student.matricule)) {
    student.matricule = eleve.matricule;
  }
  if (eleve.date_naissance && !student.dateNaissance) {
    student.dateNaissance = eleve.date_naissance;
  }
  if (eleve.sexe && !student.sexe) {
    student.sexe = eleve.sexe as 'Masculin' | 'Féminin';
  }
  if (eleve.nationalite && !student.nationalite) {
    student.nationalite = eleve.nationalite;
  }
  if (eleve.lieu_naissance && !student.lieuNaissance) {
    student.lieuNaissance = eleve.lieu_naissance;
  }
}

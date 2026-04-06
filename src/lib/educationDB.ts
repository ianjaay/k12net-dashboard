/**
 * IndexedDB store using Dexie.js for multi-level education data.
 *
 * v1: Base tables (drenas, etablissements, classes, eleves, resultats, imports)
 * v2: + api_config, sync_logs, enseignants, enrollments (OneRoster support)
 */
import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
  DRENA,
  Etablissement,
  ClasseML,
  EleveML,
  Enseignant,
  EnrollmentML,
  ResultatTrimestre,
  NoteDiscipline,
  StatsClasse,
  AnneeScolaire,
  ImportLog,
} from '../types/multiLevel';
import type { OneRosterApiConfig, SyncLog } from '../types/oneRoster';
import { DRENA_PRECHARGES, MINISTERE_DEFAULT } from '../types/multiLevel';

class EducationDB extends Dexie {
  annees_scolaires!: Table<AnneeScolaire, string>;
  drenas!: Table<DRENA, string>;
  etablissements!: Table<Etablissement, string>;
  classes!: Table<ClasseML, string>;
  eleves!: Table<EleveML, string>;
  enseignants!: Table<Enseignant, string>;
  enrollments!: Table<EnrollmentML, string>;
  resultats_trimestre!: Table<ResultatTrimestre, string>;
  notes_discipline!: Table<NoteDiscipline, string>;
  stats_classe!: Table<StatsClasse, string>;
  imports!: Table<ImportLog, string>;
  api_config!: Table<OneRosterApiConfig, string>;
  sync_logs!: Table<SyncLog, string>;

  constructor() {
    super('EducationDashboard');

    this.version(1).stores({
      annees_scolaires: 'id, libelle, active',
      drenas: 'id, code, nom',
      etablissements: 'id, code, nom, drena_id',
      classes: 'id, nom, etablissement_id, annee_scolaire, niveau',
      eleves: 'id, matricule, nom, classe_id, etablissement_id, annee_scolaire, salle_de_classe',
      resultats_trimestre: 'id, eleve_id, trimestre, annee_scolaire',
      notes_discipline: 'id, eleve_id, trimestre, annee_scolaire, discipline',
      stats_classe: 'id, classe_id, trimestre, annee_scolaire',
      imports: 'id, date_import, type_import, etablissement_id, annee_scolaire',
    });

    this.version(2).stores({
      annees_scolaires: 'id, libelle, active',
      drenas: 'id, code, nom',
      etablissements: 'id, code, nom, drena_id',
      classes: 'id, nom, etablissement_id, annee_scolaire, niveau',
      eleves: 'id, matricule, nom, classe_id, etablissement_id, annee_scolaire, salle_de_classe',
      enseignants: 'id, matricule, nom, etablissement_id',
      enrollments: 'id, user_id, class_id, role',
      resultats_trimestre: 'id, eleve_id, trimestre, annee_scolaire',
      notes_discipline: 'id, eleve_id, trimestre, annee_scolaire, discipline',
      stats_classe: 'id, classe_id, trimestre, annee_scolaire',
      imports: 'id, date_import, type_import, etablissement_id, annee_scolaire',
      api_config: 'id',
      sync_logs: 'id, date, type, statut',
    });
  }
}

export const db = new EducationDB();

// ═══════════════════════════════════════════════════════════════════════════
// SEED / INIT
// ═══════════════════════════════════════════════════════════════════════════

/** Seed the database with pre-loaded DRENA list (idempotent). */
export async function seedDRENAs(): Promise<void> {
  const existing = await db.drenas.count();
  if (existing > 0) return;

  const drenas: DRENA[] = DRENA_PRECHARGES.map(d => ({
    ...d,
    ministere_id: MINISTERE_DEFAULT.id,
  }));
  await db.drenas.bulkPut(drenas);
}

/** Ensure a default academic year exists. */
export async function ensureDefaultYear(year: string): Promise<void> {
  const y = parseInt(year, 10);
  const id = year;
  const existing = await db.annees_scolaires.get(id);
  if (existing) return;

  await db.annees_scolaires.put({
    id,
    libelle: `${y}-${y + 1}`,
    debut: `${y}-09-01`,
    fin: `${y + 1}-07-31`,
    active: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DRENA QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllDRENAs(): Promise<DRENA[]> {
  return db.drenas.orderBy('nom').toArray();
}

export async function getDRENA(id: string): Promise<DRENA | undefined> {
  return db.drenas.get(id);
}

// ═══════════════════════════════════════════════════════════════════════════
// ETABLISSEMENT QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export async function getEtablissementsByDRENA(drena_id: string): Promise<Etablissement[]> {
  return db.etablissements.where('drena_id').equals(drena_id).toArray();
}

export async function getEtablissement(id: string): Promise<Etablissement | undefined> {
  return db.etablissements.get(id);
}

export async function getAllEtablissements(): Promise<Etablissement[]> {
  return db.etablissements.orderBy('nom').toArray();
}

export async function saveEtablissements(etabs: Etablissement[]): Promise<void> {
  await db.etablissements.bulkPut(etabs);
}

// ═══════════════════════════════════════════════════════════════════════════
// CLASSE QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export async function getClassesByEtablissement(
  etablissement_id: string,
  annee_scolaire?: string,
): Promise<ClasseML[]> {
  let query = db.classes.where('etablissement_id').equals(etablissement_id);
  const all = await query.toArray();
  if (annee_scolaire) return all.filter(c => c.annee_scolaire === annee_scolaire);
  return all;
}

export async function getClasse(id: string): Promise<ClasseML | undefined> {
  return db.classes.get(id);
}

export async function saveClasses(classes: ClasseML[]): Promise<void> {
  await db.classes.bulkPut(classes);
}

// ═══════════════════════════════════════════════════════════════════════════
// ELEVE QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export async function getElevesByClasse(classe_id: string): Promise<EleveML[]> {
  return db.eleves.where('classe_id').equals(classe_id).toArray();
}

export async function getElevesByEtablissement(
  etablissement_id: string,
  annee_scolaire?: string,
): Promise<EleveML[]> {
  const all = await db.eleves.where('etablissement_id').equals(etablissement_id).toArray();
  if (annee_scolaire) return all.filter(e => e.annee_scolaire === annee_scolaire);
  return all;
}

export async function getEleve(id: string): Promise<EleveML | undefined> {
  return db.eleves.get(id);
}

export async function saveEleves(eleves: EleveML[]): Promise<void> {
  await db.eleves.bulkPut(eleves);
}

// ═══════════════════════════════════════════════════════════════════════════
// RESULTATS
// ═══════════════════════════════════════════════════════════════════════════

export async function getResultatsByEleve(eleve_id: string): Promise<ResultatTrimestre[]> {
  return db.resultats_trimestre.where('eleve_id').equals(eleve_id).toArray();
}

export async function saveResultats(resultats: ResultatTrimestre[]): Promise<void> {
  await db.resultats_trimestre.bulkPut(resultats);
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS CLASSE
// ═══════════════════════════════════════════════════════════════════════════

export async function getStatsClasse(
  classe_id: string,
  annee_scolaire?: string,
): Promise<StatsClasse[]> {
  const all = await db.stats_classe.where('classe_id').equals(classe_id).toArray();
  if (annee_scolaire) return all.filter(s => s.annee_scolaire === annee_scolaire);
  return all;
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT LOG
// ═══════════════════════════════════════════════════════════════════════════

export async function addImportLog(log: ImportLog): Promise<void> {
  await db.imports.put(log);
}

export async function getImportLogs(
  etablissement_id?: string,
  annee_scolaire?: string,
): Promise<ImportLog[]> {
  let all = await db.imports.orderBy('date_import').reverse().toArray();
  if (etablissement_id) all = all.filter(l => l.etablissement_id === etablissement_id);
  if (annee_scolaire) all = all.filter(l => l.annee_scolaire === annee_scolaire);
  return all;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANNEE SCOLAIRE
// ═══════════════════════════════════════════════════════════════════════════

export async function getAllAnneeScolaires(): Promise<AnneeScolaire[]> {
  return db.annees_scolaires.orderBy('libelle').reverse().toArray();
}

export async function getActiveAnneeScolaire(): Promise<AnneeScolaire | undefined> {
  return db.annees_scolaires.where('active').equals(1).first();
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEAR
// ═══════════════════════════════════════════════════════════════════════════

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.annees_scolaires.clear(),
    db.drenas.clear(),
    db.etablissements.clear(),
    db.classes.clear(),
    db.eleves.clear(),
    db.enseignants.clear(),
    db.enrollments.clear(),
    db.resultats_trimestre.clear(),
    db.notes_discipline.clear(),
    db.stats_classe.clear(),
    db.imports.clear(),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ENSEIGNANTS
// ═══════════════════════════════════════════════════════════════════════════

export async function saveEnseignants(enseignants: Enseignant[]): Promise<void> {
  await db.enseignants.bulkPut(enseignants);
}

export async function getEnseignantsByEtablissement(
  etablissement_id: string,
): Promise<Enseignant[]> {
  return db.enseignants.where('etablissement_id').equals(etablissement_id).toArray();
}

// ═══════════════════════════════════════════════════════════════════════════
// ENROLLMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function saveEnrollments(enrollments: EnrollmentML[]): Promise<void> {
  await db.enrollments.bulkPut(enrollments);
}

// ═══════════════════════════════════════════════════════════════════════════
// API CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export async function getApiConfig(): Promise<OneRosterApiConfig | undefined> {
  return db.api_config.toCollection().first();
}

export async function saveApiConfig(config: OneRosterApiConfig): Promise<void> {
  await db.api_config.put(config);
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC LOGS
// ═══════════════════════════════════════════════════════════════════════════

export async function addSyncLog(log: SyncLog): Promise<void> {
  await db.sync_logs.put(log);
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  return db.sync_logs.orderBy('date').reverse().toArray();
}

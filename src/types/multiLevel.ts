/**
 * Multi-level hierarchy types for the K12net Dashboard.
 *
 * Organisation:
 *   Ministère → DRENA → Établissement → Classe → Élève
 *
 * Two import flows:
 *   1. Administration centrale: liste_des_etablissment.xlsx → DRENA + Établissements
 *   2. Niveau établissement: listes_eleves.xlsx → Élèves + auto-create Classes
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. ENUMS & LITERALS
// ═══════════════════════════════════════════════════════════════════════════

export type NiveauScolaire =
  | 'Sixième'
  | 'Cinquième'
  | 'Quatrième'
  | 'Troisième'
  | 'Seconde'
  | 'Première'
  | 'Terminale';

export type CycleScolaire = 'Premier Cycle' | 'Second Cycle';

export type Sexe = 'Masculin' | 'Féminin';

export type QualiteEleve = 'Redoublant' | 'Non Redoublant';

export type StatutEleve = 'Affecté(e)' | 'Réaffecté(e)' | string;

export type StatutInternat = 'Externe' | 'Interne' | string;

export type ImportType = 'etablissements' | 'eleves' | 'resultats';
export type ImportFileType = 'pdf' | 'xlsx' | 'csv';
export type ImportStatut = 'succes' | 'partiel' | 'erreur';

export type DataSource = 'api' | 'excel' | 'manual';

// ═══════════════════════════════════════════════════════════════════════════
// 2. NIVEAU MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export interface NiveauInfo {
  niveau: NiveauScolaire;
  cycle: CycleScolaire;
  ordre: number;
}

export const CODE_NIVEAU_MAP: Record<string, NiveauInfo> = {
  '07': { niveau: 'Sixième', cycle: 'Premier Cycle', ordre: 1 },
  '08': { niveau: 'Cinquième', cycle: 'Premier Cycle', ordre: 2 },
  '09': { niveau: 'Quatrième', cycle: 'Premier Cycle', ordre: 3 },
  '10': { niveau: 'Troisième', cycle: 'Premier Cycle', ordre: 4 },
  '11': { niveau: 'Seconde', cycle: 'Second Cycle', ordre: 5 },
  '12': { niveau: 'Première', cycle: 'Second Cycle', ordre: 6 },
  '13': { niveau: 'Terminale', cycle: 'Second Cycle', ordre: 7 },
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. DRENA (19 pre-loaded)
// ═══════════════════════════════════════════════════════════════════════════

export interface DRENA {
  id: string;
  code: string;
  nom: string;
  ministere_id: string;
  source?: DataSource;
}

export const DRENA_PRECHARGES: Omit<DRENA, 'ministere_id'>[] = [
  { id: 'DRENA_ABJ1', code: 'DRENA_ABJ1', nom: 'DRENA ABIDJAN1' },
  { id: 'DRENA_ABJ2', code: 'DRENA_ABJ2', nom: 'DRENA ABIDJAN2' },
  { id: 'DRENA_ABJ3', code: 'DRENA_ABJ3', nom: 'DRENA ABIDJAN3' },
  { id: 'DRENA_ABJ4', code: 'DRENA_ABJ4', nom: 'DRENA ABIDJAN4' },
  { id: 'DRENA_ABOISSO', code: 'DRENA_ABOISSO', nom: 'DRENA ABOISSO' },
  { id: 'DRENA_BOUAFLE', code: 'DRENA_BOUAFLE', nom: 'DRENA BOUAFLE' },
  { id: 'DRENA_BOUAKE1', code: 'DRENA_BOUAKE1', nom: 'DRENA BOUAKE 1' },
  { id: 'DRENA_BOUAKE2', code: 'DRENA_BOUAKE2', nom: 'DRENA BOUAKE 2' },
  { id: 'DRENA_BOUNDIALI', code: 'DRENA_BOUNDIALI', nom: 'DRENA BOUNDIALI' },
  { id: 'DRENA_DABOU', code: 'DRENA_DABOU', nom: 'DRENA DABOU' },
  { id: 'DRENA_DALOA', code: 'DRENA_DALOA', nom: 'DRENA DALOA' },
  { id: 'DRENA_DIVO', code: 'DRENA_DIVO', nom: 'DRENA DIVO' },
  { id: 'DRENA_KATIOLA', code: 'DRENA_KATIOLA', nom: 'DRENA KATIOLA' },
  { id: 'DRENA_KORHOGO', code: 'DRENA_KORHOGO', nom: 'DRENA KORHOGO' },
  { id: 'DRENA_MINIGNAN', code: 'DRENA_MINIGNAN', nom: 'DRENA MINIGNAN' },
  { id: 'DRENA_ODIENNE', code: 'DRENA_ODIENNE', nom: 'DRENA ODIENNE' },
  { id: 'DRENA_SANPEDRO', code: 'DRENA_SANPEDRO', nom: 'DRENA SAN-PEDRO' },
  { id: 'DRENA_YAMOU', code: 'DRENA_YAMOU', nom: 'DRENA YAMOUSSOUKRO' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. MINISTERE
// ═══════════════════════════════════════════════════════════════════════════

export interface Ministere {
  id: string;
  nom: string;
  pays: string;
}

export const MINISTERE_DEFAULT: Ministere = {
  id: 'MENA',
  nom: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION",
  pays: 'CÔTE D\'IVOIRE',
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. ETABLISSEMENT
// ═══════════════════════════════════════════════════════════════════════════

export interface ChefEtablissement {
  nom: string;
  matricule?: string;
  telephone?: string;
  email?: string;
}

export interface StructureClasses {
  nb_classes: {
    sixieme: number;
    cinquieme: number;
    quatrieme: number;
    troisieme: number;
    seconde_a?: number;
    seconde_c?: number;
    premiere_a1?: number;
    premiere_a2?: number;
    premiere_c?: number;
    premiere_d?: number;
    terminale_a1?: number;
    terminale_a2?: number;
    terminale_c?: number;
    terminale_d?: number;
    total: number;
  };
  effectifs: {
    sixieme: number;
    cinquieme: number;
    quatrieme: number;
    troisieme: number;
    seconde_a?: number;
    seconde_c?: number;
    premiere_a1?: number;
    premiere_a2?: number;
    premiere_c?: number;
    premiere_d?: number;
    terminale_a1?: number;
    terminale_a2?: number;
    terminale_c?: number;
    terminale_d?: number;
    total: number;
  };
}

export interface Etablissement {
  id: string;
  code: string;        // "CI 000405" (School ID)
  nom: string;         // "LYCEE SAINTE MARIE DE COCODY ABIDJAN"
  type_focus: string;  // "Général"
  cycle?: string;
  genre_eleves?: string;
  genre_personnel?: string;
  coordonnees?: string; // "5.933257;-5.017172"
  localite?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  nb_administratifs: number;
  nb_enseignants: number;
  nb_conseillers: number;
  chef_etablissement?: ChefEtablissement;
  structure_classes: StructureClasses;
  drena_id: string;
  source?: DataSource;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. CLASSE (multi-level)
// ═══════════════════════════════════════════════════════════════════════════

export interface ClasseML {
  id: string;
  nom: string;           // "6eme_2", "2ndeC_1"
  niveau: NiveauScolaire;
  serie?: string;        // null for 1er cycle, "A1"/"A2"/"C"/"D" for 2nd cycle
  etablissement_id: string;
  annee_scolaire: string;
  professeur_principal?: string;
  educateur?: string;
  term_ids?: string[];
  source?: DataSource;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6b. ENSEIGNANT
// ═══════════════════════════════════════════════════════════════════════════

export interface Enseignant {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  etablissement_id: string;
  source?: DataSource;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6c. ENROLLMENT (link student/teacher → class)
// ═══════════════════════════════════════════════════════════════════════════

export interface EnrollmentML {
  id: string;
  user_id: string;
  class_id: string;
  role: 'student' | 'teacher';
  school_id: string;
  begin_date?: string;
  end_date?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. ELEVE (multi-level)
// ═══════════════════════════════════════════════════════════════════════════

export interface ParentInfo {
  numero_identite?: string;
  nom: string;
  prenom: string;
  telephone?: string;
  email?: string;
}

export interface EleveML {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance?: string;
  pays_naissance: string;
  sexe: Sexe;
  nationalite: string;
  telephone?: string;
  date_entree?: string;
  // Scolarité
  niveau_scolaire: NiveauScolaire;
  serie?: string;
  salle_de_classe: string;
  lv2: string;
  ap_mus: string;
  statut: string;
  qualite: QualiteEleve;
  statut_internat: string;
  type_adhesion: string;
  // Année précédente
  classe_annee_precedente?: string;
  lv2_annee_precedente?: string;
  ap_mus_annee_precedente?: string;
  // Parents
  pere?: ParentInfo;
  mere?: ParentInfo;
  // Foreign keys
  classe_id: string;
  etablissement_id: string;
  annee_scolaire: string;
  source?: DataSource;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. RESULTATS TRIMESTRIELS
// ═══════════════════════════════════════════════════════════════════════════

export interface ResultatTrimestre {
  id: string;
  eleve_id: string;
  trimestre: 1 | 2 | 3;
  annee_scolaire: string;
  moyenne?: number;
  rang?: number;
  total_eleves?: number;
  distinction?: string;
  sanction?: string;
}

export interface NoteDiscipline {
  id: string;
  eleve_id: string;
  trimestre: 1 | 2 | 3;
  annee_scolaire: string;
  discipline: string;
  moyenne: number;
}

export interface StatsClasse {
  id: string;
  classe_id: string;
  trimestre: 1 | 2 | 3;
  annee_scolaire: string;
  effectif: number;
  moyenne_classe: number;
  min_moyenne: number;
  max_moyenne: number;
  taux_reussite: number;
  taux_excellence: number;
  taux_echec: number;
  nb_felicitations: number;
  nb_th: number;
  nb_the: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. ANNEE SCOLAIRE & IMPORT LOG
// ═══════════════════════════════════════════════════════════════════════════

export interface AnneeScolaire {
  id: string;
  libelle: string; // "2025-2026"
  debut: string;
  fin: string;
  school_year?: string; // "2026" (OneRoster format)
  active: boolean;
  trimestres?: Trimestre[];
}

export interface Trimestre {
  id: string;
  numero: 1 | 2 | 3;
  titre: string;
  debut: string;
  fin: string;
  parent_annee_id: string;
}

export interface ImportLog {
  id: string;
  date_import: string;
  fichier_source: string;
  type_import: ImportType;
  type_fichier: ImportFileType;
  trimestre?: 1 | 2 | 3;
  nb_enregistrements: number;
  statut: ImportStatut;
  erreurs?: string[];
  etablissement_id?: string;
  annee_scolaire?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════

export interface EntiteEnfant {
  nom: string;
  effectif: number;
  moyenne: number;
  nb_reussite: number;
  nb_excellence: number;
  nb_echec: number;
  nb_felicitations: number;
}

export interface AggregationResult {
  effectif_total: number;
  moyenne_ponderee: number;
  mediane: number;
  ecart_type: number;
  coefficient_variation: number;
  taux_reussite: number;
  taux_excellence: number;
  taux_echec: number;
  taux_felicitations: number;
  nb_entites: number;
  min_moyenne: number;
  max_moyenne: number;
  ecart_max: number;
  entite_meilleure: string;
  entite_plus_faible: string;
  classement: { nom: string; moyenne: number; rang: number }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. NAVIGATION CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

export type NavigationLevel = 'ministere' | 'drena' | 'etablissement' | 'classe';

export interface NavigationState {
  level: NavigationLevel;
  ministere_id?: string;
  drena_id?: string;
  etablissement_id?: string;
  classe_id?: string;
  annee_scolaire?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. CLASSE NAME PARSING
// ═══════════════════════════════════════════════════════════════════════════

export interface ParsedClassName {
  niveau: NiveauScolaire;
  serie?: string;
  numero: number;
}

const CLASSE_PATTERNS: { regex: RegExp; niveau: NiveauScolaire }[] = [
  { regex: /^6eme_(\d+)$/i, niveau: 'Sixième' },
  { regex: /^5eme_(\d+)$/i, niveau: 'Cinquième' },
  { regex: /^4eme_(\d+)$/i, niveau: 'Quatrième' },
  { regex: /^3eme_(\d+)$/i, niveau: 'Troisième' },
];

const CLASSE_SERIE_PATTERNS: { regex: RegExp; niveau: NiveauScolaire }[] = [
  { regex: /^2nde([A-Z]\d?)_(\d+)$/i, niveau: 'Seconde' },
  { regex: /^1ere([A-Z]\d?)_(\d+)$/i, niveau: 'Première' },
  { regex: /^Tle([A-Z]\d?)_(\d+)$/i, niveau: 'Terminale' },
];

export function parseNomClasse(salle: string): ParsedClassName | null {
  for (const p of CLASSE_PATTERNS) {
    const m = salle.match(p.regex);
    if (m) return { niveau: p.niveau, numero: parseInt(m[1], 10) };
  }
  for (const p of CLASSE_SERIE_PATTERNS) {
    const m = salle.match(p.regex);
    if (m) return { niveau: p.niveau, serie: m[1].toUpperCase(), numero: parseInt(m[2], 10) };
  }
  return null;
}

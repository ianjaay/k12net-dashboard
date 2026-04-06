// ─── Report Module Types ────────────────────────────────────────────────────
// Types for the 7 official K12net reports (PV Conseil, Liste Nominative, etc.)

import type { TermId, GradeLevel, Branch, PromotionStatus, TermDistinction, TermSanction } from './k12';

// ─── Report identifiers ────────────────────────────────────────────────────

export type ReportType =
  | 'pv_conseil_classe'
  | 'liste_nominative'
  | 'majors_par_classe'
  | 'majors_par_niveau'
  | 'premiers_par_discipline'
  | 'non_classes'
  | 'bilan_annuel';

export interface ReportMeta {
  id: ReportType;
  label: string;
  description: string;
  icon: string; // lucide icon name
}

export const REPORT_CATALOG: ReportMeta[] = [
  { id: 'pv_conseil_classe', label: 'PV de Conseil de Classe', description: 'Effectifs, moyennes, distinctions/sanctions, statistiques par discipline', icon: 'FileText' },
  { id: 'liste_nominative', label: 'Liste Nominative', description: 'Liste alphabétique avec moyennes, rangs et distinctions', icon: 'List' },
  { id: 'majors_par_classe', label: 'Majors par Classe', description: 'Meilleur élève de chaque classe', icon: 'Trophy' },
  { id: 'majors_par_niveau', label: 'Majors par Niveau', description: 'Meilleur élève de chaque niveau scolaire', icon: 'Award' },
  { id: 'premiers_par_discipline', label: 'Premiers par Discipline', description: 'Premier de chaque matière par classe', icon: 'Medal' },
  { id: 'non_classes', label: 'Non-Classés', description: 'Élèves sans moyenne (absences prolongées, etc.)', icon: 'UserX' },
  { id: 'bilan_annuel', label: 'Bilan Annuel', description: 'Récapitulatif T1/T2/T3, moyenne annuelle, décision', icon: 'CalendarDays' },
];

// ─── Etablissement ──────────────────────────────────────────────────────────

export interface Etablissement {
  pays: string;
  ministere: string;
  direction: string;
  nom: string;
  code: string;
  statut: string;
  adresse: string;
  telephone: string;
  email: string;
  logo?: string;
}

export const DEFAULT_ETABLISSEMENT: Etablissement = {
  pays: "REPUBLIQUE DE CÔTE D'IVOIRE",
  ministere: "MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION",
  direction: 'DRENA ABIDJAN1',
  nom: 'LYCEE SAINTE MARIE DE COCODY ABIDJAN',
  code: 'CI 000405',
  statut: 'Public',
  adresse: 'LYCEE SAINTE MARIE DE COCODY ABIDJAN ABIDJAN 04 BP 343 Abidjan 04 COCODY - ABIDJAN / CÔTE D\'IVOIRE',
  telephone: '+225 01 03 85 58 02',
  email: 'lysmaci.ci@gmail.com',
};

// ─── Gender stats ───────────────────────────────────────────────────────────

export interface GenderCount {
  garcons: number;
  filles: number;
  total: number;
}

export interface GenderMoyenneRepartition {
  genre: 'GARÇONS' | 'FILLES' | 'TOTAL';
  inf_8_5: { nombre: number; pourcentage: number };
  entre_8_5_10: { nombre: number; pourcentage: number };
  sup_10: { nombre: number; pourcentage: number };
}

// ─── Rapport 1: PV Conseil de Classe ────────────────────────────────────────

export interface DisciplineStats {
  nom: string;
  enseignant: string;
  enseignantMatricule: string;
  effectifClasses: number;
  moyenneClasse: number | null;
  plusFaibleMoyenne: number | null;
  plusForteMoyenne: number | null;
  appreciation: string;
  repartition: {
    inf_8_5: { nombre: number; pourcentage: number };
    entre_8_5_10: { nombre: number; pourcentage: number };
    sup_10: { nombre: number; pourcentage: number };
  };
}

export interface PVConseilData {
  classe: string;
  displayName: string;
  niveau: string;
  trimestre: string;
  termId: TermId;
  anneeScolaire: string;
  professeurPrincipal: string;
  educateur: string;
  effectifs: GenderCount & { classes: number; absents: number };
  repartitionMoyennes: GenderMoyenneRepartition[];
  moyenneClasse: number | null;
  plusFaibleMoyenne: number | null;
  plusForteMoyenne: number | null;
  distinctions: {
    tableauHonneur: number;
    tableauHonneurEncouragements: number;
    tableauHonneurFelicitations: number;
  };
  sanctions: {
    blameTravail: number;
    avertissementTravail: number;
    blameConduite: number;
    avertissementConduite: number;
    tableauHonneurRefuse: number;
  };
  disciplines: DisciplineStats[];
}

// ─── Rapport 2: Liste Nominative ────────────────────────────────────────────

export interface ListeNominativeEntry {
  numero: number;
  matricule: string;
  nomPrenoms: string;
  nationalite: string;
  sexe: string;
  affecte: boolean;
  redoublant: boolean;
  moyenne: number | null;
  rang: string;
  distinctionSanction: string;
  observation: string;
}

export interface ListeNominativeData {
  classe: string;
  displayName: string;
  trimestre: string;
  termId: TermId;
  anneeScolaire: string;
  effectifs: GenderCount;
  eleves: ListeNominativeEntry[];
}

// ─── Rapport 3: Majors par Classe ───────────────────────────────────────────

export interface MajorEntry {
  numero: number;
  matricule: string;
  nomPrenoms: string;
  sexe: string;
  dateNaissance: string;
  nationalite: string;
  redoublant: boolean;
  lv2: string;
  moyenne: number;
  classe: string;       // for majors par classe
  niveau: string;       // for majors par niveau
}

// ─── Rapport 5: Premiers par Discipline ─────────────────────────────────────

export interface PremierDisciplineEntry {
  classe: string;
  discipline: string;
  matricule: string;
  nomPrenoms: string;
  sexe: string;
  moyenne: number | null;
  observation: string;
}

// ─── Rapport 6: Non-Classés ─────────────────────────────────────────────────

export interface NonClasseEntry {
  numero: number;
  matricule: string;
  nomPrenoms: string;
  sexe: string;
  dateNaissance: string;
  nationalite: string;
  redoublant: boolean;
  lv2: string;
  classe: string;
}

// ─── Rapport 7: Bilan Annuel ────────────────────────────────────────────────

export interface BilanAnnuelEntry {
  numero: number;
  matricule: string;
  nomPrenoms: string;
  redoublant: boolean;
  moyT1: number | null;
  rangT1: string;
  dsT1: string;
  moyT2: number | null;
  rangT2: string;
  dsT2: string;
  moyT3: number | null;
  rangT3: string;
  dsT3: string;
  moyAnnuelle: number | null;
  rangAnnuel: string;
  dfa: string;
  nivSup: string;
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

/** Format a number as French-style with comma decimal: 14.92 → "14,92" */
export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(decimals).replace('.', ',');
}

/** Format a rank: 1 → "1er", 2 → "2ème", with ex-aequo handling */
export function fmtRank(rank: number | null | undefined, totalStudents?: number): string {
  if (rank === null || rank === undefined || rank === 0) return '—';
  if (rank === 1) return '1er';
  return `${rank}ème`;
}

/** Format rank with ex-aequo suffix */
export function fmtRankWithExAequo(rank: number, isExAequo: boolean): string {
  if (rank === 0) return '—';
  if (rank === 1 && !isExAequo) return '1er';
  return isExAequo ? `${rank}ex` : `${rank}ème`;
}

/** Get appreciation text from class average */
export function getAppreciation(moyenne: number | null): string {
  if (moyenne === null) return '';
  if (moyenne >= 16) return 'Excellent';
  if (moyenne >= 14) return 'Bien';
  if (moyenne >= 12) return 'Assez Bien';
  if (moyenne >= 10) return 'Passable';
  if (moyenne >= 8) return 'Insuffisant';
  return 'Très Insuffisant';
}

/** Format distinction/sanction code */
export function fmtDistinctionSanction(
  distinction: TermDistinction | null | undefined,
  sanction: TermSanction | null | undefined,
): string {
  if (distinction) return distinction;
  if (sanction) {
    switch (sanction) {
      case 'BTI': return 'BT';
      case 'AVT': return 'AT';
      case 'BMC': return 'BC';
      case 'AMC': return 'AC';
    }
  }
  return '';
}

/** Format trimester label */
export function getTrimestreLabel(termId: TermId): string {
  switch (termId) {
    case 'T1': return 'Premier Trimestre';
    case 'T2': return 'Deuxième Trimestre';
    case 'T3': return 'Troisième Trimestre';
  }
}

/** Format grade level to display name */
export function getNiveauLabel(gradeLevel: GradeLevel, branch?: Branch | null): string {
  const labels: Record<GradeLevel, string> = {
    '07': 'Sixième', '08': 'Cinquième', '09': 'Quatrième', '10': 'Troisième',
    '11': 'Seconde', '12': 'Première', '13': 'Terminale',
  };
  const base = labels[gradeLevel] ?? gradeLevel;
  return branch ? `${base} ${branch}` : base;
}

// ─── Analytics Types ────────────────────────────────────────────────────────
// Types for delta metrics, alerts, student profiles, and progression reports.

import type { TermId, TermDistinction, TermSanction } from './k12';

// ─── Delta Metrics ──────────────────────────────────────────────────────────

export type DeltaDirection = 'up' | 'down' | 'stable';

export interface DeltaResult {
  value: number;
  direction: DeltaDirection;
  percentage: number | null;   // relative change %
  reference: TermId;           // "T1" or "T2"
}

export type DeltaFormat = 'number' | 'percent' | 'rank';

// ─── Alerts ─────────────────────────────────────────────────────────────────

export type AlertSeverity = 'danger' | 'warning' | 'success' | 'info';

export type AlertCode =
  // Individual
  | 'REG_FORTE' | 'REG_MODEREE' | 'CHUTE_RANG' | 'PERTE_DISTINCTION'
  | 'SEUIL_CRITIQUE' | 'ZONE_FRAGILE'
  | 'PROG_FORTE' | 'PROG_MODEREE' | 'GAIN_DISTINCTION' | 'DERNIERS_10PCT'
  // Discipline
  | 'DISC_ECHEC' | 'DISC_ECHEC_ELEVES'
  // Class
  | 'CLASSE_REGRESSION' | 'HOMOGENEITE_BAISSE' | 'NON_CLASSES_ELEVES';

export interface Alert {
  code: AlertCode;
  severity: AlertSeverity;
  message: string;
  /** Student matricule (for individual alerts) or discipline name */
  target?: string;
  targetLabel?: string;
  data?: {
    currentValue?: number;
    previousValue?: number;
    delta?: number;
    termId?: TermId;
  };
}

// ─── Student Profile ────────────────────────────────────────────────────────

export type StudentProfile =
  | 'excellent_stable'
  | 'bon_progression'
  | 'stable_milieu'
  | 'en_progression'
  | 'en_decrochage'
  | 'fragile';

export const PROFILE_META: Record<StudentProfile, { label: string; color: string; bg: string }> = {
  excellent_stable:  { label: 'Excellent stable',   color: '#166534', bg: '#dcfce7' },
  bon_progression:   { label: 'Bon en progression', color: '#22d273', bg: '#e6f9ef' },
  stable_milieu:     { label: 'Stable',             color: '#637382', bg: '#f3f6f9' },
  en_progression:    { label: 'En progression',     color: '#2563eb', bg: '#dbeafe' },
  en_decrochage:     { label: 'En décrochage',      color: '#ea580c', bg: '#fff7ed' },
  fragile:           { label: 'Fragile',            color: '#dc3545', bg: '#fce8ea' },
};

// ─── Discipline Profile ─────────────────────────────────────────────────────

export type DisciplineProfile = 'litteraire' | 'scientifique' | 'equilibre';

export const DISCIPLINE_FAMILIES: Record<string, string[]> = {
  litteraire:   ['Français', 'Anglais', 'Allemand', 'Espagnol', 'Histoire-Géographie', 'E.D.H.C', 'EDHC'],
  scientifique: ['Mathématiques', 'Physique-Chimie', 'SVT', 'Informatique'],
  artistique:   ['Éducation Musicale', 'Arts Plastiques', 'Danse', 'ESF/Couture', 'EPS'],
  transversale: ['Environnement', 'Conduite'],
};

// ─── Progression Report ─────────────────────────────────────────────────────

export interface TermSnapshot {
  termId: TermId;
  average: number | null;
  rank: number;
  totalStudents: number;
  distinction: TermDistinction;
  sanction: TermSanction;
  classAverage: number | null;
}

export interface ProgressionReport {
  matricule: string;
  fullName: string;
  className: string;
  snapshots: TermSnapshot[];
  deltas: {
    moyenneDelta: DeltaResult[];
    rangDelta: DeltaResult[];
  };
  profile: StudentProfile;
  disciplineProfile: DisciplineProfile;
  positionVsClass: number | null;  // écart vs moyenne de la classe
  percentile: number | null;       // 0-100
  volatility: number | null;       // std dev of term averages
  trend: number | null;            // slope of linear regression
  predictedNext: number | null;    // extrapolated next term avg
}

// ─── Period Stats (for MetricCard deltas) ───────────────────────────────────

export interface PeriodStats {
  termId: TermId | 'ANNUAL';
  mean: number | null;
  median: number | null;
  stddev: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  range: number | null;
  pctBelow8_5: number;
  pctBetween8_5_10: number;
  pctAbove10: number;
  pctAbove14: number;
  pctAbove16: number;
  count: number;
}

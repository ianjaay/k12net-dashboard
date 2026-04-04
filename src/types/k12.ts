// ─── K12net Dashboard — Domain Types ───────────────────────────────────────
// Types for the K12/Lycée grade management, term distinctions/sanctions,
// and annual promotion rules engine.
// Aligned with real data from K12net section lists and grade exports.

// ─── Grade Levels ────────────────────────────────────────────────────────────

/**
 * K12net grade levels using the internal numbering system (07–13).
 * Maps to Ivorian class names:
 *   07 = 6ème, 08 = 5ème, 09 = 4ème, 10 = 3ème (Collège)
 *   11 = 2nde, 12 = 1ère, 13 = Tle (Lycée)
 */
export type GradeLevel = '07' | '08' | '09' | '10' | '11' | '12' | '13';

/** Grade level group for rule targeting */
export type GradeLevelGroup = '7-10' | '11-13';

/** Human-readable class name for a grade level */
export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  '07': '6ème',
  '08': '5ème',
  '09': '4ème',
  '10': '3ème',
  '11': '2nde',
  '12': '1ère',
  '13': 'Tle',
};

/** Map a grade level to its group */
export function getGradeLevelGroup(level: GradeLevel): GradeLevelGroup {
  switch (level) {
    case '07': case '08': case '09': case '10':
      return '7-10';
    case '11': case '12': case '13':
      return '11-13';
  }
}

/** Whether a grade level is a terminal level (3ème or Terminale) */
export function isTerminalGrade(level: GradeLevel): boolean {
  return level === '10' || level === '13';
}

/**
 * Parse a K12net level string like "09-09***" or "13-13*** [D]"
 * into a GradeLevel and optional branch.
 */
export function parseK12Level(raw: string): { level: GradeLevel; branch: Branch | null } {
  const match = raw.match(/^(\d{2})-\d{2}\*{3}(?:\s*\[(\w+)\])?/);
  if (!match) return { level: '07', branch: null };
  return {
    level: match[1] as GradeLevel,
    branch: match[2] || null,
  };
}

// ─── Academic Year & Terms ──────────────────────────────────────────────────

/** Academic year identifier (e.g. "2024" for 2024-2025) */
export type AcademicYear = string;

/** Trimester identifier */
export type TermId = 'T1' | 'T2' | 'T3';

// ─── Filière / Branch ───────────────────────────────────────────────────────

/** Filière (branch) for lycée */
export type Branch = 'A' | 'A1' | 'A2' | 'C' | 'D' | string;

// ─── Course Definition (from Section List) ──────────────────────────────────

/**
 * A course entry from the K12net "Liste des Sections" report.
 * Defines a subject, its coefficient, and which classrooms it applies to.
 */
export interface CourseDefinition {
  /** K12net course code, e.g. "Mat13D", "Fra07", "PC12C" */
  code: string;
  /** Display name, e.g. "Mathématiques", "Français" */
  name: string;
  /** Grade level code, e.g. "07", "13" */
  gradeLevel: GradeLevel;
  /** Branch (lycée only), e.g. "A1", "C", "D". Null for collège */
  branch: Branch | null;
  /** Course coefficient for weighted average (0 = not graded) */
  coefficient: number;
  /** Weekly hours */
  weeklyHours: number;
  /** Classrooms this course applies to, e.g. ["TleD_1", "TleD_2"] */
  classrooms: string[];
  /** Number of enrolled students */
  studentCount: number;
  /** Teacher names */
  teachers: string[];
}

/**
 * Resolved subject for a specific class, merging the course definition
 * with flags needed by the rules engine.
 */
export interface SubjectDefinition {
  code: string;
  name: string;
  coefficient: number;
  isBonus: boolean;           // matière bonus (excluded from distinction refusal check)
  isBehavioral: boolean;      // conduite / discipline
  isFrenchComposition: boolean; // composition de français
  gradeLevel: GradeLevel;
  branch: Branch | null;
}

// ─── Evaluations & Subject Grades ───────────────────────────────────────────

/**
 * A single evaluation entry (note).
 * Parsed from column headers like "IE 1[T2] [20]" or "compo_francais[T1] [20]".
 */
export interface Evaluation {
  /** Evaluation name as entered in K12net, e.g. "IE 1", "DS2", "compo_francais" */
  name: string;
  /** Term this evaluation belongs to */
  termId: TermId;
  /** Maximum score (barème), typically 10 or 20 */
  maxScore: number;
  /** Student's actual score (null = not yet graded) */
  score: number | null;
}

/**
 * All grades for one subject in one term.
 * Contains individual evaluations and the computed term average.
 */
export interface SubjectTermGrades {
  /** Course code, e.g. "Mat13D" */
  subjectCode: string;
  /** Display name, e.g. "Mathématiques" */
  subjectName: string;
  /** Coefficient from course definition */
  coefficient: number;
  /** Individual evaluations for this term */
  evaluations: Evaluation[];
  /** Computed average for this subject this term (null if no evaluations) */
  average: number | null;
}

/**
 * Complete grades for one subject across all terms + year average.
 * This is the per-subject row in the grade sheet.
 */
export interface SubjectYearGrades {
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  /** Flags for rules engine */
  isBonus: boolean;
  isBehavioral: boolean;
  isFrenchComposition: boolean;
  /** Per-term grades (T1, T2, T3). Missing terms have empty evaluations. */
  terms: Record<TermId, SubjectTermGrades>;
  /** Year average = mean of available term averages */
  yearAverage: number | null;
}

// ─── Legacy SubjectMark (used by rules engine) ─────────────────────────────

/** Simplified subject mark for rules engine consumption */
export interface SubjectMark {
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  mark: number | null;
  isBonus: boolean;
  isBehavioral: boolean;
  isFrenchComposition: boolean;
}

/** Convert SubjectTermGrades → SubjectMark for rules engine */
export function toSubjectMark(stg: SubjectTermGrades, def?: SubjectDefinition): SubjectMark {
  return {
    subjectCode: stg.subjectCode,
    subjectName: stg.subjectName,
    coefficient: stg.coefficient,
    mark: stg.average,
    isBonus: def?.isBonus ?? false,
    isBehavioral: def?.isBehavioral ?? stg.subjectName.toLowerCase().includes('conduite'),
    isFrenchComposition: def?.isFrenchComposition ?? false,
  };
}

export interface TermMarks {
  termId: TermId;
  subjectMarks: SubjectMark[];
  termAverage: number | null;
  /** Weighted average: Σ(subject_avg × coef) / Σ(coef) */
  weightedAverage: number | null;
  /** Count of non-bonus subjects with mark < 10 */
  failedSubjectCount: number;
  /** Whether a failing French composition score exists */
  hasFailedFrenchComposition: boolean;
  /** Whether the student has zero graded subjects (exempt) */
  isExempt: boolean;
}

// ─── Term Distinctions & Sanctions ──────────────────────────────────────────

/**
 * Term distinctions (Tableau d'Honneur, Excellence, Félicitations)
 *  - TH  = Tableau d'Honneur
 *  - THR = Tableau d'Honneur avec Réserve (has failed subjects)
 *  - THE = Tableau d'Excellence
 *  - THER = Tableau d'Excellence avec Réserve
 *  - THF = Tableau de Félicitations
 *  - THFR = Tableau de Félicitations avec Réserve
 */
export type TermDistinction = 'TH' | 'THR' | 'THE' | 'THER' | 'THF' | 'THFR' | null;

/**
 * Term sanctions
 *  - BTI = Blâme de Travail Insuffisant (avg < 8.5)
 *  - AVT = Avertissement de Travail (avg < 10)
 *  - BMC = Blâme de Mauvaise Conduite (behavioral < 10)
 *  - AMC = Avertissement de Mauvaise Conduite (behavioral < 11)
 */
export type TermSanction = 'BTI' | 'AVT' | 'BMC' | 'AMC' | null;

export interface TermResult {
  termId: TermId;
  termAverage: number | null;
  distinction: TermDistinction;
  sanction: TermSanction;
  isExempt: boolean;
  rank: number;
  totalStudents: number;
}

// ─── Annual Promotion ───────────────────────────────────────────────────────

/**
 * Annual promotion status:
 *  - ADMIS = Promoted (passes to next grade)
 *  - REDOUBLE = Retained (repeats the grade)
 *  - EXCLU = Expelled (removed from school)
 */
export type PromotionStatus = 'ADMIS' | 'REDOUBLE' | 'EXCLU' | null;

export interface YearResult {
  yearAverage: number | null;
  termResults: TermResult[];
  promotionStatus: PromotionStatus;
  isRepeating: boolean;       // was the student already retained last year?
  suggestedBranch: Branch | null;  // for lycée students
  rank: number;
  totalStudents: number;
}

// ─── Student ────────────────────────────────────────────────────────────────

export interface K12Student {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gradeLevel: GradeLevel;
  className: string;          // e.g. "6eme_1", "TleD_2"
  branch: Branch | null;      // null for collège students
  isRepeating: boolean;       // repeating this grade level
  previousPromotionStatus: PromotionStatus; // last year's status
  /** Full subject grades (evaluations + per-term + year averages) */
  subjectGrades: SubjectYearGrades[];
  /** Simplified term marks for rules engine */
  termMarks: TermMarks[];
  yearResult: YearResult | null;
}

// ─── Class / Section ────────────────────────────────────────────────────────

export interface K12Class {
  id: string;
  name: string;               // e.g. "6eme_1", "TleD_2"
  displayName: string;        // e.g. "6ème 1", "Tle D 2"
  gradeLevel: GradeLevel;
  branch: Branch | null;
  academicYear: AcademicYear;
  /** Subject definitions (from course catalog) applicable to this class */
  subjects: SubjectDefinition[];
  students: K12Student[];
}

// ─── Rules Configuration (per academic year) ────────────────────────────────

/** Distinction thresholds per grade level group */
export interface DistinctionThresholds {
  /** Minimum average for TH (Tableau d'Honneur) */
  thMin: number;
  /** Minimum average for THE (Tableau d'Excellence) */
  theMin: number;
  /** Minimum average for THF (Tableau de Félicitations) */
  thfMin: number;
  /**
   * Max average for TH range (exclusive).
   * If avg >= thMin && avg < thMax → TH. If not set, thMax = theMin.
   */
  thMax?: number;
  /**
   * Max average for THE range (exclusive).
   * If avg >= theMin && avg < theMax → THE. If not set, theMax = thfMin.
   */
  theMax?: number;
}

export interface SanctionThresholds {
  /** Below this average → BTI */
  btiMax: number;
  /** Below this average → AVT (but >= btiMax) */
  avtMax: number;
  /** Below this behavioral mark → BMC */
  bmcMax: number;
  /** Below this behavioral mark → AMC (but >= bmcMax) */
  amcMax: number;
}

export interface PromotionThresholds {
  /** Min year average for promotion (non-repeating) */
  promotionMin: number;
  /** Min year average for retained status (below this = expelled) */
  retainedMin: number;
  /** Min year average for repeating student to be promoted */
  repeatingPromotionMin: number;
}

export interface TerminalGradePromotionThresholds {
  /** For terminal classes (10ème, Terminale) */
  nonRepeatingRetainedMin: number;
  repeatingAutoExpelled: boolean; // 2023-2024: repeating terminal = auto expelled
}

export interface BranchTransitionRule {
  fromGradeLevel: GradeLevel;
  fromBranch: Branch;
  toBranch: Branch;
  isRepeating: boolean;
  conditions?: {
    /** Required course grades (e.g. { 'Mat12D': 11, 'PC12D': 11 }) */
    courseMinGrades?: Record<string, number>;
    /** Required minimum year average */
    minYearAverage?: number;
  };
}

export interface K12YearRulesConfig {
  academicYear: AcademicYear;
  termDistinction: {
    '7-10': DistinctionThresholds;
    '11-13': DistinctionThresholds;
  };
  termSanction: SanctionThresholds;
  promotion: PromotionThresholds;
  terminalGradePromotion: TerminalGradePromotionThresholds;
  branchTransitions: BranchTransitionRule[];
  /**
   * Whether distinction refusal checks use NonBonusSectionMarks (2023+)
   * vs all SectionMarks (2022).
   */
  useNonBonusForDistinctionCheck: boolean;
  /**
   * Whether French composition failure blocks distinction (2023+).
   */
  checkFrenchCompositionForDistinction: boolean;
}

// ─── Firestore Document Types ───────────────────────────────────────────────

export interface K12SessionDoc {
  name: string;
  description: string;
  academicYear: AcademicYear;
  schoolName: string;
  createdAt: unknown;
  updatedAt: unknown;
  ownerId: string;
  members: Record<string, 'owner' | 'editor' | 'reader'>;
  memberEmails: string[];
  rulesConfig: K12YearRulesConfig | null;
}

export interface K12ClassDoc {
  className: string;
  displayName: string;
  gradeLevel: GradeLevel;
  branch: Branch | null;
  subjects: SubjectDefinition[];
  students: K12Student[];
}

export interface K12SnapshotDoc {
  createdAt: unknown;
  label: string;
  data: {
    classes: K12ClassDoc[];
    rulesConfig: K12YearRulesConfig | null;
  };
}

// ─── Global Settings ────────────────────────────────────────────────────────

export interface K12GlobalSettings {
  schoolName: string;
  schoolLogo: string | null;
  defaultAcademicYear: AcademicYear;
  /** All available academic year rule configurations */
  yearConfigs: Record<AcademicYear, K12YearRulesConfig>;
  /** Course catalog loaded from K12net section list */
  courseCatalog: CourseDefinition[];
  /** Subject definitions per class name (resolved from course catalog) */
  subjectsByClass: Record<string, SubjectDefinition[]>;
}

export interface SubjectDefinition {
  code: string;
  name: string;
  coefficient: number;
  isBonus: boolean;
  isBehavioral: boolean;
  isFrenchComposition: boolean;
  gradeLevel: GradeLevel;
  branch: Branch | null;
}

// ─── App State (K12 Dashboard) ──────────────────────────────────────────────

/** View toggle: per-trimester or annual */
export type TermView = 'T1' | 'T2' | 'T3' | 'ANNUAL';

/** K12 session role */
export type K12SessionRole = 'owner' | 'editor' | 'reader';

/** App-level data used by all K12 components */
export interface K12AppData {
  academicYear: AcademicYear;
  rulesConfig: K12YearRulesConfig;
  schoolName: string;
  classes: K12Class[];
  /** Course catalog from section list import */
  courseCatalog: CourseDefinition[];
  /** Currently active students (filtered by class selection) */
  students: K12Student[];
}

// ─── Calculation Helpers ────────────────────────────────────────────────────

/**
 * Compute weighted average: Σ(mark_i × coef_i) / Σ(coef_i)
 * Only includes subjects where mark is not null and coefficient > 0.
 */
export function computeWeightedAverage(
  marks: Array<{ mark: number | null; coefficient: number }>
): number | null {
  let weightedSum = 0;
  let coefSum = 0;
  for (const { mark, coefficient } of marks) {
    if (mark !== null && coefficient > 0) {
      weightedSum += mark * coefficient;
      coefSum += coefficient;
    }
  }
  return coefSum > 0 ? weightedSum / coefSum : null;
}

/**
 * Compute simple average of non-null values.
 */
export function computeSimpleAverage(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/**
 * Compute subject term average: simple average of all evaluation scores,
 * normalized to /20 when maxScore differs.
 */
export function computeSubjectTermAverage(evaluations: Evaluation[]): number | null {
  const scored = evaluations.filter(e => e.score !== null);
  if (scored.length === 0) return null;
  // Normalize all scores to /20, then average
  const normalized = scored.map(e => (e.score! / e.maxScore) * 20);
  return normalized.reduce((a, b) => a + b, 0) / normalized.length;
}

/**
 * Build TermMarks from SubjectYearGrades[] for a specific term.
 */
export function buildTermMarks(
  subjectGrades: SubjectYearGrades[],
  termId: TermId
): TermMarks {
  const subjectMarks: SubjectMark[] = subjectGrades.map(sg => ({
    subjectCode: sg.subjectCode,
    subjectName: sg.subjectName,
    coefficient: sg.coefficient,
    mark: sg.terms[termId]?.average ?? null,
    isBonus: sg.isBonus,
    isBehavioral: sg.isBehavioral,
    isFrenchComposition: sg.isFrenchComposition,
  }));

  const graded = subjectMarks.filter(sm => sm.mark !== null && sm.coefficient > 0);
  const weightedAverage = computeWeightedAverage(graded);
  const simpleAverage = computeSimpleAverage(graded.map(sm => sm.mark));

  const failedSubjectCount = graded.filter(
    sm => !sm.isBonus && sm.mark !== null && sm.mark < 10
  ).length;

  const hasFailedFrenchComposition = graded.some(
    sm => sm.isFrenchComposition && sm.mark !== null && sm.mark < 10
  );

  return {
    termId,
    subjectMarks,
    termAverage: simpleAverage,
    weightedAverage,
    failedSubjectCount,
    hasFailedFrenchComposition,
    isExempt: graded.length === 0,
  };
}

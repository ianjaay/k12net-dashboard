// ─── K12net Dashboard — Domain Types ───────────────────────────────────────
// Types for the K12/Lycée grade management, term distinctions/sanctions,
// and annual promotion rules engine.

// ─── Grade Levels ────────────────────────────────────────────────────────────

/** Ivorian school grade levels (collège + lycée) */
export type GradeLevel =
  | '7eme' | '8eme' | '9eme' | '10eme'   // Collège
  | '11eme' | '12eme' | '13eme';          // Lycée (Seconde, Première, Terminale)

/** Grade level group for rule targeting */
export type GradeLevelGroup = '7-10' | '11-13';

/** Map a grade level to its group */
export function getGradeLevelGroup(level: GradeLevel): GradeLevelGroup {
  switch (level) {
    case '7eme': case '8eme': case '9eme': case '10eme':
      return '7-10';
    case '11eme': case '12eme': case '13eme':
      return '11-13';
  }
}

/** Whether a grade level is a terminal level (10ème or Terminale) */
export function isTerminalGrade(level: GradeLevel): boolean {
  return level === '10eme' || level === '13eme';
}

// ─── Academic Year & Terms ──────────────────────────────────────────────────

/** Academic year identifier (e.g. "2024" for 2024-2025) */
export type AcademicYear = string;

/** Trimester identifier */
export type TermId = 'T1' | 'T2' | 'T3';

// ─── Filière / Branch ───────────────────────────────────────────────────────

/** Filière (branch) for lycée */
export type Branch = 'A' | 'A1' | 'A2' | 'C' | 'D' | string;

// ─── Subject / Mark ─────────────────────────────────────────────────────────

export interface SubjectMark {
  subjectCode: string;
  subjectName: string;
  coefficient: number;
  mark: number | null;
  isBonus: boolean;           // matière bonus (excluded from distinction refusal check)
  isBehavioral: boolean;      // conduite / discipline
  isFrenchComposition: boolean; // composition de français
}

export interface TermMarks {
  termId: TermId;
  subjectMarks: SubjectMark[];
  termAverage: number | null;
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
  className: string;          // e.g. "7ème A", "12ème C"
  branch: Branch | null;      // null for collège students
  isRepeating: boolean;       // repeating this grade level
  previousPromotionStatus: PromotionStatus; // last year's status
  termMarks: TermMarks[];
  yearResult: YearResult | null;
}

// ─── Class / Section ────────────────────────────────────────────────────────

export interface K12Class {
  id: string;
  name: string;               // e.g. "7ème A"
  gradeLevel: GradeLevel;
  branch: Branch | null;
  academicYear: AcademicYear;
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
  gradeLevel: GradeLevel;
  branch: Branch | null;
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
  /** Subject catalog per grade level */
  subjectCatalog: Record<GradeLevel, SubjectDefinition[]>;
}

export interface SubjectDefinition {
  code: string;
  name: string;
  coefficient: number;
  isBonus: boolean;
  isBehavioral: boolean;
  isFrenchComposition: boolean;
  gradeLevel: GradeLevel;
}

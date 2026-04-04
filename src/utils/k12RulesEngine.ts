// ─── K12net Dashboard — Rules Engine ──────────────────────────────────────
// Implements the Lycée Sainte Marie de Cocody promotion rules for K12 schools.
// Rules are configurable per academic year.

import type {
  AcademicYear,
  Branch,
  BranchTransitionRule,
  DistinctionThresholds,
  GradeLevel,
  K12Student,
  K12YearRulesConfig,
  PromotionStatus,
  TermDistinction,
  TermId,
  TermMarks,
  TermResult,
  TermSanction,
  YearResult,
} from '../types/k12';
import { getGradeLevelGroup, isTerminalGrade, computeWeightedAverage } from '../types/k12';

// ─── Built-in Year Configs ──────────────────────────────────────────────────

/**
 * 2024 rules:
 *  - NonBonusSectionMarks for distinction check
 *  - French composition failure check
 *  - Grade-level differentiated TH thresholds (12.5 for 7-10, 12 for 11-13)
 *  - Repeating terminal grades → auto expelled
 */
const RULES_2024: K12YearRulesConfig = {
  academicYear: '2024',
  termDistinction: {
    '7-10': { thMin: 12.5, theMin: 13, thfMin: 14, thMax: 13, theMax: 14 },
    '11-13': { thMin: 12, theMin: 13, thfMin: 14, thMax: 13, theMax: 14 },
  },
  termSanction: { btiMax: 8.5, avtMax: 10, bmcMax: 10, amcMax: 11 },
  promotion: { promotionMin: 10, retainedMin: 8.5, repeatingPromotionMin: 10 },
  terminalGradePromotion: { nonRepeatingRetainedMin: 8.5, repeatingAutoExpelled: true },
  branchTransitions: buildBranchTransitions2024(),
  useNonBonusForDistinctionCheck: true,
  checkFrenchCompositionForDistinction: true,
};

/**
 * 2023 rules: same structure as 2024.
 * NonBonusSectionMarks, French composition check, grade-level TH differentiation.
 */
const RULES_2023: K12YearRulesConfig = {
  academicYear: '2023',
  termDistinction: {
    '7-10': { thMin: 12.5, theMin: 13, thfMin: 14, thMax: 13, theMax: 14 },
    '11-13': { thMin: 12, theMin: 13, thfMin: 14, thMax: 13, theMax: 14 },
  },
  termSanction: { btiMax: 8.5, avtMax: 10, bmcMax: 10, amcMax: 11 },
  promotion: { promotionMin: 10, retainedMin: 8.5, repeatingPromotionMin: 10 },
  terminalGradePromotion: { nonRepeatingRetainedMin: 8.5, repeatingAutoExpelled: true },
  branchTransitions: buildBranchTransitions2024(), // same as 2024
  useNonBonusForDistinctionCheck: true,
  checkFrenchCompositionForDistinction: true,
};

/**
 * 2022 rules:
 *  - Uses all SectionMarks (not non-bonus only)
 *  - No French composition check for distinction
 *  - Single TH threshold (12) for all grade levels
 *  - Repeating terminal grades → can be promoted at avg >= 8.5
 */
const RULES_2022: K12YearRulesConfig = {
  academicYear: '2022',
  termDistinction: {
    '7-10': { thMin: 12, theMin: 13, thfMin: 14, thMax: 13, theMax: 14 },
    '11-13': { thMin: 12, theMin: 13, thfMin: 14, thMax: 13, theMax: 14 },
  },
  termSanction: { btiMax: 8.5, avtMax: 10, bmcMax: 10, amcMax: 11 },
  promotion: { promotionMin: 10, retainedMin: 8.5, repeatingPromotionMin: 10 },
  terminalGradePromotion: { nonRepeatingRetainedMin: 8.5, repeatingAutoExpelled: false },
  branchTransitions: buildBranchTransitions2022(),
  useNonBonusForDistinctionCheck: false,
  checkFrenchCompositionForDistinction: false,
};

/** Registry of built-in rule configs by year */
export const BUILTIN_RULES: Record<AcademicYear, K12YearRulesConfig> = {
  '2024': RULES_2024,
  '2023': RULES_2023,
  '2022': RULES_2022,
};

// ─── Rules Engine ───────────────────────────────────────────────────────────

/**
 * Compute term distinction for a student in a given term.
 */
export function computeTermDistinction(
  termMarks: TermMarks,
  gradeLevel: GradeLevel,
  config: K12YearRulesConfig,
): TermDistinction {
  if (termMarks.isExempt || termMarks.weightedAverage === null) return null;

  const avg = termMarks.weightedAverage;
  const group = getGradeLevelGroup(gradeLevel);
  const thresholds: DistinctionThresholds = config.termDistinction[group];

  // Determine if distinction should be "avec réserve"
  const hasReserve = computeDistinctionRefused(termMarks, config);

  const thMax = thresholds.thMax ?? thresholds.theMin;
  const theMax = thresholds.theMax ?? thresholds.thfMin;

  // THF / THFR: avg >= thfMin
  if (avg >= thresholds.thfMin) {
    return hasReserve ? 'THFR' : 'THF';
  }
  // THE / THER: avg >= theMin && avg < theMax
  if (avg >= thresholds.theMin && avg < theMax) {
    return hasReserve ? 'THER' : 'THE';
  }
  // TH / THR: avg >= thMin && avg < thMax
  if (avg >= thresholds.thMin && avg < thMax) {
    return hasReserve ? 'THR' : 'TH';
  }

  return null;
}

/**
 * Determine if the student's distinction should be "avec réserve".
 * True when the student has at least one non-bonus subject below 10
 * or has failed french composition (2023+ rules).
 */
function computeDistinctionRefused(
  termMarks: TermMarks,
  config: K12YearRulesConfig,
): boolean {
  // Check failed subjects
  const failedCount = config.useNonBonusForDistinctionCheck
    ? termMarks.failedSubjectCount   // non-bonus only (2023+)
    : termMarks.subjectMarks.filter(m => m.mark !== null && m.mark < 10).length; // all subjects (2022)
  if (failedCount > 0) return true;

  // Check French composition (2023+)
  if (config.checkFrenchCompositionForDistinction && termMarks.hasFailedFrenchComposition) {
    return true;
  }

  return false;
}

/**
 * Compute term sanction for a student in a given term.
 * Sanctions are mutually exclusive and evaluated in priority order:
 *   BTI > AVT > BMC > AMC
 */
export function computeTermSanction(
  termMarks: TermMarks,
  config: K12YearRulesConfig,
): TermSanction {
  if (termMarks.isExempt || termMarks.weightedAverage === null) return null;

  const avg = termMarks.weightedAverage;
  const thresholds = config.termSanction;

  // BTI: avg < 8.5
  if (avg < thresholds.btiMax) return 'BTI';

  // AVT: avg < 10 (but >= 8.5, since BTI already caught lower)
  if (avg < thresholds.avtMax) return 'AVT';

  // BMC: behavioral < 10 (only if avg >= 10, since AVT already caught lower)
  const behavioralMark = termMarks.subjectMarks.find(m => m.isBehavioral);
  if (behavioralMark && behavioralMark.mark !== null && behavioralMark.mark < thresholds.bmcMax) {
    return 'BMC';
  }

  // AMC: behavioral < 11 (but >= 10, since BMC already caught lower)
  if (behavioralMark && behavioralMark.mark !== null && behavioralMark.mark < thresholds.amcMax) {
    return 'AMC';
  }

  return null;
}

/**
 * Compute a single term result (distinction + sanction) for a student.
 */
export function computeTermResult(
  termMarks: TermMarks,
  gradeLevel: GradeLevel,
  config: K12YearRulesConfig,
): Omit<TermResult, 'rank' | 'totalStudents'> {
  return {
    termId: termMarks.termId,
    termAverage: termMarks.weightedAverage,
    distinction: computeTermDistinction(termMarks, gradeLevel, config),
    sanction: computeTermSanction(termMarks, config),
    isExempt: termMarks.isExempt,
  };
}

/**
 * Compute the annual promotion decision for a student.
 */
export function computePromotionStatus(
  yearAverage: number | null,
  gradeLevel: GradeLevel,
  isRepeating: boolean,
  config: K12YearRulesConfig,
): PromotionStatus {
  if (yearAverage === null) return null;

  const isTerminal = isTerminalGrade(gradeLevel);

  // ─── Terminal grade special cases (10ème, Terminale) ──────────────
  if (isTerminal) {
    if (isRepeating) {
      // 2023-2024: repeating terminal = auto expelled
      if (config.terminalGradePromotion.repeatingAutoExpelled) {
        return 'EXCLU';
      }
      // 2022: repeating terminal, promoted if >= retained threshold
      return yearAverage >= config.terminalGradePromotion.nonRepeatingRetainedMin
        ? 'ADMIS'
        : 'EXCLU';
    }
    // Non-repeating terminal
    if (yearAverage >= config.terminalGradePromotion.nonRepeatingRetainedMin) {
      return 'REDOUBLE'; // retained — can repeat once
    }
    return 'EXCLU';
  }

  // ─── Regular grades (7-12, excluding terminals) ──────────────────
  if (isRepeating) {
    // Repeating student: promoted at >= 10, expelled otherwise
    return yearAverage >= config.promotion.repeatingPromotionMin
      ? 'ADMIS'
      : 'EXCLU';
  }

  // Non-repeating student
  if (yearAverage >= config.promotion.promotionMin) return 'ADMIS';
  if (yearAverage >= config.promotion.retainedMin) return 'REDOUBLE';
  return 'EXCLU';
}

/**
 * Compute the suggested branch for a promoted lycée student.
 */
export function computeSuggestedBranch(
  student: K12Student,
  promotionStatus: PromotionStatus,
  config: K12YearRulesConfig,
): Branch | null {
  if (!student.branch) return null; // collège students have no branch

  // Only compute for promoted or retained students
  if (promotionStatus !== 'ADMIS' && promotionStatus !== 'REDOUBLE') return null;

  // For retained students, keep same branch (with specific overrides)
  const transitions = config.branchTransitions.filter(
    t =>
      t.fromGradeLevel === student.gradeLevel &&
      t.fromBranch === student.branch &&
      t.isRepeating === student.isRepeating,
  );

  // Find the first matching transition (most specific first)
  for (const rule of transitions) {
    if (matchesBranchConditions(student, rule)) {
      return rule.toBranch;
    }
  }

  // Default: keep current branch
  return student.branch;
}

function matchesBranchConditions(
  student: K12Student,
  rule: BranchTransitionRule,
): boolean {
  if (!rule.conditions) return true;

  const yearAvg = student.yearResult?.yearAverage ?? 0;

  // Check minimum year average
  if (rule.conditions.minYearAverage !== undefined) {
    if (yearAvg < rule.conditions.minYearAverage) return false;
  }

  // Check required course grades
  if (rule.conditions.courseMinGrades) {
    for (const [courseCode, minGrade] of Object.entries(rule.conditions.courseMinGrades)) {
      const courseGrade = findCourseYearGrade(student, courseCode);
      if (courseGrade === null || courseGrade < minGrade) return false;
    }
  }

  return true;
}

/**
 * Find a student's year grade for a specific course.
 * Looks across all terms and computes the average.
 */
function findCourseYearGrade(student: K12Student, courseCode: string): number | null {
  const marks: number[] = [];
  for (const tm of student.termMarks) {
    const subject = tm.subjectMarks.find(s => s.subjectCode === courseCode);
    if (subject && subject.mark !== null) {
      marks.push(subject.mark);
    }
  }
  if (marks.length === 0) return null;
  return marks.reduce((a, b) => a + b, 0) / marks.length;
}

/**
 * Compute the complete year result (all terms + promotion) for a student.
 * Year average is computed as weighted average of per-subject year averages:
 *   Σ(subject_yearAvg × coef) / Σ(coef)
 * This matches K12net's calculation.
 */
export function computeYearResult(
  student: K12Student,
  config: K12YearRulesConfig,
): YearResult {
  // Compute each term result
  const termResults: TermResult[] = student.termMarks.map(tm => ({
    ...computeTermResult(tm, student.gradeLevel, config),
    rank: 0,
    totalStudents: 0,
  }));

  // Year average = weighted average of per-subject year averages
  // Uses subject yearAverage (from Excel "Fin d'année" or computed mean of term averages)
  const yearAverage = computeWeightedAverage(
    student.subjectGrades
      .filter(sg => !sg.isBonus && sg.coefficient > 0)
      .map(sg => ({ mark: sg.yearAverage, coefficient: sg.coefficient }))
  );

  const promotionStatus = computePromotionStatus(
    yearAverage,
    student.gradeLevel,
    student.isRepeating,
    config,
  );

  const suggestedBranch = computeSuggestedBranch(
    { ...student, yearResult: { yearAverage, termResults, promotionStatus, isRepeating: student.isRepeating, suggestedBranch: null, rank: 0, totalStudents: 0 } },
    promotionStatus,
    config,
  );

  return {
    yearAverage,
    termResults,
    promotionStatus,
    isRepeating: student.isRepeating,
    suggestedBranch,
    rank: 0,
    totalStudents: 0,
  };
}

/**
 * Process a full class: compute year results and assign ranks.
 * Returns the students sorted by year average descending.
 */
export function processClass(
  students: K12Student[],
  config: K12YearRulesConfig,
): K12Student[] {
  // Compute year results
  const processed = students.map(s => ({
    ...s,
    yearResult: computeYearResult(s, config),
  }));

  // Assign year ranks
  assignYearRanks(processed);

  // Assign term ranks
  const termIds: TermId[] = ['T1', 'T2', 'T3'];
  for (const termId of termIds) {
    assignTermRanks(processed, termId);
  }

  return processed;
}

/**
 * Assign ranks based on year average (descending, ex-aequo handling).
 */
function assignYearRanks(students: K12Student[]): void {
  const withAvg = students
    .filter(s => s.yearResult?.yearAverage !== null)
    .sort((a, b) => (b.yearResult!.yearAverage ?? 0) - (a.yearResult!.yearAverage ?? 0));

  const total = withAvg.length;
  let rank = 1;
  for (let i = 0; i < withAvg.length; i++) {
    if (i > 0 && withAvg[i].yearResult!.yearAverage !== withAvg[i - 1].yearResult!.yearAverage) {
      rank = i + 1;
    }
    withAvg[i].yearResult!.rank = rank;
    withAvg[i].yearResult!.totalStudents = total;
  }
}

/**
 * Assign ranks for a specific term (descending, ex-aequo handling).
 */
function assignTermRanks(students: K12Student[], termId: TermId): void {
  const withTerm = students.filter(s => {
    const tr = s.yearResult?.termResults.find(t => t.termId === termId);
    return tr && tr.termAverage !== null && !tr.isExempt;
  });

  withTerm.sort((a, b) => {
    const aAvg = a.yearResult!.termResults.find(t => t.termId === termId)!.termAverage!;
    const bAvg = b.yearResult!.termResults.find(t => t.termId === termId)!.termAverage!;
    return bAvg - aAvg;
  });

  const total = withTerm.length;
  let rank = 1;
  for (let i = 0; i < withTerm.length; i++) {
    const tr = withTerm[i].yearResult!.termResults.find(t => t.termId === termId)!;
    if (i > 0) {
      const prevTr = withTerm[i - 1].yearResult!.termResults.find(t => t.termId === termId)!;
      if (tr.termAverage !== prevTr.termAverage) {
        rank = i + 1;
      }
    }
    tr.rank = rank;
    tr.totalStudents = total;
  }
}

/**
 * Get the rules configuration for a given academic year.
 * Falls back to the most recent built-in config if no custom config is found.
 */
export function getRulesForYear(
  year: AcademicYear,
  customConfigs?: Record<AcademicYear, K12YearRulesConfig>,
): K12YearRulesConfig {
  // Check custom configs first
  if (customConfigs?.[year]) return customConfigs[year];
  // Check built-in
  if (BUILTIN_RULES[year]) return BUILTIN_RULES[year];
  // Fallback to most recent
  return RULES_2024;
}

// ─── Dashboard Statistics ───────────────────────────────────────────────────

export interface K12ClassStats {
  totalStudents: number;
  promoted: number;
  retained: number;
  expelled: number;
  noResult: number;
  averageClassGrade: number | null;
  highestAverage: number | null;
  lowestAverage: number | null;
  termStats: Record<TermId, TermStats>;
}

export interface TermStats {
  totalStudents: number;
  averageGrade: number | null;
  distinctions: {
    TH: number; THR: number;
    THE: number; THER: number;
    THF: number; THFR: number;
  };
  sanctions: {
    BTI: number; AVT: number;
    BMC: number; AMC: number;
  };
  exempt: number;
}

export function computeClassStats(students: K12Student[]): K12ClassStats {
  const total = students.length;
  let promoted = 0, retained = 0, expelled = 0, noResult = 0;
  const yearAverages: number[] = [];

  for (const s of students) {
    const yr = s.yearResult;
    if (!yr || yr.promotionStatus === null) { noResult++; continue; }
    switch (yr.promotionStatus) {
      case 'ADMIS': promoted++; break;
      case 'REDOUBLE': retained++; break;
      case 'EXCLU': expelled++; break;
    }
    if (yr.yearAverage !== null) yearAverages.push(yr.yearAverage);
  }

  const termStats: Record<TermId, TermStats> = {
    T1: computeTermStats(students, 'T1'),
    T2: computeTermStats(students, 'T2'),
    T3: computeTermStats(students, 'T3'),
  };

  return {
    totalStudents: total,
    promoted,
    retained,
    expelled,
    noResult,
    averageClassGrade: yearAverages.length > 0
      ? yearAverages.reduce((a, b) => a + b, 0) / yearAverages.length
      : null,
    highestAverage: yearAverages.length > 0 ? Math.max(...yearAverages) : null,
    lowestAverage: yearAverages.length > 0 ? Math.min(...yearAverages) : null,
    termStats,
  };
}

function computeTermStats(students: K12Student[], termId: TermId): TermStats {
  const distinctions = { TH: 0, THR: 0, THE: 0, THER: 0, THF: 0, THFR: 0 };
  const sanctions = { BTI: 0, AVT: 0, BMC: 0, AMC: 0 };
  let exempt = 0;
  const averages: number[] = [];

  for (const s of students) {
    const tr = s.yearResult?.termResults.find(t => t.termId === termId);
    if (!tr) continue;
    if (tr.isExempt) { exempt++; continue; }
    if (tr.termAverage !== null) averages.push(tr.termAverage);
    if (tr.distinction && tr.distinction in distinctions) {
      distinctions[tr.distinction as keyof typeof distinctions]++;
    }
    if (tr.sanction && tr.sanction in sanctions) {
      sanctions[tr.sanction as keyof typeof sanctions]++;
    }
  }

  return {
    totalStudents: students.length,
    averageGrade: averages.length > 0
      ? averages.reduce((a, b) => a + b, 0) / averages.length
      : null,
    distinctions,
    sanctions,
    exempt,
  };
}

// ─── Branch Transitions ─────────────────────────────────────────────────────

function buildBranchTransitions2024(): BranchTransitionRule[] {
  return [
    // ─── Repeating 11ème (Seconde) ───
    { fromGradeLevel: '11', fromBranch: 'C', toBranch: 'D', isRepeating: true },
    { fromGradeLevel: '11', fromBranch: 'A', toBranch: 'A2', isRepeating: true },
    // ─── Non-Repeating 11ème ───
    {
      fromGradeLevel: '11', fromBranch: 'C', toBranch: 'C', isRepeating: false,
      conditions: { minYearAverage: 13, courseMinGrades: { 'Mat11C': 14, 'PC11C': 14, 'SVT11C': 12 } },
    },
    { fromGradeLevel: '11', fromBranch: 'C', toBranch: 'D', isRepeating: false },
    { fromGradeLevel: '11', fromBranch: 'A', toBranch: 'A2', isRepeating: false },
    // ─── Repeating 12ème (Première) ───
    {
      fromGradeLevel: '12', fromBranch: 'D', toBranch: 'D', isRepeating: true,
      conditions: { minYearAverage: 10, courseMinGrades: { 'Mat12D': 11, 'PC12D': 11, 'SVT12D': 12 } },
    },
    { fromGradeLevel: '12', fromBranch: 'D', toBranch: 'A1', isRepeating: true },
    { fromGradeLevel: '12', fromBranch: 'A2', toBranch: 'A2', isRepeating: true },
    // ─── Non-Repeating 12ème ───
    {
      fromGradeLevel: '12', fromBranch: 'A2', toBranch: 'A1', isRepeating: false,
      conditions: { minYearAverage: 12, courseMinGrades: { 'Mat12A2': 12 } },
    },
    {
      fromGradeLevel: '12', fromBranch: 'D', toBranch: 'D', isRepeating: false,
      conditions: { minYearAverage: 10, courseMinGrades: { 'Mat12D': 11, 'PC12D': 11, 'SVT12D': 12 } },
    },
    {
      fromGradeLevel: '12', fromBranch: 'C', toBranch: 'C', isRepeating: false,
      conditions: { minYearAverage: 13, courseMinGrades: { 'Mat12C': 13, 'PC12C': 13, 'SVT12C': 12 } },
    },
    { fromGradeLevel: '12', fromBranch: 'D', toBranch: 'A1', isRepeating: false },
    { fromGradeLevel: '12', fromBranch: 'A2', toBranch: 'A2', isRepeating: false },
  ];
}

function buildBranchTransitions2022(): BranchTransitionRule[] {
  return [
    // ─── Repeating 11ème ───
    { fromGradeLevel: '11', fromBranch: 'C', toBranch: 'D', isRepeating: true },
    { fromGradeLevel: '11', fromBranch: 'A', toBranch: 'A2', isRepeating: true },
    // ─── Non-Repeating 11ème ───
    {
      fromGradeLevel: '11', fromBranch: 'C', toBranch: 'C', isRepeating: false,
      conditions: { minYearAverage: 12.5, courseMinGrades: { 'Mat11C': 13, 'PC11C': 13 } },
    },
    {
      fromGradeLevel: '11', fromBranch: 'A', toBranch: 'A1', isRepeating: false,
      conditions: { minYearAverage: 12, courseMinGrades: { 'Mat11A': 13 } },
    },
    { fromGradeLevel: '11', fromBranch: 'C', toBranch: 'D', isRepeating: false },
    { fromGradeLevel: '11', fromBranch: 'A', toBranch: 'A2', isRepeating: false },
    // ─── Repeating 12ème ───
    { fromGradeLevel: '12', fromBranch: 'D', toBranch: 'D', isRepeating: true },
    { fromGradeLevel: '12', fromBranch: 'C', toBranch: 'C', isRepeating: true },
    { fromGradeLevel: '12', fromBranch: 'A2', toBranch: 'A2', isRepeating: true },
    // ─── Non-Repeating 12ème ───
    {
      fromGradeLevel: '12', fromBranch: 'A2', toBranch: 'A1', isRepeating: false,
      conditions: { minYearAverage: 12, courseMinGrades: { 'Mat12A2': 13 } },
    },
    { fromGradeLevel: '12', fromBranch: 'D', toBranch: 'D', isRepeating: false },
    { fromGradeLevel: '12', fromBranch: 'C', toBranch: 'C', isRepeating: false },
    { fromGradeLevel: '12', fromBranch: 'A2', toBranch: 'A2', isRepeating: false },
    { fromGradeLevel: '12', fromBranch: 'A1', toBranch: 'A1', isRepeating: false },
  ];
}

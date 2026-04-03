import type {
  CourseStructure, ParsedExcel, Student, StudentUEResult, StudentECUEResult,
  StudentStatus, Session, ClassInfo, ClassPair, AnnualStudent, CreditOverride,
  MultiClassData, ValidationRules,
} from '../types';
import { DEFAULT_VALIDATION_RULES } from '../types';
import { matchECUEToCourses, extractClassMetadata, filterCoursesByHomeroom, normalizeSemester } from './excelParser';

/**
 * Assign ranks with ex æquo support.
 * Students with the same average get the same rank; the next rank skips.
 * E.g. 1, 2ex, 2ex, 4
 */
export function assignRanks<T extends { rank: number; isExAequo: boolean }>(
  items: T[],
  getAvg: (item: T) => number,
): void {
  if (items.length === 0) return;
  items.sort((a, b) => getAvg(b) - getAvg(a));
  items[0].rank = 1;
  items[0].isExAequo = false;
  for (let i = 1; i < items.length; i++) {
    if (getAvg(items[i]) === getAvg(items[i - 1])) {
      items[i].rank = items[i - 1].rank;
      items[i].isExAequo = true;
      items[i - 1].isExAequo = true;
    } else {
      items[i].rank = i + 1;
      items[i].isExAequo = false;
    }
  }
}

function computeECUEAverage(ccc: number | null, ets: number | null, fileAvg: number | null): number | null {
  // Prefer the file's computed value (more accurate)
  if (fileAvg !== null) return fileAvg;
  if (ccc !== null && ets !== null) return round2(0.4 * ccc + 0.6 * ets);
  if (ets !== null) return ets;
  if (ccc !== null) return ccc;
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeUEAverage(ecueResults: StudentECUEResult[]): number {
  const creditedEcues = ecueResults.filter(e => e.credits > 0 && e.average !== null);
  if (creditedEcues.length === 0) return 0;
  const totalWeighted = creditedEcues.reduce((sum, e) => sum + (e.average! * e.credits), 0);
  const totalCredits = creditedEcues.reduce((sum, e) => sum + e.credits, 0);
  return totalCredits > 0 ? round2(totalWeighted / totalCredits) : 0;
}

function computeSemesterAverage(ueResults: StudentUEResult[], courses: CourseStructure): number {
  const creditedUes = ueResults.filter(u => {
    const ue = courses.ues[u.ueCode];
    return ue && ue.totalCredits > 0;
  });
  const totalWeighted = creditedUes.reduce((sum, u) => sum + u.average * u.totalCredits, 0);
  const totalCredits = creditedUes.reduce((sum, u) => sum + u.totalCredits, 0);
  return totalCredits > 0 ? round2(totalWeighted / totalCredits) : 0;
}

export function calculateStudents(
  parsed: ParsedExcel,
  courses: CourseStructure,
  rules: ValidationRules = DEFAULT_VALIDATION_RULES,
): Student[] {
  const ecueMapping = matchECUEToCourses(parsed.ecueColumns, courses);

  const students = parsed.studentRows.map((row) => {
    // ── Build ECUE results ─────────────────────────────────────────────────
    const allECUEResults: StudentECUEResult[] = ecueMapping.map((mapping, idx) => {
      const grade = row.grades[idx];
      const ecueInfo = courses.ecues[mapping.ecueCode];
      const average = grade ? computeECUEAverage(grade.ccc, grade.ets, grade.fileAvg) : null;

      return {
        ecueCode: mapping.ecueCode,
        ecueName: (ecueInfo?.name && ecueInfo.name !== ecueInfo.code)
          ? ecueInfo.name
          : parsed.ecueColumns[idx]?.normalizedName ?? '',
        credits: ecueInfo?.credits ?? 0,
        ccc: grade?.ccc ?? null,
        ets: grade?.ets ?? null,
        session1: grade?.session1 ?? null,
        session2: grade?.session2 ?? null,
        fileAvg: grade?.fileAvg ?? null,
        average,
        validated: average !== null && average >= rules.ecue.passMark,
        approved: grade?.approved ?? true,
        approvalFlags: grade?.approvalFlags ?? {
          ccc: true,
          ets: true,
          session1: true,
          session2: true,
          fileAvg: true,
        },
      };
    });

    // Build a lookup of ecueCode → matchedUECode (from grade report's row-5 grouping)
    const ecueToUEMap: Record<string, string> = {};
    ecueMapping.forEach(m => { if (m.ecueCode) ecueToUEMap[m.ecueCode] = m.matchedUECode; });

    // ── Build UE results ───────────────────────────────────────────────────
    const ueResults: StudentUEResult[] = courses.orderedUeCodes
      .filter(ueCode => courses.ues[ueCode]?.totalCredits > 0) // skip 0-credit UEs
      .map((ueCode) => {
        const ueInfo = courses.ues[ueCode];
        const ecueResults = allECUEResults.filter(e => {
          // Use matchedUECode (derived from grade report row-5 grouping) as primary source
          const mapped = ecueToUEMap[e.ecueCode];
          if (mapped) return mapped === ueCode;
          // Fallback: use section list code-based ueCode
          const info = courses.ecues[e.ecueCode];
          return info?.ueCode === ueCode;
        });

        const average = computeUEAverage(ecueResults);

        // ── UE validation: supports grade / credits / both modes ─────────
        const gradeOk = average >= rules.ue.passMark;
        // Partial credits: sum of individually validated ECUEs (used for 'credits'/'both' mode)
        const capitalizedCredits = ecueResults
          .filter(e => e.validated && e.credits > 0)
          .reduce((sum, e) => sum + e.credits, 0);
        const creditsOk = capitalizedCredits >= (rules.ue.minCredits ?? 0);
        const mode = rules.ue.validationMode ?? 'grade';
        const validated =
          mode === 'grade'   ? gradeOk :
          mode === 'credits' ? creditsOk :
          /* 'both' */         gradeOk && creditsOk;

        // Compensation: UE validated but at least one ECUE below pass mark
        const hasFailedECUE = ecueResults.some(e => e.credits > 0 && e.average !== null && e.average < rules.ecue.passMark);
        const compensated = validated && hasFailedECUE;

        // Credit capitalisation: when UE fails and rule is enabled,
        // individually validated ECUEs still earn their own credits.
        const creditsEarned = validated
          ? ueInfo.totalCredits
          : rules.ue.capitalizeEcueCredits
            ? capitalizedCredits
            : 0;

        return {
          ueCode,
          ueName: ueInfo.name,
          totalCredits: ueInfo.totalCredits,
          creditsEarned,
          average,
          validated,
          compensated,
          ecueResults,
        };
      })
      .filter(ue => ue.ecueResults.length > 0); // exclude UEs with no graded ECUEs (e.g. coaching)

    // ── Semester totals ────────────────────────────────────────────────────
    const totalCredits = ueResults.reduce((s, u) => s + u.creditsEarned, 0);
    const maxCredits = ueResults.reduce((s, u) => s + u.totalCredits, 0);
    const semesterAverage = computeSemesterAverage(ueResults, courses);

    // ── Status (dynamic based on actual total credits) ───────────────────
    const creditThreshold = rules.semester.autoriseMode === 'absolute'
      ? (rules.semester.autoriseMinCreditsAbsolute ?? 0)
      : Math.floor(maxCredits * rules.semester.autoriseMinCreditsRatio);
    let status: StudentStatus;
    if (totalCredits === maxCredits) {
      status = 'ADMIS';
    } else if (totalCredits >= creditThreshold) {
      status = 'AUTORISÉ';
    } else {
      status = 'AJOURNÉ';
    }

    // ── Session ──────────────────────────────────────────────────────────
    const hasSR = allECUEResults.some(e => e.session2 !== null);
    const session: Session = hasSR ? 'SR' : 'S1';

    // ── Repêchage ────────────────────────────────────────────────────────
    const failedUEs = ueResults.filter(u => !u.validated && u.totalCredits > 0);
    let eligibleRepechage = false;
    let repechageUECode: string | null = null;
    let repechageUEAvg: number | null = null;

    if (
      rules.repechage.enabled &&
      status === 'AUTORISÉ' &&
      totalCredits >= creditThreshold &&
      failedUEs.length <= rules.repechage.maxFailedUEs
    ) {
      const failedUE = failedUEs[0];
      if (failedUE && failedUE.average >= rules.repechage.minUEAverage) {
        eligibleRepechage = true;
        repechageUECode = failedUE.ueCode;
        repechageUEAvg = failedUE.average;
      }
    }

    return {
      rank: row.rank,
      matricule: row.matricule,
      name: row.name,
      isExAequo: row.isExAequo,
      fileAverage: row.fileAverage,
      fileRank: row.fileRank,
      ueResults,
      totalCredits,
      semesterAverage,
      status,
      session,
      eligibleRepechage,
      repechageUECode,
      repechageUEAvg,
    };
  });

  // Assign ranks with ex æquo support
  assignRanks(students, s => s.semesterAverage);

  return students;
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

export function computeStats(students: Student[]) {
  const avgs = students.map(s => s.semesterAverage).filter(v => v > 0);
  if (avgs.length === 0) return { mean: 0, median: 0, stddev: 0, min: 0, max: 0 };

  const mean = round2(avgs.reduce((a, b) => a + b, 0) / avgs.length);
  const sorted = [...avgs].sort((a, b) => a - b);
  const median = round2(sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]);
  const variance = avgs.reduce((s, v) => s + (v - mean) ** 2, 0) / avgs.length;
  const stddev = round2(Math.sqrt(variance));
  const min = round2(sorted[0]);
  const max = round2(sorted[sorted.length - 1]);

  return { mean, median, stddev, min, max };
}

export function getStatusCounts(students: Student[]) {
  const counts = { ADMIS: 0, AUTORISÉ: 0, AJOURNÉ: 0 };
  const s1Counts = { ADMIS: 0, AUTORISÉ: 0, AJOURNÉ: 0 };
  const srCounts = { ADMIS: 0, AUTORISÉ: 0, AJOURNÉ: 0 };
  for (const s of students) {
    counts[s.status]++;
    if (s.session === 'S1') s1Counts[s.status]++;
    else srCounts[s.status]++;
  }
  return { counts, s1Counts, srCounts };
}

export interface SRStudentInfo {
  student: Student;
  failedECUEs: { ecueName: string; ecueCode: string; average: number }[];
}

/** Students eligible for Session de Rattrapage: those with at least one ECUE average < 10 */
export function getSREligibleStudents(students: Student[]): SRStudentInfo[] {
  const result: SRStudentInfo[] = [];
  for (const s of students) {
    const failedECUEs: SRStudentInfo['failedECUEs'] = [];
    for (const ue of s.ueResults) {
      for (const ecue of ue.ecueResults) {
        if (ecue.average !== null && ecue.average < 10 && ecue.credits > 0) {
          failedECUEs.push({ ecueName: ecue.ecueName, ecueCode: ecue.ecueCode, average: ecue.average });
        }
      }
    }
    if (failedECUEs.length > 0) {
      result.push({ student: s, failedECUEs });
    }
  }
  return result;
}

export function getUEStats(students: Student[]) {
  if (students.length === 0) return [];
  const ueResults = students[0].ueResults;
  return ueResults.map(ue => {
    const allAvgs = students
      .map(s => s.ueResults.find(u => u.ueCode === ue.ueCode)?.average ?? 0)
      .filter(v => v > 0);
    const validatedCount = students.filter(
      s => s.ueResults.find(u => u.ueCode === ue.ueCode)?.validated
    ).length;
    return {
      ueCode: ue.ueCode,
      ueName: ue.ueName,
      validationRate: round2((validatedCount / students.length) * 100),
      avgGrade: allAvgs.length > 0
        ? round2(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length)
        : 0,
    };
  });
}

// ─── Credit overrides ────────────────────────────────────────────────────────

export function applyCreditOverrides(
  courses: CourseStructure,
  overrides: CreditOverride[],
  homeroom: string,
): CourseStructure {
  if (overrides.length === 0) return courses;

  // Deep clone
  const cloned: CourseStructure = {
    orderedUeCodes: [...courses.orderedUeCodes],
    ues: {},
    ecues: {},
  };
  for (const [k, v] of Object.entries(courses.ues)) {
    cloned.ues[k] = { ...v, ecueCodes: [...v.ecueCodes], homerooms: [...v.homerooms] };
  }
  for (const [k, v] of Object.entries(courses.ecues)) {
    cloned.ecues[k] = { ...v, homerooms: [...v.homerooms] };
  }

  // Apply overrides: global first (homeroom=''), then homeroom-specific
  const sorted = [...overrides].sort((a, b) => {
    if (a.homeroom === '' && b.homeroom !== '') return -1;
    if (a.homeroom !== '' && b.homeroom === '') return 1;
    return 0;
  });

  for (const ov of sorted) {
    if (ov.homeroom !== '' && ov.homeroom !== homeroom) continue;
    if (cloned.ecues[ov.ecueCode]) {
      cloned.ecues[ov.ecueCode].credits = ov.credits;
    }
  }

  // Recalculate UE totalCredits
  for (const ueCode of cloned.orderedUeCodes) {
    const ue = cloned.ues[ueCode];
    if (!ue) continue;
    ue.totalCredits = ue.ecueCodes.reduce((s, ec) => s + (cloned.ecues[ec]?.credits ?? 0), 0);
  }

  return cloned;
}

// ─── Multi-class orchestrator ─────────────────────────────────────────────────

export function calculateAllClasses(
  parsedSheets: ParsedExcel[],
  courses: CourseStructure,
  creditOverrides: CreditOverride[] = [],
  rules: ValidationRules = DEFAULT_VALIDATION_RULES,
): MultiClassData {
  const hasHomerooms = Object.values(courses.ues).some(u => u.homerooms.length > 0);

  const classes: ClassInfo[] = parsedSheets.map((parsed) => {
    let filteredCourses = courses;
    if (hasHomerooms) {
      filteredCourses = filterCoursesByHomeroom(courses, parsed.groupName);
    }
    // Apply credit overrides
    if (creditOverrides.length > 0) {
      filteredCourses = applyCreditOverrides(filteredCourses, creditOverrides, parsed.groupName);
    }

    const students = calculateStudents(parsed, filteredCourses, rules);
    const meta = extractClassMetadata(parsed, parsed.groupName);
    return {
      sheetName: parsed.groupName,
      groupName: parsed.groupName,
      niveau: meta.niveau,
      filiere: meta.filiere,
      semester: parsed.semester,
      date: parsed.date,
      level: parsed.level,
      parsedExcel: parsed,
      students,
    };
  });

  const classPairs = pairClasses(classes, rules);
  const allNiveaux = [...new Set(classes.map(c => c.niveau))].sort();
  const allFilieres = [...new Set(classes.map(c => c.filiere))].sort();

  return { courses, classes, classPairs, allNiveaux, allFilieres };
}

// ─── Semester pairing ────────────────────────────────────────────────────────

export function pairClasses(classes: ClassInfo[], rules: ValidationRules = DEFAULT_VALIDATION_RULES): ClassPair[] {
  // Group by groupName
  const groups = new Map<string, ClassInfo[]>();
  for (const c of classes) {
    const existing = groups.get(c.groupName) ?? [];
    existing.push(c);
    groups.set(c.groupName, existing);
  }

  const pairs: ClassPair[] = [];
  for (const [groupName, group] of groups) {
    let s1: ClassInfo | null = null;
    let s2: ClassInfo | null = null;

    for (const c of group) {
      const sem = normalizeSemester(c.semester);
      if (sem === 'S1' && !s1) s1 = c;
      else if (sem === 'S2' && !s2) s2 = c;
    }

    // If we couldn't identify semesters and there's only 1 sheet, treat it as S1
    if (!s1 && !s2 && group.length === 1) {
      s1 = group[0];
    }

    const s1Max = s1 ? s1.students[0]?.ueResults.reduce((s, u) => s + u.totalCredits, 0) ?? 0 : 0;
    const s2Max = s2 ? s2.students[0]?.ueResults.reduce((s, u) => s + u.totalCredits, 0) ?? 0 : 0;

    const annualStudents = computeAnnualStudents(
      s1?.students ?? null,
      s2?.students ?? null,
      s1Max,
      s2Max,
      rules,
    );

    pairs.push({
      groupName,
      niveau: (s1 ?? s2)!.niveau,
      filiere: (s1 ?? s2)!.filiere,
      s1,
      s2,
      annualStudents,
    });
  }

  return pairs;
}

export function computeAnnualStudents(
  s1Students: Student[] | null,
  s2Students: Student[] | null,
  s1MaxCredits: number,
  s2MaxCredits: number,
  rules: ValidationRules = DEFAULT_VALIDATION_RULES,
): AnnualStudent[] {
  const byMatricule = new Map<string, { s1: Student | null; s2: Student | null }>();

  if (s1Students) {
    for (const s of s1Students) {
      byMatricule.set(s.matricule, { s1: s, s2: null });
    }
  }
  if (s2Students) {
    for (const s of s2Students) {
      const existing = byMatricule.get(s.matricule);
      if (existing) {
        existing.s2 = s;
      } else {
        byMatricule.set(s.matricule, { s1: null, s2: s });
      }
    }
  }

  const maxCreditsAnnual = s1MaxCredits + s2MaxCredits;
  const results: AnnualStudent[] = [];

  for (const [matricule, { s1, s2 }] of byMatricule) {
    const totalCreditsS1 = s1?.totalCredits ?? 0;
    const totalCreditsS2 = s2?.totalCredits ?? 0;
    const totalCreditsAnnual = totalCreditsS1 + totalCreditsS2;

    // Weighted average by max credits of each semester
    const s1w = s1 ? s1.semesterAverage * s1MaxCredits : 0;
    const s2w = s2 ? s2.semesterAverage * s2MaxCredits : 0;
    const totalWeight = (s1 ? s1MaxCredits : 0) + (s2 ? s2MaxCredits : 0);
    const annualAverage = totalWeight > 0 ? round2((s1w + s2w) / totalWeight) : 0;

    // Status
    const creditThreshold = rules.annual.autoriseMode === 'absolute'
      ? (rules.annual.autoriseMinCreditsAbsolute ?? 0)
      : Math.floor(maxCreditsAnnual * rules.annual.autoriseMinCreditsRatio);
    let annualStatus: StudentStatus;
    if (totalCreditsAnnual === maxCreditsAnnual) {
      annualStatus = 'ADMIS';
    } else if (totalCreditsAnnual >= creditThreshold) {
      annualStatus = 'AUTORISÉ';
    } else {
      annualStatus = 'AJOURNÉ';
    }

    results.push({
      matricule,
      name: (s1 ?? s2)!.name,
      isExAequo: (s1 ?? s2)!.isExAequo,
      s1,
      s2,
      annualAverage,
      totalCreditsS1,
      totalCreditsS2,
      maxCreditsS1: s1 ? s1MaxCredits : 0,
      maxCreditsS2: s2 ? s2MaxCredits : 0,
      totalCreditsAnnual,
      maxCreditsAnnual,
      annualStatus,
      rank: 0,
    });
  }

  // Sort by annual average descending and assign ranks with ex æquo
  assignRanks(results, s => s.annualAverage);

  return results;
}

// ─── Annual → Student adapter ────────────────────────────────────────────────

export function annualToStudent(a: AnnualStudent): Student {
  return {
    rank: a.rank,
    matricule: a.matricule,
    name: a.name,
    isExAequo: a.isExAequo,
    fileAverage: null,
    fileRank: null,
    ueResults: [],
    totalCredits: a.totalCreditsAnnual,
    semesterAverage: a.annualAverage,
    status: a.annualStatus,
    session: 'S1',
    eligibleRepechage: false,
    repechageUECode: null,
    repechageUEAvg: null,
    s1Average: a.s1?.semesterAverage ?? null,
    s2Average: a.s2?.semesterAverage ?? null,
  };
}

export function getECUEStats(students: Student[]) {
  if (students.length === 0) return [];
  const firstStudentUEs = students[0].ueResults;
  const results: { code: string; name: string; avg: number; validationRate: number; ueCode: string }[] = [];

  for (const ue of firstStudentUEs) {
    for (const ecue of ue.ecueResults) {
      const allAvgs = students.flatMap(s =>
        s.ueResults
          .find(u => u.ueCode === ue.ueCode)
          ?.ecueResults.filter(e => e.ecueCode === ecue.ecueCode)
          .map(e => e.average ?? 0)
          .filter(v => v > 0) ?? []
      );
      const validatedCount = students.filter(s =>
        s.ueResults
          .find(u => u.ueCode === ue.ueCode)
          ?.ecueResults.find(e => e.ecueCode === ecue.ecueCode)
          ?.validated
      ).length;
      results.push({
        code: ecue.ecueCode,
        name: ecue.ecueName,
        ueCode: ue.ueCode,
        avg: allAvgs.length > 0
          ? round2(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length)
          : 0,
        validationRate: round2((validatedCount / students.length) * 100),
      });
    }
  }
  return results;
}

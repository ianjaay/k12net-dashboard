// ─── Analytics Calculations ─────────────────────────────────────────────────
// Statistics, deltas, alerts, profiles, and progression report generation.

import type { K12Student, K12Class, TermId, TermView } from '../types/k12';
import type {
  DeltaResult, DeltaDirection, Alert, AlertSeverity,
  StudentProfile, DisciplineProfile, ProgressionReport,
  TermSnapshot, PeriodStats, DISCIPLINE_FAMILIES,
} from '../types/analytics';
import { DISCIPLINE_FAMILIES as FAMILIES } from '../types/analytics';

// ═══════════════════════════════════════════════════════════════════════════
// 1. BASIC STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export function moyenne(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function mediane(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function ecartType(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

export function quartiles(values: number[]): { q1: number; q2: number; q3: number } | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q2 = mediane(sorted)!;
  const lower = sorted.slice(0, Math.floor(sorted.length / 2));
  const upper = sorted.slice(Math.ceil(sorted.length / 2));
  return { q1: mediane(lower)!, q2, q3: mediane(upper)! };
}

export function percentile(values: number[], target: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const below = sorted.filter(v => v < target).length;
  return Math.round((below / sorted.length) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PERIOD STATS
// ═══════════════════════════════════════════════════════════════════════════

function getStudentAvg(s: K12Student, termId: TermId | 'ANNUAL'): number | null {
  if (termId === 'ANNUAL') return s.yearResult?.yearAverage ?? null;
  return s.yearResult?.termResults.find(t => t.termId === termId)?.termAverage ?? null;
}

export function computePeriodStats(students: K12Student[], termId: TermId | 'ANNUAL'): PeriodStats {
  const avgs = students.map(s => getStudentAvg(s, termId)).filter((v): v is number => v != null);
  const sorted = [...avgs].sort((a, b) => a - b);
  const n = sorted.length;
  const m = moyenne(sorted);
  const q = quartiles(sorted);

  const pct = (count: number) => n > 0 ? Math.round((count / n) * 100 * 10) / 10 : 0;

  return {
    termId,
    mean: m,
    median: mediane(sorted),
    stddev: ecartType(sorted),
    min: n > 0 ? sorted[0] : null,
    max: n > 0 ? sorted[n - 1] : null,
    q1: q?.q1 ?? null,
    q3: q?.q3 ?? null,
    iqr: q ? q.q3 - q.q1 : null,
    range: n > 0 ? sorted[n - 1] - sorted[0] : null,
    pctBelow8_5: pct(sorted.filter(v => v < 8.5).length),
    pctBetween8_5_10: pct(sorted.filter(v => v >= 8.5 && v < 10).length),
    pctAbove10: pct(sorted.filter(v => v >= 10).length),
    pctAbove14: pct(sorted.filter(v => v >= 14).length),
    pctAbove16: pct(sorted.filter(v => v >= 16).length),
    count: n,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DELTAS
// ═══════════════════════════════════════════════════════════════════════════

const STABLE_THRESHOLD = 0.1;

function direction(delta: number, threshold = STABLE_THRESHOLD): DeltaDirection {
  if (delta > threshold) return 'up';
  if (delta < -threshold) return 'down';
  return 'stable';
}

export function calculateDelta(current: number | null, previous: number | null, ref: TermId): DeltaResult | null {
  if (current === null || previous === null) return null;
  const val = current - previous;
  return {
    value: val,
    direction: direction(val),
    percentage: previous !== 0 ? (val / Math.abs(previous)) * 100 : null,
    reference: ref,
  };
}

/** Get all deltas for the current term vs previous terms */
export function getTermDeltas(
  students: K12Student[],
  currentTerm: TermId,
): { vsT1?: { current: PeriodStats; previous: PeriodStats }; vsT2?: { current: PeriodStats; previous: PeriodStats } } {
  const current = computePeriodStats(students, currentTerm);
  const result: ReturnType<typeof getTermDeltas> = {};

  if (currentTerm === 'T2') {
    result.vsT1 = { current, previous: computePeriodStats(students, 'T1') };
  } else if (currentTerm === 'T3') {
    result.vsT2 = { current, previous: computePeriodStats(students, 'T2') };
    result.vsT1 = { current, previous: computePeriodStats(students, 'T1') };
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ALERTS
// ═══════════════════════════════════════════════════════════════════════════

export function generateStudentAlerts(student: K12Student, currentTerm: TermId): Alert[] {
  const alerts: Alert[] = [];
  const yr = student.yearResult;
  if (!yr) return alerts;

  const currentTR = yr.termResults.find(t => t.termId === currentTerm);
  if (!currentTR) return alerts;

  const currentAvg = currentTR.termAverage;

  // Find previous term result
  const prevTermId: TermId | null = currentTerm === 'T2' ? 'T1' : currentTerm === 'T3' ? 'T2' : null;
  const prevTR = prevTermId ? yr.termResults.find(t => t.termId === prevTermId) : null;

  if (currentAvg !== null) {
    // Seuil critique
    if (currentAvg < 10) {
      alerts.push({
        code: 'SEUIL_CRITIQUE', severity: 'danger',
        message: `${student.fullName} : moyenne sous le seuil de 10 (${currentAvg.toFixed(2)})`,
        target: student.matricule, targetLabel: student.fullName,
        data: { currentValue: currentAvg, termId: currentTerm },
      });
    } else if (currentAvg < 11) {
      alerts.push({
        code: 'ZONE_FRAGILE', severity: 'warning',
        message: `${student.fullName} : zone fragile (${currentAvg.toFixed(2)})`,
        target: student.matricule, targetLabel: student.fullName,
        data: { currentValue: currentAvg, termId: currentTerm },
      });
    }

    // Delta-based alerts
    if (prevTR?.termAverage != null) {
      const delta = currentAvg - prevTR.termAverage;

      if (delta <= -1.0) {
        alerts.push({
          code: 'REG_FORTE', severity: 'danger',
          message: `${student.fullName} : chute de ${Math.abs(delta).toFixed(2)} pts`,
          target: student.matricule, targetLabel: student.fullName,
          data: { currentValue: currentAvg, previousValue: prevTR.termAverage, delta, termId: currentTerm },
        });
      } else if (delta <= -0.5) {
        alerts.push({
          code: 'REG_MODEREE', severity: 'warning',
          message: `${student.fullName} : régression modérée (${delta.toFixed(2)} pts)`,
          target: student.matricule, targetLabel: student.fullName,
          data: { currentValue: currentAvg, previousValue: prevTR.termAverage, delta, termId: currentTerm },
        });
      }

      if (delta >= 1.5) {
        alerts.push({
          code: 'PROG_FORTE', severity: 'success',
          message: `${student.fullName} : progression remarquable (+${delta.toFixed(2)} pts)`,
          target: student.matricule, targetLabel: student.fullName,
          data: { currentValue: currentAvg, previousValue: prevTR.termAverage, delta, termId: currentTerm },
        });
      } else if (delta >= 0.5) {
        alerts.push({
          code: 'PROG_MODEREE', severity: 'info',
          message: `${student.fullName} : en progression (+${delta.toFixed(2)} pts)`,
          target: student.matricule, targetLabel: student.fullName,
          data: { currentValue: currentAvg, previousValue: prevTR.termAverage, delta, termId: currentTerm },
        });
      }

      // Rank change
      const rankDelta = prevTR.rank - currentTR.rank; // positive = improved
      if (rankDelta <= -10) {
        alerts.push({
          code: 'CHUTE_RANG', severity: 'warning',
          message: `${student.fullName} : recul de ${Math.abs(rankDelta)} places`,
          target: student.matricule, targetLabel: student.fullName,
          data: { currentValue: currentTR.rank, previousValue: prevTR.rank, delta: rankDelta, termId: currentTerm },
        });
      }

      // Distinction changes
      const prevD = prevTR.distinction;
      const curD = currentTR.distinction;
      if (prevD && ['THF', 'THFR'].includes(prevD) && (!curD || !['THF', 'THFR'].includes(curD))) {
        alerts.push({
          code: 'PERTE_DISTINCTION', severity: 'warning',
          message: `${student.fullName} : perte des félicitations (${prevD} → ${curD ?? 'aucune'})`,
          target: student.matricule, targetLabel: student.fullName,
        });
      }
      if (curD && ['THF', 'THFR'].includes(curD) && (!prevD || !['THF', 'THFR'].includes(prevD))) {
        alerts.push({
          code: 'GAIN_DISTINCTION', severity: 'success',
          message: `${student.fullName} : obtention des félicitations`,
          target: student.matricule, targetLabel: student.fullName,
        });
      }
    }

    // Bottom 10%
    if (currentTR.totalStudents > 0) {
      const pctile = ((currentTR.totalStudents - currentTR.rank + 1) / currentTR.totalStudents) * 100;
      if (pctile <= 10) {
        alerts.push({
          code: 'DERNIERS_10PCT', severity: 'warning',
          message: `${student.fullName} : dans le dernier décile`,
          target: student.matricule, targetLabel: student.fullName,
          data: { currentValue: currentTR.rank, termId: currentTerm },
        });
      }
    }
  }

  return alerts;
}

export function generateClassAlerts(students: K12Student[], currentTerm: TermId): Alert[] {
  const alerts: Alert[] = [];

  const prevTermId: TermId | null = currentTerm === 'T2' ? 'T1' : currentTerm === 'T3' ? 'T2' : null;
  if (!prevTermId) return alerts;

  const current = computePeriodStats(students, currentTerm);
  const prev = computePeriodStats(students, prevTermId);

  // Class regression
  if (current.mean !== null && prev.mean !== null && current.mean < prev.mean) {
    alerts.push({
      code: 'CLASSE_REGRESSION', severity: 'warning',
      message: `Régression de la moyenne de classe (${prev.mean.toFixed(2)} → ${current.mean.toFixed(2)})`,
      data: { currentValue: current.mean, previousValue: prev.mean, delta: current.mean - prev.mean, termId: currentTerm },
    });
  }

  // Homogeneity decrease
  if (current.stddev !== null && prev.stddev !== null && current.stddev > prev.stddev + 0.5) {
    alerts.push({
      code: 'HOMOGENEITE_BAISSE', severity: 'info',
      message: `Augmentation de l'hétérogénéité (σ: ${prev.stddev.toFixed(2)} → ${current.stddev.toFixed(2)})`,
      data: { currentValue: current.stddev, previousValue: prev.stddev, termId: currentTerm },
    });
  }

  // Non-classified students
  const nonClassed = students.filter(s => getStudentAvg(s, currentTerm) === null).length;
  if (nonClassed > 0) {
    alerts.push({
      code: 'NON_CLASSES_ELEVES', severity: 'warning',
      message: `${nonClassed} élève${nonClassed > 1 ? 's' : ''} non classé${nonClassed > 1 ? 's' : ''}`,
      data: { currentValue: nonClassed, termId: currentTerm },
    });
  }

  return alerts;
}

export function generateAllAlerts(students: K12Student[], currentTerm: TermId): Alert[] {
  const indiv = students.flatMap(s => generateStudentAlerts(s, currentTerm));
  const classAlerts = generateClassAlerts(students, currentTerm);
  return [...classAlerts, ...indiv];
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. STUDENT PROFILES
// ═══════════════════════════════════════════════════════════════════════════

export function classifyStudent(student: K12Student, currentTerm: TermId): StudentProfile {
  const yr = student.yearResult;
  if (!yr) return 'fragile';

  const termAvgs = (['T1', 'T2', 'T3'] as TermId[])
    .map(t => yr.termResults.find(r => r.termId === t)?.termAverage)
    .filter((v): v is number => v != null);

  if (termAvgs.length === 0) return 'fragile';

  const lastAvg = termAvgs[termAvgs.length - 1];
  const allAbove16 = termAvgs.every(a => a >= 16);
  const currentRank = yr.termResults.find(t => t.termId === currentTerm)?.rank ?? yr.rank;

  // Excellent stable: avg ≥ 16 on all terms, top 10
  if (allAbove16 && currentRank <= 10) return 'excellent_stable';

  // Calculate delta if possible
  let delta = 0;
  let rankDelta = 0;
  if (termAvgs.length >= 2) {
    delta = termAvgs[termAvgs.length - 1] - termAvgs[termAvgs.length - 2];
    const currentTR = yr.termResults.find(t => t.termId === currentTerm);
    const prevTermId: TermId | null = currentTerm === 'T2' ? 'T1' : currentTerm === 'T3' ? 'T2' : null;
    const prevTR = prevTermId ? yr.termResults.find(t => t.termId === prevTermId) : null;
    if (currentTR && prevTR) {
      rankDelta = prevTR.rank - currentTR.rank; // positive = improved
    }
  }

  // Bon en progression: avg ≥ 14 AND positive delta ≥ 0.5
  if (lastAvg >= 14 && delta >= 0.5) return 'bon_progression';

  // En décrochage: delta ≤ -1.0 OR loss ≥ 10 places
  if (delta <= -1.0 || rankDelta <= -10) return 'en_decrochage';

  // Fragile: avg < 12 or in bottom 10%
  if (lastAvg < 12) return 'fragile';

  // En progression: delta ≥ +1.0 OR gain ≥ 10 places
  if (delta >= 1.0 || rankDelta >= 10) return 'en_progression';

  // Stable milieu: 12 ≤ avg < 16 and |delta| < 0.5
  if (lastAvg >= 12 && Math.abs(delta) < 0.5) return 'stable_milieu';

  return 'stable_milieu';
}

export function classifyDisciplineProfile(
  student: K12Student,
  termId: TermId | 'ANNUAL',
): DisciplineProfile {
  const famAvgs: Record<string, number[]> = { litteraire: [], scientifique: [] };

  for (const sg of student.subjectGrades) {
    const termGrade = termId === 'ANNUAL' ? sg.yearAverage : sg.terms[termId]?.average;
    if (termGrade == null) continue;
    const name = sg.subjectName;
    for (const [family, subjects] of Object.entries(FAMILIES)) {
      if ((family === 'litteraire' || family === 'scientifique') &&
          subjects.some(s => name.toLowerCase().includes(s.toLowerCase()))) {
        famAvgs[family].push(termGrade);
      }
    }
  }

  const litAvg = moyenne(famAvgs.litteraire);
  const sciAvg = moyenne(famAvgs.scientifique);

  if (litAvg === null || sciAvg === null) return 'equilibre';
  if (litAvg > sciAvg + 2) return 'litteraire';
  if (sciAvg > litAvg + 2) return 'scientifique';
  return 'equilibre';
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. PROGRESSION REPORT
// ═══════════════════════════════════════════════════════════════════════════

export function generateProgressionReport(
  student: K12Student,
  classStudents: K12Student[],
  currentTerm: TermId,
  isAnnual?: boolean,
): ProgressionReport {
  const yr = student.yearResult;
  const snapshots: TermSnapshot[] = [];
  const termIds: TermId[] = ['T1', 'T2', 'T3'];

  for (const tid of termIds) {
    const tr = yr?.termResults.find(t => t.termId === tid);
    const classAvgs = classStudents
      .map(s => s.yearResult?.termResults.find(t => t.termId === tid)?.termAverage)
      .filter((v): v is number => v != null);
    snapshots.push({
      termId: tid,
      average: tr?.termAverage ?? null,
      rank: tr?.rank ?? 0,
      totalStudents: tr?.totalStudents ?? classStudents.length,
      distinction: tr?.distinction ?? null,
      sanction: tr?.sanction ?? null,
      classAverage: moyenne(classAvgs),
    });
  }

  // Deltas
  const moyenneDeltas: DeltaResult[] = [];
  const rangDeltas: DeltaResult[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const cur = snapshots[i];
    const prev = snapshots[i - 1];
    if (cur.average !== null && prev.average !== null) {
      moyenneDeltas.push(calculateDelta(cur.average, prev.average, prev.termId)!);
    }
    if (cur.rank > 0 && prev.rank > 0) {
      const rankChange = prev.rank - cur.rank; // positive = improved
      rangDeltas.push({
        value: rankChange,
        direction: direction(rankChange),
        percentage: null,
        reference: prev.termId,
      });
    }
  }

  // Statistics
  const availAvgs = snapshots.map(s => s.average).filter((v): v is number => v != null);
  const vol = ecartType(availAvgs);
  const trend = linearSlope(availAvgs);
  const predicted = availAvgs.length >= 2 && trend !== null
    ? availAvgs[availAvgs.length - 1] + trend
    : null;

  // Position vs class
  const currentSnap = snapshots.find(s => s.termId === currentTerm);
  const posVsClass = currentSnap?.average != null && currentSnap.classAverage != null
    ? currentSnap.average - currentSnap.classAverage
    : null;

  // Percentile
  const allAvgs = classStudents
    .map(s => getStudentAvg(s, currentTerm))
    .filter((v): v is number => v != null);
  const pctile = currentSnap?.average != null ? percentile(allAvgs, currentSnap.average) : null;

  return {
    matricule: student.matricule,
    fullName: student.fullName,
    className: student.className,
    snapshots,
    deltas: { moyenneDelta: moyenneDeltas, rangDelta: rangDeltas },
    profile: classifyStudent(student, currentTerm),
    disciplineProfile: classifyDisciplineProfile(student, isAnnual ? 'ANNUAL' : currentTerm),
    positionVsClass: posVsClass,
    percentile: pctile,
    volatility: vol,
    trend,
    predictedNext: predicted != null ? Math.max(0, Math.min(20, predicted)) : null,
  };
}

function linearSlope(values: number[]): number | null {
  if (values.length < 2) return null;
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  return den !== 0 ? num / den : null;
}

// ─── Report Calculations ────────────────────────────────────────────────────
// Pure functions that compute data structures for all 7 reports.

import type {
  K12Student, K12Class, K12AppData, TermId, GradeLevel, Branch,
  SubjectYearGrades, TermResult,
} from '../types/k12';
import { GRADE_LEVEL_LABELS } from '../types/k12';
import type {
  PVConseilData, ListeNominativeData, ListeNominativeEntry,
  MajorEntry, PremierDisciplineEntry, NonClasseEntry, BilanAnnuelEntry,
  DisciplineStats, GenderCount, GenderMoyenneRepartition,
} from '../types/reports';
import {
  fmtNum, fmtRankWithExAequo, getAppreciation,
  fmtDistinctionSanction, getTrimestreLabel, getNiveauLabel,
} from '../types/reports';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTermResult(student: K12Student, termId: TermId): TermResult | undefined {
  return student.yearResult?.termResults.find(tr => tr.termId === termId);
}

function getTermAvg(student: K12Student, termId: TermId): number | null {
  return getTermResult(student, termId)?.termAverage ?? null;
}

/** Compute ranks with ex-aequo handling. Returns Map<studentId, {rank, isExAequo}> */
function computeRanks(
  students: K12Student[],
  getAvg: (s: K12Student) => number | null,
): Map<string, { rank: number; isExAequo: boolean }> {
  const withAvg = students
    .filter(s => getAvg(s) !== null)
    .sort((a, b) => (getAvg(b) ?? 0) - (getAvg(a) ?? 0));

  const result = new Map<string, { rank: number; isExAequo: boolean }>();
  let rank = 1;
  for (let i = 0; i < withAvg.length; i++) {
    if (i > 0 && getAvg(withAvg[i]) !== getAvg(withAvg[i - 1])) {
      rank = i + 1;
    }
    const isExAequo = (
      (i > 0 && getAvg(withAvg[i]) === getAvg(withAvg[i - 1])) ||
      (i < withAvg.length - 1 && getAvg(withAvg[i]) === getAvg(withAvg[i + 1]))
    );
    result.set(withAvg[i].id, { rank, isExAequo });
  }
  return result;
}

function genderCount(students: K12Student[]): GenderCount {
  // All-girls school pattern: assume F for now since the data doesn't have gender
  return { garcons: 0, filles: students.length, total: students.length };
}

function moyenneRepartition(students: K12Student[], termId: TermId): GenderMoyenneRepartition[] {
  const classedStudents = students.filter(s => getTermAvg(s, termId) !== null);
  const total = classedStudents.length;

  const count = (pred: (avg: number) => boolean) =>
    classedStudents.filter(s => pred(getTermAvg(s, termId)!)).length;

  const inf = count(a => a < 8.5);
  const mid = count(a => a >= 8.5 && a < 10);
  const sup = count(a => a >= 10);

  const pct = (n: number) => total > 0 ? parseFloat(((n / total) * 100).toFixed(2)) : 0;

  // Simplified: no gender data available in the parsed model
  return [
    { genre: 'GARÇONS', inf_8_5: { nombre: 0, pourcentage: 0 }, entre_8_5_10: { nombre: 0, pourcentage: 0 }, sup_10: { nombre: 0, pourcentage: 0 } },
    { genre: 'FILLES', inf_8_5: { nombre: inf, pourcentage: pct(inf) }, entre_8_5_10: { nombre: mid, pourcentage: pct(mid) }, sup_10: { nombre: sup, pourcentage: pct(sup) } },
    { genre: 'TOTAL', inf_8_5: { nombre: inf, pourcentage: pct(inf) }, entre_8_5_10: { nombre: mid, pourcentage: pct(mid) }, sup_10: { nombre: sup, pourcentage: pct(sup) } },
  ];
}

// ─── Rapport 1: PV Conseil de Classe ────────────────────────────────────────

export function computePVConseil(
  cls: K12Class,
  termId: TermId,
  anneeScolaire: string,
): PVConseilData {
  const students = cls.students;
  const classedStudents = students.filter(s => getTermAvg(s, termId) !== null);
  const avgs = classedStudents.map(s => getTermAvg(s, termId)!);

  const moyenneClasse = avgs.length > 0
    ? avgs.reduce((a, b) => a + b, 0) / avgs.length
    : null;

  // Count distinctions/sanctions for this term
  let th = 0, the_ = 0, thf = 0, thr = 0, ther = 0, thfr = 0;
  let bti = 0, avt = 0, bmc = 0, amc = 0;

  for (const s of students) {
    const tr = getTermResult(s, termId);
    if (!tr) continue;
    switch (tr.distinction) {
      case 'TH': th++; break;
      case 'THR': thr++; break;
      case 'THE': the_++; break;
      case 'THER': ther++; break;
      case 'THF': thf++; break;
      case 'THFR': thfr++; break;
    }
    switch (tr.sanction) {
      case 'BTI': bti++; break;
      case 'AVT': avt++; break;
      case 'BMC': bmc++; break;
      case 'AMC': amc++; break;
    }
  }

  // Discipline stats
  const disciplines = computeDisciplineStats(cls, termId);

  return {
    classe: cls.name,
    displayName: cls.displayName,
    niveau: getNiveauLabel(cls.gradeLevel, cls.branch),
    trimestre: getTrimestreLabel(termId),
    termId,
    anneeScolaire,
    professeurPrincipal: '',
    educateur: '',
    effectifs: {
      ...genderCount(students),
      classes: classedStudents.length,
      absents: students.length - classedStudents.length,
    },
    repartitionMoyennes: moyenneRepartition(students, termId),
    moyenneClasse,
    plusFaibleMoyenne: avgs.length > 0 ? Math.min(...avgs) : null,
    plusForteMoyenne: avgs.length > 0 ? Math.max(...avgs) : null,
    distinctions: {
      tableauHonneur: th,
      tableauHonneurEncouragements: the_ + ther,
      tableauHonneurFelicitations: thf + thfr,
    },
    sanctions: {
      blameTravail: bti,
      avertissementTravail: avt,
      blameConduite: bmc,
      avertissementConduite: amc,
      tableauHonneurRefuse: thr,
    },
    disciplines,
  };
}

function computeDisciplineStats(cls: K12Class, termId: TermId): DisciplineStats[] {
  // Collect all unique subject names from student data
  const subjectNames = new Set<string>();
  for (const s of cls.students) {
    for (const sg of s.subjectGrades) {
      subjectNames.add(sg.subjectName);
    }
  }

  return [...subjectNames].map(name => {
    // Get all student averages for this subject in this term
    const studentAvgs: number[] = [];
    for (const s of cls.students) {
      const sg = s.subjectGrades.find(g => g.subjectName === name);
      if (sg) {
        const avg = sg.terms[termId]?.average;
        if (avg !== null && avg !== undefined) studentAvgs.push(avg);
      }
    }

    const effectif = studentAvgs.length;
    const moyenne = effectif > 0 ? studentAvgs.reduce((a, b) => a + b, 0) / effectif : null;

    const inf = studentAvgs.filter(a => a < 8.5).length;
    const mid = studentAvgs.filter(a => a >= 8.5 && a < 10).length;
    const sup = studentAvgs.filter(a => a >= 10).length;
    const pct = (n: number) => effectif > 0 ? parseFloat(((n / effectif) * 100).toFixed(2)) : 0;

    return {
      nom: name,
      enseignant: '',
      enseignantMatricule: '',
      effectifClasses: effectif,
      moyenneClasse: moyenne,
      plusFaibleMoyenne: effectif > 0 ? Math.min(...studentAvgs) : null,
      plusForteMoyenne: effectif > 0 ? Math.max(...studentAvgs) : null,
      appreciation: getAppreciation(moyenne),
      repartition: {
        inf_8_5: { nombre: inf, pourcentage: pct(inf) },
        entre_8_5_10: { nombre: mid, pourcentage: pct(mid) },
        sup_10: { nombre: sup, pourcentage: pct(sup) },
      },
    };
  });
}

// ─── Rapport 2: Liste Nominative ────────────────────────────────────────────

export function computeListeNominative(
  cls: K12Class,
  termId: TermId,
  anneeScolaire: string,
): ListeNominativeData {
  const ranks = computeRanks(cls.students, s => getTermAvg(s, termId));

  const sorted = [...cls.students].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'fr')
  );

  const eleves: ListeNominativeEntry[] = sorted.map((s, i) => {
    const tr = getTermResult(s, termId);
    const avg = getTermAvg(s, termId);
    const rankInfo = ranks.get(s.id);

    return {
      numero: i + 1,
      matricule: s.matricule,
      nomPrenoms: s.fullName,
      nationalite: 'CIV',
      sexe: 'F',
      affecte: true,
      redoublant: s.isRepeating,
      moyenne: avg,
      rang: rankInfo ? fmtRankWithExAequo(rankInfo.rank, rankInfo.isExAequo) : '—',
      distinctionSanction: fmtDistinctionSanction(tr?.distinction, tr?.sanction),
      observation: '',
    };
  });

  return {
    classe: cls.name,
    displayName: cls.displayName,
    trimestre: getTrimestreLabel(termId),
    termId,
    anneeScolaire,
    effectifs: genderCount(cls.students),
    eleves,
  };
}

// ─── Rapport 3: Majors par Classe ───────────────────────────────────────────

export function computeMajorsParClasse(
  classes: K12Class[],
  termId: TermId,
): MajorEntry[] {
  return classes.map((cls, i) => {
    const best = [...cls.students]
      .filter(s => getTermAvg(s, termId) !== null)
      .sort((a, b) => (getTermAvg(b, termId) ?? 0) - (getTermAvg(a, termId) ?? 0))[0];

    if (!best) return null;

    return {
      numero: i + 1,
      matricule: best.matricule,
      nomPrenoms: best.fullName,
      sexe: 'F',
      dateNaissance: '',
      nationalite: 'CIV',
      redoublant: best.isRepeating,
      lv2: '',
      moyenne: getTermAvg(best, termId)!,
      classe: cls.displayName || cls.name,
      niveau: getNiveauLabel(cls.gradeLevel, cls.branch),
    };
  }).filter((e): e is MajorEntry => e !== null);
}

// ─── Rapport 4: Majors par Niveau ───────────────────────────────────────────

export function computeMajorsParNiveau(
  classes: K12Class[],
  termId: TermId,
): MajorEntry[] {
  // Group classes by grade level + branch
  const groups = new Map<string, K12Class[]>();
  for (const cls of classes) {
    const key = cls.branch ? `${cls.gradeLevel}_${cls.branch}` : cls.gradeLevel;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(cls);
  }

  const result: MajorEntry[] = [];
  let num = 1;

  const sortedKeys = [...groups.keys()].sort();
  for (const key of sortedKeys) {
    const groupClasses = groups.get(key)!;
    const allStudents = groupClasses.flatMap(c => c.students);
    const best = [...allStudents]
      .filter(s => getTermAvg(s, termId) !== null)
      .sort((a, b) => (getTermAvg(b, termId) ?? 0) - (getTermAvg(a, termId) ?? 0))[0];

    if (!best) continue;

    const ref = groupClasses[0];
    result.push({
      numero: num++,
      matricule: best.matricule,
      nomPrenoms: best.fullName,
      sexe: 'F',
      dateNaissance: '',
      nationalite: 'CIV',
      redoublant: best.isRepeating,
      lv2: '',
      moyenne: getTermAvg(best, termId)!,
      classe: best.className,
      niveau: getNiveauLabel(ref.gradeLevel, ref.branch),
    });
  }

  return result;
}

// ─── Rapport 5: Premiers par Discipline ─────────────────────────────────────

export function computePremiersParDiscipline(
  cls: K12Class,
  termId: TermId,
): PremierDisciplineEntry[] {
  const subjectNames = new Set<string>();
  for (const s of cls.students) {
    for (const sg of s.subjectGrades) {
      subjectNames.add(sg.subjectName);
    }
  }

  return [...subjectNames].map(name => {
    let best: K12Student | null = null;
    let bestAvg = -1;

    for (const s of cls.students) {
      const sg = s.subjectGrades.find(g => g.subjectName === name);
      if (sg) {
        const avg = sg.terms[termId]?.average;
        if (avg !== null && avg !== undefined && avg > bestAvg) {
          bestAvg = avg;
          best = s;
        }
      }
    }

    return {
      classe: cls.displayName || cls.name,
      discipline: name,
      matricule: best?.matricule ?? '',
      nomPrenoms: best?.fullName ?? '',
      sexe: best ? 'F' : '',
      moyenne: bestAvg >= 0 ? bestAvg : null,
      observation: getAppreciation(bestAvg >= 0 ? bestAvg : null),
    };
  });
}

// ─── Rapport 6: Non-Classés ─────────────────────────────────────────────────

export function computeNonClasses(
  classes: K12Class[],
  termId: TermId,
): { niveau: string; eleves: NonClasseEntry[] }[] {
  // Group by grade level
  const groups = new Map<string, { niveau: string; entries: NonClasseEntry[] }>();

  for (const cls of classes) {
    const niveauKey = cls.branch ? `${cls.gradeLevel}_${cls.branch}` : cls.gradeLevel;
    const niveauLabel = getNiveauLabel(cls.gradeLevel, cls.branch);

    if (!groups.has(niveauKey)) {
      groups.set(niveauKey, { niveau: niveauLabel, entries: [] });
    }

    const nonClassed = cls.students.filter(s => getTermAvg(s, termId) === null);
    for (const s of nonClassed) {
      groups.get(niveauKey)!.entries.push({
        numero: 0, // assigned later
        matricule: s.matricule,
        nomPrenoms: s.fullName,
        sexe: 'F',
        dateNaissance: '',
        nationalite: 'CIV',
        redoublant: s.isRepeating,
        lv2: '',
        classe: cls.displayName || cls.name,
      });
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { niveau, entries }]) => {
      entries.forEach((e, i) => { e.numero = i + 1; });
      return { niveau, eleves: entries };
    });
}

// ─── Rapport 7: Bilan Annuel ────────────────────────────────────────────────

export function computeBilanAnnuel(cls: K12Class): BilanAnnuelEntry[] {
  const students = cls.students;

  // Compute annual ranks
  const annualRanks = computeRanks(students, s => {
    const avails = (['T1', 'T2', 'T3'] as TermId[])
      .map(t => getTermAvg(s, t))
      .filter((v): v is number => v !== null);
    return avails.length > 0 ? avails.reduce((a, b) => a + b, 0) / avails.length : null;
  });

  // Term-specific ranks
  const t1Ranks = computeRanks(students, s => getTermAvg(s, 'T1'));
  const t2Ranks = computeRanks(students, s => getTermAvg(s, 'T2'));
  const t3Ranks = computeRanks(students, s => getTermAvg(s, 'T3'));

  return students.map((s, i) => {
    const tr1 = getTermResult(s, 'T1');
    const tr2 = getTermResult(s, 'T2');
    const tr3 = getTermResult(s, 'T3');
    const r1 = t1Ranks.get(s.id);
    const r2 = t2Ranks.get(s.id);
    const r3 = t3Ranks.get(s.id);

    const termAvgs = (['T1', 'T2', 'T3'] as TermId[])
      .map(t => getTermAvg(s, t))
      .filter((v): v is number => v !== null);
    const moyAnnuelle = termAvgs.length > 0
      ? termAvgs.reduce((a, b) => a + b, 0) / termAvgs.length
      : null;

    const annualRank = annualRanks.get(s.id);

    return {
      numero: i + 1,
      matricule: s.matricule,
      nomPrenoms: s.fullName,
      redoublant: s.isRepeating,
      moyT1: tr1?.termAverage ?? null,
      rangT1: r1 ? fmtRankWithExAequo(r1.rank, r1.isExAequo) : '',
      dsT1: fmtDistinctionSanction(tr1?.distinction, tr1?.sanction),
      moyT2: tr2?.termAverage ?? null,
      rangT2: r2 ? fmtRankWithExAequo(r2.rank, r2.isExAequo) : '',
      dsT2: fmtDistinctionSanction(tr2?.distinction, tr2?.sanction),
      moyT3: tr3?.termAverage ?? null,
      rangT3: r3 ? fmtRankWithExAequo(r3.rank, r3.isExAequo) : '',
      dsT3: fmtDistinctionSanction(tr3?.distinction, tr3?.sanction),
      moyAnnuelle,
      rangAnnuel: annualRank ? fmtRankWithExAequo(annualRank.rank, annualRank.isExAequo) : '',
      dfa: s.yearResult?.promotionStatus ?? '',
      nivSup: '',
    };
  });
}

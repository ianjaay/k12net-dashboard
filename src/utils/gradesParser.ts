// ─── K12net Grades Excel Parser ─────────────────────────────────────────────
// Parses the "Moyennes" Excel export from K12net (multi-sheet, one sheet per class).
// Extracts students, evaluations (per subject × term), and computed averages.
//
// Sheet structure (e.g. "6eme_1", "TleD_2"):
//   Row 0: School name
//   Row 1: Counselor names
//   Row 2: Notes about grading
//   Row 3: (empty)
//   Row 4: Subject names (merged cells spanning evaluation columns)
//   Row 5: Evaluation type categories (merged) — e.g. "DEVOIRS", "Interrogation Ecrite (IE)"
//   Row 6: Individual evaluation headers — e.g. "IE 1[T2] [20]", "Premier Trimestre"
//   Row 7+: Student data (rank, name, grades)
//
// Each subject block ends with 4 "Moyenne des notes" columns:
//   "Premier Trimestre", "Deuxième Trimestre", "Troisième Trimestre", "Fin d'année"
//
// After all subjects, there may be a "Notes pondérées" section with "Total" and "Moyenne".

import type {
  Branch,
  Evaluation,
  GradeLevel,
  K12Class,
  K12Student,
  SubjectDefinition,
  SubjectTermGrades,
  SubjectYearGrades,
  TermId,
  TermMarks,
} from '../types/k12';
import {
  buildTermMarks,
  computeSimpleAverage,
  computeSubjectTermAverage,
} from '../types/k12';
import * as XLSX from 'xlsx';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubjectBlock {
  name: string;
  startCol: number;
  endCol: number;
  /** Evaluation columns (individual grades) */
  evalCols: EvalColumn[];
  /** Average columns: T1, T2, T3, Fin d'année */
  avgCols: { T1: number | null; T2: number | null; T3: number | null; FIN: number | null };
}

interface EvalColumn {
  col: number;
  name: string;
  termId: TermId;
  maxScore: number;
}

interface ParsedSheet {
  className: string;
  gradeLevel: GradeLevel;
  branch: Branch | null;
  schoolName: string;
  subjects: SubjectBlock[];
  students: ParsedStudent[];
  /** Column index for "Notes pondérées" → Total */
  weightedTotalCol: number | null;
  /** Column index for "Notes pondérées" → Moyenne */
  weightedMoyenneCol: number | null;
}

interface ParsedStudent {
  rank: number;
  fullName: string;
  grades: Map<number, number | null>; // col → value
}

// ─── Row constants ──────────────────────────────────────────────────────────
const ROW_SCHOOL = 0;
const ROW_SUBJECTS = 4;
const ROW_HEADERS = 6;
const ROW_DATA_START = 7;

// ─── Patterns ───────────────────────────────────────────────────────────────
// Matches: "IE 1[T2] [20]", "compo_francais[T1] [20]", "DS[T2] [10]"
const EVAL_HEADER_RE = /^(.+?)\[T([123])\]\s*\[(\d+)\]$/;

// Term average column names
const TERM_AVG_NAMES: Record<string, TermId | 'FIN'> = {
  'Premier Trimestre': 'T1',
  'Deuxième Trimestre': 'T2',
  'Troisième Trimestre': 'T3',
  "Fin d'année": 'FIN',
};

// ─── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse a K12net grades Excel file.
 * Returns K12Class[] with students populated with SubjectYearGrades and TermMarks.
 *
 * @param fileData ArrayBuffer or Uint8Array of the .xlsx file
 * @param subjectsByClass Optional map of className → SubjectDefinition[] (from section list)
 */
export function parseGradesExcel(
  fileData: ArrayBuffer | Uint8Array,
  subjectsByClass?: Record<string, SubjectDefinition[]>,
): K12Class[] {
  const wb = XLSX.read(fileData, { type: 'array' });
  const classes: K12Class[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const parsed = parseSheet(ws, sheetName);
    if (!parsed || parsed.students.length === 0) continue;

    const subjectDefs = subjectsByClass?.[parsed.className] ?? [];
    const k12Class = buildK12Class(parsed, subjectDefs);
    classes.push(k12Class);
  }

  return classes;
}

// ─── Sheet Parsing ──────────────────────────────────────────────────────────

function parseSheet(ws: XLSX.WorkSheet, sheetName: string): ParsedSheet | null {
  // Parse class name from sheet name (e.g. "6eme_1", "TleD_2")
  const className = sheetName;
  const { gradeLevel, branch } = parseClassName(className);

  // School name from row 0
  const schoolName = getCellString(ws, ROW_SCHOOL, 0);

  // Parse subject blocks from merged cells in row 4
  const merges = ws['!merges'] || [];
  const subjects = parseSubjectBlocks(ws, merges);

  // Find Notes pondérées section
  const { totalCol, moyenneCol } = findWeightedSection(ws, merges, subjects);

  // Parse students
  const students = parseStudents(ws, subjects, totalCol, moyenneCol);

  return {
    className,
    gradeLevel,
    branch,
    schoolName,
    subjects,
    students,
    weightedTotalCol: totalCol,
    weightedMoyenneCol: moyenneCol,
  };
}

/**
 * Parse class name like "6eme_1" or "TleD_2" into grade level and branch.
 */
function parseClassName(name: string): { gradeLevel: GradeLevel; branch: Branch | null } {
  // Match patterns: 6eme_1, 5eme_2, 4eme_3, 3eme_4
  const collegeMatch = name.match(/^(\d)eme_(\d+)$/i);
  if (collegeMatch) {
    const classNum = parseInt(collegeMatch[1]);
    const levelMap: Record<number, GradeLevel> = { 6: '07', 5: '08', 4: '09', 3: '10' };
    return { gradeLevel: levelMap[classNum] || '07', branch: null };
  }

  // Match patterns: 2ndeA_1, 2ndeC_2
  const secondeMatch = name.match(/^2nde([A-Z]+)_(\d+)$/i);
  if (secondeMatch) {
    return { gradeLevel: '11', branch: secondeMatch[1].toUpperCase() };
  }

  // Match patterns: 1ereA2_1, 1ereC_2, 1ereD_1
  const premiereMatch = name.match(/^1ere([A-Z0-9]+)_(\d+)$/i);
  if (premiereMatch) {
    return { gradeLevel: '12', branch: premiereMatch[1].toUpperCase() };
  }

  // Match patterns: TleA1_1, TleC_1, TleD_2
  const terminaleMatch = name.match(/^Tle([A-Z0-9]+)_(\d+)$/i);
  if (terminaleMatch) {
    return { gradeLevel: '13', branch: terminaleMatch[1].toUpperCase() };
  }

  return { gradeLevel: '07', branch: null };
}

/**
 * Parse subject blocks from row 4 merged cells.
 * Each merged cell in row 4 defines a subject that spans multiple columns.
 */
function parseSubjectBlocks(ws: XLSX.WorkSheet, merges: XLSX.Range[]): SubjectBlock[] {
  const subjectMerges = merges
    .filter(m => m.s.r === ROW_SUBJECTS && m.e.r === ROW_SUBJECTS)
    .sort((a, b) => a.s.c - b.s.c);

  const blocks: SubjectBlock[] = [];

  for (const merge of subjectMerges) {
    const name = getCellString(ws, ROW_SUBJECTS, merge.s.c);
    if (!name) continue;

    const startCol = merge.s.c;
    const endCol = merge.e.c;

    // Parse evaluation columns and average columns within this block
    const evalCols: EvalColumn[] = [];
    const avgCols: { T1: number | null; T2: number | null; T3: number | null; FIN: number | null } = {
      T1: null, T2: null, T3: null, FIN: null,
    };

    for (let c = startCol; c <= endCol; c++) {
      const header = getCellString(ws, ROW_HEADERS, c);
      if (!header) continue;

      // Check if it's a term average column
      const termKey = TERM_AVG_NAMES[header];
      if (termKey) {
        avgCols[termKey] = c;
        continue;
      }

      // Check if it's an evaluation column
      const match = header.match(EVAL_HEADER_RE);
      if (match) {
        evalCols.push({
          col: c,
          name: match[1].trim(),
          termId: `T${match[2]}` as TermId,
          maxScore: parseInt(match[3]),
        });
        continue;
      }

      // Some columns have pattern like "Moyenne[T1] [20]" (for Conduite)
      const moyenneMatch = header.match(/^Moyenne\[T([123])\]\s*\[(\d+)\]$/);
      if (moyenneMatch) {
        evalCols.push({
          col: c,
          name: 'Moyenne',
          termId: `T${moyenneMatch[1]}` as TermId,
          maxScore: parseInt(moyenneMatch[2]),
        });
      }
    }

    blocks.push({ name, startCol, endCol, evalCols, avgCols });
  }

  return blocks;
}

/**
 * Find the "Notes pondérées" section beyond all subject blocks.
 */
function findWeightedSection(
  ws: XLSX.WorkSheet,
  merges: XLSX.Range[],
  subjects: SubjectBlock[],
): { totalCol: number | null; moyenneCol: number | null } {
  if (subjects.length === 0) return { totalCol: null, moyenneCol: null };

  const lastSubjectEnd = Math.max(...subjects.map(s => s.endCol));

  // Look for "Notes pondérées" in row 4 beyond last subject
  for (let c = lastSubjectEnd + 1; c <= lastSubjectEnd + 20; c++) {
    const val = getCellString(ws, ROW_SUBJECTS, c);
    if (val === 'Notes pondérées') {
      // Find Total and Moyenne columns below
      let totalCol: number | null = null;
      let moyenneCol: number | null = null;

      // Check the merge for this cell to find its span
      const npMerge = merges.find(m => m.s.r === ROW_SUBJECTS && m.s.c === c);
      const endC = npMerge ? npMerge.e.c : c + 1;

      for (let cc = c; cc <= endC + 2; cc++) {
        const header = getCellString(ws, ROW_HEADERS, cc);
        if (header === 'Total') totalCol = cc;
        if (header === 'Moyenne') moyenneCol = cc;
      }

      return { totalCol, moyenneCol };
    }
  }

  return { totalCol: null, moyenneCol: null };
}

/**
 * Parse student rows starting from row 7.
 */
function parseStudents(
  ws: XLSX.WorkSheet,
  subjects: SubjectBlock[],
  weightedTotalCol: number | null,
  weightedMoyenneCol: number | null,
): ParsedStudent[] {
  const students: ParsedStudent[] = [];
  const maxCol = Math.max(
    ...subjects.map(s => s.endCol),
    weightedTotalCol ?? 0,
    weightedMoyenneCol ?? 0,
  );

  for (let r = ROW_DATA_START; r <= 500; r++) {
    const nameVal = getCellString(ws, r, 1);
    if (!nameVal) break; // end of student data

    const rank = getCellNumber(ws, r, 0) ?? 0;
    const grades = new Map<number, number | null>();

    for (let c = 2; c <= maxCol; c++) {
      const raw = getCellValue(ws, r, c);
      if (raw === undefined || raw === null || raw === '' || raw === 'X') {
        grades.set(c, null);
      } else {
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
        grades.set(c, isNaN(num) ? null : num);
      }
    }

    students.push({ rank, fullName: nameVal, grades });
  }

  return students;
}

// ─── K12 Model Building ────────────────────────────────────────────────────

function buildK12Class(parsed: ParsedSheet, subjectDefs: SubjectDefinition[]): K12Class {
  const subjectDefMap = new Map(subjectDefs.map(sd => [sd.name, sd]));

  const students: K12Student[] = parsed.students.map((ps, idx) => {
    const subjectGrades = buildSubjectGrades(ps, parsed.subjects, subjectDefMap);

    // Build term marks from subject grades
    const termIds: TermId[] = ['T1', 'T2', 'T3'];
    const termMarks: TermMarks[] = termIds.map(tid => buildTermMarks(subjectGrades, tid));

    return {
      id: `${parsed.className}_${idx}`,
      matricule: String(ps.rank),
      firstName: extractFirstName(ps.fullName),
      lastName: extractLastName(ps.fullName),
      fullName: ps.fullName,
      gradeLevel: parsed.gradeLevel,
      className: parsed.className,
      branch: parsed.branch,
      isRepeating: false,
      previousPromotionStatus: null,
      subjectGrades,
      termMarks,
      yearResult: null,
    };
  });

  return {
    id: parsed.className,
    name: parsed.className,
    displayName: formatClassName(parsed.className),
    gradeLevel: parsed.gradeLevel,
    branch: parsed.branch,
    academicYear: '',
    subjects: subjectDefs,
    students,
  };
}

function buildSubjectGrades(
  student: ParsedStudent,
  subjects: SubjectBlock[],
  subjectDefMap: Map<string, SubjectDefinition>,
): SubjectYearGrades[] {
  return subjects.map(block => {
    const def = subjectDefMap.get(block.name);

    // Group evaluations by term
    const termEvals: Record<TermId, Evaluation[]> = { T1: [], T2: [], T3: [] };
    for (const ec of block.evalCols) {
      const score = student.grades.get(ec.col) ?? null;
      termEvals[ec.termId].push({
        name: ec.name,
        termId: ec.termId,
        maxScore: ec.maxScore,
        score,
      });
    }

    // Build per-term grades
    const terms: Record<TermId, SubjectTermGrades> = {} as Record<TermId, SubjectTermGrades>;
    for (const tid of ['T1', 'T2', 'T3'] as TermId[]) {
      // Use the pre-computed average from the Excel if available, otherwise compute
      const excelAvg = block.avgCols[tid] !== null
        ? student.grades.get(block.avgCols[tid]!) ?? null
        : null;

      const computedAvg = computeSubjectTermAverage(termEvals[tid]);

      terms[tid] = {
        subjectCode: def?.code ?? block.name,
        subjectName: block.name,
        coefficient: def?.coefficient ?? 1,
        evaluations: termEvals[tid],
        average: excelAvg ?? computedAvg,
      };
    }

    // Year average: from Excel "Fin d'année" or computed from term averages
    const excelYearAvg = block.avgCols.FIN !== null
      ? student.grades.get(block.avgCols.FIN!) ?? null
      : null;
    const termAvgs = [terms.T1.average, terms.T2.average, terms.T3.average];
    const computedYearAvg = computeSimpleAverage(termAvgs);

    return {
      subjectCode: def?.code ?? block.name,
      subjectName: block.name,
      coefficient: def?.coefficient ?? 1,
      isBonus: def?.isBonus ?? false,
      isBehavioral: def?.isBehavioral ?? block.name.toLowerCase().includes('conduite'),
      isFrenchComposition: def?.isFrenchComposition ?? false,
      terms,
      yearAverage: excelYearAvg ?? computedYearAvg,
    };
  });
}

// ─── Name Parsing ───────────────────────────────────────────────────────────

function extractLastName(fullName: string): string {
  // In K12net format, names are typically "LASTNAME Firstname"
  // All-caps words are the last name
  const words = fullName.split(/\s+/);
  const lastNameWords = words.filter(w => w === w.toUpperCase() && /[A-ZÀ-Ÿ]/.test(w));
  return lastNameWords.join(' ') || words[0] || '';
}

function extractFirstName(fullName: string): string {
  const words = fullName.split(/\s+/);
  const firstNameWords = words.filter(w => w !== w.toUpperCase() || !/[A-ZÀ-Ÿ]/.test(w));
  return firstNameWords.join(' ') || '';
}

/**
 * Format a class name for display: "6eme_1" → "6ème 1", "TleD_2" → "Tle D 2"
 */
export function formatClassName(name: string): string {
  // Collège: 6eme_1 → 6ème 1
  const collegeMatch = name.match(/^(\d)eme_(\d+)$/i);
  if (collegeMatch) return `${collegeMatch[1]}ème ${collegeMatch[2]}`;

  // Seconde: 2ndeC_1 → 2nde C 1
  const secondeMatch = name.match(/^2nde([A-Z]+)_(\d+)$/i);
  if (secondeMatch) return `2nde ${secondeMatch[1]} ${secondeMatch[2]}`;

  // Première: 1ereA2_1 → 1ère A2 1
  const premiereMatch = name.match(/^1ere([A-Z0-9]+)_(\d+)$/i);
  if (premiereMatch) return `1ère ${premiereMatch[1]} ${premiereMatch[2]}`;

  // Terminale: TleD_2 → Tle D 2
  const terminaleMatch = name.match(/^Tle([A-Z0-9]+)_(\d+)$/i);
  if (terminaleMatch) return `Tle ${terminaleMatch[1]} ${terminaleMatch[2]}`;

  return name;
}

// ─── Cell Helpers ───────────────────────────────────────────────────────────

function getCellValue(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return ws[addr]?.v;
}

function getCellString(ws: XLSX.WorkSheet, row: number, col: number): string {
  const v = getCellValue(ws, row, col);
  return v !== undefined && v !== null ? String(v).trim() : '';
}

function getCellNumber(ws: XLSX.WorkSheet, row: number, col: number): number | null {
  const v = getCellValue(ws, row, col);
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

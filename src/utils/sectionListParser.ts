// ─── K12net Section List Parser ──────────────────────────────────────────────
// Parses the "Rapport sur la Liste des Sections" Excel export from K12net.
// Produces a CourseDefinition[] catalog with codes, names, coefficients, and class mappings.

import type { Branch, CourseDefinition, GradeLevel, SubjectDefinition } from '../types/k12';
import { parseK12Level } from '../types/k12';
import * as XLSX from 'xlsx';

// ─── Column indices in the section list spreadsheet ─────────────────────────
const COL = {
  CODE: 0,          // "Code de cours"
  NAME: 1,          // "Nom du cours"
  LEVEL: 2,         // "Niveau scolaire" e.g. "09-09***" or "13-13*** [D]"
  CLASSROOMS: 3,    // "Salle de classe" e.g. "TleD_1, TleD_2"
  COEFFICIENT: 4,   // "Coéfficients du cours"
  BRANCH: 5,        // "Branche du cours" (usually empty)
  WEEKLY_HOURS: 6,  // "Weekly Hours"
  SECTION_COUNT: 7, // "Nombre d'utilisation de la section"
  SECTIONS: 8,      // "Sections du cours"
  SECTION_HOURS: 9, // "Nombre d'heures de section hebdomadaires"
  SCHEDULE: 10,     // "Programme de la section"
  STUDENT_COUNT: 11,// "Nombre d'élèves du cours"
  TEACHERS: 12,     // "Enseignant"
} as const;

/** Data row start (row 0–3 = header/title, row 4 = column headers, row 5+ = data) */
const DATA_START_ROW = 5;

/** Known behavioral subjects */
const BEHAVIORAL_SUBJECTS = new Set(['Conduite']);

/** Known French composition subjects */
const FRENCH_COMP_SUBJECTS = new Set(['Français']);

/** Known bonus/non-graded subjects (coefficient 0 or typically excluded) */
const BONUS_SUBJECTS = new Set([
  'CDI', 'AVIS', 'Education Religieuse', 'Théâtre', 'Danse', 'LATIN',
]);

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse a K12net section list Excel file into CourseDefinition[].
 * @param fileData ArrayBuffer or Uint8Array of the .xlsx file
 */
export function parseSectionList(fileData: ArrayBuffer | Uint8Array): CourseDefinition[] {
  const wb = XLSX.read(fileData, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const courses: CourseDefinition[] = [];

  // Scan rows until no more data
  for (let r = DATA_START_ROW; r <= 500; r++) {
    const code = getCellString(ws, r, COL.CODE);
    const name = getCellString(ws, r, COL.NAME);
    if (!code && !name) break; // end of data

    const levelRaw = getCellString(ws, r, COL.LEVEL);
    const coefRaw = getCellValue(ws, r, COL.COEFFICIENT);
    const classroomsRaw = getCellString(ws, r, COL.CLASSROOMS);
    const weeklyHours = getCellNumber(ws, r, COL.WEEKLY_HOURS) ?? 0;
    const studentCount = getCellNumber(ws, r, COL.STUDENT_COUNT) ?? 0;
    const teachersRaw = getCellString(ws, r, COL.TEACHERS);

    // Parse level(s) — some courses span multiple levels (e.g. "07-07***, 08-08***")
    const levelParts = levelRaw.split(',').map(s => s.trim()).filter(Boolean);
    const firstLevel = levelParts[0] || '';
    const { level, branch } = parseK12Level(firstLevel);

    const coefficient = typeof coefRaw === 'number' ? coefRaw : parseFloat(String(coefRaw));
    const classrooms = classroomsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const teachers = teachersRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    courses.push({
      code,
      name,
      gradeLevel: level,
      branch,
      coefficient: isNaN(coefficient) ? 0 : coefficient,
      weeklyHours,
      classrooms,
      studentCount,
      teachers,
    });
  }

  return courses;
}

/**
 * Resolve SubjectDefinition[] for a specific classroom from the course catalog.
 * Matches courses whose classrooms list includes the given classroom name.
 */
export function resolveSubjectsForClass(
  catalog: CourseDefinition[],
  className: string,
): SubjectDefinition[] {
  return catalog
    .filter(c => c.classrooms.includes(className) && c.coefficient > 0)
    .map(c => ({
      code: c.code,
      name: c.name,
      coefficient: c.coefficient,
      isBonus: BONUS_SUBJECTS.has(c.name) || c.coefficient === 0,
      isBehavioral: BEHAVIORAL_SUBJECTS.has(c.name),
      isFrenchComposition: FRENCH_COMP_SUBJECTS.has(c.name),
      gradeLevel: c.gradeLevel,
      branch: c.branch,
    }));
}

/**
 * Build a map of className → SubjectDefinition[] for all classes in the catalog.
 */
export function buildSubjectsByClass(
  catalog: CourseDefinition[],
): Record<string, SubjectDefinition[]> {
  const allClassrooms = new Set<string>();
  for (const c of catalog) {
    for (const cl of c.classrooms) allClassrooms.add(cl);
  }

  const result: Record<string, SubjectDefinition[]> = {};
  for (const className of allClassrooms) {
    result[className] = resolveSubjectsForClass(catalog, className);
  }
  return result;
}

/**
 * Extract unique grade levels from the catalog.
 */
export function extractGradeLevels(catalog: CourseDefinition[]): GradeLevel[] {
  const levels = new Set(catalog.map(c => c.gradeLevel));
  return [...levels].sort();
}

/**
 * Extract unique branches for a given grade level.
 */
export function extractBranches(catalog: CourseDefinition[], level: GradeLevel): Branch[] {
  const branches = new Set(
    catalog
      .filter(c => c.gradeLevel === level && c.branch)
      .map(c => c.branch!)
  );
  return [...branches].sort();
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
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

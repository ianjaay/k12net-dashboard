/**
 * Parser for `liste_des_etablissment.xlsx` — Administration centrale import.
 *
 * Expected structure:
 *   Row 0 = grouping headers (ignored)
 *   Row 1 = column headers (Zone, School ID, School Name Ar, School Name En, ...)
 *   Row 2+ = data
 *
 * Columns include:
 *   Zone, School ID, School Name Ar/En, Education Type, Program Types,
 *   School Focus, Cycle, Student Gender, Staff Gender, Coordinates,
 *   Area/location, Address, Number of admins/Teachers/Counceling,
 *   07*** to 13*** (class counts), Total,
 *   07*** . to 13*** . (student counts), Total .,
 *   Principal Name/Staff ID/Mobile/Email, Phone No, Email
 */
import * as XLSX from 'xlsx';
import type { Etablissement, DRENA, StructureClasses } from '../types/multiLevel';
import { DRENA_PRECHARGES, MINISTERE_DEFAULT } from '../types/multiLevel';

export interface ParseEtablissementsResult {
  drenas: DRENA[];
  etablissements: Etablissement[];
  errors: string[];
}

// Column header patterns for dynamic column detection
const COL_PATTERNS: Record<string, string | RegExp> = {
  zone: /^zone$/i,
  schoolId: /^school\s*id$/i,
  schoolNameAr: /^school\s*name\s*ar$/i,
  schoolNameEn: /^school\s*name\s*en$/i,
  schoolFocus: /^school\s*focus$/i,
  cycle: /^cycle$/i,
  studentGender: /^student\s*gender$/i,
  staffGender: /^staff\s*gender$/i,
  coordinates: /^coordinates$/i,
  areaLocation: /^area\s*[\/\\]?\s*location$/i,
  address: /^address$/i,
  nbAdmins: /^number\s*of\s*admin/i,
  nbTeachers: /^number\s*of\s*teacher/i,
  nbCounceling: /^number\s*of\s*counc/i,
  principalName: /^principal\s*name$/i,
  principalStaffId: /^principal\s*staff\s*id$/i,
  principalMobile: /^principal\s*mobile$/i,
  principalEmail: /^principal\s*email$/i,
  phoneNo: /^phone\s*no$/i,
  email: /^email$/i,
};

// Level class count columns — exact headers from the real file
const LEVEL_CLASS_COLS: Record<string, string> = {
  '07***': 'sixieme',
  '08***': 'cinquieme',
  '09***': 'quatrieme',
  '10***': 'troisieme',
  '11***A': 'seconde_a',
  '11***C': 'seconde_c',
  '12***A1': 'premiere_a1',
  '12***A2': 'premiere_a2',
  '12***C': 'premiere_c',
  '12***D': 'premiere_d',
  '12***A2/C/A1/D': 'premiere_a2_c_a1_d',
  '12***A1/D/A2/C': 'premiere_a1_d_a2_c',
  '12***': 'premiere_all',
  '13***A1': 'terminale_a1',
  '13***A2': 'terminale_a2',
  '13***C': 'terminale_c',
  '13***D': 'terminale_d',
  '13***': 'terminale_all',
};

function detectColumns(headers: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toString().trim();
    if (!h) continue;

    // Check named patterns
    for (const [key, pattern] of Object.entries(COL_PATTERNS)) {
      if (pattern instanceof RegExp ? pattern.test(h) : h.toLowerCase() === pattern.toLowerCase()) {
        colMap[key] = i;
      }
    }

    // Check level class/effectif columns
    for (const [colHeader, fieldName] of Object.entries(LEVEL_CLASS_COLS)) {
      if (h === colHeader) {
        colMap[`classes_${fieldName}`] = i;
      }
      if (h === `${colHeader} .` || h === `${colHeader}.`) {
        colMap[`effectifs_${fieldName}`] = i;
      }
    }

    // Total columns
    if (h === 'Total' && !('total_classes' in colMap)) {
      colMap['total_classes'] = i;
    } else if ((h === 'Total .' || h === 'Total.') && !('total_effectifs' in colMap)) {
      colMap['total_effectifs'] = i;
    }
  }

  return colMap;
}

function getCell(row: Record<string, unknown>, colMap: Record<string, number>, key: string): string {
  const idx = colMap[key];
  if (idx === undefined) return '';
  const val = row[XLSX.utils.encode_col(idx)];
  if (val == null) return '';
  return String(val).trim();
}

function getCellNum(row: Record<string, unknown>, colMap: Record<string, number>, key: string): number {
  const val = getCell(row, colMap, key);
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function buildStructureClasses(
  row: Record<string, unknown>,
  colMap: Record<string, number>,
): StructureClasses {
  const nb_classes: Record<string, number> = {};
  const effectifs: Record<string, number> = {};

  for (const [, fieldName] of Object.entries(LEVEL_CLASS_COLS)) {
    nb_classes[fieldName] = getCellNum(row, colMap, `classes_${fieldName}`);
    effectifs[fieldName] = getCellNum(row, colMap, `effectifs_${fieldName}`);
  }

  nb_classes['total'] = getCellNum(row, colMap, 'total_classes');
  effectifs['total'] = getCellNum(row, colMap, 'total_effectifs');

  return {
    nb_classes: nb_classes as StructureClasses['nb_classes'],
    effectifs: effectifs as StructureClasses['effectifs'],
  };
}

function normalizeDRENAName(zone: string): string {
  return zone.trim().toUpperCase().replace(/\s+/g, ' ');
}

function findOrCreateDRENA(
  zone: string,
  drenasMap: Map<string, DRENA>,
): DRENA {
  const normalized = normalizeDRENAName(zone);
  const existing = drenasMap.get(normalized);
  if (existing) return existing;

  // Try to match with pre-loaded DRENA
  const preloaded = DRENA_PRECHARGES.find(
    d => normalizeDRENAName(d.nom) === normalized,
  );

  const drena: DRENA = {
    id: preloaded?.id ?? `DRENA_${normalized.replace(/[^A-Z0-9]/g, '_')}`,
    code: preloaded?.code ?? `DRENA_${normalized.replace(/[^A-Z0-9]/g, '_')}`,
    nom: zone.trim(),
    ministere_id: MINISTERE_DEFAULT.id,
  };

  drenasMap.set(normalized, drena);
  return drena;
}

export function parseEtablissementsFile(data: ArrayBuffer): ParseEtablissementsResult {
  const errors: string[] = [];
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { drenas: [], etablissements: [], errors: ['No sheet found in workbook'] };
  }

  const sheet = workbook.Sheets[sheetName];

  // Fix !ref — some files have an incorrect/truncated range.
  // Recompute from actual cell keys to ensure we read ALL rows.
  const cellKeys = Object.keys(sheet).filter(k => k[0] !== '!');
  if (cellKeys.length > 0) {
    let maxR = 0;
    let maxC = 0;
    for (const k of cellKeys) {
      const cell = XLSX.utils.decode_cell(k);
      if (cell.r > maxR) maxR = cell.r;
      if (cell.c > maxC) maxC = cell.c;
    }
    sheet['!ref'] = `A1:${XLSX.utils.encode_col(maxC)}${maxR + 1}`;
  }

  // Read all rows as array of arrays to detect headers
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawRows.length < 3) {
    return { drenas: [], etablissements: [], errors: ['File has too few rows'] };
  }

  // Find the header row (row with "Zone" and "School ID")
  let headerRowIdx = 1; // default: row 2 (0-indexed 1)
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i];
    if (row.some(c => /^zone$/i.test(String(c ?? '').trim())) &&
        row.some(c => /^school\s*id$/i.test(String(c ?? '').trim()))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rawRows[headerRowIdx].map(c => String(c ?? '').trim());
  const colMap = detectColumns(headers);

  if (colMap['zone'] === undefined || colMap['schoolId'] === undefined) {
    return { drenas: [], etablissements: [], errors: ['Required columns "Zone" and "School ID" not found'] };
  }

  // Parse data rows
  const drenasMap = new Map<string, DRENA>();
  const etablissements: Etablissement[] = [];

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (!rawRow || rawRow.every(c => !c || String(c).trim() === '')) continue;

    // Convert array row to col-keyed object for getCell
    const row: Record<string, unknown> = {};
    for (let j = 0; j < rawRow.length; j++) {
      row[XLSX.utils.encode_col(j)] = rawRow[j];
    }

    const zone = getCell(row, colMap, 'zone');
    const schoolId = getCell(row, colMap, 'schoolId');
    if (!zone || !schoolId) {
      errors.push(`Row ${i + 1}: missing Zone or School ID, skipped`);
      continue;
    }

    // "DIRECTORATE OF SUPERVISION..." is a special supervisory entity — keep it as its own DRENA

    const drena = findOrCreateDRENA(zone, drenasMap);

    const nom = getCell(row, colMap, 'schoolNameEn') || getCell(row, colMap, 'schoolNameAr') || schoolId;
    const coordinates = getCell(row, colMap, 'coordinates').replace(',', '.');

    const etab: Etablissement = {
      id: schoolId.replace(/\s+/g, '_'),
      code: schoolId,
      nom,
      type_focus: getCell(row, colMap, 'schoolFocus') || 'Général',
      cycle: getCell(row, colMap, 'cycle') || undefined,
      genre_eleves: getCell(row, colMap, 'studentGender') || undefined,
      genre_personnel: getCell(row, colMap, 'staffGender') || undefined,
      coordonnees: coordinates || undefined,
      localite: getCell(row, colMap, 'areaLocation') || undefined,
      adresse: getCell(row, colMap, 'address') || undefined,
      telephone: getCell(row, colMap, 'phoneNo') || undefined,
      email: getCell(row, colMap, 'email') || undefined,
      nb_administratifs: getCellNum(row, colMap, 'nbAdmins'),
      nb_enseignants: getCellNum(row, colMap, 'nbTeachers'),
      nb_conseillers: getCellNum(row, colMap, 'nbCounceling'),
      chef_etablissement: (() => {
        const name = getCell(row, colMap, 'principalName');
        if (!name) return undefined;
        return {
          nom: name,
          matricule: getCell(row, colMap, 'principalStaffId') || undefined,
          telephone: getCell(row, colMap, 'principalMobile') || undefined,
          email: getCell(row, colMap, 'principalEmail') || undefined,
        };
      })(),
      structure_classes: buildStructureClasses(row, colMap),
      drena_id: drena.id,
    };

    etablissements.push(etab);
  }

  return {
    drenas: Array.from(drenasMap.values()),
    etablissements,
    errors,
  };
}

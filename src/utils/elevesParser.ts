/**
 * Parser for `listes_eleves.xlsx` — Niveau établissement import.
 *
 * Expected structure (feuille "Élèves"):
 *   Row 0 = empty or grouping headers
 *   Row 1 = column headers
 *   Row 2+ = data
 *
 * Auto-creates:
 *   - ClasseML entries from distinct "Salle de classe" values
 *   - EleveML entries for each student row
 */
import * as XLSX from 'xlsx';
import type { EleveML, ClasseML, ParentInfo, NiveauScolaire, Sexe, QualiteEleve } from '../types/multiLevel';
import { parseNomClasse } from '../types/multiLevel';

export interface ParseElevesResult {
  classes: ClasseML[];
  eleves: EleveML[];
  errors: string[];
}

// Known column header patterns
const COL_DEFS: { key: string; patterns: RegExp[] }[] = [
  { key: 'matricule', patterns: [/num[ée]ro\s*matricule/i, /matricule/i] },
  { key: 'nom', patterns: [/nom\s*de\s*famille\s*de\s*l[''']?\s*[ée]l[èe]ve/i, /nom\s*de\s*famille/i, /^nom$/i] },
  { key: 'prenom', patterns: [/pr[ée]nom\s*de\s*l[''']?\s*[ée]l[èe]ve/i, /pr[ée]nom/i] },
  { key: 'dateNaissance', patterns: [/date\s*de\s*naissance/i] },
  { key: 'lieuNaissance', patterns: [/lieu\s*de\s*naissance/i] },
  { key: 'paysNaissance', patterns: [/pays\s*de\s*naissance/i] },
  { key: 'sexe', patterns: [/sexe/i] },
  { key: 'nationalite', patterns: [/pays\s*de\s*citoyen/i, /nationalit[ée]/i] },
  { key: 'telephone', patterns: [/t[ée]l[ée]phone\s*de\s*l[''']?\s*[ée]l[èe]ve/i, /num[ée]ro\s*de\s*t[ée]l[ée]phone\s*de\s*l[''']?\s*[ée]l[èe]ve/i] },
  { key: 'dateEntree', patterns: [/date\s*d[''']?\s*entr[ée]e/i] },
  { key: 'niveauScolaire', patterns: [/niveau\s*scolaire/i] },
  { key: 'typeAdhesion', patterns: [/type\s*d[''']?\s*adh[ée]sion/i] },
  { key: 'cadreTemporel', patterns: [/cadre\s*temporel/i] },
  { key: 'serie', patterns: [/^s[ée]rie$/i] },
  { key: 'salleDeClasse', patterns: [/salle\s*de\s*classe$/i] },
  { key: 'lv2', patterns: [/^lv2$/i] },
  { key: 'apMus', patterns: [/^ap\s*[\/\\]?\s*mus$/i] },
  { key: 'classePrecedente', patterns: [/salle\s*de\s*classe\s*ann[ée]e\s*pr[ée]c[ée]dente/i] },
  { key: 'lv2Precedente', patterns: [/lv2\s*ann[ée]e\s*pr[ée]c[ée]dente/i] },
  { key: 'apMusPrecedente', patterns: [/ap\s*[\/\\]?\s*mus\s*ann[ée]e\s*pr[ée]c[ée]dente/i] },
  { key: 'statut', patterns: [/^statut$/i] },
  { key: 'regime', patterns: [/^r[ée]gime$/i] },
  { key: 'statutInternat', patterns: [/statut\s*internat/i] },
  { key: 'qualite', patterns: [/^qualit[ée]$/i] },
  // Parent (père)
  { key: 'pereNumId', patterns: [/identit[ée]\s*nationale\s*du\s*p[èe]re/i] },
  { key: 'pereNom', patterns: [/nom\s*de\s*famille\s*du\s*p[èe]re/i] },
  { key: 'perePrenom', patterns: [/pr[ée]nom\s*du\s*p[èe]re/i] },
  { key: 'pereTel', patterns: [/t[ée]l[ée]phone\s*du\s*p[èe]re/i] },
  { key: 'pereEmail', patterns: [/e-?mail\s*du\s*p[èe]re/i] },
  // Parent (mère)
  { key: 'mereNumId', patterns: [/identit[ée]\s*nationale\s*de\s*la\s*m[èe]re/i] },
  { key: 'mereNom', patterns: [/nom\s*de\s*famille\s*de\s*la\s*m[èe]re/i] },
  { key: 'merePrenom', patterns: [/pr[ée]nom\s*de\s*la\s*m[èe]re/i] },
  { key: 'mereTel', patterns: [/t[ée]l[ée]phone\s*de\s*la\s*m[èe]re/i] },
  { key: 'mereEmail', patterns: [/e-?mail\s*de\s*la\s*m[èe]re/i] },
];

function detectColumns(headers: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};

  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toString().trim();
    if (!h) continue;

    for (const def of COL_DEFS) {
      if (def.key in colMap) continue; // already found
      if (def.patterns.some(p => p.test(h))) {
        colMap[def.key] = i;
        break;
      }
    }
  }

  return colMap;
}

function getCell(row: unknown[], idx: number | undefined): string {
  if (idx === undefined) return '';
  const val = row[idx];
  if (val == null) return '';
  return String(val).trim();
}

function parseDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  const s = String(val).trim();
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try DD/MM/YYYY
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

function parseSexe(val: string): Sexe {
  if (/f[ée]minin/i.test(val) || val.toUpperCase() === 'F') return 'Féminin';
  return 'Masculin';
}

function parseQualite(val: string): QualiteEleve {
  if (/redoublant/i.test(val) && !/non/i.test(val)) return 'Redoublant';
  return 'Non Redoublant';
}

function parseNiveau(val: string): NiveauScolaire {
  const map: Record<string, NiveauScolaire> = {
    'sixième': 'Sixième',
    'sixieme': 'Sixième',
    'cinquième': 'Cinquième',
    'cinquieme': 'Cinquième',
    'quatrième': 'Quatrième',
    'quatrieme': 'Quatrième',
    'troisième': 'Troisième',
    'troisieme': 'Troisième',
    'seconde': 'Seconde',
    'première': 'Première',
    'premiere': 'Première',
    'terminale': 'Terminale',
  };
  const lower = val.toLowerCase().trim();
  return map[lower] ?? 'Sixième';
}

function buildParent(
  row: unknown[],
  colMap: Record<string, number>,
  prefix: 'pere' | 'mere',
): ParentInfo | undefined {
  const nom = getCell(row, colMap[`${prefix}Nom`]);
  const prenom = getCell(row, colMap[`${prefix}Prenom`]);
  if (!nom && !prenom) return undefined;

  return {
    numero_identite: getCell(row, colMap[`${prefix}NumId`]) || undefined,
    nom: nom || '',
    prenom: prenom || '',
    telephone: getCell(row, colMap[`${prefix}Tel`]) || undefined,
    email: getCell(row, colMap[`${prefix}Email`]) || undefined,
  };
}

export function parseElevesFile(
  data: ArrayBuffer,
  etablissement_id: string,
  annee_scolaire: string,
): ParseElevesResult {
  const errors: string[] = [];
  const workbook = XLSX.read(data, { type: 'array' });

  // Find the "Élèves" sheet or use first sheet
  let sheetName = workbook.SheetNames.find(
    s => /[ée]l[èe]ves/i.test(s),
  );
  if (!sheetName) sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { classes: [], eleves: [], errors: ['No sheet found'] };
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

  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawRows.length < 3) {
    return { classes: [], eleves: [], errors: ['File has too few rows'] };
  }

  // Find header row (look for "Matricule" or "Numéro Matricule")
  let headerRowIdx = 1;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i];
    if (row.some(c => /matricule/i.test(String(c ?? '')))) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rawRows[headerRowIdx].map(c => String(c ?? '').trim());
  const colMap = detectColumns(headers);

  if (colMap['matricule'] === undefined && colMap['nom'] === undefined) {
    return { classes: [], eleves: [], errors: ['Required columns not found (Matricule, Nom)'] };
  }

  // Parse data rows and auto-create classes
  const classesMap = new Map<string, ClasseML>();
  const eleves: EleveML[] = [];
  let eleveIdx = 0;

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;

    const matricule = getCell(row, colMap['matricule']);
    const nom = getCell(row, colMap['nom']);
    if (!matricule && !nom) {
      errors.push(`Row ${i + 1}: missing matricule and nom, skipped`);
      continue;
    }

    const salleDeClasse = getCell(row, colMap['salleDeClasse']);
    if (!salleDeClasse) {
      errors.push(`Row ${i + 1}: missing Salle de classe for ${nom}, skipped`);
      continue;
    }

    // Auto-create class
    if (!classesMap.has(salleDeClasse)) {
      const parsed = parseNomClasse(salleDeClasse);
      const classe: ClasseML = {
        id: `${etablissement_id}_${annee_scolaire}_${salleDeClasse}`,
        nom: salleDeClasse,
        niveau: parsed?.niveau ?? parseNiveau(getCell(row, colMap['niveauScolaire'])),
        serie: parsed?.serie || getCell(row, colMap['serie']) || undefined,
        etablissement_id,
        annee_scolaire,
      };
      classesMap.set(salleDeClasse, classe);
    }

    const classe = classesMap.get(salleDeClasse)!;

    const eleve: EleveML = {
      id: `${etablissement_id}_${annee_scolaire}_${matricule || `row${eleveIdx}`}`,
      matricule: matricule || `UNKNOWN_${eleveIdx}`,
      nom,
      prenom: getCell(row, colMap['prenom']),
      date_naissance: parseDate(row[colMap['dateNaissance'] ?? -1]),
      lieu_naissance: getCell(row, colMap['lieuNaissance']) || undefined,
      pays_naissance: getCell(row, colMap['paysNaissance']) || "CÔTE D'IVOIRE",
      sexe: parseSexe(getCell(row, colMap['sexe'])),
      nationalite: getCell(row, colMap['nationalite']) || "CÔTE D'IVOIRE",
      telephone: getCell(row, colMap['telephone']) || undefined,
      date_entree: parseDate(row[colMap['dateEntree'] ?? -1]) || undefined,
      niveau_scolaire: classe.niveau,
      serie: classe.serie,
      salle_de_classe: salleDeClasse,
      lv2: getCell(row, colMap['lv2']) || 'Aucune',
      ap_mus: getCell(row, colMap['apMus']) || 'Aucune',
      statut: getCell(row, colMap['statut']) || 'Affecté(e)',
      qualite: parseQualite(getCell(row, colMap['qualite'])),
      statut_internat: getCell(row, colMap['statutInternat']) || 'Externe',
      type_adhesion: getCell(row, colMap['typeAdhesion']) || 'Accueil/Permanent',
      classe_annee_precedente: getCell(row, colMap['classePrecedente']) || undefined,
      lv2_annee_precedente: getCell(row, colMap['lv2Precedente']) || undefined,
      ap_mus_annee_precedente: getCell(row, colMap['apMusPrecedente']) || undefined,
      pere: buildParent(row, colMap, 'pere'),
      mere: buildParent(row, colMap, 'mere'),
      classe_id: classe.id,
      etablissement_id,
      annee_scolaire,
    };

    eleves.push(eleve);
    eleveIdx++;
  }

  return {
    classes: Array.from(classesMap.values()),
    eleves,
    errors,
  };
}

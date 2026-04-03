import * as XLSX from 'xlsx';
import type {
  CourseStructure, ECUEInfo, UEInfo,
  ParsedExcel, ECUEColumn, RawStudentRow, RawGrade,
  TermConfig,
} from '../types';

// ─── Default Term Configuration ───────────────────────────────────────────────

export const DEFAULT_TERM_CONFIG: TermConfig = {
  terms: [
    { id: 'S1', label: 'Semestre 1', patterns: ['- S1', '- SEM1', '[SEM1]'] },
    { id: 'S2', label: 'Semestre 2', patterns: ['- S2', '- SEM2', '[SEM2]'] },
  ],
  defaultTermId: 'S1',
};

// ─── Section List (Course Structure) Parser ───────────────────────────────────

function normalizeCourseName(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .trim();
}

export function parseSectionList(file: File): Promise<CourseStructure> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Fix truncated !ref: some exports set A1:U4 even when data extends further
        const allCells = Object.keys(ws).filter(k => !k.startsWith('!'));
        if (allCells.length > 0) {
          const maxR = Math.max(...allCells.map(k => XLSX.utils.decode_cell(k).r));
          const maxC = Math.max(...allCells.map(k => XLSX.utils.decode_cell(k).c));
          ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
        }
        const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: null,
        });

        const ues: Record<string, UEInfo> = {};
        const ecues: Record<string, ECUEInfo> = {};
        const orderedUeCodes: string[] = [];

        // Detect format by checking header row (row 4)
        const headerRow = rows[4];
        const isNewFormat = headerRow && String(headerRow[0] ?? '').trim().toLowerCase().includes('course code');

        // Column indices differ by format:
        // New format: col[0]=Code, col[1]=Name, col[3]=Homeroom(s), col[4]=Credit
        // Old format: col[3]=Code, col[4]=Name, no credits
        const COL_CODE = isNewFormat ? 0 : 3;
        const COL_NAME = isNewFormat ? 1 : 4;
        const COL_HOMEROOM = isNewFormat ? 3 : -1;
        const COL_CREDIT = isNewFormat ? 4 : -1;

        type RawItem = { code: string; name: string; credit: number; homerooms: string[] };
        const ueItems: RawItem[] = [];
        const ecueItems: RawItem[] = [];

        for (let i = 5; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[COL_CODE]) continue;
          const code = String(row[COL_CODE]).trim();
          if (!code) continue;

          const name = row[COL_NAME] ? String(row[COL_NAME]).trim() : '';
          const credit = COL_CREDIT >= 0 && row[COL_CREDIT] != null ? Number(row[COL_CREDIT]) : -1;

          // Parse homerooms (comma-separated)
          const homerooms: string[] = [];
          if (COL_HOMEROOM >= 0 && row[COL_HOMEROOM]) {
            String(row[COL_HOMEROOM]).split(',').forEach(h => {
              const trimmed = h.trim();
              if (trimmed) homerooms.push(trimmed);
            });
          }

          // Detect UE vs ECUE:
          // UEL_XXX (2 parts starting with UEL) → UE
          // UEL_XXX_YYY (3+ parts starting with UEL) → ECUE
          // *_UEn (ends with _UE followed by digits) → UE
          // *_UEn_m (has suffix after _UEn) → ECUE
          const isUE = isUECode(code);
          if (isUE) {
            ueItems.push({ code, name, credit: credit >= 0 ? credit : 6, homerooms });
          } else if (isECUECode(code)) {
            ecueItems.push({ code, name, credit: credit >= 0 ? credit : 1, homerooms });
          }
          // Skip codes that don't match any known pattern
        }

        // Build UE map (deduplicate by code)
        for (const { code, name, credit, homerooms } of ueItems) {
          if (!ues[code]) {
            if (!orderedUeCodes.includes(code)) orderedUeCodes.push(code);
            // Extract course name by stripping homeroom suffixes
            let ueName = normalizeCourseName(name || code);
            if (ueName === code && name) {
              const stripped = name
                .replace(/\s+L\d\/[A-Z][-–].+$/i, '')
                .replace(/\s+L\d\/[A-Z]\d?.+$/i, '')
                .replace(/\s+[A-Z]{2,}\d+(\s*[-–]\s*S\d+)?$/i, '')
                .trim();
              if (stripped) ueName = normalizeCourseName(stripped);
            }
            ues[code] = {
              code,
              name: ueName,
              totalCredits: credit,
              ecueCodes: [],
              homerooms,
            };
          } else {
            // Merge homerooms for duplicate entries
            for (const hr of homerooms) {
              if (!ues[code].homerooms.includes(hr)) ues[code].homerooms.push(hr);
            }
          }
        }

        // Build ECUE map, assigning to UEs by prefix
        for (const { code, name, credit, homerooms } of ecueItems) {
          if (ecues[code]) {
            // Merge homerooms for duplicate entries
            for (const hr of homerooms) {
              if (!ecues[code].homerooms.includes(hr)) ecues[code].homerooms.push(hr);
            }
            continue;
          }
          const ueCode = findUECode(code, ues);

          // Extract course name intelligently:
          // If name is empty but the raw name from the section list contains homeroom suffix,
          // extract the course name by stripping the homeroom/class suffix.
          // e.g. "ANGLAIS GENERAL 1 DSER2" → "ANGLAIS GENERAL 1"
          // e.g. "INITIATION A LA COMPTABILITE GENERALE DSER2 - S3" → "INITIATION A LA COMPTABILITE GENERALE"
          let effectiveName = normalizeCourseName(name);
          if (!effectiveName || effectiveName === code) {
            // Try to extract name from the raw name by stripping homeroom suffixes
            // Homerooms look like: DSER2, FDIG1, LNUM3, MDIG2, L1/A-GROUPE 1, etc.
            const strippedName = name
              .replace(/\s+L\d\/[A-Z][-–].+$/i, '')       // strip "L1/A-GROUPE 1" suffix
              .replace(/\s+L\d\/[A-Z]\d?.+$/i, '')          // strip other L1/X patterns
              .replace(/\s+[A-Z]{2,}\d+(\s*[-–]\s*S\d+)?$/i, '')  // strip "DSER2" or "DSER2 - S3"
              .trim();
            if (strippedName && strippedName !== name) {
              effectiveName = normalizeCourseName(strippedName);
            }
          }

          ecues[code] = {
            code,
            name: effectiveName,
            credits: credit,
            ueCode,
            homerooms,
          };
          if (ueCode && ues[ueCode]) {
            if (!ues[ueCode].ecueCodes.includes(code)) {
              ues[ueCode].ecueCodes.push(code);
            }
          }
        }

        resolve({ ues, ecues, orderedUeCodes });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

function isUECode(code: string): boolean {
  // Old format: UEL_XXX (exactly 2 underscore parts starting with UEL)
  if (code.startsWith('UEL_') || code.startsWith('UEL_')) {
    const parts = code.split('_').filter(Boolean);
    if (parts.length === 2) return true;
  }
  // New format: ends with _UEn (e.g. DSER_S2_UE1)
  if (/_UE\d+$/.test(code)) return true;
  return false;
}

function isECUECode(code: string): boolean {
  // Old format: UEL_XXX_YYY (3+ parts starting with UEL)
  if (code.startsWith('UEL_')) {
    const parts = code.split('_').filter(Boolean);
    if (parts.length >= 3) return true;
  }
  // New format: has _UEn_ followed by more (e.g. DSER_S2_UE1_1)
  if (/_UE\d+_\d+/.test(code)) return true;
  return false;
}

function findUECode(ecueCode: string, ues: Record<string, UEInfo>): string {
  // Try progressively shorter prefixes
  const parts = ecueCode.split('_');
  for (let len = parts.length - 1; len >= 2; len--) {
    const candidate = parts.slice(0, len).join('_');
    if (ues[candidate]) return candidate;
  }
  return '';
}

// ─── Grade Distribution Parser ────────────────────────────────────────────────

function parseGradeValue(val: unknown): { value: number | null; approved: boolean } {
  if (val == null) return { value: null, approved: true };
  const str = String(val).trim();
  if (!str) return { value: null, approved: true };
  const normalized = str.toUpperCase();
  if (normalized === 'X' || normalized === 'DISP' || normalized === 'EX') {
    return { value: null, approved: true };
  }
  const approved = !str.includes('*');
  const cleaned = str
    .replace(/\*/g, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
  const num = Number(cleaned);
  return { value: Number.isNaN(num) ? null : num, approved };
}

function normalizeHomeroomName(name: string): string {
  return name
    .trim()
    .replace(/^homeroom\s*/i, '')
    .replace(/^salle de classe\s*/i, '')
    .replace(/^classroom\s*/i, '')
    .replace(/^([LM]\d)-([A-Z])(?=(?:\s*[-/]\s*GROUPE|\b))/i, '$1/$2');
}

function extractGroupInfo(titleCell: string): { groupName: string; semester: string; date: string; level: string } {
  const lines = titleCell.split('\n').map(l => l.trim()).filter(Boolean);
  let groupName = '';
  let semester = '';
  let date = '';
  let level = '';
  for (const line of lines) {
    if ((/^homeroom\b/i.test(line) || /^salle de classe\b/i.test(line) || /^classroom\b/i.test(line))
      && !/report|rapport/i.test(line)) {
      groupName = normalizeHomeroomName(line);
    } else if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(line)) {
      date = line;
    } else if (/semestre|semester/i.test(line)) {
      semester = line;
    }
  }
  if (groupName) {
    groupName = normalizeHomeroomName(groupName);
  }
  // Extract level from group name (e.g. "L1/A-GROUPE 1" -> "L1", "DSER2" -> try from context)
  const levelMatch = groupName.match(/\b(L\d|M\d)\b/i);
  if (levelMatch) level = levelMatch[1].toUpperCase();
  return { groupName, semester, date, level };
}

// ── Semester normalization ──────────────────────────────────────────────────

export function normalizeSemester(semester: string): 'S1' | 'S2' | null {
  const s = semester.toLowerCase();
  if (/premier\s+semestre|semestre\s*1|semester\s*1|\bsem\s*1\b|\bs1\b/i.test(s)) return 'S1';
  if (/deuxi[eè]me\s+semestre|semestre\s*2|semester\s*2|\bsem\s*2\b|\bs2\b/i.test(s)) return 'S2';
  return null;
}

// ── Detect term from ECUE name using TermConfig patterns ────────────────────

function detectTermFromName(rawName: string, termConfig: TermConfig): string | null {
  const upper = rawName.toUpperCase();
  for (const term of termConfig.terms) {
    for (const pattern of term.patterns) {
      if (upper.includes(pattern.toUpperCase())) {
        return term.id;
      }
    }
  }
  return null;
}

// ── Parse a single worksheet into ParsedExcel ──────────────────────────────

function parseSheet(ws: XLSX.WorkSheet, sheetName: string, termConfig: TermConfig = DEFAULT_TERM_CONFIG): ParsedExcel {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
  });

  // ── Parse header ────────────────────────────────────────────────────
  let groupName = sheetName;
  let semester = '';
  let date = '';
  let level = '';

  // Title cell is at row 0, col 3
  const titleCell = rows[0]?.[3];
  if (titleCell && typeof titleCell === 'string' && titleCell.includes('\n')) {
    const info = extractGroupInfo(titleCell);
    groupName = info.groupName || sheetName;
    semester = info.semester;
    date = info.date;
    level = info.level;
  }

  // Fallback semester detection from header row labels
  if (!semester) {
    const headerScan = rows[7] as (string | null)[] | undefined;
    if (headerScan) {
      const headerStr = headerScan.filter(Boolean).join(' ');
      if (/Deuxi[eè]me\s+Semestre/i.test(headerStr) || /\[SEM2\]/i.test(headerStr)) {
        semester = 'Deuxième Semestre';
      } else if (/Premier\s+Semestre/i.test(headerStr) || /\[SEM1\]/i.test(headerStr)) {
        semester = 'Premier Semestre';
      }
    }
  }

  // ── Find UE/ECUE/header rows ─────────────────────────────────────────
  const ueRow = rows[4] as (string | null)[];
  const ecueRow = rows[5] as (string | null)[];
  const headerRow = rows[7] as (string | null)[];

  // Find start of student data (first row where col 0 is a positive integer or numeric string)
  let dataStartRow = 8;
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const first = r[0];
    const num = typeof first === 'number' ? first : Number(String(first ?? '').trim());
    if (Number.isFinite(num) && num > 0) { dataStartRow = i; break; }
  }

  // ── Identify ECUE columns ────────────────────────────────────────────
  const ecueColumns: ECUEColumn[] = [];
  let currentUEName = '';

  for (let col = 3; col < (headerRow?.length ?? 0); col++) {
    const hdr = headerRow?.[col];
    if (!hdr || typeof hdr !== 'string') continue;

    if (String(hdr).includes('CCC')) {
      for (let lookback = col; lookback >= 3; lookback--) {
        const candidate = ueRow?.[lookback];
        if (candidate && typeof candidate === 'string' && candidate.trim().length > 1) {
          currentUEName = candidate.trim();
          break;
        }
      }
      const rawEcueName = ecueRow?.[col] ? String(ecueRow[col]).trim() : `ECUE_${col}`;

      // Detect term from ECUE name using configurable patterns
      const detectedTermId = detectTermFromName(rawEcueName, termConfig);
      const detectedTerm: 'S1' | 'S2' | null = detectedTermId === 'S1' ? 'S1'
        : detectedTermId === 'S2' ? 'S2'
        : detectedTermId ? 'S2' // non-standard term IDs mapped to S2 for backward compat
        : null;

      // Strip group/homeroom suffixes:
      // "ANGLAIS GENERAL 1 L1/A-GROUPE 1" → "ANGLAIS GENERAL 1"
      // "INITIATION A LA COMPTABILITE GENERALE DSER2" → "INITIATION A LA COMPTABILITE GENERALE"
      // "ANGLAIS DE SPECIALITE  2 DSER2 - S3" → "ANGLAIS DE SPECIALITE  2"
      const normalized = normalizeCourseName(
        rawEcueName
          .replace(/\s+L\d\/[A-Z][-–].+$/i, '')
          .replace(/\s+L\d\/[A-Z]\d?.+$/i, '')
          .replace(/\s+[A-Z]{2,}\d+(\s*-\s*S\d+)?$/i, '')  // strip homeroom suffix like " DSER2" or " DSER2 - S3"
      );
      ecueColumns.push({
        colIndex: col,
        rawName: rawEcueName,
        normalizedName: normalized,
        rawUeName: currentUEName,
        detectedTerm,
      });
    }
  }

  // ── Resolve summary column start once (not per-row) ──────────────────
  // Look for the summary section header (Premier Semestre / Total / Average / Rank)
  // that appears AFTER the last ECUE block. Some export formats omit this section.
  let globalSummaryStart: number | null = null;
  if (headerRow && ecueColumns.length > 0) {
    const lastEcueStart = ecueColumns[ecueColumns.length - 1].colIndex;
    // Scan up to 10 columns past the expected end of the last ECUE block
    for (let c = lastEcueStart + 4; c < Math.min(lastEcueStart + 20, headerRow.length); c++) {
      const label = headerRow[c] ? String(headerRow[c]).trim() : '';
      const next  = headerRow[c + 1] ? String(headerRow[c + 1]).trim() : '';
      // The summary starts with "Premier/Deuxième Semestre" followed by "Total" or "Average"
      if (/premier|deuxi[eè]me/i.test(label) && (/total/i.test(next) || /average|rank/i.test(headerRow[c + 2] ? String(headerRow[c + 2]) : ''))) {
        globalSummaryStart = c;
        break;
      }
    }
  }

  // ── Parse student rows ───────────────────────────────────────────────
  const studentRows: RawStudentRow[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    // Accept both numeric ranks (e.g. 1) and string-numeric ranks (e.g. "1")
    const firstCell = row[0];
    const rankRaw = typeof firstCell === 'number'
      ? firstCell
      : Number(String(firstCell ?? '').trim());
    if (!Number.isFinite(rankRaw) || rankRaw <= 0) continue;
    const matricule = row[1] ? String(row[1]).trim() : '';
    const name = row[2] ? String(row[2]).trim() : '';

    const grades: RawGrade[] = ecueColumns.map(({ colIndex }) => {
      const cccP = parseGradeValue(row[colIndex]);
      const etsP = parseGradeValue(row[colIndex + 1]);
      const s1P  = parseGradeValue(row[colIndex + 2]);
      const s2P  = parseGradeValue(row[colIndex + 3]);
      const avgP = parseGradeValue(row[colIndex + 4]);

      const ets = etsP.value;
      return {
        ccc: cccP.value,
        ets,
        session1: s1P.value,
        session2: s2P.value,
        fileAvg: avgP.value,
        approved: avgP.approved && cccP.approved && etsP.approved && s1P.approved && s2P.approved,
        approvalFlags: {
          ccc: cccP.approved,
          ets: etsP.approved,
          session1: s1P.approved,
          session2: s2P.approved,
          fileAvg: avgP.approved,
        },
      };
    });

    // Summary columns — use pre-resolved position, or null if absent
    let fileAverage: number | null = null;
    let fileTotal: number | null = null;
    let fileRankStr: string | null = null;

    if (globalSummaryStart !== null) {
      const fileSemAvgP = parseGradeValue(row[globalSummaryStart]);
      const fileTotalP  = parseGradeValue(row[globalSummaryStart + 1]);
      const fileAvgP    = parseGradeValue(row[globalSummaryStart + 2]);
      const fileRankRaw = row[globalSummaryStart + 3];
      fileAverage = fileSemAvgP.value ?? fileAvgP.value;
      fileTotal   = fileTotalP.value;
      fileRankStr = fileRankRaw != null ? String(fileRankRaw).trim() : null;
    }

    studentRows.push({
      rank: rankRaw,
      matricule,
      name,
      grades,
      fileAverage,
      fileTotal,
      fileRank: fileRankStr,
      isExAequo: fileRankStr?.toLowerCase().includes('repeat') ?? false,
    });
  }

  // Compute available terms from ECUE columns
  const termSet = new Set<'S1' | 'S2'>();
  for (const col of ecueColumns) {
    if (col.detectedTerm) termSet.add(col.detectedTerm);
  }
  const availableTerms = termSet.size > 0
    ? ([...termSet].sort() as ('S1' | 'S2')[])
    : [termConfig.defaultTermId as 'S1' | 'S2']; // default to configured default term

  return { groupName, semester, date, level, ecueColumns, studentRows, availableTerms };
}

// ── Split a mixed-term sheet into separate ParsedExcel objects per term ─────

function splitSheetByTerm(parsed: ParsedExcel, termConfig: TermConfig = DEFAULT_TERM_CONFIG): ParsedExcel[] {
  // If only one term detected, or no explicit term suffixes, return as-is
  if (parsed.availableTerms.length <= 1) {
    // For single-term sheets, try to detect semester from headers/column labels
    if (!parsed.semester) {
      const termDef = termConfig.terms.find(t => t.id === parsed.availableTerms[0]);
      parsed.semester = termDef?.label ?? 'Premier Semestre';
    }
    return [parsed];
  }

  // Sheet has multiple terms — split into one ParsedExcel per term
  return parsed.availableTerms.map(term => {
    // Find indices of ECUE columns belonging to this term
    const defaultTermId = termConfig.defaultTermId as 'S1' | 'S2';
    const termIndices: number[] = [];
    parsed.ecueColumns.forEach((col, idx) => {
      const colTerm = col.detectedTerm ?? defaultTermId;
      if (colTerm === term) termIndices.push(idx);
    });

    const termColumns = termIndices.map(i => parsed.ecueColumns[i]);
    const termStudentRows = parsed.studentRows.map(row => ({
      ...row,
      grades: termIndices.map(i => row.grades[i]),
      // Clear file-level summary since it covers all terms combined
      fileAverage: null,
      fileTotal: null,
      fileRank: null,
    }));

    const termDef = termConfig.terms.find(t => t.id === term);

    return {
      groupName: parsed.groupName,
      semester: termDef?.label ?? (term === 'S1' ? 'Premier Semestre' : 'Deuxième Semestre'),
      date: parsed.date,
      level: parsed.level,
      ecueColumns: termColumns,
      studentRows: termStudentRows,
      availableTerms: [term],
    };
  });
}

// ── Single-sheet grade distribution (backward compatible) ──────────────────

export function parseGradeDistribution(file: File, termConfig: TermConfig = DEFAULT_TERM_CONFIG): Promise<ParsedExcel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(parseSheet(ws, wb.SheetNames[0], termConfig));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ── Multi-sheet grade distribution (all classes) ───────────────────────────

export function parseGradeDistributionAllSheets(file: File, termConfig: TermConfig = DEFAULT_TERM_CONFIG): Promise<ParsedExcel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const results: ParsedExcel[] = [];
        for (const name of wb.SheetNames) {
          try {
            const ws = wb.Sheets[name];
            const parsed = parseSheet(ws, name, termConfig);
            // Skip empty sheets (no students)
            if (parsed.studentRows.length > 0) {
              // Split sheets that contain both S1 and S2 ECUEs
              const splits = splitSheetByTerm(parsed, termConfig);
              results.push(...splits);
            }
          } catch {
            // Skip sheets that fail to parse (e.g. summary sheets)
            console.warn(`Skipped sheet "${name}": parse error`);
          }
        }
        if (results.length === 0) {
          reject(new Error('No valid grade sheets found in the file'));
        } else {
          resolve(results);
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ── Extract class metadata (filiere, niveau) from parsed header ────────────

export function extractClassMetadata(parsed: ParsedExcel, sheetName: string): { niveau: string; filiere: string } {
  const gn = parsed.groupName || sheetName;

  // Extract niveau: L1, L2, L3, M1, M2
  let niveau = parsed.level || '';
  if (!niveau) {
    const niveauMatch = gn.match(/\b(L[1-3]|M[1-2])\b/i);
    if (niveauMatch) niveau = niveauMatch[1].toUpperCase();
  }
  // For homerooms like "DSER1", "DSER2", "DSER3" → extract level from trailing digit
  // DSER1 = L1, DSER2 = L2, DSER3 = L3, MDIG1 = M1, etc.
  if (!niveau) {
    const homeroomMatch = gn.match(/^[A-Z]+(\d)$/i);
    if (homeroomMatch) {
      const digit = homeroomMatch[1];
      // Guess level based on prefix: M* → Master, others → Licence
      const prefix = gn.replace(/\d+$/, '').toUpperCase();
      if (prefix.startsWith('M')) {
        niveau = `M${digit}`;
      } else {
        niveau = `L${digit}`;
      }
    }
  }

  // Extract filiere
  let filiere = '';

  // For homerooms like "DSER2", "FDIG1", "LNUM3", "MDIG2" → strip trailing digits
  const homeroomPrefixMatch = gn.match(/^([A-Z]{2,})\d*$/i);
  if (homeroomPrefixMatch) {
    filiere = homeroomPrefixMatch[1].toUpperCase();
  }

  // For "L1/A-GROUPE 1" style → filiere is the shared L1 program
  if (!filiere) {
    const beforeLevel = gn.split(/\b[LM]\d\b/i)[0]?.trim();
    if (beforeLevel) {
      const tokens = beforeLevel.split(/[\s/,;-]+/).filter(t => t.length >= 2);
      if (tokens.length > 0) {
        filiere = tokens[tokens.length - 1].toUpperCase();
      }
    }
  }

  // If it starts with "L1" or "M1" directly, it's a common class
  if (!filiere && /^[LM]\d/i.test(gn)) {
    filiere = 'COMMUN';
  }

  if (!filiere) filiere = 'AUTRE';

  return { niveau: niveau || 'AUTRE', filiere };
}

// ─── Filter CourseStructure by homeroom ─────────────────────────────────────

export function filterCoursesByHomeroom(
  courses: CourseStructure,
  homeroom: string,
): CourseStructure {
  const targetHomeroom = normalizeHomeroomName(homeroom);
  const ues: Record<string, UEInfo> = {};
  const ecues: Record<string, ECUEInfo> = {};
  const orderedUeCodes: string[] = [];

  // Include UEs that belong to the given homeroom
  for (const ueCode of courses.orderedUeCodes) {
    const ue = courses.ues[ueCode];
    if (!ue) continue;
    const normalizedHomerooms = ue.homerooms.map(normalizeHomeroomName);
    // If homerooms array is empty (old format, no homeroom info), include all
    if (ue.homerooms.length === 0 || normalizedHomerooms.includes(targetHomeroom)) {
      ues[ueCode] = { ...ue, ecueCodes: [] }; // will rebuild ecueCodes
      orderedUeCodes.push(ueCode);
    }
  }

  // Include ECUEs that belong to the given homeroom
  for (const [ecueCode, ecue] of Object.entries(courses.ecues)) {
    const normalizedHomerooms = ecue.homerooms.map(normalizeHomeroomName);
    if (ecue.homerooms.length === 0 || normalizedHomerooms.includes(targetHomeroom)) {
      ecues[ecueCode] = ecue;
      // Link to UE if it exists in filtered set
      if (ecue.ueCode && ues[ecue.ueCode]) {
        if (!ues[ecue.ueCode].ecueCodes.includes(ecueCode)) {
          ues[ecue.ueCode].ecueCodes.push(ecueCode);
        }
      }
    }
  }

  return { ues, ecues, orderedUeCodes };
}

// ─── Match ECUE columns to course structure ───────────────────────────────────

/**
 * Match ECUE columns from grade file to course structure codes.
 * Uses name similarity matching when course names are available,
 * falls back to positional matching when names are empty (new format).
 */
export function matchECUEToCourses(
  ecueColumns: ECUEColumn[],
  courses: CourseStructure,
): { ecueCode: string; colIndex: number; matchedUECode: string }[] {
  // Check if most ECUEs in course structure have meaningful names
  // (not just the code repeated as name). If most have names, use name matching;
  // otherwise fall back to positional matching.
  const ecueCodesAll = Object.keys(courses.ecues);
  const namedCount = ecueCodesAll.filter(c => {
    const ecue = courses.ecues[c];
    return ecue.name.length > 0 && ecue.name !== ecue.code;
  }).length;
  const hasNames = namedCount > ecueCodesAll.length * 0.5;

  if (hasNames) {
    return matchByNameSimilarity(ecueColumns, courses);
  } else {
    return matchByPosition(ecueColumns, courses);
  }
}

/** Name-based matching (original algorithm) */
function matchByNameSimilarity(
  ecueColumns: ECUEColumn[],
  courses: CourseStructure,
): { ecueCode: string; colIndex: number; matchedUECode: string }[] {
  const ecueCodes = Object.keys(courses.ecues);
  const ueCodes = Object.keys(courses.ues);

  return ecueColumns.map((col) => {
    let bestECUECode = '';
    let bestECUEScore = 0;
    for (const code of ecueCodes) {
      const score = similarity(col.normalizedName, normalizeCourseName(courses.ecues[code].name));
      if (score > bestECUEScore) { bestECUEScore = score; bestECUECode = code; }
    }

    let matchedUECode = bestECUECode ? (courses.ecues[bestECUECode]?.ueCode ?? '') : '';
    if (!matchedUECode && col.rawUeName) {
      let bestUEScore = 0;
      const rawUENorm = normalizeCourseName(col.rawUeName);
      for (const code of ueCodes) {
        if (courses.ues[code].totalCredits === 0) continue;
        const score = similarity(rawUENorm, normalizeCourseName(courses.ues[code].name));
        if (score > bestUEScore) { bestUEScore = score; matchedUECode = code; }
      }
    }
    if (bestECUECode && !courses.ecues[bestECUECode]?.ueCode && col.rawUeName) {
      const rawUENorm = normalizeCourseName(col.rawUeName);
      let bestUEScore = 0;
      for (const code of ueCodes) {
        if (courses.ues[code].totalCredits === 0) continue;
        const score = similarity(rawUENorm, normalizeCourseName(courses.ues[code].name));
        if (score > bestUEScore) { bestUEScore = score; matchedUECode = code; }
      }
      if (matchedUECode && courses.ecues[bestECUECode]) {
        courses.ecues[bestECUECode].ueCode = matchedUECode;
        if (!courses.ues[matchedUECode].ecueCodes.includes(bestECUECode)) {
          courses.ues[matchedUECode].ecueCodes.push(bestECUECode);
        }
      }
    }

    return { ecueCode: bestECUECode, colIndex: col.colIndex, matchedUECode };
  });
}

/**
 * Positional matching for when Section List has no ECUE names.
 * Matches grade file ECUEs to Section List ECUEs by order within each UE.
 * The grade file UE names (row 4) group ECUEs; Section List UEs group ECUEs by code prefix.
 * Both are in the same sequential order.
 */
function matchByPosition(
  ecueColumns: ECUEColumn[],
  courses: CourseStructure,
): { ecueCode: string; colIndex: number; matchedUECode: string }[] {
  // Build ordered list of ECUEs from course structure (non-zero credit UEs only)
  const orderedECUEs: { ecueCode: string; ueCode: string }[] = [];
  for (const ueCode of courses.orderedUeCodes) {
    const ue = courses.ues[ueCode];
    if (!ue || ue.totalCredits === 0) continue;
    for (const ecueCode of ue.ecueCodes) {
      const ecue = courses.ecues[ecueCode];
      if (ecue && ecue.credits > 0) {
        orderedECUEs.push({ ecueCode, ueCode });
      }
    }
  }

  // Map by position
  return ecueColumns.map((col, idx) => {
    if (idx < orderedECUEs.length) {
      return {
        ecueCode: orderedECUEs[idx].ecueCode,
        colIndex: col.colIndex,
        matchedUECode: orderedECUEs[idx].ueCode,
      };
    }
    // Extra ECUE columns beyond what's in the course structure
    return { ecueCode: `UNKNOWN_${idx}`, colIndex: col.colIndex, matchedUECode: '' };
  });
}

function similarity(a: string, b: string): number {
  // Simple word-overlap similarity
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

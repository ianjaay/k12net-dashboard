// Test the full import pipeline exactly as the UI does it
const XLSX = require('xlsx');

// ─── Simulate sectionListParser.buildSubjectsByClass ────────────────────────
function parseK12Level(raw) {
  const match = raw.match(/^(\d{2})-\d{2}\*{3}(?:\s*\[(\w+)\])?/);
  if (!match) return { level: '07', branch: null };
  return { level: match[1], branch: match[2] || null };
}

const BEHAVIORAL = new Set(['Conduite']);
const FRENCH_COMP = new Set(['Français']);
const BONUS = new Set(['CDI', 'AVIS', 'Education Religieuse', 'Théâtre', 'Danse', 'LATIN']);

const slWb = XLSX.readFile('docs/Liste Section Sainte marie.xlsx');
const slWs = slWb.Sheets[slWb.SheetNames[0]];
const courses = [];
for (let r = 5; r <= 500; r++) {
  const code = slWs[XLSX.utils.encode_cell({r, c: 0})]?.v;
  const name = slWs[XLSX.utils.encode_cell({r, c: 1})]?.v;
  if (!code && !name) break;
  const levelRaw = String(slWs[XLSX.utils.encode_cell({r, c: 2})]?.v || '');
  const coef = slWs[XLSX.utils.encode_cell({r, c: 4})]?.v;
  const classrooms = String(slWs[XLSX.utils.encode_cell({r, c: 3})]?.v || '').split(',').map(s => s.trim()).filter(Boolean);
  const { level, branch } = parseK12Level(levelRaw.split(',')[0].trim());
  courses.push({ code: String(code), name: String(name), gradeLevel: level, branch, 
    coefficient: typeof coef === 'number' ? coef : 0, classrooms,
    isBonus: BONUS.has(String(name)), isBehavioral: BEHAVIORAL.has(String(name)),
    isFrenchComposition: FRENCH_COMP.has(String(name)),
  });
}

function buildSubjectsByClass(catalog) {
  const allClassrooms = new Set();
  for (const c of catalog) for (const cl of c.classrooms) allClassrooms.add(cl);
  const result = {};
  for (const className of allClassrooms) {
    result[className] = catalog.filter(c => c.classrooms.includes(className)).map(c => ({
      code: c.code, name: c.name, coefficient: c.coefficient, 
      isBehavioral: c.isBehavioral, isBonus: c.isBonus, isFrenchComposition: c.isFrenchComposition,
      gradeLevel: c.gradeLevel, branch: c.branch,
    }));
  }
  return result;
}

const subjectsByClass = buildSubjectsByClass(courses);

// ─── Simulate gradesParser exactly ──────────────────────────────────────────
const EVAL_HEADER_RE = /^(.+?)\[T([123])\]\s*\[(\d+)\]$/;
const TERM_AVG_NAMES = {
  'Premier Trimestre': 'T1', 'Deuxième Trimestre': 'T2', 'Troisième Trimestre': 'T3', "Fin d'année": 'FIN'
};

const grWb = XLSX.readFile('docs/moyennes sainte marie.xlsx');

// Check ONE class: 6eme_1
const targetSheet = '6eme_1';
const ws = grWb.Sheets[targetSheet];
const merges = ws['!merges'] || [];

// Row 4 subject merges
const subjectMerges = merges.filter(m => m.s.r === 4 && m.e.r === 4).sort((a, b) => a.s.c - b.s.c);

const subjectBlocks = [];
for (const merge of subjectMerges) {
  const name = String(ws[XLSX.utils.encode_cell({r: 4, c: merge.s.c})]?.v || '').trim();
  if (!name) continue;
  
  const evalCols = [];
  const avgCols = { T1: null, T2: null, T3: null, FIN: null };
  
  for (let c = merge.s.c; c <= merge.e.c; c++) {
    const header = String(ws[XLSX.utils.encode_cell({r: 6, c})]?.v || '').trim();
    if (!header) continue;
    
    const termKey = TERM_AVG_NAMES[header];
    if (termKey) { avgCols[termKey] = c; continue; }
    
    const match = header.match(EVAL_HEADER_RE);
    if (match) {
      evalCols.push({ col: c, name: match[1].trim(), termId: `T${match[2]}`, maxScore: parseInt(match[3]) });
      continue;
    }
    
    const moyenneMatch = header.match(/^Moyenne\[T([123])\]\s*\[(\d+)\]$/);
    if (moyenneMatch) {
      evalCols.push({ col: c, name: 'Moyenne', termId: `T${moyenneMatch[1]}`, maxScore: parseInt(moyenneMatch[2]) });
    }
  }
  
  subjectBlocks.push({ name, startCol: merge.s.c, endCol: merge.e.c, evalCols, avgCols });
}

// Parse first student
const r = 7;
const studentName = String(ws[XLSX.utils.encode_cell({r, c: 1})]?.v || '');
console.log(`Student: ${studentName}`);

// Get subject definitions from section list
const subjectDefs = subjectsByClass[targetSheet] || [];
const subjectDefMap = new Map(subjectDefs.map(s => [s.name, s]));

console.log('\n=== SUBJECT MATCHING ===');
for (const block of subjectBlocks) {
  const def = subjectDefMap.get(block.name);
  const coef = def?.coefficient ?? 1;
  const matched = def ? 'YES' : 'NO (default coef=1)';
  
  // Get term averages from Excel
  const t1 = block.avgCols.T1 !== null ? ws[XLSX.utils.encode_cell({r, c: block.avgCols.T1})]?.v : null;
  const t2 = block.avgCols.T2 !== null ? ws[XLSX.utils.encode_cell({r, c: block.avgCols.T2})]?.v : null;
  const t3 = block.avgCols.T3 !== null ? ws[XLSX.utils.encode_cell({r, c: block.avgCols.T3})]?.v : null;
  const fin = block.avgCols.FIN !== null ? ws[XLSX.utils.encode_cell({r, c: block.avgCols.FIN})]?.v : null;
  
  // Parse values
  const parseVal = (v) => {
    if (v === undefined || v === null || v === '' || v === 'X') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  };
  
  console.log(`${block.name.padEnd(25)} coef=${coef} matched=${matched}`);
  console.log(`  T1=${parseVal(t1)?.toFixed(2) ?? 'null'}  T2=${parseVal(t2)?.toFixed(2) ?? 'null'}  T3=${parseVal(t3)?.toFixed(2) ?? 'null'}  FIN=${parseVal(fin)?.toFixed(2) ?? 'null'}`);
  console.log(`  raw T1="${t1}" T2="${t2}" T3="${t3}" FIN="${fin}" (typeof T1: ${typeof t1})`);
}

// Compute what the weighted average SHOULD be
console.log('\n=== WEIGHTED AVERAGE CHECK (Year) ===');
let weightedSum = 0, coefSum = 0;
for (const block of subjectBlocks) {
  const def = subjectDefMap.get(block.name);
  const coef = def?.coefficient ?? 1;
  if (coef === 0) continue; // skip bonus
  
  const finCol = block.avgCols.FIN;
  if (finCol === null) continue;
  
  const raw = ws[XLSX.utils.encode_cell({r, c: finCol})]?.v;
  if (raw === undefined || raw === null || raw === '' || raw === 'X') continue;
  const fin = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (isNaN(fin)) continue;
  
  weightedSum += fin * coef;
  coefSum += coef;
}
console.log(`Weighted avg (year): ${(weightedSum/coefSum).toFixed(4)}`);
console.log(`Sum weights: ${weightedSum.toFixed(4)}, Sum coefs: ${coefSum}`);

// Check Notes pondérées
const lastSubjectEnd = Math.max(...subjectBlocks.map(s => s.endCol));
let npTotal = null, npMoyenne = null;
for (let c = lastSubjectEnd + 1; c <= lastSubjectEnd + 10; c++) {
  const v4 = String(ws[XLSX.utils.encode_cell({r: 4, c})]?.v || '');
  if (v4 === 'Notes pondérées') {
    const npMerge = merges.find(m => m.s.r === 4 && m.s.c === c);
    const endC = npMerge ? npMerge.e.c : c + 1;
    for (let cc = c; cc <= endC + 2; cc++) {
      const header = String(ws[XLSX.utils.encode_cell({r: 6, cc})]?.v || '');
      if (header === 'Total') npTotal = ws[XLSX.utils.encode_cell({r, c: cc})]?.v;
      if (header === 'Moyenne') npMoyenne = ws[XLSX.utils.encode_cell({r, c: cc})]?.v;
    }
    // Also try reading from known positions
    npTotal = ws[XLSX.utils.encode_cell({r, c})]?.v;
    npMoyenne = ws[XLSX.utils.encode_cell({r, c: c+1})]?.v;
    console.log(`\nNotes pondérées (from Excel): Total=${npTotal}, Moyenne=${npMoyenne}`);
    break;
  }
}

// Now check what buildTermMarks would produce
console.log('\n=== TERM MARKS T1 ===');
let t1WeightedSum = 0, t1CoefSum = 0;
for (const block of subjectBlocks) {
  const def = subjectDefMap.get(block.name);
  const coef = def?.coefficient ?? 1;
  if (coef === 0) continue;
  
  const t1Col = block.avgCols.T1;
  if (t1Col === null) continue;
  
  const raw = ws[XLSX.utils.encode_cell({r, c: t1Col})]?.v;
  if (raw === undefined || raw === null || raw === '' || raw === 'X') continue;
  const t1 = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  if (isNaN(t1)) continue;
  
  console.log(`  ${block.name.padEnd(25)} T1=${t1.toFixed(2)} × coef=${coef} = ${(t1*coef).toFixed(2)}`);
  t1WeightedSum += t1 * coef;
  t1CoefSum += coef;
}
console.log(`T1 Weighted avg: ${(t1WeightedSum/t1CoefSum).toFixed(4)}, coefSum=${t1CoefSum}`);

// Check what Dashboard.tsx actually displays
console.log('\n=== WHAT THE DASHBOARD WOULD SHOW ===');
console.log('Dashboard reads: activeStudents[].yearResult?.yearAverage');
console.log('Dashboard reads: activeStudents[].yearResult?.termResults for term T1/T2/T3');
console.log('Dashboard reads: activeStudents[].yearResult?.promotionStatus');
console.log('Dashboard reads: activeStudents[].termMarks[].weightedAverage');

// Check what processClass does
// It calls computeYearResult which uses buildTermMarks data
// The year average comes from termMarks weighted averages

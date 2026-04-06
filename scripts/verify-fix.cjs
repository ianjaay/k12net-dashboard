// Verify the full pipeline produces correct results after the fix
// Simulates the exact same logic as the rules engine
const XLSX = require('xlsx');

// ─── Parse section list ─────────────────────────────────────────────────────
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

// ─── Parse grades ───────────────────────────────────────────────────────────
const EVAL_HEADER_RE = /^(.+?)\[T([123])\]\s*\[(\d+)\]$/;
const TERM_AVG_NAMES = {
  'Premier Trimestre': 'T1', 'Deuxième Trimestre': 'T2', 'Troisième Trimestre': 'T3', "Fin d'année": 'FIN'
};

const grWb = XLSX.readFile('docs/moyennes sainte marie.xlsx');

function parseVal(v) {
  if (v === undefined || v === null || v === '' || v === 'X') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function computeWeightedAverage(marks) {
  let ws = 0, cs = 0;
  for (const { mark, coefficient } of marks) {
    if (mark !== null && coefficient > 0) { ws += mark * coefficient; cs += coefficient; }
  }
  return cs > 0 ? ws / cs : null;
}

// Check 6eme_1 student 1
const targetSheet = '6eme_1';
const ws = grWb.Sheets[targetSheet];
const merges = ws['!merges'] || [];
const subjectMerges = merges.filter(m => m.s.r === 4 && m.e.r === 4).sort((a, b) => a.s.c - b.s.c);
const defs = subjectsByClass[targetSheet] || [];
const defMap = new Map(defs.map(d => [d.name, d]));

const r = 7; // first student
const studentName = String(ws[XLSX.utils.encode_cell({r, c: 1})]?.v || '');
console.log(`=== Student: ${studentName} (${targetSheet}) ===\n`);

// Build subject data
const subjects = [];
for (const merge of subjectMerges) {
  const name = String(ws[XLSX.utils.encode_cell({r: 4, c: merge.s.c})]?.v || '').trim();
  if (!name) continue;
  const def = defMap.get(name);
  const coef = def?.coefficient ?? 1;
  const isBonus = def?.isBonus ?? false;

  // Find avg cols
  const avgCols = { T1: null, T2: null, T3: null, FIN: null };
  for (let c = merge.s.c; c <= merge.e.c; c++) {
    const h = String(ws[XLSX.utils.encode_cell({r: 6, c})]?.v || '').trim();
    const tk = TERM_AVG_NAMES[h];
    if (tk) avgCols[tk] = c;
  }

  const t1 = avgCols.T1 !== null ? parseVal(ws[XLSX.utils.encode_cell({r, c: avgCols.T1})]?.v) : null;
  const t2 = avgCols.T2 !== null ? parseVal(ws[XLSX.utils.encode_cell({r, c: avgCols.T2})]?.v) : null;
  const t3 = avgCols.T3 !== null ? parseVal(ws[XLSX.utils.encode_cell({r, c: avgCols.T3})]?.v) : null;
  const fin = avgCols.FIN !== null ? parseVal(ws[XLSX.utils.encode_cell({r, c: avgCols.FIN})]?.v) : null;

  subjects.push({ name, coef, isBonus, t1, t2, t3, fin });
}

// T1 weighted average (FIXED)
console.log('T1 Weighted Average (new logic):');
const t1Marks = subjects.filter(s => s.t1 !== null && s.coef > 0 && !s.isBonus).map(s => ({ mark: s.t1, coefficient: s.coef }));
const t1Weighted = computeWeightedAverage(t1Marks);
console.log(`  ${t1Weighted?.toFixed(4)}`);

// T2 weighted average (FIXED)
console.log('T2 Weighted Average (new logic):');
const t2Marks = subjects.filter(s => s.t2 !== null && s.coef > 0 && !s.isBonus).map(s => ({ mark: s.t2, coefficient: s.coef }));
const t2Weighted = computeWeightedAverage(t2Marks);
console.log(`  ${t2Weighted?.toFixed(4)}`);

// Year average (FIXED - using subject year averages × coefficients)
console.log('\nYear Average (FIXED - per-subject yearAvg × coef):');
const yearMarks = subjects.filter(s => s.fin !== null && s.coef > 0 && !s.isBonus).map(s => ({ mark: s.fin, coefficient: s.coef }));
const yearWeighted = computeWeightedAverage(yearMarks);
console.log(`  ${yearWeighted?.toFixed(4)}`);

// Old (wrong) year average - simple average of term simple averages
console.log('\nYear Average (OLD - mean of simple term averages):');
const t1Simple = t1Marks.length > 0 ? t1Marks.reduce((s, m) => s + m.mark, 0) / t1Marks.length : null;
const t2Simple = t2Marks.length > 0 ? t2Marks.reduce((s, m) => s + m.mark, 0) / t2Marks.length : null;
const oldYearAvg = (t1Simple + t2Simple) / 2;
console.log(`  T1 simple=${t1Simple?.toFixed(4)}, T2 simple=${t2Simple?.toFixed(4)}, mean=${oldYearAvg?.toFixed(4)}`);

// Compare with Excel Notes pondérées
const lastEnd = Math.max(...subjectMerges.map(m => m.e.c));
for (let c = lastEnd + 1; c <= lastEnd + 10; c++) {
  const v4 = String(ws[XLSX.utils.encode_cell({r: 4, c})]?.v || '');
  if (v4 === 'Notes pondérées') {
    const total = parseVal(ws[XLSX.utils.encode_cell({r, c})]?.v);
    const moyenne = parseVal(ws[XLSX.utils.encode_cell({r, c: c+1})]?.v);
    console.log(`\nExcel "Notes pondérées": Total=${total}, Moyenne=${moyenne}`);
    if (moyenne !== null) console.log(`  Difference from FIXED: ${Math.abs(yearWeighted - moyenne).toFixed(6)}`);
    if (moyenne !== null) console.log(`  Difference from OLD: ${Math.abs(oldYearAvg - moyenne).toFixed(6)}`);
    break;
  }
}

// Also check TleD_1 (has branch, different coefficients)
console.log('\n\n=== TleD_1 Student 1 ===');
const ws2 = grWb.Sheets['TleD_1'];
const merges2 = ws2['!merges'] || [];
const subjectMerges2 = merges2.filter(m => m.s.r === 4 && m.e.r === 4).sort((a, b) => a.s.c - b.s.c);
const defs2 = subjectsByClass['TleD_1'] || [];
const defMap2 = new Map(defs2.map(d => [d.name, d]));

const r2 = 7;
const studentName2 = String(ws2[XLSX.utils.encode_cell({r: r2, c: 1})]?.v || '');
console.log(`Student: ${studentName2}\n`);

const subjects2 = [];
for (const merge of subjectMerges2) {
  const name = String(ws2[XLSX.utils.encode_cell({r: 4, c: merge.s.c})]?.v || '').trim();
  if (!name) continue;
  const def = defMap2.get(name);
  const coef = def?.coefficient ?? 1;
  const isBonus = def?.isBonus ?? false;

  const avgCols = { T1: null, T2: null, T3: null, FIN: null };
  for (let c = merge.s.c; c <= merge.e.c; c++) {
    const h = String(ws2[XLSX.utils.encode_cell({r: 6, c})]?.v || '').trim();
    const tk = TERM_AVG_NAMES[h];
    if (tk) avgCols[tk] = c;
  }

  const t1 = avgCols.T1 !== null ? parseVal(ws2[XLSX.utils.encode_cell({r: r2, c: avgCols.T1})]?.v) : null;
  const t2 = avgCols.T2 !== null ? parseVal(ws2[XLSX.utils.encode_cell({r: r2, c: avgCols.T2})]?.v) : null;
  const fin = avgCols.FIN !== null ? parseVal(ws2[XLSX.utils.encode_cell({r: r2, c: avgCols.FIN})]?.v) : null;

  console.log(`  ${name.padEnd(30)} coef=${coef} matched=${def ? 'YES' : 'NO'} T1=${t1?.toFixed(2) ?? 'null'} T2=${t2?.toFixed(2) ?? 'null'} FIN=${fin?.toFixed(2) ?? 'null'}`);
  subjects2.push({ name, coef, isBonus, t1, t2, fin });
}

const yearMarks2 = subjects2.filter(s => s.fin !== null && s.coef > 0 && !s.isBonus).map(s => ({ mark: s.fin, coefficient: s.coef }));
const yearWeighted2 = computeWeightedAverage(yearMarks2);
console.log(`\nYear avg (FIXED): ${yearWeighted2?.toFixed(4)}`);

// Find Excel Notes pondérées for TleD_1
const lastEnd2 = Math.max(...subjectMerges2.map(m => m.e.c));
for (let c = lastEnd2 + 1; c <= lastEnd2 + 10; c++) {
  const v4 = String(ws2[XLSX.utils.encode_cell({r: 4, c})]?.v || '');
  if (v4 === 'Notes pondérées') {
    const moyenne = parseVal(ws2[XLSX.utils.encode_cell({r: r2, c: c+1})]?.v);
    console.log(`Excel Moyenne: ${moyenne}`);
    if (moyenne !== null && yearWeighted2 !== null) 
      console.log(`Difference: ${Math.abs(yearWeighted2 - moyenne).toFixed(6)}`);
    break;
  }
}

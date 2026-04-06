// Quick verification script for the K12 parsers
const XLSX = require('xlsx');
const path = require('path');

// ─── Simulate sectionListParser logic ───────────────────────────────────────
const EVAL_HEADER_RE = /^(.+?)\[T([123])\]\s*\[(\d+)\]$/;
const TERM_AVG_NAMES = {
  'Premier Trimestre': 'T1',
  'Deuxième Trimestre': 'T2',
  'Troisième Trimestre': 'T3',
  "Fin d'année": 'FIN',
};

function parseK12Level(raw) {
  const match = raw.match(/^(\d{2})-\d{2}\*{3}(?:\s*\[(\w+)\])?/);
  if (!match) return { level: '07', branch: null };
  return { level: match[1], branch: match[2] || null };
}

// Parse section list
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
  
  courses.push({ code: String(code), name: String(name), gradeLevel: level, branch, coefficient: typeof coef === 'number' ? coef : 0, classrooms });
}

console.log('=== SECTION LIST ===');
console.log('Total courses:', courses.length);

// Resolve subjects for TleD_1
const tleD1Subjects = courses.filter(c => c.classrooms.includes('TleD_1') && c.coefficient > 0);
console.log('\nTleD_1 subjects:');
let totalCoef = 0;
tleD1Subjects.forEach(s => {
  console.log(`  ${s.code.padEnd(12)} ${s.name.padEnd(25)} coef=${s.coefficient}`);
  totalCoef += s.coefficient;
});
console.log('  Total coefficient sum:', totalCoef);

// Now parse grades for TleD_1
const grWb = XLSX.readFile('docs/moyennes sainte marie.xlsx');
const ws = grWb.Sheets['TleD_1'];
const merges = ws['!merges'] || [];

// Parse subject blocks
const subjectMerges = merges.filter(m => m.s.r === 4 && m.e.r === 4).sort((a,b) => a.s.c - b.s.c);
const subjectDefMap = new Map(tleD1Subjects.map(s => [s.name, s]));

console.log('\n=== GRADES: TleD_1 Student 1 ===');
const studentRow = 7;
const studentName = ws[XLSX.utils.encode_cell({r: studentRow, c: 1})]?.v;
console.log('Name:', studentName);

let weightedSum = 0;
let coefSum = 0;

for (const sm of subjectMerges) {
  const subjectName = String(ws[XLSX.utils.encode_cell(sm.s)]?.v || '');
  const def = subjectDefMap.get(subjectName);
  const coef = def?.coefficient ?? 1;
  
  // Find eval columns and avg columns
  let t1Avg = null, t2Avg = null, finAvg = null;
  let evalCount = {T1: 0, T2: 0, T3: 0};
  
  for (let c = sm.s.c; c <= sm.e.c; c++) {
    const header = String(ws[XLSX.utils.encode_cell({r: 6, c})]?.v || '');
    const termKey = TERM_AVG_NAMES[header];
    if (termKey === 'T1') t1Avg = ws[XLSX.utils.encode_cell({r: studentRow, c})]?.v;
    if (termKey === 'T2') t2Avg = ws[XLSX.utils.encode_cell({r: studentRow, c})]?.v;
    if (termKey === 'FIN') finAvg = ws[XLSX.utils.encode_cell({r: studentRow, c})]?.v;
    
    const evalMatch = header.match(EVAL_HEADER_RE);
    if (evalMatch) {
      const tid = 'T' + evalMatch[2];
      const score = ws[XLSX.utils.encode_cell({r: studentRow, c})]?.v;
      if (score !== undefined && score !== null && score !== 'X') evalCount[tid]++;
    }
  }
  
  const parseFr = (v) => {
    if (v === undefined || v === null || v === 'X') return null;
    return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  };
  
  const fin = parseFr(finAvg);
  console.log(`  ${subjectName.padEnd(25)} coef=${coef} T1=${parseFr(t1Avg)?.toFixed(2) ?? 'N/A'} T2=${parseFr(t2Avg)?.toFixed(2) ?? 'N/A'} Fin=${fin?.toFixed(2) ?? 'N/A'} evals(T1=${evalCount.T1},T2=${evalCount.T2})`);
  
  if (fin !== null && !isNaN(fin) && coef > 0) {
    weightedSum += fin * coef;
    coefSum += coef;
  }
}

console.log('\n--- VERIFICATION ---');
console.log('Weighted sum:', weightedSum.toFixed(2));
console.log('Coefficient sum:', coefSum);
console.log('Weighted average:', (weightedSum / coefSum).toFixed(4));

// Check excel's reported values
const lastSubjectEnd = Math.max(...subjectMerges.map(m => m.e.c));
for (let c = lastSubjectEnd + 1; c <= lastSubjectEnd + 10; c++) {
  const h = ws[XLSX.utils.encode_cell({r: 6, c})]?.v;
  const v = ws[XLSX.utils.encode_cell({r: studentRow, c})]?.v;
  if (h) console.log(`  Excel ${h}: ${v}`);
}

// Also check 6eme_1
console.log('\n=== GRADES: 6eme_1 Student 1 ===');
const ws6 = grWb.Sheets['6eme_1'];
const merges6 = ws6['!merges'] || [];
const sm6 = merges6.filter(m => m.s.r === 4 && m.e.r === 4).sort((a,b) => a.s.c - b.s.c);
const s6Subjects = courses.filter(c => c.classrooms.includes('6eme_1') && c.coefficient > 0);
const s6Map = new Map(s6Subjects.map(s => [s.name, s]));

console.log('Name:', ws6[XLSX.utils.encode_cell({r: 7, c: 1})]?.v);
console.log('Subjects from catalog:', s6Subjects.length);
console.log('Subject blocks from grades:', sm6.length);

let ws6Sum = 0, ws6Coef = 0;
for (const sm of sm6) {
  const subjectName = String(ws6[XLSX.utils.encode_cell(sm.s)]?.v || '');
  const def = s6Map.get(subjectName);
  const coef = def?.coefficient ?? 1;
  
  const finCol = sm.e.c;
  const finHeader = String(ws6[XLSX.utils.encode_cell({r: 6, c: finCol})]?.v || '');
  const finRaw = ws6[XLSX.utils.encode_cell({r: 7, c: finCol})]?.v;
  const fin = finRaw !== undefined && finRaw !== null && finRaw !== 'X' 
    ? (typeof finRaw === 'number' ? finRaw : parseFloat(String(finRaw).replace(',', '.')))
    : null;
  
  console.log(`  ${subjectName.padEnd(25)} coef=${coef} Fin=${fin?.toFixed(2) ?? 'N/A'} (header: ${finHeader})`);
  if (fin !== null && !isNaN(fin) && coef > 0) {
    ws6Sum += fin * coef;
    ws6Coef += coef;
  }
}

console.log('\n--- 6eme_1 VERIFICATION ---');
console.log('Weighted sum:', ws6Sum.toFixed(2));
console.log('Coefficient sum:', ws6Coef);
console.log('Weighted average:', (ws6Sum / ws6Coef).toFixed(4));

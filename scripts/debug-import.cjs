// Debug the full import pipeline to find issues
const XLSX = require('xlsx');

// ─── Parse section list ─────────────────────────────────────────────────────
function parseK12Level(raw) {
  const match = raw.match(/^(\d{2})-\d{2}\*{3}(?:\s*\[(\w+)\])?/);
  if (!match) return { level: '07', branch: null };
  return { level: match[1], branch: match[2] || null };
}

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

// Build subjectsByClass
function buildSubjectsByClass(catalog) {
  const allClassrooms = new Set();
  for (const c of catalog) for (const cl of c.classrooms) allClassrooms.add(cl);
  const result = {};
  for (const className of allClassrooms) {
    result[className] = catalog.filter(c => c.classrooms.includes(className) && c.coefficient > 0).map(c => ({
      code: c.code, name: c.name, coefficient: c.coefficient, isBehavioral: c.name === 'Conduite',
      isBonus: false, isFrenchComposition: c.name === 'Français', branch: c.branch,
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

console.log('Total sheets:', grWb.SheetNames.length);
console.log('Sheet names:', grWb.SheetNames.join(', '));
console.log();

// Analyze each sheet
for (const sheetName of grWb.SheetNames) {
  const ws = grWb.Sheets[sheetName];
  const merges = ws['!merges'] || [];

  // Subject blocks from row 4
  const subjectMerges = merges.filter(m => m.s.r === 4 && m.e.r === 4).sort((a, b) => a.s.c - b.s.c);
  
  // Count students from row 7
  let studentCount = 0;
  for (let r = 7; r <= 500; r++) {
    const nameVal = ws[XLSX.utils.encode_cell({r, c: 1})]?.v;
    if (!nameVal) break;
    studentCount++;
  }

  // Parse subject names
  const subjectNames = [];
  for (const m of subjectMerges) {
    const name = ws[XLSX.utils.encode_cell({r: 4, c: m.s.c})]?.v;
    if (name) subjectNames.push(name);
  }

  // Check eval columns
  let evalCount = 0;
  let avgCount = 0;
  for (const m of subjectMerges) {
    for (let c = m.s.c; c <= m.e.c; c++) {
      const header = String(ws[XLSX.utils.encode_cell({r: 6, c})]?.v || '');
      if (header.match(EVAL_HEADER_RE)) evalCount++;
      if (TERM_AVG_NAMES[header]) avgCount++;
    }
  }

  console.log(`${sheetName}: ${studentCount} students, ${subjectMerges.length} subjects, ${evalCount} evals, ${avgCount} avg cols`);
  
  if (studentCount === 0) {
    console.log(`  !! NO STUDENTS - checking name column...`);
    for (let r = 0; r <= 10; r++) {
      const c0 = ws[XLSX.utils.encode_cell({r, c: 0})]?.v;
      const c1 = ws[XLSX.utils.encode_cell({r, c: 1})]?.v;
      const c2 = ws[XLSX.utils.encode_cell({r, c: 2})]?.v;
      console.log(`    row ${r}: col0="${c0}" col1="${c1}" col2="${c2}"`);
    }
  }
}

// Deep-dive first class: 6eme_1
console.log('\n=== DETAILED: 6eme_1 ===');
const ws = grWb.Sheets['6eme_1'];
if (ws) {
  const merges = ws['!merges'] || [];
  
  // Row 0-6 content
  for (let r = 0; r <= 6; r++) {
    let row = `row ${r}:`;
    for (let c = 0; c <= 5; c++) {
      const v = ws[XLSX.utils.encode_cell({r, c})]?.v;
      if (v !== undefined) row += ` [c${c}="${String(v).substring(0, 40)}"]`;
    }
    console.log(row);
  }

  // Row 7 (first student)
  console.log('\nFirst student (row 7):');
  for (let c = 0; c <= 5; c++) {
    const v = ws[XLSX.utils.encode_cell({r: 7, c})]?.v;
    console.log(`  col ${c}: "${v}"`);
  }

  // Subject blocks
  const subjectMerges = merges.filter(m => m.s.r === 4 && m.e.r === 4).sort((a, b) => a.s.c - b.s.c);
  console.log(`\nMerged cells in row 4: ${subjectMerges.length}`);
  for (const m of subjectMerges) {
    const name = ws[XLSX.utils.encode_cell({r: 4, c: m.s.c})]?.v;
    console.log(`  cols ${m.s.c}-${m.e.c}: "${name}"`);
    // Show headers in row 6
    for (let c = m.s.c; c <= m.e.c; c++) {
      const h = ws[XLSX.utils.encode_cell({r: 6, c})]?.v;
      if (h) console.log(`    col ${c} header: "${h}"`);
    }
  }

  // Check all merges in row 4 (maybe Rank/Name are in row 4 too)
  console.log('\nAll merges in row 4:');
  const allRow4Merges = merges.filter(m => m.s.r === 4);
  for (const m of allRow4Merges) {
    const v = ws[XLSX.utils.encode_cell({r: 4, c: m.s.c})]?.v;
    console.log(`  rows ${m.s.r}-${m.e.r}, cols ${m.s.c}-${m.e.c}: "${v}"`);
  }

  // Check "Notes pondérées" section  
  const lastSubjectEnd = Math.max(...subjectMerges.map(m => m.e.c));
  console.log(`\nLast subject ends at col ${lastSubjectEnd}. Looking for Notes pondérées...`);
  for (let c = lastSubjectEnd + 1; c <= lastSubjectEnd + 10; c++) {
    const v4 = ws[XLSX.utils.encode_cell({r: 4, c})]?.v;
    const v6 = ws[XLSX.utils.encode_cell({r: 6, c})]?.v;
    if (v4 || v6) console.log(`  col ${c}: row4="${v4}" row6="${v6}"`);
  }

  // Show subjects found vs section list subjects
  const subjectsInGrades = subjectMerges.map(m => ws[XLSX.utils.encode_cell({r: 4, c: m.s.c})]?.v);
  const subjectsInSectionList = (subjectsByClass['6eme_1'] || []).map(s => s.name);
  
  console.log('\nSubjects in grades:', subjectsInGrades);
  console.log('Subjects in section list:', subjectsInSectionList);
  
  const missing = subjectsInSectionList.filter(s => !subjectsInGrades.includes(s));
  const extra = subjectsInGrades.filter(s => !subjectsInSectionList.includes(s));
  if (missing.length) console.log('In section list but NOT in grades:', missing);
  if (extra.length) console.log('In grades but NOT in section list:', extra);

  // Check first student term marks
  console.log('\nFirst student weighted average check (6eme_1):');
  const studentRow = 7;
  for (const m of subjectMerges) {
    const name = ws[XLSX.utils.encode_cell({r: 4, c: m.s.c})]?.v;
    const def = (subjectsByClass['6eme_1'] || []).find(s => s.name === name);
    
    // Find avg columns
    for (let c = m.s.c; c <= m.e.c; c++) {
      const h = String(ws[XLSX.utils.encode_cell({r: 6, c})]?.v || '');
      if (h === "Fin d'année") {
        const v = ws[XLSX.utils.encode_cell({r: studentRow, c})]?.v;
        console.log(`  ${String(name).padEnd(25)} FIN=${v} coef=${def?.coefficient ?? '?'}`);
      }
    }
  }
}

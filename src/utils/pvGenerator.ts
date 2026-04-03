import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { AppData, PVConfig } from '../types';
import { getStatusCounts } from './calculator';

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'B0B0B0' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const THICK_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '1F3864' };
const THICK_BORDERS = { top: THICK_BORDER, bottom: THICK_BORDER, left: THICK_BORDER, right: THICK_BORDER };

function cell(text: string, opts: {
  bold?: boolean; shade?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  fontSize?: number; width?: number; color?: string; thick?: boolean;
} = {}) {
  return new TableCell({
    borders: opts.thick ? THICK_BORDERS : BORDERS,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : { size: 0, type: WidthType.AUTO },
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align ?? AlignmentType.LEFT,
      children: [new TextRun({
        text,
        bold: opts.bold,
        size: (opts.fontSize ?? 11) * 2,
        color: opts.color ?? '000000',
        font: 'Arial',
      })],
    })],
  });
}

function heading(text: string, level: 1 | 2 | 3 = 2) {
  const sizes: Record<number, number> = { 1: 16, 2: 13, 3: 12 };
  const colors: Record<number, string> = { 1: '1F3864', 2: '1F3864', 3: '2F5496' };
  return new Paragraph({
    spacing: { before: level === 1 ? 320 : 200, after: 120 },
    children: [new TextRun({
      text,
      bold: true,
      size: sizes[level] * 2,
      color: colors[level],
      font: 'Arial',
    })],
    border: level === 1 ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: '1F3864' } } : undefined,
  });
}

function para(text: string, opts: { bold?: boolean; indent?: boolean; size?: number } = {}) {
  return new Paragraph({
    indent: opts.indent ? { left: 360 } : undefined,
    spacing: { after: 80 },
    children: [new TextRun({
      text,
      bold: opts.bold,
      size: (opts.size ?? 11) * 2,
      font: 'Arial',
    })],
  });
}

function blankLine() {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: '', font: 'Arial' })] });
}

export async function generatePV(data: AppData, config: PVConfig): Promise<void> {
  const students = data.students!;
  const { counts, s1Counts, srCounts } = getStatusCounts(students);
  const groupInfo = data.parsedExcel;
  const repechage = students.filter(s => s.eligibleRepechage);
  const topStudents = [...students].sort((a, b) => b.semesterAverage - a.semesterAverage).slice(0, 3);

  const groupName = groupInfo?.groupName ?? 'Groupe';
  const semester = groupInfo?.semester ?? 'Premier Semestre';
  const level = groupInfo?.level ?? '';
  const docTitle = `Procès-Verbal de Délibération — ${groupName} — ${semester}`;

  const sections: (Paragraph | Table)[] = [];

  // ── COVER ──────────────────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 160 },
      children: [new TextRun({ text: "ÉCOLE MULTINATIONALE SUPÉRIEURE DES POSTES D'ABIDJAN", bold: true, size: 28, font: 'Arial', color: '1F3864' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: 'FS MENUM — Formations Supérieures en Management de l\'Économie Numérique', size: 22, font: 'Arial', color: '2F5496' })],
    }),
    blankLine(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 160 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '1F3864' }, bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F3864' } },
      children: [new TextRun({ text: 'PROCÈS-VERBAL DE DÉLIBÉRATION', bold: true, size: 36, font: 'Arial', color: '1F3864', allCaps: true })],
    }),
    blankLine(),
    para(`Groupe : ${groupName}`, { bold: true }),
    para(`Période : ${semester}`),
    para(`Niveau : ${level}`),
    para(`Date : ${config.date}`),
    para(`Lieu : ${config.lieu}`),
    blankLine(),
  );

  // ── 1. ORDRE DU JOUR ────────────────────────────────────────────────────────
  sections.push(heading('I. ORDRE DU JOUR', 1));
  for (const item of [
    'a) Informations générales',
    'b) Présentation et examen des résultats académiques',
    'c) Délibération et attribution des mentions',
    'd) Cas de repêchage',
    'e) Divers',
  ]) {
    sections.push(para(item, { indent: true }));
  }

  // ── 2. PARTICIPANTS ──────────────────────────────────────────────────────────
  sections.push(heading('II. PARTICIPANTS', 1));
  if (config.presidentJury) {
    sections.push(para(`Président du jury : ${config.presidentJury}`, { bold: true }));
  }
  if (config.juryMembers.filter(m => m.name).length > 0) {
    sections.push(para('Membres du jury :', { bold: true }));
    for (const m of config.juryMembers.filter(j => j.name)) {
      sections.push(para(`• ${m.name} — ${m.role}`, { indent: true }));
    }
  }

  // ── 3. RÉSULTATS ────────────────────────────────────────────────────────────
  sections.push(heading('III. RÉSULTATS ACADÉMIQUES', 1));
  sections.push(heading('3.1 Rappel des critères de validation', 2));
  for (const item of [
    'Validation ECUE : Moyenne ECUE = (0,4 × CCC) + (0,6 × ETS) ≥ 10/20',
    'Validation UE : Moyenne UE ≥ 10/20 (compensation intra-UE possible)',
    `Admis : totalité des crédits validés`,
    `Autorisé : ≥ 80% des crédits validés`,
    `Ajourné : < 80% des crédits validés`,
  ]) {
    sections.push(para(`• ${item}`, { indent: true }));
  }
  sections.push(blankLine());

  sections.push(heading('3.2 Tableau récapitulatif', 2));

  // Summary table
  sections.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2500, 1500, 1500, 1500, 2360],
    rows: [
      new TableRow({
        children: [
          cell('Résultat', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('Session 1', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('Session SR', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('Total', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('%', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
        ],
      }),
      ...(['ADMIS', 'AUTORISÉ', 'AJOURNÉ'] as const).map((st) => {
        const pctVal = students.length > 0 ? Math.round((counts[st] / students.length) * 100) : 0;
        const shades = { ADMIS: 'E8F5E9', AUTORISÉ: 'FFF8E1', AJOURNÉ: 'FFEBEE' };
        return new TableRow({
          children: [
            cell(st, { bold: true, shade: shades[st] }),
            cell(String(s1Counts[st]), { align: AlignmentType.CENTER }),
            cell(String(srCounts[st]), { align: AlignmentType.CENTER }),
            cell(String(counts[st]), { bold: true, align: AlignmentType.CENTER }),
            cell(`${pctVal}%`, { align: AlignmentType.CENTER }),
          ],
        });
      }),
      new TableRow({
        children: [
          cell('TOTAL', { bold: true, shade: 'E3F2FD' }),
          cell(String(s1Counts.ADMIS + s1Counts.AUTORISÉ + s1Counts.AJOURNÉ), { bold: true, align: AlignmentType.CENTER, shade: 'E3F2FD' }),
          cell(String(srCounts.ADMIS + srCounts.AUTORISÉ + srCounts.AJOURNÉ), { bold: true, align: AlignmentType.CENTER, shade: 'E3F2FD' }),
          cell(String(students.length), { bold: true, align: AlignmentType.CENTER, shade: 'E3F2FD' }),
          cell('100%', { bold: true, align: AlignmentType.CENTER, shade: 'E3F2FD' }),
        ],
      }),
    ],
  }));

  sections.push(blankLine());

  // Nominative lists
  for (const [status, shade] of [['ADMIS', 'E8F5E9'], ['AUTORISÉ', 'FFF8E1'], ['AJOURNÉ', 'FFEBEE']] as const) {
    const group = students
      .filter(s => s.status === status)
      .sort((a, b) => b.semesterAverage - a.semesterAverage);
    if (group.length === 0) continue;

    sections.push(heading(`3.3 Liste des ${status.toLowerCase()}s (${group.length})`, 2));
    sections.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [500, 1700, 3500, 1300, 1300, 1060],
      rows: [
        new TableRow({
          children: [
            cell('#', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
            cell('Matricule', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
            cell('Nom', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
            cell('Moyenne', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
            cell('Crédits', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
            cell('Session', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          ],
        }),
        ...group.map((s, i) => new TableRow({
          children: [
            cell(String(i + 1), { align: AlignmentType.CENTER }),
            cell(s.matricule),
            cell(s.name),
            cell(s.semesterAverage.toFixed(2), { align: AlignmentType.CENTER, shade }),
            cell(`${s.totalCredits}/${s.ueResults.reduce((a: number, u: { totalCredits: number }) => a + u.totalCredits, 0)}`, { align: AlignmentType.CENTER }),
            cell(s.session, { align: AlignmentType.CENTER }),
          ],
        })),
      ],
    }));
    sections.push(blankLine());
  }

  // ── 4. REPÊCHAGE ─────────────────────────────────────────────────────────────
  sections.push(heading('IV. CAS DE REPÊCHAGE', 1));
  sections.push(para('Critères de repêchage :'));
  for (const c of ['≥ 80% des crédits validés (statut AUTORISÉ)', 'Moyenne de l\'UE non validée ≥ 9,50/20', 'Décision du jury du Conseil de Classe']) {
    sections.push(para(`• ${c}`, { indent: true }));
  }
  sections.push(blankLine());

  if (repechage.length === 0) {
    sections.push(para('Aucun étudiant éligible au repêchage.'));
  } else {
    sections.push(para(`${repechage.length} étudiant(s) éligible(s) au repêchage :`));
    sections.push(blankLine());
    sections.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1700, 3200, 1600, 1500, 1360],
      rows: [
        new TableRow({
          children: [
            cell('Matricule', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
            cell('Nom', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
            cell('Crédits', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
            cell('UE défaillante', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
            cell('Moy. UE', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          ],
        }),
        ...repechage.map(s => {
          const failedUE = s.ueResults.find(u => u.ueCode === s.repechageUECode);
          return new TableRow({
            children: [
              cell(s.matricule),
              cell(s.name),
              cell(`${s.totalCredits}/${s.ueResults.reduce((a: number, u: { totalCredits: number }) => a + u.totalCredits, 0)}`, { align: AlignmentType.CENTER }),
              cell(failedUE?.ueName ?? '', { fontSize: 9 }),
              cell(`${s.repechageUEAvg?.toFixed(2)}/20`, { align: AlignmentType.CENTER, shade: 'FFF8E1', bold: true }),
            ],
          });
        }),
      ],
    }));
    sections.push(blankLine());
    sections.push(para('Décision du jury : ________________________________', { bold: true }));
  }

  // ── 5. DIVERS ─────────────────────────────────────────────────────────────────
  sections.push(heading('V. DIVERS', 1));
  if (config.observationsDiverses.trim()) {
    sections.push(para(config.observationsDiverses));
  } else {
    sections.push(para('Néant.'));
  }

  // Top students
  sections.push(blankLine());
  sections.push(heading('Meilleurs résultats du groupe', 2));
  topStudents.forEach((s, i) => {
    sections.push(para(`${i + 1}. ${s.name} (${s.matricule}) — ${s.semesterAverage.toFixed(2)}/20 — ${s.totalCredits} crédits`, { indent: true }));
  });

  // ── 6. DILIGENCES ─────────────────────────────────────────────────────────────
  sections.push(heading('VI. TABLEAU DES DILIGENCES', 1));
  sections.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [500, 3000, 2000, 1200, 1200, 1460],
    rows: [
      new TableRow({
        children: [
          cell('N°', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('Action', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
          cell('Porteur', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
          cell('Début', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('Fin', { bold: true, shade: '1F3864', align: AlignmentType.CENTER, color: 'FFFFFF' }),
          cell('Observations', { bold: true, shade: '1F3864', color: 'FFFFFF' }),
        ],
      }),
      ...[
        ['1', 'Saisie des résultats dans le système', 'Scolarité', '', '', ''],
        ['2', 'Communication des résultats aux étudiants', 'Direction', '', '', ''],
        ['3', 'Archivage du PV', 'Secrétariat', '', '', ''],
      ].map(row => new TableRow({
        children: row.map((v, i) => cell(v, { align: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT })),
      })),
    ],
  }));

  // ── 7. SIGNATURES ─────────────────────────────────────────────────────────────
  sections.push(heading('VII. VISAS', 1));
  sections.push(blankLine());
  sections.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({
        children: [
          cell('Rédigé par', { bold: true, shade: 'E3F2FD', align: AlignmentType.CENTER }),
          cell('Vérifié par', { bold: true, shade: 'E3F2FD', align: AlignmentType.CENTER }),
          cell('Adopté par', { bold: true, shade: 'E3F2FD', align: AlignmentType.CENTER }),
        ],
      }),
      new TableRow({
        children: [
          cell('\n\n\nSignature :', { align: AlignmentType.CENTER }),
          cell('\n\n\nSignature :', { align: AlignmentType.CENTER }),
          cell('\n\n\nSignature :', { align: AlignmentType.CENTER }),
        ],
      }),
    ],
  }));

  // ── Build document ────────────────────────────────────────────────────────────
  const doc = new Document({
    title: docTitle,
    creator: 'EMSP Dashboard',
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 },
        },
      },
      children: sections,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const filename = `PV_Deliberation_${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_${config.date.replace(/\//g, '-')}.docx`;
  saveAs(buffer, filename);
}

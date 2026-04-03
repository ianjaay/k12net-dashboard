import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
} from 'docx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExportHeader {
  schoolName: string;
  sessionTitle: string;
  sessionDate: string;
  generatedAt?: string;  // auto-filled if empty
  logo?: string;         // base64 data URL
}

export interface ExportTableData {
  title: string;           // e.g. "Liste des étudiants"
  subtitle?: string;       // e.g. "EMSP L1 A-GROUPE 1 · Premier Semestre"
  columns: string[];       // header labels
  rows: (string | number)[][];
  filename: string;        // without extension
}

type ExportFormat = 'excel' | 'pdf' | 'word';

// ── Main export function ────────────────────────────────────────────────────

export async function exportTable(
  data: ExportTableData,
  format: ExportFormat,
  header: ExportHeader,
): Promise<void> {
  const h = { ...header, generatedAt: header.generatedAt || new Date().toLocaleString('fr-FR') };

  switch (format) {
    case 'excel': return exportExcel(data, h);
    case 'pdf': return exportPDF(data, h);
    case 'word': return exportWord(data, h);
  }
}

// ── Excel Export ────────────────────────────────────────────────────────────

function exportExcel(data: ExportTableData, header: ExportHeader): void {
  const wb = XLSX.utils.book_new();

  // Build rows: header block + blank + column headers + data
  const sheetRows: (string | number | null)[][] = [];

  // Header block
  sheetRows.push([header.schoolName]);
  if (header.sessionTitle) sheetRows.push([header.sessionTitle]);
  if (header.sessionDate) sheetRows.push([`Date de session : ${header.sessionDate}`]);
  sheetRows.push([`Généré le : ${header.generatedAt}`]);
  sheetRows.push([]); // blank line
  sheetRows.push([data.title]);
  if (data.subtitle) sheetRows.push([data.subtitle]);
  sheetRows.push([]); // blank line

  // Column headers
  const headerRowIdx = sheetRows.length;
  sheetRows.push(data.columns);

  // Data rows
  for (const row of data.rows) {
    sheetRows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);

  // Style: merge school name across all columns
  const colCount = data.columns.length;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
  ];

  // Column widths
  ws['!cols'] = data.columns.map((col, i) => {
    // Auto-width: max of header and data values
    let maxLen = col.length;
    for (const row of data.rows) {
      const val = String(row[i] ?? '');
      maxLen = Math.max(maxLen, val.length);
    }
    return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
  });

  // Bold header row cells
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, data.title.substring(0, 31)); // sheet name max 31 chars
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbOut], { type: 'application/octet-stream' }), `${data.filename}.xlsx`);
}

// ── PDF Export ──────────────────────────────────────────────────────────────

function exportPDF(data: ExportTableData, header: ExportHeader): void {
  const doc = new jsPDF({ orientation: data.columns.length > 6 ? 'landscape' : 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 15;

  // School name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(header.schoolName, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Session title
  if (header.sessionTitle) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(header.sessionTitle, pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  // Session date
  if (header.sessionDate) {
    doc.setFontSize(9);
    doc.text(`Date de session : ${header.sessionDate}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // Generated date
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text(`Généré le : ${header.generatedAt!}`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 4;

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, 14, y);
  y += 5;

  if (data.subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(data.subtitle, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }

  y += 2;

  // Table
  autoTable(doc, {
    startY: y,
    head: [data.columns],
    body: data.rows.map(row => row.map(v => String(v ?? ''))),
    styles: { fontSize: 8, cellPadding: 2, font: 'helvetica' },
    headStyles: { fillColor: [85, 86, 253], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 249, 253] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${data.filename}.pdf`);
}

// ── Word Export ─────────────────────────────────────────────────────────────

async function exportWord(data: ExportTableData, header: ExportHeader): Promise<void> {
  const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'B0B0B0' };
  const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

  function wCell(text: string, opts: { bold?: boolean; shade?: string; align?: typeof AlignmentType[keyof typeof AlignmentType]; fontSize?: number } = {}) {
    return new TableCell({
      borders: BORDERS,
      width: { size: 0, type: WidthType.AUTO },
      shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [new TextRun({
          text,
          bold: opts.bold,
          size: (opts.fontSize ?? 10) * 2,
          font: 'Arial',
        })],
      })],
    });
  }

  const children: (Paragraph | Table)[] = [];

  // Header block
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: header.schoolName, bold: true, size: 28, font: 'Arial', color: '1F3864' })],
  }));

  if (header.sessionTitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: header.sessionTitle, size: 22, font: 'Arial' })],
    }));
  }

  if (header.sessionDate) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: `Date de session : ${header.sessionDate}`, size: 18, font: 'Arial', color: '666666' })],
    }));
  }

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text: `Généré le : ${header.generatedAt!}`, size: 16, font: 'Arial', color: '999999', italics: true })],
  }));

  // Separator
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' } },
    children: [],
  }));

  // Title
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: data.title, bold: true, size: 24, font: 'Arial', color: '1F3864' })],
  }));

  if (data.subtitle) {
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: data.subtitle, size: 20, font: 'Arial', color: '666666' })],
    }));
  }

  // Table
  const headerRow = new TableRow({
    tableHeader: true,
    children: data.columns.map(col =>
      wCell(col, { bold: true, shade: '1F3864', fontSize: 9 })
    ),
  });
  // Override header text color to white
  const headerRowWhite = new TableRow({
    tableHeader: true,
    children: data.columns.map(col =>
      new TableCell({
        borders: BORDERS,
        width: { size: 0, type: WidthType.AUTO },
        shading: { fill: '1F3864', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: col, bold: true, size: 18, font: 'Arial', color: 'FFFFFF' })],
        })],
      })
    ),
  });

  const tableRows = data.rows.map((row, rowIdx) =>
    new TableRow({
      children: row.map(val =>
        wCell(String(val ?? ''), { shade: rowIdx % 2 === 0 ? undefined : 'F4F4FB', fontSize: 9 })
      ),
    })
  );

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRowWhite, ...tableRows],
  }));

  // Silence unused variable
  void headerRow;

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${data.filename}.docx`);
}

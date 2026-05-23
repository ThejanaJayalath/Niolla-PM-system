import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

type RowCell = string | number | undefined | null;
type ReportRow = RowCell[];

function escapeCsvCell(val: RowCell): string {
  const s = val == null ? '' : String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeFilename(filename: string, ext: string): string {
  const base = filename.replace(new RegExp(`\\.(${ext}|csv|xlsx|pdf)$`, 'i'), '');
  return `${base}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvContent(filename: string, rows: ReportRow[]): void {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, normalizeFilename(filename, 'csv'));
}

/** True .xlsx workbook via SheetJS. */
export function downloadReportXlsx(
  filename: string,
  rows: ReportRow[],
  sheetName = 'Report'
): void {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, normalizeFilename(filename, 'xlsx'));
}

export interface ReportPdfOptions {
  filename: string;
  title: string;
  periodLabel: string;
  summary?: { label: string; value: string }[];
  headers: string[];
  rows: ReportRow[];
}

/** Professional PDF with jsPDF + autoTable. */
export function downloadReportPdf({
  filename,
  title,
  periodLabel,
  summary,
  headers,
  rows,
}: ReportPdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setTextColor(234, 88, 12);
  doc.setFontSize(9);
  doc.text('NIOLLA NEXA', 14, 14);

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(16);
  doc.text(title, 14, 24);

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Period: ${periodLabel}`, 14, 31);
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 14, 37);

  let startY = 44;
  if (summary?.length) {
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    for (const item of summary) {
      doc.text(`${item.label}: ${item.value}`, 14, startY);
      startY += 6;
    }
    startY += 4;
  }

  autoTable(doc, {
    startY,
    head: [headers],
    body: rows.map((row) => row.map((c) => (c == null ? '' : String(c)))),
    theme: 'grid',
    headStyles: {
      fillColor: [255, 247, 237],
      textColor: [194, 65, 12],
      fontStyle: 'bold',
    },
    styles: { fontSize: 9, cellPadding: 2.5 },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    },
  });

  doc.save(normalizeFilename(filename, 'pdf'));
}

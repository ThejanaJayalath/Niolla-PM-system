/**
 * Build proposal PDF from data using pdf-lib (no LibreOffice required).
 * Used when DOCX→PDF conversion is not available so the user always gets a PDF.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { Proposal } from '../../domain/entities/Proposal';
import { getTemplateData } from './ProposalDocxGenerator';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LINE_HEIGHT = 14;
const TITLE_SIZE = 18;
const HEADING_SIZE = 12;
const BODY_SIZE = 10;
const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapLines(
  font: PDFFont,
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    const words = para.trim() ? para.split(/\s+/) : [''];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const w = font.widthOfTextAtSize(candidate, fontSize);
      if (w <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [''];
}

export async function buildProposalPdf(proposal: Proposal): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;
  const data = getTemplateData(proposal);

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; x?: number } = {}
  ) => {
    const size = opts.size ?? BODY_SIZE;
    const f = opts.bold ? fontBold : font;
    const x = opts.x ?? MARGIN;
    const lines = wrapLines(f, text, size, MAX_WIDTH);
    for (const line of lines) {
      if (y < MARGIN + LINE_HEIGHT) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x,
        y,
        size,
        font: f,
        color: rgb(0, 0, 0),
      });
      y -= LINE_HEIGHT + 2;
    }
  };

  drawText('PROJECT PROPOSAL', { size: TITLE_SIZE, bold: true });
  y -= 10;
  drawText(data.PROJECT_NAME, { size: 14, bold: true });
  drawText(`Date: ${data.DATE}`);
  y -= 16;

  drawText('Introduction', { size: HEADING_SIZE, bold: true });
  drawText(data.INTRODUCTION);
  y -= 12;

  drawText('Key Features', { size: HEADING_SIZE, bold: true });
  drawText(data.KEY_FEATURES);
  y -= 12;

  drawText('Financials', { size: HEADING_SIZE, bold: true });
  drawText(`Advance Payment: ${data.ADVANCE_PAYMENT}`);
  drawText(`Project Cost: ${data.PROJECT_COST}`);
  drawText(`Total Cost: ${data.TOTAL_COST}`);
  y -= 12;

  drawText('Deliverables', { size: HEADING_SIZE, bold: true });
  drawText(data.DELIVERABLE_SECTION);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

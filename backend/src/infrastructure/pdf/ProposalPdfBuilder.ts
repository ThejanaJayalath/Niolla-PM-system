/**
 * Build proposal PDF from data using pdf-lib (no LibreOffice required).
 * Mirrors the Niolla sample proposal layout when DOCX→PDF conversion is unavailable.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { Proposal } from '../../domain/entities/Proposal';
import { getTemplateData } from './ProposalDocxGenerator';
import { sanitizePdfText } from './textSanitize';

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

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; x?: number; gap?: number } = {}
  ) => {
    const size = opts.size ?? BODY_SIZE;
    const f = opts.bold ? fontBold : font;
    const x = opts.x ?? MARGIN;
    const lines = wrapLines(f, sanitizePdfText(text), size, MAX_WIDTH);
    for (const line of lines) {
      if (y < MARGIN + LINE_HEIGHT) newPage();
      page.drawText(line, {
        x,
        y,
        size,
        font: f,
        color: rgb(0, 0, 0),
      });
      y -= LINE_HEIGHT + 2;
    }
    if (opts.gap) y -= opts.gap;
  };

  // Cover
  y -= 120;
  drawText(data.PROJECT_NAME, { size: 22, bold: true });
  y -= 40;
  drawText('Prepared by:');
  drawText('Niolla Solutions');
  drawText(data.DATE);
  y -= 60;
  drawText('PROJECT PROPOSAL', { size: TITLE_SIZE, bold: true });
  newPage();

  // TOC
  drawText('PROJECT PROPOSAL', { size: HEADING_SIZE, bold: true, gap: 12 });
  drawText('Table of contents.');
  drawText('1. Project Overview.');
  drawText('1.1 Introduction');
  drawText('1.2 Key Features');
  drawText('1.3 Technology Stack');
  drawText('2. Project Management');
  drawText('3. Project Deliverables & Milestones');
  drawText('4. Financials');
  drawText('5. Conclusion');
  newPage();

  // Overview
  drawText('PROJECT PROPOSAL', { size: HEADING_SIZE, bold: true, gap: 12 });
  drawText('1. Project Overview.', { size: HEADING_SIZE, bold: true });
  drawText('1.1 Introduction', { size: HEADING_SIZE, bold: true });
  drawText(data.INTRODUCTION);
  y -= 8;
  drawText('1.2 Key Features', { size: HEADING_SIZE, bold: true });
  drawText(data.KEY_FEATURES);
  y -= 8;
  drawText('1.3 Technology Stack', { size: HEADING_SIZE, bold: true });
  drawText(data.TECHNOLOGY_STACK);
  newPage();

  // Management
  drawText('PROJECT PROPOSAL', { size: HEADING_SIZE, bold: true, gap: 12 });
  drawText('2. Project Management.', { size: HEADING_SIZE, bold: true });
  drawText('2.1 Project Structure & Phases', { size: HEADING_SIZE, bold: true });
  drawText('2.1.1 Project Team', { size: HEADING_SIZE, bold: true });
  drawText('• Project Manager (1)');
  drawText('• Developers (2)');
  y -= 8;
  drawText('2.2 Project Phases', { size: HEADING_SIZE, bold: true });
  drawText('1. Requirement Analysis & Information Gathering');
  drawText('2. System Architecture Design');
  drawText('3. UI/UX Design');
  drawText('4. System Development');
  drawText('5. Testing & Quality Assurance');
  drawText('6. Deployment & Maintenance');
  newPage();

  // Deliverables + financials
  drawText('PROJECT PROPOSAL', { size: HEADING_SIZE, bold: true, gap: 12 });
  drawText('3. Project Deliverables & Milestones.', { size: HEADING_SIZE, bold: true });
  drawText(data.DELIVERABLE_SECTION);
  y -= 8;
  drawText('4. Financials.', { size: HEADING_SIZE, bold: true });
  drawText('4.1 Project Costs', { size: HEADING_SIZE, bold: true });
  drawText(data.FINANCIALS_SECTION);
  newPage();

  // Deployment + conclusion
  drawText('PROJECT PROPOSAL', { size: HEADING_SIZE, bold: true, gap: 12 });
  drawText('4.2 Deployment, Maintain & Publication cost', { size: HEADING_SIZE, bold: true });
  drawText('➢ Play Store one time registration fee - $25');
  drawText('➢ App store annual fee - $99');
  drawText('➢ Maintain & Server cost per month for first 10,000 users - $50 (then $0.01 per user)');
  if (data.MAINTENANCE_SECTION) drawText(data.MAINTENANCE_SECTION);
  y -= 8;
  drawText('5. Conclusion', { size: HEADING_SIZE, bold: true });
  drawText(data.CONCLUSION);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

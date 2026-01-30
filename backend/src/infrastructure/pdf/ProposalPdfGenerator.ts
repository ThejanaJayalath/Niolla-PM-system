import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Proposal } from '../../domain/entities/Proposal';

const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 30;
const DISCLAIMER =
  'This is a sample proposal. Final pricing, scope, and deliverables may change upon further discussion and agreement.';

const PROJECT_PHASES = [
  'Requirement Analysis & Information Gathering',
  'System Architecture Design',
  'UI/UX Design',
  'System Development',
  'Testing & Quality Assurance',
  'Deployment & Maintenance',
];

function getLogoPath(): string | null {
  const base = process.cwd();
  const png = path.join(base, 'assets', 'proposal-logo.png');
  const jpg = path.join(base, 'assets', 'proposal-logo.jpg');
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(jpg)) return jpg;
  return null;
}

type Doc = InstanceType<typeof PDFDocument>;

function drawFooter(doc: Doc, pageNum: number) {
  doc.fontSize(9).fillColor('#333333');
  doc.text('NIOLLA', MARGIN, FOOTER_Y);
  doc.text(String(pageNum), PAGE_WIDTH - MARGIN - 25, FOOTER_Y, { width: 25, align: 'right' });
  doc.fillColor('#000000');
}

function drawPageHeader(doc: Doc) {
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000');
  doc.text('PROJECT PROPOSAL', MARGIN, 50);
  doc.moveTo(MARGIN, 65).lineTo(PAGE_WIDTH - MARGIN, 65).stroke();
  doc.y = 80;
}

export class ProposalPdfGenerator {
  async generate(proposal: Proposal): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const projectName = proposal.projectName || proposal.customerName || 'Project';
      const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      // ========== COVER PAGE ==========
      const logoPath = getLogoPath();
      if (logoPath) {
        try {
          doc.image(logoPath, (PAGE_WIDTH - 120) / 2, 100, { width: 120 });
          doc.y = 240;
        } catch {
          doc.fontSize(22).font('Helvetica-Bold').text('NIOLLA', 0, 120, { width: PAGE_WIDTH, align: 'center' });
          doc.y = 240;
        }
      } else {
        doc.fontSize(22).font('Helvetica-Bold').text('NIOLLA', 0, 120, { width: PAGE_WIDTH, align: 'center' });
        doc.y = 240;
      }

      doc.fontSize(26).font('Helvetica-Bold').text('PROJECT', 0, doc.y, { width: PAGE_WIDTH, align: 'center' });
      doc.fontSize(26).font('Helvetica-Bold').text('PROPOSAL', 0, doc.y + 30, { width: PAGE_WIDTH, align: 'center' });

      doc.fontSize(11).font('Helvetica');
      doc.text(projectName, MARGIN, 420);
      doc.text('Prepared by:', MARGIN, 455);
      doc.text('Niolla Solutions', MARGIN, 472);
      doc.text(`Date: ${today}`, MARGIN, 502);

      doc.addPage();

      // ========== PAGE 1: TABLE OF CONTENTS ==========
      doc.x = MARGIN;
      doc.y = 50;
      drawPageHeader(doc);

      doc.fontSize(14).font('Helvetica-Bold').text('Table of contents.', 0, doc.y, { width: PAGE_WIDTH, align: 'center' });
      doc.y += 28;

      doc.fontSize(10).font('Helvetica');
      const toc = [
        { t: '1. Project Overview.', p: 2 },
        { t: '1.1 Introduction', p: 2 },
        { t: '1.2 Key Features', p: 2 },
        { t: '2. Project Management', p: 3 },
        { t: '2.1 Project Structure & Phases', p: 3 },
        { t: '2.1.1 Project Team', p: 3 },
        { t: '2.2 Project Phases', p: 3 },
        { t: '3. Project Deliverables & Milestones', p: 4 },
        { t: '4. Financials', p: 4 },
        { t: '4.1 Project Costs', p: 4 },
        { t: '4.2 Deployment, Maintain & Publication cost', p: 5 },
        { t: '5. Conclusion', p: 5 },
      ];
      toc.forEach(({ t, p }) => {
        doc.text(t, MARGIN, doc.y);
        doc.text(String(p), PAGE_WIDTH - MARGIN - 25, doc.y, { width: 25, align: 'right' });
        doc.y += 18;
      });

      drawFooter(doc, 1);
      doc.addPage();

      // ========== PAGE 2: PROJECT OVERVIEW ==========
      doc.x = MARGIN;
      doc.y = 50;
      drawPageHeader(doc);

      doc.fontSize(12).font('Helvetica-Bold').text('1. Project Overview.', MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 16).lineTo(PAGE_WIDTH - MARGIN, doc.y + 16).stroke();
      doc.y += 28;

      doc.fontSize(10).font('Helvetica-Bold').text('1.1 Introduction', MARGIN, doc.y);
      doc.y += 16;
      doc.font('Helvetica');
      doc.text(proposal.projectDescription, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 20;

      doc.font('Helvetica-Bold').text('1.2 Key Features', MARGIN, doc.y);
      doc.y += 16;
      doc.font('Helvetica');
      if (proposal.requiredFeatures?.length) {
        proposal.requiredFeatures.forEach((f) => {
          doc.text(`• ${f}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
          doc.y += 14;
        });
      } else {
        doc.text('(To be defined)', MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.y += 14;
      }

      drawFooter(doc, 2);
      doc.addPage();

      // ========== PAGE 3: PROJECT MANAGEMENT ==========
      doc.x = MARGIN;
      doc.y = 50;
      drawPageHeader(doc);

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#c00000').text('2. Project Management.', MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 16).lineTo(PAGE_WIDTH - MARGIN, doc.y + 16).stroke();
      doc.fillColor('#000000');
      doc.y += 28;

      doc.fontSize(10).font('Helvetica-Bold').text('Project Structure & Phases', MARGIN, doc.y);
      doc.y += 20;
      doc.font('Helvetica-Bold').text('Project Team', MARGIN, doc.y);
      doc.y += 14;
      doc.font('Helvetica').text('• Project Manager (1)', MARGIN + 15, doc.y);
      doc.y += 14;
      doc.text('• Developers (2)', MARGIN + 15, doc.y);
      doc.y += 24;
      doc.font('Helvetica-Bold').text('Project Phases', MARGIN, doc.y);
      doc.y += 14;
      doc.font('Helvetica');
      PROJECT_PHASES.forEach((phase, i) => {
        doc.text(`${i + 1}. ${phase}`, MARGIN + 15, doc.y, { width: CONTENT_WIDTH - 15 });
        doc.y += 14;
      });

      drawFooter(doc, 3);
      doc.addPage();

      // ========== PAGE 4: DELIVERABLES & MILESTONES + FINANCIALS ==========
      doc.x = MARGIN;
      doc.y = 50;
      drawPageHeader(doc);

      doc.fontSize(12).font('Helvetica-Bold').text('3. Project Deliverables & Milestones.', MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 16).lineTo(PAGE_WIDTH - MARGIN, doc.y + 16).stroke();
      doc.y += 28;

      doc.fontSize(10).font('Helvetica');
      proposal.milestones.forEach((m, i) => {
        doc.font('Helvetica-Bold').text(`${i + 1}. ${m.title}`, MARGIN, doc.y);
        doc.y += 14;
        if (m.description) {
          doc.font('Helvetica').text(m.description, MARGIN + 15, doc.y, { width: CONTENT_WIDTH - 15 });
          doc.y += 10;
        }
        doc.font('Helvetica').text(`Amount: $${m.amount.toLocaleString()}${m.dueDate ? `  |  Due: ${m.dueDate}` : ''}`, MARGIN + 15, doc.y);
        doc.y += 20;
      });

      doc.y += 8;
      doc.fontSize(12).font('Helvetica-Bold').text('4. Financials.', MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 16).lineTo(PAGE_WIDTH - MARGIN, doc.y + 16).stroke();
      doc.y += 28;
      doc.fontSize(10).font('Helvetica-Bold').text('4.1 Project Costs', MARGIN, doc.y);
      doc.y += 14;
      doc.font('Helvetica').text(`Total: $${proposal.totalAmount.toLocaleString()}`, MARGIN + 15, doc.y);
      doc.y += 14;
      if (proposal.validUntil) {
        doc.text(`Valid until: ${proposal.validUntil}`, MARGIN + 15, doc.y);
        doc.y += 14;
      }

      drawFooter(doc, 4);
      doc.addPage();

      // ========== PAGE 5: DEPLOYMENT + CONCLUSION ==========
      doc.x = MARGIN;
      doc.y = 50;
      drawPageHeader(doc);

      doc.fontSize(10).font('Helvetica-Bold').text('4.2 Deployment, Maintain & Publication cost', MARGIN, doc.y);
      doc.y += 18;
      doc.font('Helvetica');
      doc.text('• Play Store one time registration fee - $25', MARGIN, doc.y);
      doc.y += 14;
      doc.text('• App store annual fee - $99', MARGIN, doc.y);
      doc.y += 14;
      doc.text('• Maintain & Server cost per month for first 10,000 users - $50 (then $0.01 per user)', MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 28;

      doc.font('Helvetica-Bold').text('5. Conclusion', MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 16).lineTo(PAGE_WIDTH - MARGIN, doc.y + 16).stroke();
      doc.y += 24;
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666');
      doc.text(DISCLAIMER, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.fillColor('#000000');

      drawFooter(doc, 5);
      doc.end();
    });
  }
}

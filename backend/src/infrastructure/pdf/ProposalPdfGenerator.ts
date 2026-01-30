import PDFDocument from 'pdfkit';
import { Proposal } from '../../domain/entities/Proposal';

const DISCLAIMER =
  'This is a sample proposal. Final pricing, scope, and deliverables may change upon further discussion and agreement.';

export class ProposalPdfGenerator {
  async generate(proposal: Proposal): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(22).font('Helvetica-Bold').text('Project Proposal', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).font('Helvetica').text('Niolla Customer Solution', { align: 'center' });
      doc.moveDown(2);

      // Customer & project
      doc.fontSize(14).font('Helvetica-Bold').text('Customer', 50, doc.y);
      doc.fontSize(10).font('Helvetica').text(proposal.customerName, 50, doc.y + 18);
      doc.moveDown(1.5);

      doc.fontSize(14).font('Helvetica-Bold').text('Project Description', 50, doc.y);
      doc.fontSize(10).font('Helvetica').text(proposal.projectDescription, 50, doc.y + 18, { width: 500 });
      doc.moveDown(1.5);

      if (proposal.requiredFeatures?.length) {
        doc.fontSize(14).font('Helvetica-Bold').text('Required Features', 50, doc.y);
        doc.fontSize(10).font('Helvetica');
        proposal.requiredFeatures.forEach((f) => doc.text(`• ${f}`, 60, doc.y + 18, { width: 490 }));
        doc.moveDown(1.5);
      }

      // Milestones & pricing
      doc.fontSize(14).font('Helvetica-Bold').text('Milestones & Pricing', 50, doc.y);
      doc.moveDown(0.5);

      let y = doc.y;
      proposal.milestones.forEach((m, i) => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${i + 1}. ${m.title}`, 50, y);
        if (m.description) {
          doc.font('Helvetica').text(m.description, 60, doc.y + 14, { width: 400 });
        }
        doc.font('Helvetica').text(`Amount: $${m.amount.toLocaleString()}`, 60, doc.y + (m.description ? 8 : 4));
        if (m.dueDate) doc.text(`Due: ${m.dueDate}`, 250, doc.y);
        y = doc.y + 20;
      });

      doc.moveDown(1);
      doc.font('Helvetica-Bold').text(`Total: $${proposal.totalAmount.toLocaleString()}`, 50, doc.y);
      if (proposal.validUntil) {
        doc.font('Helvetica').text(`Valid until: ${proposal.validUntil}`, 50, doc.y + 16);
      }
      doc.moveDown(2);

      // Disclaimer
      doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666666').text(DISCLAIMER, 50, doc.y, { width: 500, align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#000000');

      doc.end();
    });
  }
}

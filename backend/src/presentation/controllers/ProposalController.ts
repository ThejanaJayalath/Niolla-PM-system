import { Response } from 'express';
import { ProposalService } from '../../application/services/ProposalService';
import { buildProposalDocx } from '../../infrastructure/pdf/ProposalDocxBuilder';
import { fillProposalTemplate } from '../../infrastructure/pdf/ProposalDocxGenerator';
import { buildProposalPdf } from '../../infrastructure/pdf/ProposalPdfBuilder';
import { convertDocxToPdf } from '../../infrastructure/pdf/convertDocxToPdf';
import { ProposalTemplateModel } from '../../infrastructure/database/models/ProposalTemplateModel';
import { AuthenticatedRequest } from '../middleware/auth';

const proposalService = new ProposalService();

export async function createProposal(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { inquiryId, projectName, milestones, advancePayment, projectCost, totalAmount, maintenanceCostPerMonth, maintenanceNote, validUntil, notes } = req.body;
  const proposal = await proposalService.create({
    inquiryId,
    projectName,
    milestones,
    advancePayment,
    projectCost,
    totalAmount,
    maintenanceCostPerMonth,
    maintenanceNote,
    validUntil,
    notes,
  });
  res.status(201).json({ success: true, data: proposal });
}

export async function getProposal(req: AuthenticatedRequest, res: Response): Promise<void> {
  const proposal = await proposalService.findById(req.params.id);
  if (!proposal) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
    return;
  }
  res.json({ success: true, data: proposal });
}

export async function listProposals(req: AuthenticatedRequest, res: Response): Promise<void> {
  const proposals = await proposalService.findAll();
  res.json({ success: true, data: proposals });
}

export async function getProposalsByInquiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const proposals = await proposalService.findAllByInquiryId(req.params.inquiryId);
  res.json({ success: true, data: proposals });
}

function toBuffer(raw: unknown): Buffer | null {
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw.length > 0 ? raw : null;
  if (typeof (raw as { buffer?: Uint8Array }).buffer !== 'undefined') {
    const b = (raw as { buffer: Uint8Array }).buffer;
    return b && b.length > 0 ? Buffer.from(b) : null;
  }
  try {
    const b = Buffer.from(raw as ArrayLike<number>);
    return b.length > 0 ? b : null;
  } catch {
    return null;
  }
}

export async function downloadProposalPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const proposal = await proposalService.findById(req.params.id);
    if (!proposal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
      return;
    }
    const safeName = (proposal.customerName || 'proposal').toString().replace(/\s+/g, '-');
    const timestamp = Date.now();

    let docxBuffer: Buffer;
    let usedTemplate = false;
    const templateDoc = await ProposalTemplateModel.findOne().sort({ uploadedAt: -1 }).select('templateDocx');
    const raw = templateDoc?.templateDocx;
    const templateBuffer = toBuffer(raw);

    if (templateBuffer && templateBuffer.length > 0) {
      try {
        docxBuffer = fillProposalTemplate(templateBuffer, proposal);
        usedTemplate = true;
      } catch (templateErr) {
        console.warn('Template fill failed, using built docx:', (templateErr as Error)?.message);
        docxBuffer = await buildProposalDocx(proposal);
      }
    } else {
      docxBuffer = await buildProposalDocx(proposal);
    }

    const wantDocx = req.query.format === 'docx';
    if (wantDocx) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${safeName}-${timestamp}.docx"`);
      res.send(docxBuffer);
      return;
    }

    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    if (pdfBuffer && pdfBuffer.length > 0) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${safeName}-${timestamp}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    // Conversion failed. If we used the user's template, send the filled DOCX so they can open in Word and Save as PDF.
    if (usedTemplate) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${safeName}-${timestamp}.docx"`);
      res.setHeader('X-Message', 'Template could not be converted to PDF on this server. You received your filled template as Word - open it and use File > Save As > PDF for a PDF that matches your design.');
      res.send(docxBuffer);
      return;
    }

    // No template (or template failed): use generated PDF.
    try {
      const generatedPdf = await buildProposalPdf(proposal);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${safeName}-${timestamp}.pdf"`);
      res.send(generatedPdf);
    } catch (pdfErr) {
      console.warn('Generated PDF failed, sending docx:', (pdfErr as Error)?.message);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${safeName}-${timestamp}.docx"`);
      res.send(docxBuffer);
    }
  } catch (err) {
    console.error('Download proposal error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate proposal document';
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message },
      });
    }
  }
}

export async function uploadProposalTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file || !file.buffer) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No file uploaded. Please upload a .docx file.' } });
    return;
  }
  const ext = (file.originalname || '').toLowerCase();
  if (!ext.endsWith('.docx')) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Only .docx (Word) files are allowed.' } });
    return;
  }
  await ProposalTemplateModel.deleteMany({});
  await ProposalTemplateModel.create({
    fileName: file.originalname || 'proposal-template.docx',
    templateDocx: file.buffer,
    uploadedAt: new Date(),
  });
  res.status(201).json({
    success: true,
    data: { fileName: file.originalname || 'proposal-template.docx', message: 'Template uploaded successfully.' },
  });
}

export async function getProposalTemplateInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const doc = await ProposalTemplateModel.findOne().sort({ uploadedAt: -1 }).select('fileName uploadedAt').lean();
  if (!doc) {
    res.json({ success: true, data: { hasTemplate: false } });
    return;
  }
  res.json({
    success: true,
    data: {
      hasTemplate: true,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
    },
  });
}
export async function deleteProposal(req: AuthenticatedRequest, res: Response): Promise<void> {
  const success = await proposalService.delete(req.params.id);
  if (!success) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
    return;
  }
  res.json({ success: true, message: 'Proposal deleted successfully' });
}

export async function updateProposal(req: AuthenticatedRequest, res: Response): Promise<void> {
  const proposal = await proposalService.update(req.params.id, req.body);
  if (!proposal) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
    return;
  }
  res.json({ success: true, data: proposal });
}

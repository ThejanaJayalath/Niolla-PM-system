import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ProposalService } from '../../application/services/ProposalService';
import { ProposalDocumentService } from '../../application/services/ProposalDocumentService';
import { buildProposalPdf } from '../../infrastructure/pdf/ProposalPdfBuilder';
import { convertDocxToPdf } from '../../infrastructure/pdf/convertDocxToPdf';
import { sanitizeDownloadFileName, sanitizeHttpHeaderValue } from '../../infrastructure/pdf/textSanitize';
import { ProposalTemplateModel } from '../../infrastructure/database/models/ProposalTemplateModel';
import { AuthenticatedRequest } from '../middleware/auth';

const proposalService = new ProposalService();
const proposalDocumentService = new ProposalDocumentService();

export async function createProposal(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const {
    inquiryId,
    projectName,
    milestones,
    advancePayment,
    projectCost,
    totalAmount,
    paymentPlan,
    installmentMonths,
    monthlyInstallment,
    maintenanceCostPerMonth,
    maintenanceNote,
    validUntil,
    notes,
  } = req.body;
  try {
    const proposal = await proposalService.create({
      inquiryId,
      projectName,
      milestones,
      advancePayment,
      projectCost,
      totalAmount,
      paymentPlan,
      installmentMonths,
      monthlyInstallment,
      maintenanceCostPerMonth,
      maintenanceNote,
      validUntil,
      notes,
    });
    res.status(201).json({ success: true, data: proposal });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Inquiry not found') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message },
      });
      return;
    }
    if (err instanceof mongoose.Error.ValidationError) {
      const first = Object.values(err.errors)[0] as { message?: string } | undefined;
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: first?.message ?? 'Invalid proposal data' },
      });
      return;
    }
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Proposal id conflict. Please try again.',
        },
      });
      return;
    }
    next(err);
  }
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

export async function downloadProposalPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const proposal = await proposalService.findById(req.params.id);
    if (!proposal) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
      return;
    }
    const safeName = sanitizeDownloadFileName(
      (proposal.customerName || 'proposal').toString(),
      'proposal'
    ).replace(/\.docx$/i, '');
    const timestamp = Date.now();
    const pdfFileName = sanitizeDownloadFileName(`proposal-${safeName}-${timestamp}.pdf`);
    const docxFileName = sanitizeDownloadFileName(`proposal-${safeName}-${timestamp}.docx`);

    const { buffer: docxBuffer, usedTemplate, fileName: storedFileName } =
      await proposalDocumentService.getDocumentForDownload(proposal);

    const wantDocx = req.query.format === 'docx';
    if (wantDocx) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${sanitizeDownloadFileName(storedFileName || docxFileName)}"`
      );
      res.send(docxBuffer);
      return;
    }

    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    if (pdfBuffer && pdfBuffer.length > 0) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName}"`);
      res.send(pdfBuffer);
      return;
    }

    // Filled sample template: deliver Word so layout matches the .docx design (not the plain pdf-lib fallback).
    if (usedTemplate) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${docxFileName}"`);
      res.setHeader(
        'X-Message',
        sanitizeHttpHeaderValue(
          'PDF needs LibreOffice on this PC. You received your filled proposal as Word — open it and use File > Save As > PDF. Install LibreOffice to get PDF directly from Download PDF.'
        )
      );
      res.send(docxBuffer);
      return;
    }

    // Template fill failed: generic PDF layout (no LibreOffice).
    try {
      const generatedPdf = await buildProposalPdf(proposal);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFileName}"`);
      res.send(generatedPdf);
      return;
    } catch (pdfErr) {
      console.warn('Generated PDF failed after DOCX conversion failed:', (pdfErr as Error)?.message);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${docxFileName}"`);
    res.setHeader(
      'X-Message',
      sanitizeHttpHeaderValue(
        'Could not build a PDF on this server. You received the proposal as Word — use File > Save As > PDF if needed.'
      )
    );
    res.send(docxBuffer);
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
  res.json({
    success: true,
    data: {
      hasTemplate: true,
      fileName: 'Project proposal sample template.docx',
      isDefault: true,
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

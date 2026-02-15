import { Response } from 'express';
import { ProposalService } from '../../application/services/ProposalService';
import { ProposalPdfGenerator } from '../../infrastructure/pdf/ProposalPdfGenerator';
import { fillProposalTemplate } from '../../infrastructure/pdf/ProposalDocxGenerator';
import { ProposalTemplateModel } from '../../infrastructure/database/models/ProposalTemplateModel';
import { AuthenticatedRequest } from '../middleware/auth';

const proposalService = new ProposalService();
const pdfGenerator = new ProposalPdfGenerator();

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

export async function downloadProposalPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  const proposal = await proposalService.findById(req.params.id);
  if (!proposal) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Proposal not found' } });
    return;
  }
  const safeName = proposal.customerName.replace(/\s+/g, '-');
  const templateDoc = await ProposalTemplateModel.findOne().sort({ uploadedAt: -1 }).lean();
  if (templateDoc?.templateDocx && Buffer.isBuffer(templateDoc.templateDocx)) {
    const buffer = fillProposalTemplate(templateDoc.templateDocx as Buffer, proposal);
    const filename = `proposal-${safeName}-${Date.now()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    return;
  }
  const buffer = await pdfGenerator.generate(proposal);
  const filename = `proposal-${safeName}-${Date.now()}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
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

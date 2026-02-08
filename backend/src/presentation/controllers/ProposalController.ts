import { Response } from 'express';
import { ProposalService } from '../../application/services/ProposalService';
import { ProposalPdfGenerator } from '../../infrastructure/pdf/ProposalPdfGenerator';
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
  const buffer = await pdfGenerator.generate(proposal);
  const filename = `proposal-${proposal.customerName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(buffer);
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

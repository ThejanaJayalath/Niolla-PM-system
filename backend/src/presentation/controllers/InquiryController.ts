import { Response } from 'express';
import { InquiryService } from '../../application/services/InquiryService';
import { AuthenticatedRequest } from '../middleware/auth';

const inquiryService = new InquiryService();

export async function createInquiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { customerName, phoneNumber, projectDescription, requiredFeatures, internalNotes } = req.body;
  const createdBy = req.user?.userId;

  const { inquiry, duplicatePhone } = await inquiryService.create({
    customerName,
    phoneNumber,
    projectDescription,
    requiredFeatures: Array.isArray(requiredFeatures) ? requiredFeatures : [requiredFeatures].filter(Boolean),
    internalNotes,
    createdBy,
  });

  res.status(201).json({
    success: true,
    data: inquiry,
    meta: { duplicatePhone },
  });
}

export async function getInquiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const inquiry = await inquiryService.findById(req.params.id);
  if (!inquiry) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inquiry not found' } });
    return;
  }
  res.json({ success: true, data: inquiry });
}

export async function listInquiries(req: AuthenticatedRequest, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const inquiries = await inquiryService.findAll({
    status: status as never,
    search
  });
  res.json({ success: true, data: inquiries });
}

export async function updateInquiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const inquiry = await inquiryService.update(req.params.id, req.body);
  if (!inquiry) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inquiry not found' } });
    return;
  }
  res.json({ success: true, data: inquiry });
}

export async function deleteInquiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await inquiryService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inquiry not found' } });
    return;
  }
  res.status(204).send();
}

export async function checkDuplicatePhone(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { phoneNumber } = req.query;
  const excludeId = req.query.excludeId as string | undefined;
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'phoneNumber is required' } });
    return;
  }
  const duplicate = await inquiryService.checkDuplicatePhone(phoneNumber, excludeId);
  res.json({ success: true, data: { duplicate } });
}

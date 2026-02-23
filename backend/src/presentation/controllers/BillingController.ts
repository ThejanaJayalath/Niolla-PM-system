import { Response } from 'express';
import { BillingService } from '../../application/services/BillingService';
import { BillingTemplateModel } from '../../infrastructure/database/models/BillingTemplateModel';
import { AuthenticatedRequest } from '../middleware/auth';

const billingService = new BillingService();

export async function createBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    inquiryId,
    customerName,
    projectName,
    phoneNumber,
    items,
    totalAmount,
    companyName,
    address,
    email,
    billingDate,
  } = req.body;
  const billing = await billingService.create({
    inquiryId,
    customerName,
    projectName,
    phoneNumber,
    items: Array.isArray(items) ? items : [],
    totalAmount: Number(totalAmount),
    companyName,
    address,
    email,
    billingDate: billingDate ? new Date(billingDate) : new Date(),
  });
  res.status(201).json({ success: true, data: billing });
}

export async function getBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
  const billing = await billingService.findById(req.params.id);
  if (!billing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Billing not found' } });
    return;
  }
  res.json({ success: true, data: billing });
}

export async function listBillings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const billings = await billingService.findAll();
  res.json({ success: true, data: billings });
}

export async function deleteBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
  const success = await billingService.delete(req.params.id);
  if (!success) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Billing not found' } });
    return;
  }
  res.status(204).send();
}

export async function uploadBillingTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file || !file.buffer) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No file uploaded. Please upload a .docx file.' },
    });
    return;
  }
  const ext = (file.originalname || '').toLowerCase();
  if (!ext.endsWith('.docx')) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Only .docx (Word) files are allowed.' },
    });
    return;
  }
  await BillingTemplateModel.deleteMany({});
  await BillingTemplateModel.create({
    fileName: file.originalname || 'billing-template.docx',
    templateDocx: file.buffer,
    uploadedAt: new Date(),
  });
  res.status(201).json({
    success: true,
    data: {
      fileName: file.originalname || 'billing-template.docx',
      message: 'Template uploaded successfully.',
    },
  });
}

export async function getBillingTemplateInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const doc = await BillingTemplateModel.findOne().sort({ uploadedAt: -1 }).select('fileName uploadedAt').lean();
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

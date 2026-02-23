import { Response } from 'express';
import { BillingService } from '../../application/services/BillingService';
import { BillingTemplateModel } from '../../infrastructure/database/models/BillingTemplateModel';
import { fillBillingTemplate } from '../../infrastructure/pdf/BillingDocxGenerator';
import { convertDocxToPdf } from '../../infrastructure/pdf/convertDocxToPdf';
import { AuthenticatedRequest } from '../middleware/auth';

const billingService = new BillingService();

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

export async function updateBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = req.params.id;
  const {
    companyName,
    address,
    email,
    billingDate,
    items,
    totalAmount,
  } = req.body;
  const update: Record<string, unknown> = {};
  if (companyName !== undefined) update.companyName = companyName;
  if (address !== undefined) update.address = address;
  if (email !== undefined) update.email = email;
  if (billingDate !== undefined) update.billingDate = new Date(billingDate);
  if (items !== undefined) update.items = items;
  if (totalAmount !== undefined) update.totalAmount = Number(totalAmount);
  const billing = await billingService.update(id, update as import('../../application/services/BillingService').UpdateBillingInput);
  if (!billing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Billing not found' } });
    return;
  }
  res.json({ success: true, data: billing });
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

export async function downloadBillingPdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const billing = await billingService.findById(req.params.id);
    if (!billing) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Billing not found' } });
      return;
    }
    const safeName = (billing.customerName || 'invoice').toString().replace(/\s+/g, '-');
    const timestamp = Date.now();

    const templateDoc = await BillingTemplateModel.findOne().sort({ uploadedAt: -1 }).select('templateDocx').lean();
    const raw = templateDoc?.templateDocx;
    const templateBuffer = toBuffer(raw);

    if (!templateBuffer || templateBuffer.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_TEMPLATE', message: 'No invoice template uploaded. Upload a template in Create Billing first.' },
      });
      return;
    }

    const docxBuffer = fillBillingTemplate(templateBuffer, billing);

    const wantDocx = req.query.format === 'docx';
    if (wantDocx) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}-${timestamp}.docx"`);
      res.send(docxBuffer);
      return;
    }

    const pdfBuffer = await convertDocxToPdf(docxBuffer);
    if (pdfBuffer && pdfBuffer.length > 0) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}-${timestamp}.pdf"`);
      res.send(pdfBuffer);
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}-${timestamp}.docx"`);
    res.setHeader('X-Message', 'PDF conversion not available on this server. You received the filled invoice as Word - open it and use File > Save As > PDF.');
    res.send(docxBuffer);
  } catch (err) {
    console.error('Download billing/invoice error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate invoice';
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message },
      });
    }
  }
}

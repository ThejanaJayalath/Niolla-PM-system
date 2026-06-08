import { Request, Response } from 'express';
import { InvoiceService } from '../../application/services/InvoiceService';
import { PaymentTransactionService } from '../../application/services/PaymentTransactionService';
import { CustomerService } from '../../application/services/CustomerService';
import { PaymentNotificationService } from '../../application/services/PaymentNotificationService';
import { ProposalService } from '../../application/services/ProposalService';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { buildInvoicePdf } from '../../infrastructure/pdf/InvoicePdfBuilder';
import { AuthenticatedRequest } from '../middleware/auth';
import { Invoice } from '../../domain/entities/Invoice';
import {
  verifyInvoicePdfLink,
  isInvoicePdfLinkExpired,
  buildInvoicePdfPublicUrl,
  getPublicApiBaseUrl,
} from '../../infrastructure/security/invoicePublicLink';

const invoiceService = new InvoiceService();
const paymentTransactionService = new PaymentTransactionService();
const customerService = new CustomerService();
const paymentNotificationService = new PaymentNotificationService();
const proposalService = new ProposalService();

function formatInvoiceDate(invoice: Invoice): string {
  const d = invoice.invoiceDate;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

async function buildPdfBufferForInvoice(invoice: Invoice): Promise<Buffer> {
  let paymentMethod: string | undefined;
  let referenceNo: string | undefined;
  if (invoice.transactionId) {
    const transaction = await paymentTransactionService.findById(invoice.transactionId);
    if (transaction) {
      paymentMethod = transaction.paymentMethod;
      referenceNo = transaction.referenceNo;
    }
  }
  return buildInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: formatInvoiceDate(invoice),
    clientName: (invoice as { clientName?: string }).clientName,
    originalAmount: invoice.originalAmount,
    discountAmt: invoice.discountAmt,
    totalAmount: invoice.totalAmount,
    campaignName: invoice.campaignName,
    status: invoice.status,
    transactionRef: referenceNo,
    paymentMethod,
  });
}

export async function listInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.query.clientId as string | undefined;
  const status = req.query.status as string | undefined;
  const inquiryId = req.query.inquiryId as string | undefined;
  const invoices = await invoiceService.findAll({ clientId, status, inquiryId });
  res.json({ success: true, data: invoices });
}

export async function getInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const invoice = await invoiceService.findById(req.params.id);
  if (!invoice) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    return;
  }
  res.json({ success: true, data: invoice });
}

export async function generateInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const transaction = await paymentTransactionService.findById(req.params.transactionId);
    if (!transaction) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
      return;
    }
    const { invoice, created } = await invoiceService.ensureInvoiceForPaymentTransaction(req.params.transactionId);
    res.status(created ? 201 : 200).json({ success: true, data: invoice });
  } catch (err) {
    console.error('Generate invoice error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Unknown error' },
    });
  }
}

/** Mark invoice as emailed (sets emailedAt). Actual email can be wired later via nodemailer/SendGrid. */
export async function sendInvoiceEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  const invoice = await invoiceService.markEmailed(req.params.id);
  if (!invoice) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    return;
  }
  res.json({ success: true, data: invoice });
}

export async function downloadInvoicePdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const invoice = await invoiceService.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const pdfBuffer = await buildPdfBufferForInvoice(invoice);
    const safeName = (invoice.invoiceNumber || 'invoice').replace(/\s+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Download invoice PDF error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate invoice PDF';
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message },
      });
    }
  }
}

export async function downloadPublicInvoicePdf(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig || '');
    if (!verifyInvoicePdfLink(id, exp, sig) || isInvoicePdfLinkExpired(exp)) {
      res.status(403).json({
        success: false,
        error: { code: 'INVALID_OR_EXPIRED_LINK', message: 'This download link is invalid or has expired.' },
      });
      return;
    }
    const invoice = await invoiceService.findById(id);
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const pdfBuffer = await buildPdfBufferForInvoice(invoice);
    const safeName = (invoice.invoiceNumber || 'invoice').replace(/\s+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${safeName}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Public invoice PDF error:', err);
    const message = err instanceof Error ? err.message : 'Failed to generate invoice PDF';
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: { code: 'DOWNLOAD_FAILED', message },
      });
    }
  }
}

export interface NotifyCustomerInvoiceResult {
  pdfUrl: string;
  publicApiBaseUrl: string;
  queuedEmail: boolean;
  queuedSms: boolean;
  invoice: Invoice;
}

async function onProposalAdvanceInvoicePaid(invoice: Invoice): Promise<void> {
  if (invoice.sourceType !== 'PROPOSAL_ADVANCE' || !invoice.clientId) return;

  const remaining = invoice.inquiryId
    ? await proposalService.getRemainingContractBalanceAfterAdvance(String(invoice.inquiryId))
    : 0;
  const amtStr = `LKR ${remaining.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const body = `Payment Received. Order Confirmed! Your Remaining Balance is ${amtStr}. Thank you for choosing NIOLLA.`;
  const sentAt = new Date();

  await Promise.all([
    paymentNotificationService.create({
      clientId: invoice.clientId,
      type: 'email',
      triggerType: 'receipt',
      scheduledAt: sentAt,
      status: 'sent',
      sentAt,
      messageBody: body,
    }),
    paymentNotificationService.create({
      clientId: invoice.clientId,
      type: 'sms',
      triggerType: 'receipt',
      scheduledAt: sentAt,
      status: 'sent',
      sentAt,
      messageBody: body,
    }),
  ]);

  if (invoice.inquiryId) {
    await InquiryModel.updateOne(
      { _id: invoice.inquiryId, status: 'PENDING_ADVANCE' },
      { $set: { status: 'CONFIRMED' } }
    );
  }
}

export async function patchInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const status = req.body?.status as string | undefined;
    if (!status || !['draft', 'sent', 'paid', 'pending'].includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid status is required (draft, sent, paid, pending).' },
      });
      return;
    }
    const { invoice, previousStatus } = await invoiceService.updateStatus(
      req.params.id,
      status as 'draft' | 'sent' | 'paid' | 'pending'
    );
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    if (status === 'paid' && previousStatus !== 'paid' && invoice.sourceType === 'PROPOSAL_ADVANCE') {
      await onProposalAdvanceInvoicePaid(invoice);
    }
    res.json({ success: true, data: invoice });
  } catch (err) {
    console.error('Patch invoice error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Unknown error' },
    });
  }
}

export async function notifyCustomerInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const invoice = await invoiceService.findById(req.params.id);
    if (!invoice || !invoice._id) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    const customer = await customerService.findById(invoice.clientId);
    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found for this invoice' } });
      return;
    }

    const baseUrl = getPublicApiBaseUrl();
    const pdfUrl = buildInvoicePdfPublicUrl(invoice._id, baseUrl);
    const displayName = customer.name || customer.companyName || 'Valued customer';
    const amountStr = `LKR ${Number(invoice.totalAmount).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const invNo = invoice.invoiceNumber;
    const desc = invoice.description ? ` ${invoice.description}` : '';

    const emailBody = [
      `Dear ${displayName},`,
      '',
      `Thank you for choosing Niolla Nexa.`,
      '',
      `Your invoice ${invNo} is ready.${desc ? `\n\nDetails:${desc}` : ''}`,
      `Amount due: ${amountStr}.`,
      '',
      `Download your official PDF invoice here:`,
      pdfUrl,
      '',
      'If you have any questions, reply to this email or contact us with this invoice number.',
      '',
      'Best regards,',
      'Niolla Nexa',
    ].join('\n');

    const smsBody = `Niolla Nexa: Invoice ${invNo} — ${amountStr}. Download PDF: ${pdfUrl}`;

    const tasks: Promise<unknown>[] = [];
    if (customer.email?.trim()) {
      tasks.push(
        paymentNotificationService.create({
          clientId: String(customer._id),
          type: 'email',
          triggerType: 'receipt',
          scheduledAt: new Date(),
          messageBody: emailBody,
        })
      );
    }
    if (customer.phoneNumber?.trim()) {
      tasks.push(
        paymentNotificationService.create({
          clientId: String(customer._id),
          type: 'sms',
          triggerType: 'receipt',
          scheduledAt: new Date(),
          messageBody: smsBody,
        })
      );
    }

    if (tasks.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'NO_CONTACT',
          message: 'Add an email or phone number on the customer profile before sending notifications.',
        },
      });
      return;
    }

    await Promise.all(tasks);
    const updated = await invoiceService.markCustomerNotified(invoice._id);

    const payload: NotifyCustomerInvoiceResult = {
      pdfUrl,
      publicApiBaseUrl: baseUrl,
      queuedEmail: !!customer.email?.trim(),
      queuedSms: !!customer.phoneNumber?.trim(),
      invoice: updated || invoice,
    };
    res.json({ success: true, data: payload });
  } catch (err) {
    console.error('Notify customer invoice error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Unknown error' },
    });
  }
}

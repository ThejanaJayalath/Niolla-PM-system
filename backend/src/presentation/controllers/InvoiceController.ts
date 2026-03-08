import { Response } from 'express';
import { InvoiceService } from '../../application/services/InvoiceService';
import { PaymentTransactionService } from '../../application/services/PaymentTransactionService';
import { buildInvoicePdf } from '../../infrastructure/pdf/InvoicePdfBuilder';
import { AuthenticatedRequest } from '../middleware/auth';

const invoiceService = new InvoiceService();
const paymentTransactionService = new PaymentTransactionService();

export async function listInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.query.clientId as string | undefined;
  const status = req.query.status as string | undefined;
  const invoices = await invoiceService.findAll({ clientId, status });
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

export async function downloadInvoicePdf(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const invoice = await invoiceService.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
      return;
    }
    let paymentMethod: string | undefined;
    let referenceNo: string | undefined;
    const transaction = await paymentTransactionService.findById(invoice.transactionId);
    if (transaction) {
      paymentMethod = transaction.paymentMethod;
      referenceNo = transaction.referenceNo;
    }
    const invoiceDateStr =
      invoice.invoiceDate instanceof Date
        ? invoice.invoiceDate.toISOString().slice(0, 10)
        : String(invoice.invoiceDate).slice(0, 10);
    const safeName = (invoice.invoiceNumber || 'invoice').replace(/\s+/g, '-');
    const pdfBuffer = await buildInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoiceDateStr,
      clientName: (invoice as { clientName?: string }).clientName,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      transactionRef: referenceNo,
      paymentMethod,
    });
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

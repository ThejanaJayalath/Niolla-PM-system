/**
 * Build invoice/receipt PDF using pdf-lib (payment receipt for a single transaction).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const LINE_HEIGHT = 14;
const TITLE_SIZE = 18;
const BODY_SIZE = 11;

export interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  clientName?: string;
  totalAmount: number;
  status: string;
  transactionRef?: string;
  paymentMethod?: string;
}

export async function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  page.drawText('PAYMENT RECEIPT / INVOICE', {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: fontBold,
    color: rgb(0.2, 0.45, 0.11),
  });
  y -= LINE_HEIGHT * 2;

  page.drawText(`Invoice No: ${data.invoiceNumber}`, {
    x: MARGIN,
    y,
    size: BODY_SIZE,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT;

  page.drawText(`Date: ${data.invoiceDate}`, {
    x: MARGIN,
    y,
    size: BODY_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT;

  if (data.clientName) {
    page.drawText(`Client: ${data.clientName}`, {
      x: MARGIN,
      y,
      size: BODY_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;
  }

  y -= LINE_HEIGHT;
  page.drawText('Amount Paid', {
    x: MARGIN,
    y,
    size: BODY_SIZE,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= LINE_HEIGHT;

  page.drawText(`Rs. ${Number(data.totalAmount).toLocaleString()}`, {
    x: MARGIN,
    y,
    size: 16,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= LINE_HEIGHT * 2;

  if (data.paymentMethod) {
    page.drawText(`Payment Method: ${data.paymentMethod}`, {
      x: MARGIN,
      y,
      size: BODY_SIZE,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= LINE_HEIGHT;
  }

  if (data.transactionRef) {
    page.drawText(`Reference: ${data.transactionRef}`, {
      x: MARGIN,
      y,
      size: BODY_SIZE,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= LINE_HEIGHT;
  }

  page.drawText(`Status: ${data.status.toUpperCase()}`, {
    x: MARGIN,
    y,
    size: BODY_SIZE,
    font: fontBold,
    color: rgb(0.2, 0.45, 0.11),
  });

  y -= LINE_HEIGHT * 3;
  page.drawText('Thank you for your payment.', {
    x: MARGIN,
    y,
    size: BODY_SIZE,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

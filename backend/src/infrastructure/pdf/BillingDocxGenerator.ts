import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Billing } from '../../domain/entities/Billing';

/**
 * Fills the invoice/billing Word template.
 * Template placeholders: {{billingId}}, {{billingDate}}, {{customerName}}, {{companyName}},
 * {{address}}, {{email}}, {{phoneNumber}}, and for items use a loop: {{#items}} {{no}} {{description}} {{amount}} {{/items}} (all in one table row).
 * For a single row you can use {{item.no}}, {{item.description}}, {{item.amount}} (first item only).
 * Summary: {{subTotal}}, {{totalAmount}}. Advance (optional): use {{#advanceApplied}}- Advance Payment = {{advanceApplied}}{{/advanceApplied}} so the line hides when no advance.
 * Optional sender: {{senderCompanyName}}, {{senderAddress}}, etc.
 */

function formatLkr(value: number): string {
  return `LKR ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();
}

export function getInvoiceTemplateData(billing: Billing): Record<string, unknown> {
  const billingDate = billing.billingDate
    ? new Date(billing.billingDate)
    : billing.createdAt
      ? new Date(billing.createdAt)
      : new Date();

  const items = Array.isArray(billing.items) && billing.items.length > 0
    ? billing.items.map((it, i) => ({
        no: it.number || String(i + 1),
        description: it.description || '—',
        amount: formatLkr(Number(it.amount)),
      }))
    : [{ no: '1', description: '—', amount: formatLkr(0) }];

  const subTotalComputed = billing.items?.length
    ? billing.items.reduce((sum, it) => sum + Number(it.amount), 0)
    : 0;
  const subTotal = (billing.subTotal ?? subTotalComputed) || billing.totalAmount ?? 0;
  const advanceAppliedNum = billing.advanceApplied ?? 0;
  const totalAmount = billing.totalAmount ?? Math.max(0, subTotal - advanceAppliedNum);

  const itemFirst = items[0] ?? { no: '1', description: '—', amount: formatLkr(0) };

  const senderCompanyName = process.env.SENDER_COMPANY_NAME || 'NIOLLA';
  const senderLegalName = process.env.SENDER_LEGAL_NAME || 'Niolla PVT.LTD';
  const senderAddress = process.env.SENDER_ADDRESS || 'Pothuhera';
  const senderEmail = process.env.SENDER_EMAIL || 'contact@niolla.lk';
  const senderPhone = process.env.SENDER_PHONE || '+94 77 665 1638';
  const senderWebsite = process.env.SENDER_WEBSITE || 'https://niolla.lk';
  const paymentTerms = process.env.INVOICE_PAYMENT_TERMS || 'Due Within 24 hours';
  const paymentRecipientName = process.env.PAYMENT_RECIPIENT_NAME || '';
  const bankName = process.env.BANK_NAME || 'NDB bank Kurunegala';
  const bankAccountNumber = process.env.BANK_ACCOUNT_NUMBER || '115511292516';

  return {
    billingId: billing.billingId || 'INV 001',
    billingDate: formatDate(billingDate),
    customerName: billing.customerName || '—',
    companyName: billing.companyName || '—',
    address: billing.address || '—',
    email: billing.email || '—',
    phoneNumber: billing.phoneNumber || '—',
    items,
    item: itemFirst,
    subTotal: formatLkr(subTotal),
    advanceApplied: advanceAppliedNum > 0 ? formatLkr(advanceAppliedNum) : null,
    totalAmount: formatLkr(totalAmount),
    total: { amount: formatLkr(totalAmount) },
    senderCompanyName,
    senderLegalName,
    senderAddress,
    senderEmail,
    senderPhone,
    senderWebsite,
    paymentTerms,
    paymentRecipientName,
    bankName,
    bankAccountNumber,
    thankYouMessage: 'Thank you for your business!',
  };
}

export function fillBillingTemplate(templateBuffer: Buffer, billing: Billing): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });
  const data = getInvoiceTemplateData(billing);
  doc.render(data);
  const out = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}

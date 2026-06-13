import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Proposal } from '../../domain/entities/Proposal';
import { sanitizeDocxText } from './textSanitize';

/**
 * Fills a Word template that uses placeholders {{PROJECT_NAME}}, {{DATE}}, etc.
 * Template must be built so each placeholder is ONE run (see PROPOSAL_TEMPLATE_GUIDE.md).
 * No XML merging — we do not modify the docx structure, so the file stays valid.
 */

/** Format number as LKR currency string for template */
function formatLkr(value: number): string {
  return `LKR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Fills the proposal Word template with placeholder values.
 * Template placeholders (exact spelling): {{PROJECT_NAME}}, {{DATE}}, {{INTRODUCTION}},
 * {{KEY_FEATURES}}, {{ADVANCE_PAYMENT}}, {{PROJECT_COST}}, {{TOTAL_COST}}, {{DELIVERABLE_SECTION}}
 * In Word, type each placeholder as plain text with no extra spaces inside the braces.
 */
export function getTemplateData(proposal: Proposal): Record<string, string> {
  const projectName =
    (proposal.projectName || proposal.customerName || '').trim() || 'Project';
  const date = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
  const introduction = (proposal.projectDescription || '').trim() || '—';
  const keyFeaturesList = Array.isArray(proposal.requiredFeatures)
    ? proposal.requiredFeatures.filter(Boolean).map((f) => String(f).trim())
    : [];
  const keyFeatures =
    keyFeaturesList.length > 0
      ? '• ' + keyFeaturesList.join('\n• ')
      : '—';
  const advancePayment =
    proposal.advancePayment != null
      ? formatLkr(proposal.advancePayment)
      : formatLkr(0);
  const projectCost =
    proposal.projectCost != null
      ? formatLkr(proposal.projectCost)
      : formatLkr(0);
  const totalCost =
    proposal.totalAmount != null
      ? formatLkr(proposal.totalAmount)
      : formatLkr(0);
  const hasCampaignDiscount = (proposal.campaignDiscountAmount ?? 0) > 0;
  const originalPrice = hasCampaignDiscount
    ? formatLkr(proposal.originalAmount ?? proposal.totalAmount)
    : '';
  const discountAmount = hasCampaignDiscount ? formatLkr(proposal.campaignDiscountAmount ?? 0) : '';
  const finalPayable = totalCost;
  const pricingSection = hasCampaignDiscount
    ? [
        `Original Price: ${originalPrice}`,
        `Discount (${proposal.campaignName || 'Campaign'}): −${discountAmount}`,
        `Final Payable Price: ${finalPayable}`,
      ].join('\n')
    : `Total Cost: ${totalCost}`;
  const deliverableSection =
    (proposal.milestones || []).length > 0
      ? (proposal.milestones || [])
          .map(
            (m, i) =>
              `${i + 1}. ${m.title}${m.amount != null ? ` - LKR ${m.amount.toLocaleString()}` : ''}${m.timePeriod ? ` (${m.timePeriod})` : ''}${m.description ? `\n   ${m.description}` : ''}`
          )
          .join('\n\n')
      : '—';

  const validUntil = proposal.validUntil
    ? new Date(proposal.validUntil).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const financialsLines = [
    `Advance Payment: ${advancePayment}`,
    `Project Cost: ${projectCost}`,
    hasCampaignDiscount
      ? `Original Price: ${originalPrice}\nDiscount (${proposal.campaignName || 'Campaign'}): −${discountAmount}\nFinal Payable Price: ${finalPayable}`
      : `Total Cost: ${totalCost}`,
  ];
  if (proposal.installmentMonths && proposal.monthlyInstallment) {
    financialsLines.push(
      `Payment Plan: ${proposal.installmentMonths}-month installment`,
      `Monthly Installment: ${formatLkr(proposal.monthlyInstallment)}`
    );
  }
  if (validUntil) financialsLines.push(`Valid until: ${validUntil}`);

  const maintenanceLines: string[] = [];
  if (proposal.maintenanceCostPerMonth != null && proposal.maintenanceCostPerMonth > 0) {
    maintenanceLines.push(
      `Maintenance cost per month: ${formatLkr(proposal.maintenanceCostPerMonth)}`
    );
  }
  if (proposal.maintenanceNote?.trim()) {
    maintenanceLines.push(proposal.maintenanceNote.trim());
  }

  const raw = {
    PROJECT_NAME: projectName,
    DATE: date,
    INTRODUCTION: introduction,
    KEY_FEATURES: keyFeatures,
    TECHNOLOGY_STACK: '—',
    ADVANCE_PAYMENT: advancePayment,
    PROJECT_COST: projectCost,
    TOTAL_COST: totalCost,
    ORIGINAL_PRICE: originalPrice || totalCost,
    DISCOUNT_AMOUNT: discountAmount || '—',
    FINAL_PAYABLE: finalPayable,
    PRICING_SECTION: pricingSection,
    FINANCIALS_SECTION: financialsLines.join('\n'),
    DELIVERABLE_SECTION: deliverableSection,
    MAINTENANCE_SECTION:
      maintenanceLines.length > 0
        ? `Deployment, Maintain & Publication cost\n${maintenanceLines.join('\n')}`
        : '',
    VALID_UNTIL: validUntil || '—',
    CONCLUSION:
      proposal.notes?.trim() ||
      'This proposal outlines the scope, deliverables, and financial terms for the project. Final pricing, scope, and deliverables may change upon further discussion and agreement.',
  };

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, sanitizeDocxText(value)])
  );
}

export function assertValidDocxBuffer(buffer: Buffer): void {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error('Generated file is not a valid Word document');
  }
}

export function fillProposalTemplate(templateBuffer: Buffer, proposal: Proposal): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });
  const data = getTemplateData(proposal);
  doc.render(data);
  const out = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Proposal } from '../../domain/entities/Proposal';

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
  const deliverableSection =
    (proposal.milestones || []).length > 0
      ? (proposal.milestones || [])
          .map(
            (m, i) =>
              `${i + 1}. ${m.title}${m.amount != null ? ` - LKR ${m.amount.toLocaleString()}` : ''}${m.timePeriod ? ` (${m.timePeriod})` : ''}${m.description ? `\n   ${m.description}` : ''}`
          )
          .join('\n\n')
      : '—';

  return {
    PROJECT_NAME: projectName,
    DATE: date,
    INTRODUCTION: introduction,
    KEY_FEATURES: keyFeatures,
    ADVANCE_PAYMENT: advancePayment,
    PROJECT_COST: projectCost,
    TOTAL_COST: totalCost,
    DELIVERABLE_SECTION: deliverableSection,
  };
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

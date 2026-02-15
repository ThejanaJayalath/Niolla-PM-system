import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { Proposal } from '../../domain/entities/Proposal';

/**
 * Fills the proposal Word template with placeholder values.
 * Template placeholders (mandatory): {{PROJECT_NAME}}, {{DATE}}, {{INTRODUCTION}},
 * {{KEY_FEATURES}}, {{ADVANCE_PAYMENT}}, {{PROJECT_COST}}, {{TOTAL_COST}}, {{DELIVERABLE_SECTION}}
 */
export function getTemplateData(proposal: Proposal): Record<string, string | number> {
  const projectName = proposal.projectName || proposal.customerName || 'Project';
  const date = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const introduction = proposal.projectDescription || '';
  const keyFeatures = Array.isArray(proposal.requiredFeatures)
    ? proposal.requiredFeatures.join('\n• ')
    : '';
  const advancePayment = proposal.advancePayment != null ? proposal.advancePayment : 0;
  const projectCost = proposal.projectCost != null ? proposal.projectCost : 0;
  const totalCost = proposal.totalAmount != null ? proposal.totalAmount : 0;
  const deliverableSection = (proposal.milestones || [])
    .map(
      (m, i) =>
        `${i + 1}. ${m.title}${m.amount != null ? ` - LKR ${m.amount.toLocaleString()}` : ''}${m.timePeriod ? ` (${m.timePeriod})` : ''}${m.description ? `\n   ${m.description}` : ''}`
    )
    .join('\n\n');

  return {
    PROJECT_NAME: projectName,
    DATE: date,
    INTRODUCTION: introduction,
    KEY_FEATURES: keyFeatures ? '• ' + keyFeatures : '',
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

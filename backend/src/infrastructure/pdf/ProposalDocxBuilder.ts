/**
 * Build proposal document from data using the "docx" package.
 * No Word template file — we generate valid .docx from code. No XML corruption, no placeholder splitting.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
} from 'docx';
import { Proposal } from '../../domain/entities/Proposal';

function formatDate(proposal: Proposal): string {
  const d = proposal.createdAt ? new Date(proposal.createdAt) : new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatLkr(value: number): string {
  return `LKR ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildProposalDocx(proposal: Proposal): Promise<Buffer> {
  const projectName = (proposal.projectName || proposal.customerName || '').trim() || 'Project';
  const dateStr = formatDate(proposal);
  const introduction = (proposal.projectDescription || '').trim() || '—';
  const features = Array.isArray(proposal.requiredFeatures) ? proposal.requiredFeatures.filter(Boolean) : [];
  const advancePayment = proposal.advancePayment != null ? proposal.advancePayment : 0;
  const projectCost = proposal.projectCost != null ? proposal.projectCost : 0;
  const totalCost = proposal.totalAmount != null ? proposal.totalAmount : 0;
  const milestones = proposal.milestones || [];

  const children: Paragraph[] = [
    new Paragraph({
      text: 'PROJECT PROPOSAL',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: projectName, bold: true })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Date: ${dateStr}` })],
      spacing: { after: 360 },
    }),
    new Paragraph({
      text: 'Introduction',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
    new Paragraph({
      text: introduction,
      spacing: { after: 240 },
    }),
    new Paragraph({
      text: 'Key Features',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
  ];

  if (features.length > 0) {
    features.forEach((f) => {
      children.push(
        new Paragraph({
          text: `• ${String(f).trim()}`,
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    });
  } else {
    children.push(new Paragraph({ text: '—', spacing: { after: 120 } }));
  }

  children.push(
    new Paragraph({
      text: 'Deliverables',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    })
  );

  if (milestones.length > 0) {
    milestones.forEach((m, i) => {
      const line = [
        `${i + 1}. ${m.title}`,
        m.amount != null ? ` - LKR ${m.amount.toLocaleString()}` : '',
        m.timePeriod ? ` (${m.timePeriod})` : '',
      ].join('');
      children.push(new Paragraph({ text: line, spacing: { after: 80 } }));
      if (m.description) {
        children.push(new Paragraph({ text: `   ${m.description}`, spacing: { after: 80 } }));
      }
    });
  } else {
    children.push(new Paragraph({ text: '—', spacing: { after: 120 } }));
  }

  children.push(
    new Paragraph({
      text: 'Financials',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Advance Payment: ', bold: true }),
        new TextRun(formatLkr(advancePayment)),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Project Cost: ', bold: true }),
        new TextRun(formatLkr(projectCost)),
      ],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Total Cost: ', bold: true }),
        new TextRun({ text: formatLkr(totalCost), bold: true }),
      ],
      spacing: { after: 240 },
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

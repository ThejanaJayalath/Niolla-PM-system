/**
 * Build proposal document from data using the "docx" package.
 * Fallback when template fill fails — mirrors the Niolla sample proposal layout.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  convertInchesToTwip,
} from 'docx';
import { Proposal } from '../../domain/entities/Proposal';
import { getTemplateData } from './ProposalDocxGenerator';

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function body(text: string): Paragraph {
  return new Paragraph({
    text,
    spacing: { after: 80 },
  });
}

function multiline(text: string): Paragraph[] {
  return text.split('\n').map((line) => body(line));
}

export async function buildProposalDocx(proposal: Proposal): Promise<Buffer> {
  const data = getTemplateData(proposal);

  const children: Paragraph[] = [
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      children: [new TextRun({ text: data.PROJECT_NAME, bold: true, size: 32 })],
      spacing: { after: 120 },
    }),
    new Paragraph({ spacing: { before: 480 } }),
    body('Prepared by:'),
    body('Niolla Solutions'),
    body(data.DATE),
    new Paragraph({ spacing: { before: 720 } }),
    new Paragraph({
      children: [new TextRun({ text: 'PROJECT PROPOSAL', bold: true, size: 48 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    pageBreak(),

    new Paragraph({
      children: [new TextRun({ text: 'PROJECT PROPOSAL', bold: true })],
      spacing: { after: 240 },
    }),
    body('Table of contents.'),
    body('1. Project Overview.'),
    body('1.1 Introduction'),
    body('1.2 Key Features'),
    body('1.3 Technology Stack'),
    body('2. Project Management'),
    body('3. Project Deliverables & Milestones'),
    body('4. Financials'),
    body('5. Conclusion'),
    pageBreak(),

    new Paragraph({
      children: [new TextRun({ text: 'PROJECT PROPOSAL', bold: true })],
      spacing: { after: 240 },
    }),
    heading('1. Project Overview.'),
    heading('1.1 Introduction', HeadingLevel.HEADING_2),
    body(data.INTRODUCTION),
    heading('1.2 Key Features', HeadingLevel.HEADING_2),
    ...multiline(data.KEY_FEATURES),
    heading('1.3 Technology Stack', HeadingLevel.HEADING_2),
    body(data.TECHNOLOGY_STACK),
    pageBreak(),

    new Paragraph({
      children: [new TextRun({ text: 'PROJECT PROPOSAL', bold: true })],
      spacing: { after: 240 },
    }),
    heading('2. Project Management.'),
    heading('2.1 Project Structure & Phases', HeadingLevel.HEADING_2),
    heading('2.1.1 Project Team', HeadingLevel.HEADING_3),
    body('• Project Manager (1)'),
    body('• Developers (2)'),
    heading('2.2 Project Phases', HeadingLevel.HEADING_2),
    body('1. Requirement Analysis & Information Gathering'),
    body('2. System Architecture Design'),
    body('3. UI/UX Design'),
    body('4. System Development'),
    body('5. Testing & Quality Assurance'),
    body('6. Deployment & Maintenance'),
    pageBreak(),

    new Paragraph({
      children: [new TextRun({ text: 'PROJECT PROPOSAL', bold: true })],
      spacing: { after: 240 },
    }),
    heading('3. Project Deliverables & Milestones.'),
    ...multiline(data.DELIVERABLE_SECTION),
    heading('4. Financials.'),
    heading('4.1 Project Costs', HeadingLevel.HEADING_2),
    ...multiline(data.FINANCIALS_SECTION),
    pageBreak(),

    new Paragraph({
      children: [new TextRun({ text: 'PROJECT PROPOSAL', bold: true })],
      spacing: { after: 240 },
    }),
    heading('4.2 Deployment, Maintain & Publication cost', HeadingLevel.HEADING_2),
    body('➢ Play Store one time registration fee - $25'),
    body('➢ App store annual fee - $99'),
    body('➢ Maintain & Server cost per month for first 10,000 users - $50 (then $0.01 per user)'),
    ...(data.MAINTENANCE_SECTION ? multiline(data.MAINTENANCE_SECTION) : []),
    heading('5. Conclusion'),
    ...multiline(data.CONCLUSION),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import {
  DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME,
  getAssetsDir,
  getBundledProposalTemplatePath,
  getSourceProposalTemplatePath,
} from './proposalTemplatePaths';

function paragraphText(paragraphXml: string): string {
  return [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('');
}

function placeholderParagraph(placeholder: string): string {
  return `<w:p><w:r><w:t>{{${placeholder}}}</w:t></w:r></w:p>`;
}

function replaceParagraphText(xml: string, searchText: string, replacementText: string): string {
  const parts = xml.split(/(?=<w:p[ >])/);
  let changed = false;
  const updated = parts.map((part) => {
    if (!part.startsWith('<w:p')) return part;
    const end = part.indexOf('</w:p>');
    if (end === -1) return part;
    const block = part.slice(0, end + 6);
    if (paragraphText(block) !== searchText) return part;
    changed = true;
    const openTagEnd = block.indexOf('>') + 1;
    const pPrMatch = block.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const newBlock = `<w:p>${pPr}<w:r><w:t>${replacementText}</w:t></w:r></w:p>`;
    return part.replace(block, newBlock);
  });
  if (!changed) {
    throw new Error(`Could not find paragraph with text: ${searchText}`);
  }
  return updated.join('');
}

function insertParagraphAfterText(xml: string, searchText: string, newParagraph: string): string {
  const parts = xml.split(/(?=<w:p[ >])/);
  const result: string[] = [];
  let inserted = false;
  for (const part of parts) {
    result.push(part);
    if (!part.startsWith('<w:p')) continue;
    const end = part.indexOf('</w:p>');
    if (end === -1) continue;
    const block = part.slice(0, end + 6);
    if (paragraphText(block) === searchText) {
      result.push(newParagraph);
      inserted = true;
    }
  }
  if (!inserted) {
    throw new Error(`Could not insert after paragraph with text: ${searchText}`);
  }
  return result.join('');
}

function removeParagraphsBetween(xml: string, startText: string, endText: string, replacement: string): string {
  const parts = xml.split(/(?=<w:p[ >])/);
  const result: string[] = [];
  let removing = false;
  let replaced = false;
  for (const part of parts) {
    if (!part.startsWith('<w:p')) {
      if (!removing) result.push(part);
      continue;
    }
    const end = part.indexOf('</w:p>');
    if (end === -1) {
      if (!removing) result.push(part);
      continue;
    }
    const block = part.slice(0, end + 6);
    const text = paragraphText(block);
    if (text === startText) {
      removing = true;
      result.push(replacement);
      replaced = true;
      continue;
    }
    if (removing && text === endText) {
      removing = false;
      result.push(part);
      continue;
    }
    if (!removing) result.push(part);
  }
  if (!replaced) {
    throw new Error(`Could not replace block starting at: ${startText}`);
  }
  return result.join('');
}

function injectPlaceholders(documentXml: string): string {
  let xml = documentXml;

  xml = replaceParagraphText(
    xml,
    'Customer Relationship Management System Prepared by:',
    '{{PROJECT_NAME}} Prepared by:'
  );
  xml = replaceParagraphText(xml, 'Niolla Solutions 29 January 2026', 'Niolla Solutions {{DATE}}');

  xml = insertParagraphAfterText(xml, 'Introduction', placeholderParagraph('INTRODUCTION'));
  xml = insertParagraphAfterText(xml, 'Key Features', placeholderParagraph('KEY_FEATURES'));
  xml = insertParagraphAfterText(xml, 'Technology Stack', placeholderParagraph('TECHNOLOGY_STACK'));
  xml = insertParagraphAfterText(
    xml,
    'Project Deliverables &amp; Milestones.',
    placeholderParagraph('DELIVERABLE_SECTION')
  );

  xml = removeParagraphsBetween(
    xml,
    'Project Manager:',
    'Subtotal for development: Rs.',
    placeholderParagraph('FINANCIALS_SECTION')
  );

  // Remove sample deployment / store-fee rows so downloads show proposal data only.
  xml = removeParagraphsBetween(
    xml,
    'Subtotal for development: Rs.',
    'Conclusion',
    placeholderParagraph('MAINTENANCE_SECTION')
  );

  xml = insertParagraphAfterText(xml, 'Conclusion', placeholderParagraph('CONCLUSION'));

  return xml;
}

/**
 * Reads the repo-root sample .docx, injects {{PLACEHOLDER}} tags, and writes the bundled template.
 */
export function prepareBundledProposalTemplate(sourcePath?: string, destPath?: string): Buffer {
  const source = sourcePath ?? getSourceProposalTemplatePath();
  const destination = destPath ?? getBundledProposalTemplatePath();

  if (!fs.existsSync(source)) {
    throw new Error(
      `Proposal template source not found at ${source}. Place "${DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME}" in the repo root.`
    );
  }

  const zip = new PizZip(fs.readFileSync(source));
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('Invalid proposal template: missing word/document.xml');
  }

  const preparedXml = injectPlaceholders(documentFile.asText());
  zip.file('word/document.xml', preparedXml);

  const out = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  const buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
  return buffer;
}

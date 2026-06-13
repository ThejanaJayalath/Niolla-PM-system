import fs from 'fs';
import {
  bundledProposalTemplateExists,
  DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME,
  getBundledProposalTemplatePath,
  getSourceProposalTemplatePath,
} from './proposalTemplatePaths';
import { prepareBundledProposalTemplate } from './prepareProposalTemplate';

export interface ResolvedProposalTemplate {
  buffer: Buffer;
  fileName: string;
  isDefault: boolean;
}

function loadDefaultTemplateBuffer(): Buffer {
  const sourcePath = getSourceProposalTemplatePath();
  const bundledPath = getBundledProposalTemplatePath();
  const sourceExists = fs.existsSync(sourcePath);
  const bundledExists = bundledProposalTemplateExists();

  if (sourceExists) {
    const sourceMtime = fs.statSync(sourcePath).mtimeMs;
    const bundledMtime = bundledExists ? fs.statSync(bundledPath).mtimeMs : 0;
    if (!bundledExists || sourceMtime > bundledMtime) {
      prepareBundledProposalTemplate();
    }
  } else if (!bundledExists) {
    throw new Error(
      `Proposal template not found. Place "${DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME}" in the repo root.`
    );
  }

  return fs.readFileSync(bundledPath);
}

/** Always uses Project proposal sample template.docx (repo root → bundled with placeholders). */
export async function resolveProposalTemplate(): Promise<ResolvedProposalTemplate> {
  return {
    buffer: loadDefaultTemplateBuffer(),
    fileName: DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME,
    isDefault: true,
  };
}

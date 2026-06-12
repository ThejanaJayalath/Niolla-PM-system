import fs from 'fs';
import path from 'path';

export const DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME = 'Project proposal sample template.docx';

/** Repo-root source (designer handoff). */
export function getSourceProposalTemplatePath(): string {
  return path.resolve(process.cwd(), '..', DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME);
}

/** Bundled default used at runtime (with placeholders injected). */
export function getBundledProposalTemplatePath(): string {
  return path.join(getAssetsDir(), DEFAULT_PROPOSAL_TEMPLATE_FILE_NAME);
}

export function getAssetsDir(): string {
  return path.join(process.cwd(), 'assets');
}

export function bundledProposalTemplateExists(): boolean {
  try {
    return fs.existsSync(getBundledProposalTemplatePath());
  } catch {
    return false;
  }
}

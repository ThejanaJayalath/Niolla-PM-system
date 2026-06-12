import fs from 'fs';
import path from 'path';
import { Proposal } from '../../domain/entities/Proposal';
import { ProposalModel } from '../../infrastructure/database/models/ProposalModel';
import { buildProposalDocx } from '../../infrastructure/pdf/ProposalDocxBuilder';
import { assertValidDocxBuffer, fillProposalTemplate } from '../../infrastructure/pdf/ProposalDocxGenerator';
import { sanitizeDownloadFileName } from '../../infrastructure/pdf/textSanitize';
import { resolveProposalTemplate } from '../../infrastructure/pdf/resolveProposalTemplate';

export function getProposalsUploadDir(): string {
  return path.join(process.cwd(), 'uploads', 'proposals');
}

export interface GeneratedProposalDocument {
  buffer: Buffer;
  fileName: string;
  relativePath: string;
  usedTemplate: boolean;
}

export class ProposalDocumentService {
  deleteStoredFile(relativePath?: string | null): void {
    if (!relativePath?.trim()) return;
    const abs = path.join(process.cwd(), relativePath);
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (err) {
      console.warn('Could not delete proposal document:', relativePath, (err as Error).message);
    }
  }

  private slug(value: string): string {
    return sanitizeDownloadFileName(
      value.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60),
      'proposal'
    ).replace(/\.docx$/i, '');
  }

  /** Fill sample Word template with docxtemplater and persist under uploads/proposals/. */
  async generateAndSave(proposalId: string): Promise<Proposal> {
    const doc = await ProposalModel.findById(proposalId);
    if (!doc) throw new Error('Proposal not found');

    const proposal = doc.toObject() as unknown as Proposal;
    const generated = await this.buildDocument(proposal);

    const dir = getProposalsUploadDir();
    fs.mkdirSync(dir, { recursive: true });

    const baseName = `${this.slug(proposal.projectName || proposal.customerName)}-${proposalId}`;
    const fileName = sanitizeDownloadFileName(`${baseName}.docx`);
    const relativePath = `uploads/proposals/${fileName}`;
    const absPath = path.join(getProposalsUploadDir(), fileName);

    assertValidDocxBuffer(generated.buffer);
    this.deleteStoredFile(doc.documentPath);
    fs.writeFileSync(absPath, generated.buffer);

    doc.documentPath = relativePath;
    doc.documentFileName = fileName;
    doc.documentGeneratedAt = new Date();
    await doc.save();

    return doc.toObject() as unknown as Proposal;
  }

  async buildDocument(proposal: Proposal): Promise<GeneratedProposalDocument> {
    const resolvedTemplate = await resolveProposalTemplate();
    let buffer: Buffer;
    let usedTemplate = true;

    try {
      buffer = fillProposalTemplate(resolvedTemplate.buffer, proposal);
    } catch (err) {
      console.warn('Template fill failed, using built docx:', (err as Error).message);
      buffer = await buildProposalDocx(proposal);
      usedTemplate = false;
    }

    const safeName = this.slug(proposal.projectName || proposal.customerName || 'proposal');
    return {
      buffer,
      fileName: `proposal-${safeName}.docx`,
      relativePath: '',
      usedTemplate,
    };
  }

  /** Returns stored Word file, regenerating from template when missing or stale. */
  async getDocumentForDownload(proposal: Proposal): Promise<GeneratedProposalDocument> {
    if (proposal.documentPath) {
      const abs = path.join(process.cwd(), proposal.documentPath);
      if (fs.existsSync(abs)) {
        return {
          buffer: fs.readFileSync(abs),
          fileName: proposal.documentFileName || path.basename(proposal.documentPath),
          relativePath: proposal.documentPath,
          usedTemplate: true,
        };
      }
    }

    if (!proposal._id) {
      return this.buildDocument(proposal);
    }

    const saved = await this.generateAndSave(String(proposal._id));
    const relativePath = saved.documentPath!;
    return {
      buffer: fs.readFileSync(path.join(process.cwd(), relativePath)),
      fileName: saved.documentFileName || path.basename(relativePath),
      relativePath,
      usedTemplate: true,
    };
  }
}

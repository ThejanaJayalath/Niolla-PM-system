import { promisify } from 'util';

/**
 * Converts a DOCX buffer to PDF using LibreOffice (must be installed on the system).
 * Returns null if conversion fails (e.g. LibreOffice not available, as on Vercel).
 */
let convertAsync: ((buffer: Buffer, ext: string, filter: undefined) => Promise<Buffer>) | null = null;

try {
  const libre = require('libreoffice-convert');
  convertAsync = promisify(libre.convert) as (buffer: Buffer, ext: string, filter: undefined) => Promise<Buffer>;
} catch {
  // libreoffice-convert not installed
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer | null> {
  if (!convertAsync) return null;
  try {
    const out = await convertAsync(docxBuffer, '.pdf', undefined);
    return Buffer.isBuffer(out) ? out : Buffer.from(out as unknown as ArrayBuffer);
  } catch {
    return null;
  }
}

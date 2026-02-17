import { promisify } from 'util';

/**
 * Converts a DOCX buffer to PDF using LibreOffice (must be installed on the system).
 * Returns null if conversion fails. Set LIBREOFFICE_PATH to soffice.exe path if auto-detect fails (e.g. Windows).
 */
type ConvertWithOptions = (
  document: Buffer,
  format: string,
  filter: undefined,
  options: { sofficeBinaryPaths?: string[]; fileName?: string },
  callback: (err: Error | null, data: Buffer) => void
) => void;

let convertWithOptionsAsync: ((
  document: Buffer,
  format: string,
  filter: undefined,
  options: { sofficeBinaryPaths?: string[]; fileName?: string }
) => Promise<Buffer>) | null = null;

try {
  const libre = require('libreoffice-convert');
  const convertWithOptions = libre.convertWithOptions as ConvertWithOptions;
  convertWithOptionsAsync = promisify(convertWithOptions);
} catch {
  // libreoffice-convert not installed
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer | null> {
  if (!convertWithOptionsAsync) return null;
  const paths: string[] = [];
  const customPath = process.env.LIBREOFFICE_PATH || process.env.LIBRE_OFFICE_EXE;
  if (customPath && customPath.trim()) paths.push(customPath.trim());
  try {
    const out = await convertWithOptionsAsync(docxBuffer, '.pdf', undefined, {
      sofficeBinaryPaths: paths.length ? paths : undefined,
      fileName: 'document.docx',
    });
    return Buffer.isBuffer(out) ? out : Buffer.from(out as unknown as ArrayBuffer);
  } catch (err) {
    console.warn('LibreOffice conversion failed (install LibreOffice for PDF that matches your template):', (err as Error)?.message ?? err);
    return null;
  }
}

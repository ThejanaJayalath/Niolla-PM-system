import fs from 'fs';
import path from 'path';

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

const WINDOWS_SOFFICE_PATHS = [
  process.env.LIBREOFFICE_PATH,
  process.env.LIBRE_OFFICE_EXE,
  path.join(process.env['PROGRAMFILES(X86)'] || '', 'LibreOffice', 'program', 'soffice.exe'),
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.exe'),
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
].filter((p): p is string => !!p?.trim());

let convertWithOptions: ConvertWithOptions | null = null;
let warnedMissingLibreOffice = false;

try {
  const libre = require('libreoffice-convert');
  convertWithOptions = libre.convertWithOptions as ConvertWithOptions;
} catch {
  // libreoffice-convert not installed
}

function resolveSofficePaths(): string[] {
  const found: string[] = [];
  for (const candidate of WINDOWS_SOFFICE_PATHS) {
    const trimmed = candidate.trim();
    if (trimmed && fs.existsSync(trimmed) && !found.includes(trimmed)) {
      found.push(trimmed);
    }
  }
  return found;
}

function convertAsync(
  document: Buffer,
  format: string,
  options: { sofficeBinaryPaths?: string[]; fileName?: string }
): Promise<Buffer> {
  if (!convertWithOptions) {
    return Promise.reject(new Error('libreoffice-convert is not available'));
  }
  return new Promise((resolve, reject) => {
    convertWithOptions!(document, format, undefined, options, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

export function isLibreOfficeAvailable(): boolean {
  return resolveSofficePaths().length > 0;
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer | null> {
  if (!convertWithOptions) return null;

  const sofficePaths = resolveSofficePaths();
  if (sofficePaths.length === 0) {
    if (!warnedMissingLibreOffice) {
      warnedMissingLibreOffice = true;
      console.warn(
        'LibreOffice not installed — proposal downloads will be Word (.docx). ' +
          'Install from https://www.libreoffice.org/download/ then set LIBREOFFICE_PATH in backend/.env'
      );
    }
    return null;
  }

  try {
    const out = await convertAsync(docxBuffer, '.pdf', {
      sofficeBinaryPaths: sofficePaths,
      fileName: 'document.docx',
    });
    return Buffer.isBuffer(out) ? out : Buffer.from(out as unknown as ArrayBuffer);
  } catch (err) {
    console.warn(
      'LibreOffice conversion failed:',
      (err as Error)?.message ?? err
    );
    return null;
  }
}

/** Strip characters that break HTTP response headers. */
export function sanitizeHttpHeaderValue(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

/**
 * pdf-lib StandardFonts use WinAnsi encoding — replace unsupported Unicode.
 */
export function sanitizePdfText(value: string): string {
  return value
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

/** Safe attachment name for Content-Disposition (no path separators). */
export function sanitizeDownloadFileName(value: string, fallback = 'proposal.docx'): string {
  const base = value
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
  return base || fallback;
}

/** Normalize text inserted into Word templates. */
export function sanitizeDocxText(value: string): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014]/g, '-');
}

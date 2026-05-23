import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/** WhatsApp only accepts raster images (not SVG). */
export async function ensurePngForWhatsApp(
  absolutePath: string,
  mimeType: string
): Promise<{ absolutePath: string; mimeType: 'image/png' }> {
  if (mimeType === 'image/png') {
    return { absolutePath, mimeType: 'image/png' };
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    const pngPath = absolutePath.replace(/\.(jpe?g)$/i, '') + '-wa.png';
    if (!fs.existsSync(pngPath) || fs.statSync(pngPath).mtime < fs.statSync(absolutePath).mtime) {
      await sharp(absolutePath).png().toFile(pngPath);
    }
    return { absolutePath: pngPath, mimeType: 'image/png' };
  }
  if (mimeType === 'image/svg+xml') {
    const pngPath = absolutePath.replace(/\.svg$/i, '') + '-wa.png';
    if (!fs.existsSync(pngPath) || fs.statSync(pngPath).mtime < fs.statSync(absolutePath).mtime) {
      await sharp(absolutePath).png({ quality: 90 }).toFile(pngPath);
    }
    return { absolutePath: pngPath, mimeType: 'image/png' };
  }
  throw new Error(`Unsupported card type for WhatsApp: ${mimeType}`);
}

export function publicApiBaseUrl(): string | null {
  const explicit = process.env.PUBLIC_API_BASE_URL?.trim();
  if (!explicit) return null;
  return explicit.replace(/\/$/, '');
}

export function cardImagePath(cardId: string, forWhatsApp = false): string {
  const suffix = forWhatsApp ? '?format=png' : '';
  return `/api/v1/birthdays/cards/${cardId}/image${suffix}`;
}

/** Absolute URL for Twilio MediaUrl (must be publicly reachable). */
export function cardImageUrl(cardId: string, forWhatsApp = false): string {
  const base = publicApiBaseUrl() || `http://localhost:${process.env.PORT || '5000'}`;
  return `${base}${cardImagePath(cardId, forWhatsApp)}`;
}

export async function streamCardImage(
  absolutePath: string,
  mimeType: string,
  format?: string
): Promise<{ stream: fs.ReadStream; mimeType: string }> {
  if (format === 'png' && mimeType === 'image/svg+xml') {
    const { absolutePath: pngPath } = await ensurePngForWhatsApp(absolutePath, mimeType);
    return { stream: fs.createReadStream(pngPath), mimeType: 'image/png' };
  }
  return { stream: fs.createReadStream(absolutePath), mimeType };
}

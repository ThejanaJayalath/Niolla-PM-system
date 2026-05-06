import crypto from 'crypto';

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return (
    process.env.INVOICE_PUBLIC_LINK_SECRET ||
    process.env.JWT_SECRET ||
    'dev-secret-change-in-production'
  );
}

export function signInvoicePdfLink(invoiceId: string, ttlSec: number = DEFAULT_TTL_SEC): { exp: number; token: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${invoiceId}:${exp}`;
  const token = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return { exp, token };
}

export function verifyInvoicePdfLink(invoiceId: string, exp: number, token: string): boolean {
  if (!invoiceId || !token || !Number.isFinite(exp) || exp <= 0) return false;
  const payload = `${invoiceId}:${exp}`;
  const expected = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function isInvoicePdfLinkExpired(exp: number): boolean {
  return Math.floor(Date.now() / 1000) > exp;
}

/**
 * Base URL of the API as reachable by customers (for links in SMS/email).
 * Set PUBLIC_API_BASE_URL in production (e.g. https://your-api.example.com).
 */
export function getPublicApiBaseUrl(): string {
  const explicit = process.env.PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, '');
    return `https://${host}`;
  }
  const port = process.env.PORT || '4000';
  return `http://localhost:${port}`;
}

export function buildInvoicePdfPublicUrl(invoiceId: string, baseUrl?: string): string {
  const base = (baseUrl || getPublicApiBaseUrl()).replace(/\/$/, '');
  const { exp, token } = signInvoicePdfLink(invoiceId);
  return `${base}/api/v1/public/invoices/${invoiceId}/pdf?exp=${exp}&sig=${encodeURIComponent(token)}`;
}

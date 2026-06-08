export interface PromotionalBlastCounts {
  sent: number;
  manual: number;
  failed: number;
  skipped: number;
}

export function formatPromotionalBlastToast(b: PromotionalBlastCounts): {
  message: string;
  variant: 'success' | 'warning' | 'error';
} {
  const parts: string[] = [];
  if (b.sent > 0) parts.push(`${b.sent} auto-sent`);
  if (b.manual > 0) {
    parts.push(
      `${b.manual} WhatsApp link only (set TWILIO_* in backend/.env to auto-send; otherwise open each prospect in WhatsApp yourself)`
    );
  }
  if (b.skipped > 0) parts.push(`${b.skipped} skipped`);
  if (b.failed > 0) parts.push(`${b.failed} failed`);

  const message =
    parts.length > 0
      ? `Promotional blast: ${parts.join('; ')}.`
      : 'Promotional blast: no eligible prospects (open inquiries only, excluding Lost/Confirmed).';

  let variant: 'success' | 'warning' | 'error' = 'success';
  if (b.failed > 0 || (b.sent === 0 && b.manual === 0 && b.skipped > 0)) variant = 'warning';
  if (b.sent === 0 && b.manual === 0 && b.failed > 0) variant = 'error';
  if (b.manual > 0 && b.sent === 0) variant = 'warning';

  return { message, variant };
}

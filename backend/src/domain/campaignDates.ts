/** Parse YYYY-MM-DD (or ISO prefix) as local calendar date — avoids UTC day shift. */
export function parseCalendarDate(dateStr: string): Date {
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    return new Date(y, m, d);
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date');
  return parsed;
}

export function startOfCalendarDay(dateStr: string | Date): Date {
  const d = typeof dateStr === 'string' ? parseCalendarDate(dateStr) : new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfCalendarDay(dateStr: string | Date): Date {
  const d = typeof dateStr === 'string' ? parseCalendarDate(dateStr) : new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatCalendarDateEnGb(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function campaignPeriodLabel(start: Date, end: Date): string {
  const days =
    Math.round((endOfCalendarDay(end).getTime() - startOfCalendarDay(start).getTime()) / 86400000) + 1;
  const range = `${formatCalendarDateEnGb(start)} – ${formatCalendarDateEnGb(end)}`;
  return days > 0 ? `${range} (${days} day${days === 1 ? '' : 's'})` : range;
}

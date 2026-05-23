import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type DatePreset = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ReportDateRange {
  from: string;
  to: string;
  label: string;
}

export function buildDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
  ref: Date = new Date()
): ReportDateRange {
  if (preset === 'custom' && customFrom && customTo) {
    const from = startOfDay(new Date(customFrom));
    const to = endOfDay(new Date(customTo));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return buildDateRange('monthly', undefined, undefined, ref);
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `${format(from, 'dd MMM yyyy')} – ${format(to, 'dd MMM yyyy')}`,
    };
  }
  if (preset === 'daily') {
    const from = startOfDay(ref);
    const to = endOfDay(ref);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: format(ref, 'dd MMM yyyy'),
    };
  }
  if (preset === 'weekly') {
    const from = startOfWeek(ref, { weekStartsOn: 1 });
    const to = endOfWeek(ref, { weekStartsOn: 1 });
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: `Week of ${format(from, 'dd MMM yyyy')}`,
    };
  }
  const from = startOfMonth(ref);
  const to = endOfMonth(ref);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: format(ref, 'MMMM yyyy'),
  };
}

export function rangeQueryString(range: ReportDateRange): string {
  return `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

export function rangeFileSlug(range: ReportDateRange): string {
  return range.label.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'report';
}

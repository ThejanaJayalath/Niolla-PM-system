/** Canonical P&L formula for reporting module. */
export const PROFIT_FORMULA_LABEL = 'Income − (Marketing + Payouts + Overheads)';

export interface ProfitExpenseBreakdown {
  marketing: number;
  payouts: number;
  overheads: number;
}

export function calcNetProfit(income: number, expenses: ProfitExpenseBreakdown): number {
  return income - (expenses.marketing + expenses.payouts + expenses.overheads);
}

export function expenseBucketFromCategory(category: string): keyof ProfitExpenseBreakdown {
  const c = category.toLowerCase();
  if (c.includes('marketing')) return 'marketing';
  if (c.includes('salar') || c.includes('payout')) return 'payouts';
  return 'overheads';
}

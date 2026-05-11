/** Invoice-derived income category for financial reporting (English product copy). */
export const INCOME_INVOICE_TYPES = ['ADVANCE_PAYMENT', 'MONTHLY_INSTALLMENT', 'BALANCE_PAYMENT'] as const;
export type IncomeInvoiceType = (typeof INCOME_INVOICE_TYPES)[number];

export function isIncomeInvoiceType(v: string | undefined): v is IncomeInvoiceType {
  return !!v && (INCOME_INVOICE_TYPES as readonly string[]).includes(v);
}

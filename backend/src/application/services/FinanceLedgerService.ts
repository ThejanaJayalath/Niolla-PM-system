import { MasterLedgerService } from './MasterLedgerService';

export type FinanceLedgerKind = 'income' | 'expense';

export interface FinanceLedgerRow {
  _id: string;
  kind: FinanceLedgerKind;
  date: string;
  amount: number;
  description: string;
  categoryLabel: string;
  referenceId: string;
  referenceType: 'invoice' | 'expense';
  clientName?: string;
  invoiceNumber?: string;
  invoiceType?: string;
  expenseCategory?: string;
  expenseSource?: 'manual' | 'automated';
}

export interface FinanceLedgerResult {
  rows: FinanceLedgerRow[];
  sumIncome: number;
  sumExpense: number;
  /** SUM(Income) − SUM(Expense) for the selected period (or all time if no range). */
  currentBalance: number;
  from?: string;
  to?: string;
}

const masterLedgerService = new MasterLedgerService();

/** Self-accounting master ledger — all reads go through persisted ledger entries. */
export class FinanceLedgerService {
  async getLedger(filters?: {
    from?: string;
    to?: string;
    kind?: 'all' | FinanceLedgerKind;
  }): Promise<FinanceLedgerResult> {
    return masterLedgerService.getLedger(filters);
  }
}

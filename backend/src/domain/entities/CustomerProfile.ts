/** Per-client 360° profile — aggregated from projects, invoices, and engagement tables. */

export interface CustomerProjectHistoryRow {
  projectId: string;
  projectName: string;
  productName?: string;
  productCode?: string;
  systemType?: string;
  status: string;
  totalValue: number;
  startDate?: string;
  endDate?: string;
}

export interface CustomerFinancialSummary {
  /** Sum of project contract values — customer lifetime value (deal face value). */
  totalRevenue: number;
  /** Cash collected (payment transactions + paid invoices without duplicate txn). */
  paidAmount: number;
  /** Remaining installment balances on active payment plans. */
  outstandingBalance: number;
  /** Sum of net profit across all client projects (value − payouts − expenses). */
  totalProfit: number;
  /** Paid invoice total (accounting cross-check). */
  paidInvoiceTotal: number;
  pendingInvoiceTotal: number;
}

export interface CustomerListSummary {
  servicesPurchased: string[];
  projectCount: number;
  totalRevenue: number;
  paidAmount: number;
  totalProfit: number;
}

export interface CustomerEngagementSummary {
  proposalsSent: number;
  meetingsHeld: number;
  birthdayCardsSent: number;
  callsLogged: number;
  interactionsTotal: number;
}

export interface CustomerStaffActivityEntry {
  id: string;
  occurredAt: string;
  staffName: string;
  action: string;
  summary: string;
  projectId?: string;
  projectName?: string;
}

export interface CustomerProfile360 {
  clientId: string;
  clientName: string;
  customerId: string;
  servicesPurchased: string[];
  projectHistory: CustomerProjectHistoryRow[];
  financialSummary: CustomerFinancialSummary;
  engagement: CustomerEngagementSummary;
  activityLog: CustomerStaffActivityEntry[];
}

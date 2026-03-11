export interface PaymentPlan {
  _id?: string;
  projectId: string;
  downPaymentPct: number;
  downPaymentAmt: number;
  totalInstallments: number;
  installmentAmt: number;
  remainingBalance: number;
  serviceFeePct: number;
  serviceFeeAmt: number;
  planStartDate?: Date;
  status: 'active' | 'completed' | 'defaulted';
  createdAt?: Date;
  updatedAt?: Date;
}

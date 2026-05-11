export type PaymentPlanKind = 'primary' | 'addon';

export interface PaymentPlan {
  _id?: string;
  projectId: string;
  /** Primary deal vs add-on scope (e.g. customer requirement). */
  planKind?: PaymentPlanKind;
  linkedRequirementId?: string;
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

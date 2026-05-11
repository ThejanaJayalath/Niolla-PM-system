export interface Installment {
  _id?: string;
  planId: string;
  /** Present when populated from payment plan (main contract vs value-added add-on). */
  planKind?: 'primary' | 'addon';
  /** Populated when plan → project is joined (filter installments by project). */
  projectId?: string;
  projectName?: string;
  installmentNo: number;
  dueDate: Date;
  dueAmount: number;
  paidAmount?: number;
  paidDate?: Date;
  partialPaid?: number;
  status: 'pending' | 'paid' | 'partial' | 'overdue';
  overdueDays?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

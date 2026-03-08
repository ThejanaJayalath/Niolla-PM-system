export interface Installment {
  _id?: string;
  planId: string;
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

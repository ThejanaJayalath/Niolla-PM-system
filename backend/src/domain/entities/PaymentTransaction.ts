export interface PaymentTransaction {
  _id?: string;
  installmentId: string;
  clientId: string;
  /** Resolved from installment → plan → project (list responses). */
  projectId?: string;
  projectName?: string;
  planKind?: 'primary' | 'addon';
  installmentNo?: number;
  gatewayId?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'card' | 'online';
  referenceNo?: string;
  paymentDate: Date;
  recordedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  clientName?: string;
  recordedByName?: string;
}

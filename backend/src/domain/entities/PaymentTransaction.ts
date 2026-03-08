export interface PaymentTransaction {
  _id?: string;
  installmentId: string;
  clientId: string;
  gatewayId?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'card' | 'online';
  referenceNo?: string;
  paymentDate: Date;
  recordedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentPlanTemplate {
    _id?: string;
    name: string;
    description?: string;
    downPaymentPct: number;
    installmentsCount: number;
    installmentPct: number;
    status: 'active' | 'inactive';
    createdAt?: Date;
    updatedAt?: Date;
}

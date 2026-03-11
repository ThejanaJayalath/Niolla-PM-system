export interface PaymentPlanTemplate {
    _id?: string;
    name: string;
    description?: string;
    downPaymentPct: number;
    installmentsCount: number;
    serviceFeePct: number;
    status: 'active' | 'inactive';
    createdAt?: Date;
    updatedAt?: Date;
}

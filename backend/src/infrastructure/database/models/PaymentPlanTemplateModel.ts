import mongoose, { Schema, Document } from 'mongoose';

export interface PaymentPlanTemplateDocument extends Document {
    name: string;
    description?: string;
    downPaymentPct: number;
    installmentsCount: number;
    installmentPct: number;
    status: 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
}

const templateSchema = new Schema<PaymentPlanTemplateDocument>(
    {
        name: { type: String, required: true },
        description: { type: String },
        downPaymentPct: { type: Number, required: true },
        installmentsCount: { type: Number, required: true },
        installmentPct: { type: Number, required: true },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    },
    { timestamps: true }
);

export const PaymentPlanTemplateModel = mongoose.model<PaymentPlanTemplateDocument>('PaymentPlanTemplate', templateSchema);

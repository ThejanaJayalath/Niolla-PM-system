import mongoose, { Schema, Document } from 'mongoose';

export interface BillingTemplateDocument extends Document {
  fileName: string;
  templateDocx: Buffer;
  uploadedAt: Date;
}

const billingTemplateSchema = new Schema<BillingTemplateDocument>(
  {
    fileName: { type: String, required: true },
    templateDocx: { type: Buffer, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { collection: 'billingtemplates' }
);

export const BillingTemplateModel = mongoose.model<BillingTemplateDocument>(
  'BillingTemplate',
  billingTemplateSchema
);

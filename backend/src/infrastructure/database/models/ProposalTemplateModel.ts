import mongoose, { Schema, Document } from 'mongoose';

export interface ProposalTemplateDocument extends Document {
  fileName: string;
  templateDocx: Buffer;
  uploadedAt: Date;
}

const proposalTemplateSchema = new Schema<ProposalTemplateDocument>(
  {
    fileName: { type: String, required: true },
    templateDocx: { type: Buffer, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { collection: 'proposaltemplates' }
);

// Single global template: use findOne without filter or store one doc with fixed _id
export const ProposalTemplateModel = mongoose.model<ProposalTemplateDocument>(
  'ProposalTemplate',
  proposalTemplateSchema
);

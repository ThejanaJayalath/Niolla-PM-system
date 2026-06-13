import mongoose, { Schema, Document } from 'mongoose';
import { GreetingTemplateType } from '../../../domain/entities/GreetingCardTemplate';

export interface GreetingCardTemplateDocument extends Document {
  templateType: GreetingTemplateType;
  festivalKey?: string;
  fileName: string;
  mimeType: string;
  storedFileName: string;
  uploadedAt: Date;
  uploadedBy?: mongoose.Types.ObjectId;
}

const greetingCardTemplateSchema = new Schema<GreetingCardTemplateDocument>(
  {
    templateType: {
      type: String,
      enum: ['birthday', 'anniversary', 'festival'],
      required: true,
    },
    festivalKey: { type: String, trim: true, index: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    storedFileName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: 'greetingcardtemplates' }
);

greetingCardTemplateSchema.index(
  { templateType: 1, festivalKey: 1 },
  { unique: true, partialFilterExpression: { templateType: 'festival', festivalKey: { $exists: true, $type: 'string' } } }
);
greetingCardTemplateSchema.index(
  { templateType: 1 },
  { unique: true, partialFilterExpression: { templateType: { $in: ['birthday', 'anniversary'] } } }
);

export const GreetingCardTemplateModel = mongoose.model<GreetingCardTemplateDocument>(
  'GreetingCardTemplate',
  greetingCardTemplateSchema
);

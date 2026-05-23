import mongoose, { Schema, Document } from 'mongoose';
import { BirthdaySubjectType } from '../../../domain/entities/BirthdayCard';
import { GreetingCampaignType } from '../../birthday/BirthdayCardGenerator';

export interface BirthdayCardDocument extends Document {
  campaignType: GreetingCampaignType;
  subjectType: BirthdaySubjectType;
  subjectId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  festivalKey?: string;
  personName: string;
  fileName: string;
  mimeType: string;
  greetingMessage: string;
  aiGenerated: boolean;
  sentAt?: Date;
  sentChannel?: 'email' | 'whatsapp';
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const birthdayCardSchema = new Schema<BirthdayCardDocument>(
  {
    campaignType: {
      type: String,
      enum: ['birthday', 'anniversary', 'festival'],
      default: 'birthday',
      index: true,
    },
    subjectType: { type: String, enum: ['customer', 'employee', 'inquiry'], required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    festivalKey: { type: String, trim: true },
    personName: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    greetingMessage: { type: String, required: true },
    aiGenerated: { type: Boolean, default: false },
    sentAt: { type: Date },
    sentChannel: { type: String, enum: ['email', 'whatsapp'] },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);

birthdayCardSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });

export const BirthdayCardModel = mongoose.model<BirthdayCardDocument>('BirthdayCard', birthdayCardSchema);

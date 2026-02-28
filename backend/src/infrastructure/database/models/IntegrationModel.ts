import mongoose, { Schema, Document } from 'mongoose';

export interface IntegrationDocument extends Document {
  key: string;
  refreshToken: string;
  updatedAt: Date;
}

const integrationSchema = new Schema<IntegrationDocument>(
  {
    key: { type: String, required: true, unique: true },
    refreshToken: { type: String, required: true },
  },
  { timestamps: true }
);

export const IntegrationModel = mongoose.model<IntegrationDocument>('Integration', integrationSchema);

export const GOOGLE_CALENDAR_KEY = 'google_calendar';

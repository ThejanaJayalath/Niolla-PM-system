import mongoose, { Schema, Document } from 'mongoose';
import { InteractionType, CallDirection, CallOutcome } from '../../../domain/entities/Interaction';

interface CallMetaDocument {
  direction?: CallDirection;
  durationSec?: number;
  outcome?: CallOutcome;
  nextFollowUpAt?: Date;
}

export interface InteractionDocument extends Document {
  customerRef: mongoose.Types.ObjectId;
  inquiryRef?: mongoose.Types.ObjectId;
  type: InteractionType;
  summary: string;
  details?: string;
  occurredAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  callMeta?: CallMetaDocument;
  createdAt: Date;
  updatedAt: Date;
}

const interactionSchema = new Schema<InteractionDocument>(
  {
    customerRef: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    inquiryRef: { type: Schema.Types.ObjectId, ref: 'Inquiry', index: true },
    type: {
      type: String,
      enum: ['CALL', 'MEETING', 'NOTE', 'STATUS_CHANGE', 'REQUIREMENT_UPDATE'],
      required: true,
      index: true,
    },
    summary: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    occurredAt: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    callMeta: {
      direction: { type: String, enum: ['INBOUND', 'OUTBOUND'] },
      durationSec: { type: Number, min: 0 },
      outcome: { type: String, enum: ['ANSWERED', 'NO_ANSWER', 'VOICEMAIL', 'FOLLOW_UP_REQUIRED', 'CLOSED'] },
      nextFollowUpAt: { type: Date },
    },
  },
  { timestamps: true }
);

interactionSchema.index({ customerRef: 1, occurredAt: -1 });
interactionSchema.index({ customerRef: 1, type: 1, occurredAt: -1 });

export const InteractionModel = mongoose.model<InteractionDocument>('Interaction', interactionSchema);

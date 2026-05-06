import { Schema, model } from 'mongoose';

export interface SequenceDocument {
  _id: string;
  seq: number;
}

const sequenceSchema = new Schema<SequenceDocument>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { versionKey: false }
);

export const SequenceModel = model<SequenceDocument>('Sequence', sequenceSchema);

import { Interaction, InteractionType, CallMeta } from '../../domain/entities/Interaction';
import { InteractionModel } from '../../infrastructure/database/models/InteractionModel';

export interface CreateInteractionInput {
  customerRef: string;
  inquiryRef?: string;
  type: InteractionType;
  summary: string;
  details?: string;
  occurredAt?: Date;
  createdBy?: string;
  callMeta?: CallMeta;
}

export interface UpdateInteractionInput {
  summary?: string;
  details?: string;
  occurredAt?: Date;
  callMeta?: CallMeta;
}

export class InteractionService {
  async create(data: CreateInteractionInput): Promise<Interaction> {
    const doc = await InteractionModel.create({
      ...data,
      occurredAt: data.occurredAt || new Date(),
    });
    return this.toInteraction(doc.toObject());
  }

  async findById(id: string): Promise<Interaction | null> {
    const doc = await InteractionModel.findById(id);
    return doc ? this.toInteraction(doc.toObject()) : null;
  }

  async findByCustomer(customerId: string, type?: InteractionType): Promise<Interaction[]> {
    const query: Record<string, unknown> = { customerRef: customerId };
    if (type) query.type = type;
    const docs = await InteractionModel.find(query).sort({ occurredAt: -1, createdAt: -1 });
    return docs.map((doc) => this.toInteraction(doc.toObject()));
  }

  async update(id: string, data: UpdateInteractionInput): Promise<Interaction | null> {
    const doc = await InteractionModel.findById(id);
    if (!doc) return null;
    if (data.summary !== undefined) doc.summary = data.summary;
    if (data.details !== undefined) doc.details = data.details;
    if (data.occurredAt !== undefined) doc.occurredAt = data.occurredAt;
    if (data.callMeta !== undefined) {
      doc.set('callMeta', data.callMeta);
    }
    await doc.save();
    return this.toInteraction(doc.toObject());
  }

  async delete(id: string): Promise<boolean> {
    const res = await InteractionModel.findByIdAndDelete(id);
    return !!res;
  }

  private toInteraction(o: any): Interaction {
    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      customerRef: (o.customerRef as { toString: () => string })?.toString?.() || String(o.customerRef),
      inquiryRef: o.inquiryRef ? (o.inquiryRef as { toString: () => string })?.toString?.() : undefined,
      type: o.type as InteractionType,
      summary: o.summary as string,
      details: o.details as string | undefined,
      occurredAt: o.occurredAt as Date,
      createdBy: o.createdBy ? (o.createdBy as { toString: () => string })?.toString?.() : undefined,
      callMeta: o.callMeta as CallMeta | undefined,
      createdAt: o.createdAt as Date | undefined,
      updatedAt: o.updatedAt as Date | undefined,
    };
  }
}

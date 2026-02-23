import { Reminder } from '../../domain/entities/Reminder';
import { ReminderModel } from '../../infrastructure/database/models/ReminderModel';

export interface CreateReminderInput {
  inquiryId?: string;
  customerName?: string;
  type: 'reminder' | 'meeting';
  title: string;
  description?: string;
  meetingLink?: string;
  googleEventId?: string;
  scheduledAt: Date;
  notes?: string;
  status?: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
}

export interface UpdateReminderInput {
  customerName?: string;
  title?: string;
  description?: string;
  meetingLink?: string;
  scheduledAt?: Date;
  notes?: string;
  status?: 'schedule' | 'overdue' | 'done' | 'cancel' | 'postpone';
  completed?: boolean;
}

export class ReminderService {
  async create(data: CreateReminderInput): Promise<Reminder> {
    const doc = await ReminderModel.create(data);
    return doc.toObject() as unknown as Reminder;
  }

  async findById(id: string): Promise<Reminder | null> {
    const doc = await ReminderModel.findById(id);
    return doc ? (doc.toObject() as unknown as Reminder) : null;
  }

  async findByInquiryId(inquiryId: string): Promise<Reminder[]> {
    const docs = await ReminderModel.find({ inquiryId }).sort({ scheduledAt: 1 });
    return docs.map((d) => d.toObject() as unknown as Reminder);
  }

  async findUpcoming(limit = 20, type?: string): Promise<Reminder[]> {
    const query: any = {
      scheduledAt: { $gte: new Date() },
      completed: { $ne: true },
    };
    if (type) {
      query.type = type;
    }
    const docs = await ReminderModel.find(query)
      .sort({ scheduledAt: 1 })
      .limit(limit)
      .populate('inquiryId', 'customerName phoneNumber');
    return docs.map((d) => d.toObject() as unknown as Reminder);
  }

  /** List all reminders (optionally by type) from MongoDB, sorted by scheduledAt descending. */
  async findAll(limit = 100, type?: string): Promise<Reminder[]> {
    const query: any = {};
    if (type) {
      query.type = type;
    }
    const docs = await ReminderModel.find(query)
      .sort({ scheduledAt: -1 })
      .limit(limit)
      .populate('inquiryId', 'customerName phoneNumber');
    return docs.map((d) => d.toObject() as unknown as Reminder);
  }

  async update(id: string, data: UpdateReminderInput): Promise<Reminder | null> {
    const doc = await ReminderModel.findByIdAndUpdate(id, data, { new: true });
    return doc ? (doc.toObject() as unknown as Reminder) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ReminderModel.findByIdAndDelete(id);
    return !!result;
  }
}

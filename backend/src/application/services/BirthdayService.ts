import mongoose from 'mongoose';
import path from 'path';
import { BirthdayPerson, BirthdaySubjectType } from '../../domain/entities/BirthdayCard';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { BirthdayCardModel } from '../../infrastructure/database/models/BirthdayCardModel';
import {
  buildDefaultGreeting,
  writeBirthdayCardFile,
} from '../../infrastructure/birthday/BirthdayCardGenerator';
import { getBirthdayCardsDir } from '../../infrastructure/birthday/birthdayCardPaths';
import { EmailService } from '../../infrastructure/email/EmailService';
import { WhatsAppService } from '../../infrastructure/whatsapp/WhatsAppService';
import { PaymentNotificationService } from './PaymentNotificationService';

function todayMonthDaySuffix(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `-${mm}-${dd}`;
}

function dobMatchesToday(dateOfBirth?: string | null): boolean {
  if (!dateOfBirth?.trim()) return false;
  return dateOfBirth.trim().endsWith(todayMonthDaySuffix());
}

function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

export class BirthdayService {
  private emailService = new EmailService();
  private whatsAppService = new WhatsAppService();
  private paymentNotificationService = new PaymentNotificationService();

  async findTodayBirthdays(): Promise<BirthdayPerson[]> {
    const suffix = todayMonthDaySuffix();
    const dobRegex = new RegExp(`${suffix.replace(/-/g, '\\-')}$`);

    const [customers, employees, inquiries] = await Promise.all([
      CustomerModel.find({ dateOfBirth: dobRegex, status: { $ne: 'inactive' } })
        .select('name email phoneNumber dateOfBirth')
        .lean(),
      UserModel.find({ dateOfBirth: dobRegex, status: 'active' })
        .select('name email phone dateOfBirth role')
        .lean(),
      InquiryModel.find({ dateOfBirth: dobRegex, status: { $nin: ['LOST', 'CONFIRMED'] } })
        .select('customerName phoneNumber dateOfBirth')
        .lean(),
    ]);

    const people: BirthdayPerson[] = [];

    for (const c of customers) {
      const subjectId = (c._id as mongoose.Types.ObjectId).toString();
      const latest = await this.getLatestCardMeta('customer', subjectId);
      people.push({
        subjectType: 'customer',
        subjectId,
        name: c.name,
        email: c.email,
        phone: c.phoneNumber,
        roleLabel: 'Client',
        dateOfBirth: c.dateOfBirth as string,
        ...latest,
      });
    }

    for (const u of employees) {
      const subjectId = (u._id as mongoose.Types.ObjectId).toString();
      const latest = await this.getLatestCardMeta('employee', subjectId);
      const roleLabel = u.role === 'employee' ? 'Employee' : u.role === 'pm' ? 'PM' : 'Owner';
      people.push({
        subjectType: 'employee',
        subjectId,
        name: u.name,
        email: u.email,
        phone: u.phone,
        roleLabel,
        dateOfBirth: u.dateOfBirth as string,
        ...latest,
      });
    }

    for (const inq of inquiries) {
      const subjectId = (inq._id as mongoose.Types.ObjectId).toString();
      const latest = await this.getLatestCardMeta('inquiry', subjectId);
      people.push({
        subjectType: 'inquiry',
        subjectId,
        name: inq.customerName,
        phone: inq.phoneNumber,
        roleLabel: 'Prospect',
        dateOfBirth: inq.dateOfBirth as string,
        ...latest,
      });
    }

    return people.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async getLatestCardMeta(
    subjectType: BirthdaySubjectType,
    subjectId: string
  ): Promise<{
    latestCardId?: string;
    latestCardImageUrl?: string;
    lastSentAt?: string;
    lastSentChannel?: 'email' | 'whatsapp';
  }> {
    if (!mongoose.Types.ObjectId.isValid(subjectId)) return {};
    const card = await BirthdayCardModel.findOne({
      campaignType: 'birthday',
      subjectType,
      subjectId: new mongoose.Types.ObjectId(subjectId),
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!card) return {};
    const cardId = (card._id as mongoose.Types.ObjectId).toString();
    return {
      latestCardId: cardId,
      latestCardImageUrl: `${publicBaseUrl()}/api/v1/birthdays/cards/${cardId}/image`,
      lastSentAt: card.sentAt ? new Date(card.sentAt).toISOString() : undefined,
      lastSentChannel: card.sentChannel as 'email' | 'whatsapp' | undefined,
    };
  }

  private async recordCardSent(cardId: string, channel: 'email' | 'whatsapp'): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(cardId)) return;
    await BirthdayCardModel.findByIdAndUpdate(cardId, {
      sentAt: new Date(),
      sentChannel: channel,
    });
  }

  async resolveSubject(
    subjectType: BirthdaySubjectType,
    subjectId: string
  ): Promise<{ name: string; email?: string; phone?: string; roleLabel: string; dateOfBirth?: string }> {
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      throw new Error('Invalid subject id');
    }
    const oid = new mongoose.Types.ObjectId(subjectId);

    if (subjectType === 'customer') {
      const c = await CustomerModel.findById(oid).lean();
      if (!c) throw new Error('Customer not found');
      if (!dobMatchesToday(c.dateOfBirth)) {
        throw new Error('Birthday is not today for this customer');
      }
      return {
        name: c.name,
        email: c.email,
        phone: c.phoneNumber,
        roleLabel: 'Client',
        dateOfBirth: c.dateOfBirth,
      };
    }

    if (subjectType === 'employee') {
      const u = await UserModel.findById(oid).lean();
      if (!u) throw new Error('User not found');
      if (!dobMatchesToday(u.dateOfBirth)) {
        throw new Error('Birthday is not today for this user');
      }
      const roleLabel = u.role === 'employee' ? 'Employee' : u.role === 'pm' ? 'PM' : 'Owner';
      return {
        name: u.name,
        email: u.email,
        phone: u.phone,
        roleLabel,
        dateOfBirth: u.dateOfBirth,
      };
    }

    const inq = await InquiryModel.findById(oid).lean();
    if (!inq) throw new Error('Prospect not found');
    if (!dobMatchesToday(inq.dateOfBirth)) {
      throw new Error('Birthday is not today for this prospect');
    }
    return {
      name: inq.customerName,
      phone: inq.phoneNumber,
      roleLabel: 'Prospect',
      dateOfBirth: inq.dateOfBirth,
    };
  }

  async generateCard(
    subjectType: BirthdaySubjectType,
    subjectId: string,
    customGreeting?: string
  ): Promise<{
    cardId: string;
    imageUrl: string;
    greetingMessage: string;
    aiGenerated: boolean;
    mimeType: string;
  }> {
    const subject = await this.resolveSubject(subjectType, subjectId);
    const greetingMessage =
      customGreeting?.trim() || buildDefaultGreeting(subject.name, subject.roleLabel);

    const file = await writeBirthdayCardFile(subject.name);
    const doc = await BirthdayCardModel.create({
      campaignType: 'birthday',
      subjectType,
      subjectId: new mongoose.Types.ObjectId(subjectId),
      personName: subject.name,
      fileName: file.fileName,
      mimeType: file.mimeType,
      greetingMessage,
      aiGenerated: file.aiGenerated,
    });

    const cardId = (doc._id as mongoose.Types.ObjectId).toString();
    return {
      cardId,
      imageUrl: `${publicBaseUrl()}/api/v1/birthdays/cards/${cardId}/image`,
      greetingMessage,
      aiGenerated: file.aiGenerated,
      mimeType: file.mimeType,
    };
  }

  async getCardFile(cardId: string): Promise<{ absolutePath: string; mimeType: string } | null> {
    if (!mongoose.Types.ObjectId.isValid(cardId)) return null;
    const doc = await BirthdayCardModel.findById(cardId).lean();
    if (!doc) return null;
    const absolutePath = path.join(getBirthdayCardsDir(), doc.fileName);
    return { absolutePath, mimeType: doc.mimeType };
  }

  async sendCard(
    subjectType: BirthdaySubjectType,
    subjectId: string,
    channel: 'email' | 'whatsapp',
    options?: { cardId?: string; greetingMessage?: string }
  ): Promise<{
    sent: boolean;
    channel: string;
    whatsappDeepLink?: string;
    cardDownloadUrl?: string;
    message?: string;
  }> {
    const subject = await this.resolveSubject(subjectType, subjectId);
    let cardId = options?.cardId;
    let greetingMessage = options?.greetingMessage?.trim();

    if (!cardId) {
      const generated = await this.generateCard(subjectType, subjectId, greetingMessage);
      cardId = generated.cardId;
      greetingMessage = generated.greetingMessage;
    } else if (!greetingMessage) {
      const card = await BirthdayCardModel.findById(cardId).lean();
      greetingMessage = card?.greetingMessage || buildDefaultGreeting(subject.name, subject.roleLabel);
    }

    const file = await this.getCardFile(cardId!);
    if (!file) throw new Error('Birthday card not found. Generate a card first.');

    if (channel === 'email') {
      if (!subject.email?.trim()) throw new Error('No email address on file for this person');
      await this.emailService.send({
        to: subject.email.trim(),
        subject: `Happy Birthday from NIOLLA — ${subject.name}`,
        text: greetingMessage!,
        html: `<p>${greetingMessage!.replace(/\n/g, '<br/>')}</p>`,
        attachmentPath: file.absolutePath,
        attachmentName: `birthday-${subject.name.replace(/\s+/g, '-')}${path.extname(file.absolutePath)}`,
        attachmentMime: file.mimeType,
      });
      await this.recordCardSent(cardId!, 'email');
      return { sent: true, channel: 'email', message: `Email sent to ${subject.email}` };
    }

    if (!subject.phone?.trim()) throw new Error('No phone number on file for this person');

    const waMessage = `${greetingMessage}\n\n— NIOLLA`;
    const result = await this.whatsAppService.sendCardMessage({
      phone: subject.phone,
      message: waMessage,
      filePath: file.absolutePath,
      mimeType: file.mimeType,
      cardId: cardId!,
    });

    if (result.sent) {
      await this.recordCardSent(cardId!, 'whatsapp');
      return { sent: true, channel: 'whatsapp', message: 'WhatsApp message sent with card image' };
    }

    return {
      sent: false,
      channel: 'whatsapp',
      whatsappDeepLink: result.whatsappDeepLink,
      cardDownloadUrl: result.cardDownloadUrl,
      message:
        'Card downloaded — attach the image in WhatsApp. For automatic image delivery, set TWILIO_* (and PUBLIC_API_BASE_URL or Twilio MCS).',
    };
  }

  /** Daily 8 AM job: notify owners about today's birthdays. */
  async scanAndNotifyOwners(): Promise<{ birthdayCount: number; notificationsCreated: number }> {
    const people = await this.findTodayBirthdays();
    const owners = await UserModel.find({ role: 'owner', status: 'active' }).select('_id').lean();
    let notificationsCreated = 0;
    const names = people.map((p) => `${p.name} (${p.roleLabel})`).join(', ');

    for (const owner of owners) {
      const ownerId = (owner._id as mongoose.Types.ObjectId).toString();
      const messageBody =
        people.length === 0
          ? 'No customer or employee birthdays today.'
          : `Birthdays today (${people.length}): ${names}. Open the Dashboard to generate and send cards.`;

      await this.paymentNotificationService.create({
        userId: ownerId,
        type: 'system',
        triggerType: 'birthday',
        scheduledAt: new Date(),
        status: 'sent',
        messageBody,
      });
      notificationsCreated += 1;
    }

    return { birthdayCount: people.length, notificationsCreated };
  }
}

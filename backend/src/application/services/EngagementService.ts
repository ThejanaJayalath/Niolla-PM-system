import mongoose from 'mongoose';
import path from 'path';
import { AnniversaryTodayRow, EngagementOverview, EngagementStatRow, FestivalKey, FestivalProspectRow } from '../../domain/entities/Engagement';
import { BirthdaySubjectType } from '../../domain/entities/BirthdayCard';
import { BirthdayCardModel } from '../../infrastructure/database/models/BirthdayCardModel';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import {
  buildAnniversaryGreeting,
  buildAnniversaryTemplateSvg,
  buildFestivalGreeting,
  buildFestivalTemplateSvg,
  festivalLabel,
  writeGreetingCardFile,
} from '../../infrastructure/birthday/BirthdayCardGenerator';
import { getBirthdayCardsDir } from '../../infrastructure/birthday/birthdayCardPaths';
import { EmailService } from '../../infrastructure/email/EmailService';
import { WhatsAppService } from '../../infrastructure/whatsapp/WhatsAppService';
import { PaymentNotificationService } from './PaymentNotificationService';

const FESTIVAL_KEYS: FestivalKey[] = ['new_year', 'christmas', 'vesak', 'deepavali', 'general'];

function isUsablePhone(phone?: string | null): boolean {
  if (!phone?.trim()) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return false;
  if (/^x+$/i.test(digits)) return false;
  return true;
}

function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

function isFirstAnniversaryToday(milestone: Date): boolean {
  const m = new Date(milestone);
  const today = new Date();
  if (m.getMonth() !== today.getMonth() || m.getDate() !== today.getDate()) return false;
  return today.getFullYear() - m.getFullYear() === 1;
}

export class EngagementService {
  private emailService = new EmailService();
  private whatsAppService = new WhatsAppService();
  private paymentNotificationService = new PaymentNotificationService();

  listFestivalKeys(): FestivalKey[] {
    return FESTIVAL_KEYS;
  }

  async findTodayAnniversaries(): Promise<AnniversaryTodayRow[]> {
    const projects = await ProjectModel.find({
      status: { $in: ['under_development', 'completed'] },
    })
      .select('projectName clientId startDate createdAt')
      .lean();

    const rows: AnniversaryTodayRow[] = [];

    for (const p of projects) {
      const milestone = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
      if (!isFirstAnniversaryToday(milestone)) continue;

      const clientId = (p.clientId as mongoose.Types.ObjectId).toString();
      if (!mongoose.Types.ObjectId.isValid(clientId)) continue;

      const client = await CustomerModel.findById(clientId)
        .select('name email phoneNumber status')
        .lean();
      if (!client || client.status === 'inactive') continue;

      const projectId = (p._id as mongoose.Types.ObjectId).toString();
      const latest = await this.getLatestAnniversaryCardMeta(projectId);

      rows.push({
        projectId,
        projectName: p.projectName,
        clientId,
        clientName: client.name,
        email: client.email,
        phone: client.phoneNumber,
        milestoneDate: milestone.toISOString(),
        ...latest,
      });
    }

    return rows.sort((a, b) => a.clientName.localeCompare(b.clientName));
  }

  private async getLatestAnniversaryCardMeta(projectId: string): Promise<{
    latestCardId?: string;
    latestCardImageUrl?: string;
    lastSentAt?: string;
    lastSentChannel?: 'email' | 'whatsapp';
  }> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return {};
    const card = await BirthdayCardModel.findOne({
      campaignType: 'anniversary',
      projectId: new mongoose.Types.ObjectId(projectId),
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

  async listFestivalProspects(): Promise<FestivalProspectRow[]> {
    const inquiries = await InquiryModel.find({ status: { $nin: ['LOST', 'CONFIRMED'] } })
      .select('customerName phoneNumber email status')
      .sort({ customerName: 1 })
      .lean();

    return inquiries.map((inq) => ({
      inquiryId: (inq._id as mongoose.Types.ObjectId).toString(),
      customerName: inq.customerName,
      phoneNumber: inq.phoneNumber,
      email: (inq as { email?: string }).email,
      status: inq.status,
    }));
  }

  async generateAnniversaryCard(
    projectId: string,
    customGreeting?: string
  ): Promise<{
    cardId: string;
    imageUrl: string;
    greetingMessage: string;
    aiGenerated: boolean;
    mimeType: string;
  }> {
    const ctx = await this.resolveAnniversary(projectId);
    const greetingMessage =
      customGreeting?.trim() ||
      buildAnniversaryGreeting(ctx.clientName, ctx.projectName);

    const file = await writeGreetingCardFile(
      ctx.clientName,
      'anniversary',
      () => buildAnniversaryTemplateSvg(ctx.clientName, ctx.projectName)
    );

    const doc = await BirthdayCardModel.create({
      campaignType: 'anniversary',
      subjectType: 'customer',
      subjectId: new mongoose.Types.ObjectId(ctx.clientId),
      projectId: new mongoose.Types.ObjectId(projectId),
      personName: ctx.clientName,
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

  private async resolveAnniversary(projectId: string): Promise<{
    clientId: string;
    clientName: string;
    email?: string;
    phone?: string;
    projectName: string;
  }> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new Error('Invalid project id');
    const project = await ProjectModel.findById(projectId).lean();
    if (!project) throw new Error('Project not found');

    const milestone = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
    if (!isFirstAnniversaryToday(milestone)) {
      throw new Error('This project does not have its first anniversary today');
    }

    const client = await CustomerModel.findById(project.clientId).lean();
    if (!client) throw new Error('Client not found');

    return {
      clientId: (client._id as mongoose.Types.ObjectId).toString(),
      clientName: client.name,
      email: client.email,
      phone: client.phoneNumber,
      projectName: project.projectName,
    };
  }

  async sendAnniversary(
    projectId: string,
    channel: 'email' | 'whatsapp',
    options?: { cardId?: string; greetingMessage?: string }
  ): Promise<{
    sent: boolean;
    channel: string;
    whatsappDeepLink?: string;
    cardDownloadUrl?: string;
    message?: string;
  }> {
    const ctx = await this.resolveAnniversary(projectId);
    let cardId = options?.cardId;
    let greetingMessage = options?.greetingMessage?.trim();

    if (!cardId) {
      const generated = await this.generateAnniversaryCard(projectId, greetingMessage);
      cardId = generated.cardId;
      greetingMessage = generated.greetingMessage;
    } else if (!greetingMessage) {
      const card = await BirthdayCardModel.findById(cardId).lean();
      greetingMessage =
        card?.greetingMessage || buildAnniversaryGreeting(ctx.clientName, ctx.projectName);
    }

    return this.deliverCard({
      cardId: cardId!,
      channel,
      personName: ctx.clientName,
      email: ctx.email,
      phone: ctx.phone,
      greetingMessage: greetingMessage!,
      emailSubject: `One year with NIOLLA — ${ctx.projectName}`,
    });
  }

  async sendFestivalBlast(
    festivalKey: FestivalKey,
    channel: 'email' | 'whatsapp',
    inquiryIds?: string[]
  ): Promise<{
    sent: number;
    manual: number;
    failed: number;
    skipped: number;
    results: {
      inquiryId: string;
      customerName: string;
      ok: boolean;
      status: 'sent' | 'manual' | 'skipped' | 'failed';
      message: string;
      whatsappDeepLink?: string;
      cardDownloadUrl?: string;
    }[];
  }> {
    if (!FESTIVAL_KEYS.includes(festivalKey)) throw new Error('Invalid festival key');

    let prospects = await this.listFestivalProspects();
    if (inquiryIds?.length) {
      const set = new Set(inquiryIds);
      prospects = prospects.filter((p) => set.has(p.inquiryId));
    }

    const label = festivalLabel(festivalKey);
    const results: {
      inquiryId: string;
      customerName: string;
      ok: boolean;
      status: 'sent' | 'manual' | 'skipped' | 'failed';
      message: string;
      whatsappDeepLink?: string;
      cardDownloadUrl?: string;
    }[] = [];
    let sent = 0;
    let manual = 0;
    let failed = 0;
    let skipped = 0;

    for (const p of prospects) {
      if (channel === 'email' && !p.email?.trim()) {
        skipped += 1;
        results.push({
          inquiryId: p.inquiryId,
          customerName: p.customerName,
          ok: false,
          status: 'skipped',
          message: 'No email on prospect',
        });
        continue;
      }
      if (channel === 'whatsapp' && !isUsablePhone(p.phoneNumber)) {
        skipped += 1;
        results.push({
          inquiryId: p.inquiryId,
          customerName: p.customerName,
          ok: false,
          status: 'skipped',
          message: 'Invalid or placeholder phone number',
        });
        continue;
      }

      try {
        const greetingMessage = buildFestivalGreeting(p.customerName, label);
        const file = await writeGreetingCardFile(
          p.customerName,
          'festival',
          () => buildFestivalTemplateSvg(p.customerName, label)
        );

        const doc = await BirthdayCardModel.create({
          campaignType: 'festival',
          subjectType: 'inquiry',
          subjectId: new mongoose.Types.ObjectId(p.inquiryId),
          festivalKey,
          personName: p.customerName,
          fileName: file.fileName,
          mimeType: file.mimeType,
          greetingMessage,
          aiGenerated: file.aiGenerated,
        });

        const cardId = (doc._id as mongoose.Types.ObjectId).toString();
        const outcome = await this.deliverCard({
          cardId,
          channel,
          personName: p.customerName,
          email: p.email,
          phone: p.phoneNumber,
          greetingMessage,
          emailSubject: `${label} wishes from NIOLLA`,
        });

        if (outcome.sent) {
          sent += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: true,
            status: 'sent',
            message: outcome.message || 'Sent',
          });
        } else if (outcome.whatsappDeepLink) {
          manual += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: true,
            status: 'manual',
            message: outcome.message || 'Card ready — attach image in WhatsApp',
            whatsappDeepLink: outcome.whatsappDeepLink,
            cardDownloadUrl: outcome.cardDownloadUrl,
          });
        } else {
          failed += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: false,
            status: 'failed',
            message: outcome.message || 'Send failed',
          });
        }
      } catch (err) {
        failed += 1;
        results.push({
          inquiryId: p.inquiryId,
          customerName: p.customerName,
          ok: false,
          status: 'failed',
          message: err instanceof Error ? err.message : 'Send failed',
        });
      }
    }

    return { sent, manual, failed, skipped, results };
  }

  private async deliverCard(args: {
    cardId: string;
    channel: 'email' | 'whatsapp';
    personName: string;
    email?: string;
    phone?: string;
    greetingMessage: string;
    emailSubject: string;
  }): Promise<{
    sent: boolean;
    channel: string;
    whatsappDeepLink?: string;
    cardDownloadUrl?: string;
    message?: string;
  }> {
    const file = await this.getCardFile(args.cardId);
    if (!file) throw new Error('Greeting card not found');

    if (args.channel === 'email') {
      if (!args.email?.trim()) throw new Error('No email address on file');
      await this.emailService.send({
        to: args.email.trim(),
        subject: args.emailSubject,
        text: args.greetingMessage,
        html: `<p>${args.greetingMessage.replace(/\n/g, '<br/>')}</p>`,
        attachmentPath: file.absolutePath,
        attachmentName: `greeting-${args.personName.replace(/\s+/g, '-')}${path.extname(file.absolutePath)}`,
        attachmentMime: file.mimeType,
      });
      await this.recordCardSent(args.cardId, 'email');
      return { sent: true, channel: 'email', message: `Email sent to ${args.email}` };
    }

    if (!args.phone?.trim()) throw new Error('No phone number on file');

    const waMessage = `${args.greetingMessage}\n\n— NIOLLA`;
    const result = await this.whatsAppService.sendCardMessage({
      phone: args.phone,
      message: waMessage,
      filePath: file.absolutePath,
      mimeType: file.mimeType,
      cardId: args.cardId,
    });

    if (result.sent) {
      await this.recordCardSent(args.cardId, 'whatsapp');
      return { sent: true, channel: 'whatsapp', message: 'WhatsApp message sent with card image' };
    }

    await this.recordCardSent(args.cardId, 'whatsapp');

    return {
      sent: false,
      channel: 'whatsapp',
      whatsappDeepLink: result.whatsappDeepLink,
      cardDownloadUrl: result.cardDownloadUrl,
      message:
        'Card downloaded — attach the image in WhatsApp. For automatic image delivery, set TWILIO_* (and PUBLIC_API_BASE_URL or Twilio MCS).',
    };
  }

  private async getCardFile(cardId: string): Promise<{ absolutePath: string; mimeType: string } | null> {
    if (!mongoose.Types.ObjectId.isValid(cardId)) return null;
    const doc = await BirthdayCardModel.findById(cardId).lean();
    if (!doc) return null;
    return { absolutePath: path.join(getBirthdayCardsDir(), doc.fileName), mimeType: doc.mimeType };
  }

  private async recordCardSent(cardId: string, channel: 'email' | 'whatsapp'): Promise<void> {
    await BirthdayCardModel.findByIdAndUpdate(cardId, { sentAt: new Date(), sentChannel: channel });
  }

  async markCardResponded(cardId: string, responded: boolean): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(cardId)) throw new Error('Invalid card id');
    await BirthdayCardModel.findByIdAndUpdate(cardId, {
      respondedAt: responded ? new Date() : null,
    });
  }

  async getEngagementOverview(): Promise<EngagementOverview> {
    const leaderboard = await this.getEngagementStats(25);

    const sentCards = await BirthdayCardModel.find({ sentAt: { $exists: true, $ne: null } })
      .sort({ sentAt: -1 })
      .limit(40)
      .lean();

    const totalSends = sentCards.length;
    const totalReplies = sentCards.filter((c) => c.respondedAt).length;
    const awaitingReply = totalSends - totalReplies;

    const recent = sentCards.slice(0, 15).map((c) => ({
      cardId: (c._id as mongoose.Types.ObjectId).toString(),
      personName: c.personName,
      campaignType: (c.campaignType as string) || 'birthday',
      sentAt: new Date(c.sentAt!).toISOString(),
      sentChannel: c.sentChannel as 'email' | 'whatsapp' | undefined,
      respondedAt: c.respondedAt ? new Date(c.respondedAt).toISOString() : undefined,
      subjectType: c.subjectType,
    }));

    return {
      summary: {
        totalSends,
        totalReplies,
        responseRate: totalSends > 0 ? Math.round((totalReplies / totalSends) * 100) : 0,
        awaitingReply,
      },
      leaderboard,
      recent,
    };
  }

  async getEngagementStats(limit = 25): Promise<EngagementStatRow[]> {
    const rows = await BirthdayCardModel.aggregate<{
      _id: { subjectType: BirthdaySubjectType; subjectId: mongoose.Types.ObjectId };
      personName: string;
      sends: number;
      responses: number;
      lastSentAt?: Date;
      campaignTypes: string[];
    }>([
      { $match: { sentAt: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { subjectType: '$subjectType', subjectId: '$subjectId' },
          personName: { $last: '$personName' },
          sends: { $sum: 1 },
          responses: {
            $sum: { $cond: [{ $ifNull: ['$respondedAt', false] }, 1, 0] },
          },
          lastSentAt: { $max: '$sentAt' },
          campaignTypes: { $addToSet: '$campaignType' },
        },
      },
      { $sort: { responses: -1, sends: -1 } },
      { $limit: limit },
    ]);

    return rows.map((r) => ({
      subjectType: r._id.subjectType,
      subjectId: r._id.subjectId.toString(),
      personName: r.personName,
      sends: r.sends,
      responses: r.responses,
      responseRate: r.sends > 0 ? Math.round((r.responses / r.sends) * 100) : 0,
      lastSentAt: r.lastSentAt ? new Date(r.lastSentAt).toISOString() : undefined,
      campaignTypes: r.campaignTypes.filter(Boolean),
    }));
  }

  async scanAndNotifyOwnersAnniversaries(): Promise<{
    anniversaryCount: number;
    notificationsCreated: number;
  }> {
    const rows = await this.findTodayAnniversaries();
    const owners = await UserModel.find({ role: 'owner', status: 'active' }).select('_id').lean();
    let notificationsCreated = 0;
    const names = rows.map((r) => `${r.clientName} — ${r.projectName}`).join(', ');

    for (const owner of owners) {
      const ownerId = (owner._id as mongoose.Types.ObjectId).toString();
      const messageBody =
        rows.length === 0
          ? 'No project anniversaries today.'
          : `Project anniversaries today (${rows.length}): ${names}. Open the Dashboard to send thank-you notes.`;

      await this.paymentNotificationService.create({
        userId: ownerId,
        type: 'system',
        triggerType: 'anniversary',
        scheduledAt: new Date(),
        status: 'sent',
        messageBody,
      });
      notificationsCreated += 1;
    }

    return { anniversaryCount: rows.length, notificationsCreated };
  }
}

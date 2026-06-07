import mongoose from 'mongoose';
import { buildPromotionalMessage } from '../../domain/promotionalMessage';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { InquiryModel } from '../../infrastructure/database/models/InquiryModel';
import { FestivalCampaignModel } from '../../infrastructure/database/models/FestivalCampaignModel';
import { EmailService } from '../../infrastructure/email/EmailService';
import { WhatsAppService } from '../../infrastructure/whatsapp/WhatsAppService';
import { CampaignService } from './CampaignService';

export type PromotionalChannel = 'email' | 'sms';

export interface PromotionalBlastResult {
  sent: number;
  manual: number;
  failed: number;
  skipped: number;
  channel: PromotionalChannel;
  messagePreview: string;
  results: {
    inquiryId: string;
    customerName: string;
    ok: boolean;
    status: 'sent' | 'manual' | 'skipped' | 'failed';
    message: string;
    whatsappDeepLink?: string;
  }[];
}

function isUsablePhone(phone?: string): boolean {
  if (!phone?.trim()) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9;
}

export class CampaignMarketingService {
  private emailService = new EmailService();
  private whatsAppService = new WhatsAppService();
  private campaignService = new CampaignService();

  async listProspects(): Promise<
    { inquiryId: string; customerName: string; phoneNumber: string; email?: string; status: string }[]
  > {
    const inquiries = await InquiryModel.find({ status: { $nin: ['LOST', 'CONFIRMED'] } })
      .select('customerName phoneNumber status')
      .sort({ customerName: 1 })
      .lean();

    const inquiryIds = inquiries.map((inq) => inq._id);
    const customers = await CustomerModel.find({ inquiryId: { $in: inquiryIds } })
      .select('inquiryId email')
      .lean();
    const emailByInquiryId = new Map<string, string>();
    for (const c of customers) {
      const email = c.email?.trim();
      if (email && c.inquiryId) {
        emailByInquiryId.set(String(c.inquiryId), email);
      }
    }

    return inquiries.map((inq) => ({
      inquiryId: String(inq._id),
      customerName: inq.customerName,
      phoneNumber: inq.phoneNumber,
      email: emailByInquiryId.get(String(inq._id)),
      status: inq.status,
    }));
  }

  async sendPromotionalBlast(
    campaignId: string,
    channel: PromotionalChannel,
    inquiryIds?: string[]
  ): Promise<PromotionalBlastResult> {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      throw new Error('Invalid campaign id');
    }
    const campaign = await this.campaignService.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'active') {
      throw new Error('Campaign must be active to send a promotional blast');
    }
    if (campaign.phase === 'ended') {
      throw new Error('Campaign has ended — cannot send promotional blast');
    }

    const messagePreview = buildPromotionalMessage(campaign);
    let prospects = await this.listProspects();
    if (inquiryIds?.length) {
      const set = new Set(inquiryIds);
      prospects = prospects.filter((p) => set.has(p.inquiryId));
    }

    const results: PromotionalBlastResult['results'] = [];
    let sent = 0;
    let manual = 0;
    let failed = 0;
    let skipped = 0;

    for (const p of prospects) {
      if (channel === 'email') {
        const email = p.email?.trim();
        if (!email) {
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
        try {
          if (!this.emailService.isConfigured()) {
            skipped += 1;
            results.push({
              inquiryId: p.inquiryId,
              customerName: p.customerName,
              ok: false,
              status: 'skipped',
              message: 'SMTP not configured — add email settings in backend/.env',
            });
            continue;
          }
          await this.emailService.send({
            to: email,
            subject: `${campaign.name} — NIOLLA`,
            text: `${messagePreview}\n\n— Team NIOLLA Solutions`,
            html: `<p>${messagePreview}</p><p>— Team NIOLLA Solutions</p>`,
          });
          sent += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: true,
            status: 'sent',
            message: `Email sent to ${email}`,
          });
        } catch (err) {
          failed += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: false,
            status: 'failed',
            message: err instanceof Error ? err.message : 'Email failed',
          });
        }
        continue;
      }

      // SMS channel: text via WhatsApp (Twilio SMS or wa.me deep link)
      if (!isUsablePhone(p.phoneNumber)) {
        skipped += 1;
        results.push({
          inquiryId: p.inquiryId,
          customerName: p.customerName,
          ok: false,
          status: 'skipped',
          message: 'Invalid or missing phone number',
        });
        continue;
      }

      const smsText = `${messagePreview}\n\n— NIOLLA`;
      try {
        const wa = await this.whatsAppService.sendMessage(p.phoneNumber, smsText);
        if (wa.sent) {
          sent += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: true,
            status: 'sent',
            message: 'SMS/WhatsApp message sent',
          });
        } else if (wa.whatsappDeepLink) {
          manual += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: true,
            status: 'manual',
            message: 'Open WhatsApp to send (manual)',
            whatsappDeepLink: wa.whatsappDeepLink,
          });
        } else {
          failed += 1;
          results.push({
            inquiryId: p.inquiryId,
            customerName: p.customerName,
            ok: false,
            status: 'failed',
            message: 'Could not send SMS/WhatsApp',
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

    const summary = { sent, manual, failed, skipped, channel, messagePreview, results };
    await FestivalCampaignModel.findByIdAndUpdate(campaignId, {
      $set: {
        promotionalBlastAt: new Date(),
        promotionalBlastChannel: channel,
        promotionalBlastStats: { sent, manual, failed, skipped },
        promotionalMessage: messagePreview,
      },
    });

    return summary;
  }
}

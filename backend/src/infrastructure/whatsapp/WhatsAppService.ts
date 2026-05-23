import fs from 'fs';
import {
  cardImagePath,
  cardImageUrl,
  ensurePngForWhatsApp,
  publicApiBaseUrl,
} from './cardMediaUtil';

export interface WhatsAppSendResult {
  sent: boolean;
  provider: 'twilio' | 'deeplink';
  messageSid?: string;
  whatsappDeepLink?: string;
  cardDownloadUrl?: string;
}

export interface WhatsAppCardSendOptions {
  phone: string;
  message: string;
  filePath: string;
  mimeType: string;
  cardId?: string;
}

export class WhatsAppService {
  private mcsServiceSid: string | null = null;

  isTwilioConfigured(): boolean {
    return !!(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim()
    );
  }

  private twilioAuthHeader(): string {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN!.trim();
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  private normalizeE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('94')) return `+${digits}`;
    if (digits.startsWith('0')) return `+94${digits.slice(1)}`;
    if (digits.length === 9) return `+94${digits}`;
    return `+${digits}`;
  }

  buildDeepLink(phone: string, message: string): string {
    const e164 = this.normalizeE164(phone).replace('+', '');
    const text = encodeURIComponent(message);
    return `https://wa.me/${e164}?text=${text}`;
  }

  /** Upload card PNG to Twilio MCS when no public API URL is configured. */
  private async uploadMediaToTwilio(filePath: string, mimeType: string): Promise<string> {
    const serviceSid = await this.ensureMcsServiceSid();
    const fileBuffer = fs.readFileSync(filePath);
    const res = await fetch(`https://mcs.us1.twilio.com/v1/Services/${serviceSid}/Media`, {
      method: 'POST',
      headers: {
        Authorization: this.twilioAuthHeader(),
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Twilio media upload failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      links?: { content_direct_temporary?: string };
    };
    const url = json.links?.content_direct_temporary;
    if (!url) throw new Error('Twilio media upload did not return a temporary URL');
    return url;
  }

  private async ensureMcsServiceSid(): Promise<string> {
    const fromEnv = process.env.TWILIO_MCS_SERVICE_SID?.trim();
    if (fromEnv) return fromEnv;
    if (this.mcsServiceSid) return this.mcsServiceSid;

    const auth = this.twilioAuthHeader();
    const listRes = await fetch('https://mcs.us1.twilio.com/v1/Services?PageSize=50', {
      headers: { Authorization: auth },
    });
    if (listRes.ok) {
      const list = (await listRes.json()) as {
        services?: { sid: string; friendly_name?: string }[];
      };
      const existing = list.services?.find((s) => s.friendly_name === 'NiollaGreetingCards');
      if (existing?.sid) {
        this.mcsServiceSid = existing.sid;
        return existing.sid;
      }
    }

    const createRes = await fetch('https://mcs.us1.twilio.com/v1/Services', {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ FriendlyName: 'NiollaGreetingCards' }).toString(),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Twilio MCS service create failed: ${createRes.status} ${errText.slice(0, 200)}`);
    }

    const created = (await createRes.json()) as { sid: string };
    this.mcsServiceSid = created.sid;
    return created.sid;
  }

  private async resolveMediaUrl(
    pngPath: string,
    cardId?: string
  ): Promise<string | null> {
    if (!this.isTwilioConfigured()) return null;

    const publicBase = publicApiBaseUrl();
    if (publicBase && cardId) {
      return cardImageUrl(cardId, true);
    }

    try {
      return await this.uploadMediaToTwilio(pngPath, 'image/png');
    } catch (err) {
      console.error('Twilio MCS upload failed:', err);
      return null;
    }
  }

  async sendMessage(
    phone: string,
    message: string,
    mediaUrl?: string
  ): Promise<WhatsAppSendResult> {
    const to = this.normalizeE164(phone);
    if (!to) throw new Error('Invalid phone number for WhatsApp');

    if (!this.isTwilioConfigured()) {
      return {
        sent: false,
        provider: 'deeplink',
        whatsappDeepLink: this.buildDeepLink(phone, message),
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID!.trim();
    const from = process.env.TWILIO_WHATSAPP_FROM!.trim();
    const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const fromWhatsApp = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

    const body = new URLSearchParams();
    body.set('To', toWhatsApp);
    body.set('From', fromWhatsApp);
    body.set('Body', message);
    if (mediaUrl?.trim()) body.set('MediaUrl', mediaUrl.trim());

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: this.twilioAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Twilio WhatsApp failed: ${res.status} ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as { sid?: string };
    return { sent: true, provider: 'twilio', messageSid: json.sid };
  }

  /**
   * Send greeting text with the card image attached (never a "view card" link in the body).
   */
  async sendCardMessage(options: WhatsAppCardSendOptions): Promise<WhatsAppSendResult> {
    const { phone, message, filePath, mimeType, cardId } = options;
    WhatsAppService.assertAttachmentExists(filePath);

    const png = await ensurePngForWhatsApp(filePath, mimeType);
    const downloadUrl = cardId ? cardImagePath(cardId, true) : undefined;

    if (this.isTwilioConfigured()) {
      const mediaUrl = await this.resolveMediaUrl(png.absolutePath, cardId);
      if (mediaUrl) {
        try {
          const result = await this.sendMessage(phone, message, mediaUrl);
          if (result.sent) return result;
        } catch (err) {
          console.error('Twilio WhatsApp media send failed:', err);
        }
      }
    }

    return {
      sent: false,
      provider: 'deeplink',
      whatsappDeepLink: this.buildDeepLink(phone, message),
      cardDownloadUrl: downloadUrl,
    };
  }

  /** @deprecated Use sendCardMessage — kept for callers that pass a public MediaUrl directly. */
  canAutoSendMedia(): boolean {
    return this.isTwilioConfigured() && (!!publicApiBaseUrl() || !!process.env.TWILIO_MCS_SERVICE_SID?.trim());
  }

  static assertAttachmentExists(filePath: string): void {
    if (!fs.existsSync(filePath)) throw new Error('Birthday card file not found');
  }
}

import fs from 'fs';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentMime?: string;
}

type MailTransporter = import('nodemailer').Transporter;

function loadNodemailer(): typeof import('nodemailer') | null {
  try {
    // Lazy load so API starts even before `npm install` pulls nodemailer
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('nodemailer') as typeof import('nodemailer');
  } catch {
    return null;
  }
}

export class EmailService {
  private transporter: MailTransporter | null = null;

  private getTransporter(): MailTransporter | null {
    if (this.transporter) return this.transporter;
    const nodemailer = loadNodemailer();
    if (!nodemailer) return null;

    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !user || !pass) return null;

    const port = Number(process.env.SMTP_PORT) || 587;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return this.transporter;
  }

  isConfigured(): boolean {
    return !!loadNodemailer() && !!this.getTransporter() && !!process.env.SMTP_FROM?.trim();
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!loadNodemailer()) {
      throw new Error(
        'nodemailer is not installed. Run `npm install` in the backend folder, then restart the server.'
      );
    }

    const transport = this.getTransporter();
    const from = process.env.SMTP_FROM?.trim();
    if (!transport || !from) {
      throw new Error(
        'Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in backend/.env'
      );
    }

    const attachments =
      options.attachmentPath && fs.existsSync(options.attachmentPath)
        ? [
            {
              filename: options.attachmentName || 'birthday-card',
              path: options.attachmentPath,
              contentType: options.attachmentMime,
            },
          ]
        : undefined;

    await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br/>'),
      attachments,
    });
  }
}

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);

  constructor(private config: ConfigService) {}

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const subject = this.config.get<string>('MAIL_SUBJECT_VERIFY') || 'Your verification code';
    const text = `Your verification code is: ${code}\n\nIt expires in 15 minutes. If you did not sign up, ignore this email.`;
    const html = `<p>Your verification code is:</p><p style="font-size:24px;letter-spacing:4px;font-weight:bold">${code}</p><p>This code expires in 15 minutes.</p>`;

    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      const from = this.config.get<string>('MAIL_FROM');
      if (!from) {
        throw new ServiceUnavailableException('MAIL_FROM is not set (required with RESEND_API_KEY)');
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        this.log.error(`Resend failed: ${res.status} ${body}`);
        throw new ServiceUnavailableException('Could not send email. Check RESEND_API_KEY and domain.');
      }
      return;
    }

    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const port = parseInt(this.config.get<string>('SMTP_PORT') || '587', 10);
      const user = this.config.get<string>('SMTP_USER');
      const pass = this.config.get<string>('SMTP_PASS');
      const from = this.config.get<string>('MAIL_FROM') || user;
      if (!from) {
        throw new ServiceUnavailableException('MAIL_FROM or SMTP_USER required for SMTP');
      }
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
      await transporter.sendMail({ from, to, subject, text, html });
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Email is not configured. Set RESEND_API_KEY + MAIL_FROM, or SMTP_* + MAIL_FROM.',
      );
    }
    this.log.warn(`Email not configured; verification code for ${to}: ${code}`);
  }
}

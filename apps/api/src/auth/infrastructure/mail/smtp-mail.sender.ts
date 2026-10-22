import type { Email } from '../../../identity/domain/email';
import type { MailSender } from '../../application/ports/mail-sender.port';
import { renderMagicLinkEmail } from './magic-link-email';

/** The slice of a nodemailer transport this adapter uses. */
export interface SmtpTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

/** Local development: nodemailer into Mailpit. Synchronous by design. */
export class SmtpMailSender implements MailSender {
  constructor(
    private readonly transport: SmtpTransport,
    private readonly from: string,
  ) {}

  async sendMagicLink(to: Email, link: string): Promise<void> {
    const { subject, text, html } = renderMagicLinkEmail(link);
    await this.transport.sendMail({
      from: this.from,
      to: to.value,
      subject,
      text,
      html,
    });
  }
}

import type { Email } from '../../../identity/domain/email';

export interface MailSender {
  /** Delivers the sign-in link. Rejects when the provider refuses it. */
  sendMagicLink(to: Email, link: string): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');

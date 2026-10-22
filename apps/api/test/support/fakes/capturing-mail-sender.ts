import type { MailSender } from '../../../src/auth/application/ports/mail-sender.port';
import type { Email } from '../../../src/identity/domain/email';

export interface SentMail {
  readonly to: string;
  readonly link: string;
}

/** Records every message instead of sending it; can be told to fail. */
export class CapturingMailSender implements MailSender {
  readonly sent: SentMail[] = [];
  failWith: Error | null = null;

  sendMagicLink(to: Email, link: string): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.sent.push({ to: to.value, link });
    return Promise.resolve();
  }

  /** The token of the last message: the 43 characters after `#token=`. */
  lastToken(): string {
    const link = this.sent.at(-1)?.link ?? '';
    return link.split('#token=')[1] ?? '';
  }
}

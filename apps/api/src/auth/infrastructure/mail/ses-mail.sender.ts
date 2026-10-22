import {
  SendEmailCommand,
  type SendEmailCommandOutput,
} from '@aws-sdk/client-sesv2';
import type { Email } from '../../../identity/domain/email';
import type { MailSender } from '../../application/ports/mail-sender.port';
import { renderMagicLinkEmail } from './magic-link-email';

export type SesSend = (
  command: SendEmailCommand,
) => Promise<SendEmailCommandOutput>;

const CHARSET = 'UTF-8';

/** Production: Amazon SES (ADR-007). Synchronous; a refusal rejects. */
export class SesMailSender implements MailSender {
  constructor(
    private readonly send: SesSend,
    private readonly from: string,
  ) {}

  async sendMagicLink(to: Email, link: string): Promise<void> {
    const { subject, text, html } = renderMagicLinkEmail(link);
    await this.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [to.value] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: CHARSET },
            Body: {
              Text: { Data: text, Charset: CHARSET },
              Html: { Data: html, Charset: CHARSET },
            },
          },
        },
      }),
    );
  }
}

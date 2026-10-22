import { SESv2Client } from '@aws-sdk/client-sesv2';
import { createTransport } from 'nodemailer';
import type { AppConfig } from '../../../config/app-config';
import type { MailSender } from '../../application/ports/mail-sender.port';
import { SesMailSender } from './ses-mail.sender';
import { SmtpMailSender } from './smtp-mail.sender';

const SMTP_TIMEOUT_MS = 5000;

/** The request waits for the provider, so a stuck one must not hang it. */
export function createMailSender(config: AppConfig): MailSender {
  const { mail } = config;
  if (mail.transport === 'ses') {
    const client = new SESv2Client(
      config.awsRegion ? { region: config.awsRegion } : {},
    );
    return new SesMailSender((command) => client.send(command), mail.from);
  }
  const transport = createTransport({
    host: mail.smtpHost,
    port: mail.smtpPort,
    secure: false,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  return new SmtpMailSender(transport, mail.from);
}

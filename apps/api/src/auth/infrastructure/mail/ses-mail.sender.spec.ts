import type { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Email } from '../../../identity/domain/email';
import { renderMagicLinkEmail } from './magic-link-email';
import { SesMailSender } from './ses-mail.sender';

const LINK = `https://app.example.test/acceso/verificar/#token=${'T'.repeat(43)}`;

describe('SesMailSender', () => {
  it('sends a simple UTF-8 message with both bodies through the injected client', async () => {
    const sent: SendEmailCommand[] = [];
    const sender = new SesMailSender((command) => {
      sent.push(command);
      return Promise.resolve({ $metadata: {} });
    }, 'no-reply@example.test');
    await sender.sendMagicLink(Email.parse('ana@example.test'), LINK);
    const rendered = renderMagicLinkEmail(LINK);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.input).toEqual({
      FromEmailAddress: 'no-reply@example.test',
      Destination: { ToAddresses: ['ana@example.test'] },
      Content: {
        Simple: {
          Subject: { Data: rendered.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: rendered.text, Charset: 'UTF-8' },
            Html: { Data: rendered.html, Charset: 'UTF-8' },
          },
        },
      },
    });
  });

  it('rejects when SES refuses the message', async () => {
    const sender = new SesMailSender(
      () => Promise.reject(new Error('MessageRejected')),
      'no-reply@example.test',
    );
    await expect(
      sender.sendMagicLink(Email.parse('a@example.test'), LINK),
    ).rejects.toThrow('MessageRejected');
  });
});

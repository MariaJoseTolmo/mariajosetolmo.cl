import { Email } from '../../../identity/domain/email';
import { renderMagicLinkEmail } from './magic-link-email';
import { SmtpMailSender, type SmtpTransport } from './smtp-mail.sender';

const LINK = `https://app.example.test/acceso/verificar/#token=${'T'.repeat(43)}`;

function fakeTransport(): {
  transport: SmtpTransport;
  messages: Parameters<SmtpTransport['sendMail']>[0][];
} {
  const messages: Parameters<SmtpTransport['sendMail']>[0][] = [];
  return {
    messages,
    transport: {
      sendMail: (message) => {
        messages.push(message);
        return Promise.resolve({});
      },
    },
  };
}

describe('SmtpMailSender', () => {
  it('sends the rendered email from the configured sender to the recipient', async () => {
    const { transport, messages } = fakeTransport();
    await new SmtpMailSender(transport, 'no-reply@example.test').sendMagicLink(
      Email.parse('Ana@Example.test'),
      LINK,
    );
    const rendered = renderMagicLinkEmail(LINK);
    expect(messages).toEqual([
      {
        from: 'no-reply@example.test',
        to: 'ana@example.test',
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      },
    ]);
  });

  it('sends one message per call, to each recipient', async () => {
    const { transport, messages } = fakeTransport();
    const sender = new SmtpMailSender(transport, 'no-reply@example.test');
    await sender.sendMagicLink(Email.parse('a@example.test'), LINK);
    await sender.sendMagicLink(Email.parse('b@example.test'), LINK);
    expect(messages.map((m) => m.to)).toEqual([
      'a@example.test',
      'b@example.test',
    ]);
  });

  it('rejects when the transport refuses, so the caller can log it', async () => {
    const sender = new SmtpMailSender(
      { sendMail: () => Promise.reject(new Error('connect ECONNREFUSED')) },
      'no-reply@example.test',
    );
    await expect(
      sender.sendMagicLink(Email.parse('a@example.test'), LINK),
    ).rejects.toThrow('ECONNREFUSED');
  });
});

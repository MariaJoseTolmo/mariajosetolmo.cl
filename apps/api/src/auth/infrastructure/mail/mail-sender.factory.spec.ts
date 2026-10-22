import { loadConfig } from '../../../config/app-config';
import { TEST_ENV } from '../../../../test/support/test-config';
import { createMailSender } from './mail-sender.factory';
import { SesMailSender } from './ses-mail.sender';
import { SmtpMailSender } from './smtp-mail.sender';

describe('createMailSender', () => {
  it('uses SMTP (Mailpit) when MAIL_TRANSPORT=smtp', () => {
    expect(createMailSender(loadConfig(TEST_ENV))).toBeInstanceOf(
      SmtpMailSender,
    );
  });

  it('uses SES when MAIL_TRANSPORT=ses', () => {
    const config = loadConfig({
      ...TEST_ENV,
      MAIL_TRANSPORT: 'ses',
      AWS_REGION: 'sa-east-1',
    });
    expect(createMailSender(config)).toBeInstanceOf(SesMailSender);
  });
});

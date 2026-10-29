import { InvalidToken } from '../../shared/domain/errors';
import { InvalidMagicLink, MalformedToken } from './auth-errors';

describe('auth errors', () => {
  it('treats a malformed token and an unusable link as one invalid token', () => {
    expect(new MalformedToken()).toBeInstanceOf(InvalidToken);
    expect(new InvalidMagicLink()).toBeInstanceOf(InvalidToken);
    expect(new MalformedToken().code).toBe('INVALID_TOKEN');
    expect(new InvalidMagicLink().code).toBe('INVALID_TOKEN');
    expect(new MalformedToken().code).toBe(new InvalidMagicLink().code);
  });

  it('uses one message for unknown, expired and used links', () => {
    expect(new InvalidMagicLink().message).toBe('link is invalid or expired');
  });
});

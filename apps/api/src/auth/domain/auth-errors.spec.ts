import { InvalidInput } from '../../shared/domain/errors';
import { InvalidMagicLink, MalformedToken } from './auth-errors';

describe('auth errors', () => {
  it('treats a malformed token and an unusable link as invalid input (400)', () => {
    expect(new MalformedToken()).toBeInstanceOf(InvalidInput);
    expect(new MalformedToken().code).toBe('INVALID_INPUT');
    expect(new InvalidMagicLink()).toBeInstanceOf(InvalidInput);
    expect(new InvalidMagicLink().code).toBe('INVALID_INPUT');
  });

  it('uses one message for unknown, expired and used links', () => {
    expect(new InvalidMagicLink().message).toBe('link is invalid or expired');
  });
});

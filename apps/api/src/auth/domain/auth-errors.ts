import { InvalidToken } from '../../shared/domain/errors';

/** The token has the wrong shape. Never echoes the value. */
export class MalformedToken extends InvalidToken {
  constructor() {
    super('token is malformed');
  }
}

/** Unknown, expired and already-used links look the same from outside. */
export class InvalidMagicLink extends InvalidToken {
  constructor() {
    super('link is invalid or expired');
  }
}

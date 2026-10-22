import { InvalidInput } from '../../shared/domain/errors';

/** The token has the wrong shape. Never echoes the value. */
export class MalformedToken extends InvalidInput {
  constructor() {
    super('token is malformed');
  }
}

/** Unknown, expired and already-used links look the same from outside. */
export class InvalidMagicLink extends InvalidInput {
  constructor() {
    super('link is invalid or expired');
  }
}

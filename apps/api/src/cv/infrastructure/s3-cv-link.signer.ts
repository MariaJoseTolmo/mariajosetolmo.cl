import { InfrastructureUnavailable } from '../../shared/domain/errors';
import type {
  CvLinkSigner,
  SignedCvLink,
} from '../application/ports/cv-link-signer.port';

const MS_PER_SECOND = 1000;

export interface PresignInput {
  readonly bucket: string;
  readonly key: string;
  readonly expiresInSeconds: number;
  /** The instant the signature is made at; the expiry counts from it. */
  readonly signingDate: Date;
}

/** Injected so the signer is tested without the SDK and without credentials. */
export type Presign = (input: PresignInput) => Promise<string>;

export interface S3CvLinkOptions {
  readonly bucket: string;
  readonly key: string;
  readonly ttlSeconds: number;
}

/**
 * Presigned GET on a private object. The URL is returned to the caller and
 * nothing else: it is not stored and this class has no logger.
 */
export class S3CvLinkSigner implements CvLinkSigner {
  constructor(
    private readonly options: S3CvLinkOptions,
    private readonly presign: Presign,
  ) {}

  async sign(now: Date): Promise<SignedCvLink> {
    const { bucket, key, ttlSeconds } = this.options;
    try {
      const url = await this.presign({
        bucket,
        key,
        expiresInSeconds: ttlSeconds,
        signingDate: now,
      });
      return {
        url,
        expiresAt: new Date(now.getTime() + ttlSeconds * MS_PER_SECOND),
      };
    } catch (error) {
      // The cause rides along for the server log only; the message is generic.
      throw new InfrastructureUnavailable(error);
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import { CV_LINK_SIGNER, type CvLinkSigner } from './ports/cv-link-signer.port';

export interface CvLink {
  readonly url: string;
  /** ISO 8601 in UTC. */
  readonly expiresAt: string;
}

@Injectable()
export class GetCvLink {
  constructor(
    @Inject(CV_LINK_SIGNER) private readonly signer: CvLinkSigner,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A fresh link on every call: nothing is cached, stored or logged. */
  async execute(): Promise<CvLink> {
    const signed = await this.signer.sign(this.clock.now());
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../shared/application/ports/clock.port';
import {
  VISIT_RECORDER,
  type VisitRecorder,
} from '../../visits/application/ports/visit-recorder.port';
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
    @Inject(VISIT_RECORDER) private readonly visits: VisitRecorder,
  ) {}

  /**
   * A fresh link on every call: nothing is cached, stored or logged. The visit
   * is recorded only once the link exists, and recording never fails the call.
   */
  async execute(principal: { readonly userId: string }): Promise<CvLink> {
    const signed = await this.signer.sign(this.clock.now());
    await this.visits.record({ userId: principal.userId, kind: 'CV_LINK' });
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }
}

import type {
  CvLinkSigner,
  SignedCvLink,
} from '../application/ports/cv-link-signer.port';

const MS_PER_SECOND = 1000;

/** Local and test signer: an example URL, no storage and no credentials. */
export class FakeCvLinkSigner implements CvLinkSigner {
  /** How many links were requested (the "new link every time" scenario). */
  calls = 0;

  constructor(private readonly ttlSeconds = 300) {}

  sign(now: Date): Promise<SignedCvLink> {
    this.calls += 1;
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * MS_PER_SECOND);
    return Promise.resolve({
      url: `https://cv.example.test/cv-de-ejemplo.pdf?expires=${Math.floor(expiresAt.getTime() / MS_PER_SECOND)}`,
      expiresAt,
    });
  }
}

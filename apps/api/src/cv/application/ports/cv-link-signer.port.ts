export interface SignedCvLink {
  readonly url: string;
  readonly expiresAt: Date;
}

/** Produces a short-lived download URL for the CV. Never persisted or logged. */
export interface CvLinkSigner {
  sign(now: Date): Promise<SignedCvLink>;
}

export const CV_LINK_SIGNER = Symbol('CV_LINK_SIGNER');

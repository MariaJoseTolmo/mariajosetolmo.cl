export interface CookieNames {
  readonly access: string;
  readonly refresh: string;
}

/**
 * The __Host-/__Secure- prefixes make browsers require Secure, so they only
 * exist when Secure is on. Writer and readers share this single derivation.
 */
export function cookieNamesFor(secure: boolean): CookieNames {
  return secure
    ? { access: '__Host-access', refresh: '__Secure-refresh' }
    : { access: 'access', refresh: 'refresh' };
}

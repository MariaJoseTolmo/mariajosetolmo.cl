import { useEffect, useState } from 'react';

export type MagicLinkToken =
  | { status: 'pending' }
  | { status: 'found'; token: string }
  | { status: 'missing' };

/** Where the page lives; the fragment is replaced by exactly this path. */
const VERIFY_PATH = '/acceso/verificar/';

/**
 * The only place that reads the magic-link token. It travels in the URL
 * fragment (`#token=`), which never reaches CloudFront, its logs or the
 * `Referer` header. `location.search` is deliberately ignored.
 *
 * The fragment only exists in the browser, so the read happens in an effect:
 * the first render (and the prerendered HTML) is always `pending`. Right after
 * capturing the token it lives only in memory and the fragment is removed.
 */
export function useMagicLinkToken(): MagicLinkToken {
  const [token, setToken] = useState<MagicLinkToken>({ status: 'pending' });

  useEffect(() => {
    function tokenIn(hash: string): string | null {
      return new URLSearchParams(hash.slice(1)).get('token') || null;
    }

    const { hash } = window.location;
    const value = tokenIn(hash);
    if (hash !== '') window.history.replaceState(null, '', VERIFY_PATH);
    const next: MagicLinkToken = value
      ? { status: 'found', token: value }
      : { status: 'missing' };
    // Reading browser-only state after mount is the sanctioned use of an
    // effect here (it cannot happen during render without a hydration
    // mismatch). StrictMode runs this effect twice: the second run sees an empty
    // fragment and must not overwrite the token captured by the first.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken((current) => (current.status === 'pending' ? next : current));

    // A new link opened in this same tab only changes the fragment (no reload).
    // The newest token wins, whatever the flow was doing.
    function onHashChange() {
      const fresh = tokenIn(window.location.hash);
      if (!fresh) return;
      window.history.replaceState(null, '', VERIFY_PATH);
      setToken({ status: 'found', token: fresh });
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return token;
}

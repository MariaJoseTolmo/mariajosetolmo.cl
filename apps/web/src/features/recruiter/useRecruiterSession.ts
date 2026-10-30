import { useEffect, useState } from 'react';
import type { ApiGateway } from '@/lib/api/port';
import type { ApiFailure, Me } from '@/lib/api/types';

export type SessionState =
  | { status: 'checking' }
  | { status: 'authorized'; me: Me }
  | { status: 'redirecting' }
  | { status: 'error'; failure: ApiFailure };

/**
 * Session guard: asks `getMe()` on mount. Only `unauthorized` (after the
 * adapter's single refresh attempt) means "sign in again"; a network or server
 * problem must never look like a closed session.
 */
export function useRecruiterSession(gatewayLoader: () => Promise<ApiGateway>): {
  state: SessionState;
  retry: () => void;
} {
  const [state, setState] = useState<SessionState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const settle = (next: SessionState) => {
      if (!cancelled) setState(next);
    };
    gatewayLoader()
      .then((gateway) => gateway.getMe())
      .then((result) => {
        if (result.ok) settle({ status: 'authorized', me: result.data });
        else if (result.error === 'unauthorized')
          settle({ status: 'redirecting' });
        else settle({ status: 'error', failure: result });
      })
      // A gateway that cannot load or throws counts as `network` (retryable).
      .catch(() => settle({ status: 'error', failure: { error: 'network' } }));
    return () => {
      cancelled = true;
    };
  }, [gatewayLoader, attempt]);

  const retry = () => {
    setState({ status: 'checking' });
    setAttempt((n) => n + 1);
  };

  return { state, retry };
}

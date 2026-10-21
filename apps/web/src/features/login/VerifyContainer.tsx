'use client';

import { useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loadGateway } from '@/lib/api';
import type { ApiGateway } from '@/lib/api/port';
import styles from './VerifyContainer.module.css';
import { StepsPanel } from './StepsPanel';
import { useMagicLinkToken, type MagicLinkToken } from './useMagicLinkToken';
import {
  initialVerifyState,
  verifyReducer,
  verifyStepIndex,
  verifyView,
} from './verifyReducer';
import { VerifyView } from './VerifyView';

interface VerifyContainerProps {
  /** Injected so tests use a fake gateway instead of module mocks. */
  gatewayLoader?: () => Promise<ApiGateway>;
}

export function VerifyContainer({
  gatewayLoader = loadGateway,
}: VerifyContainerProps) {
  const token = useMagicLinkToken();
  // A new link opened in this tab replaces the token: keying the flow by it
  // restarts everything (state, in-flight guard) and orphans any old request.
  const flowKey =
    token.status === 'found' ? `found:${token.token}` : token.status;
  return (
    <VerifyFlow key={flowKey} token={token} gatewayLoader={gatewayLoader} />
  );
}

interface VerifyFlowProps {
  token: MagicLinkToken;
  gatewayLoader: () => Promise<ApiGateway>;
}

function VerifyFlow({ token, gatewayLoader }: VerifyFlowProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(verifyReducer, initialVerifyState);
  // A second click can land before React re-renders with the aria-disabled button.
  const inFlight = useRef(false);

  const view = verifyView(token, state);

  async function handleConfirm() {
    if (token.status !== 'found' || inFlight.current) return;
    inFlight.current = true;
    dispatch({ type: 'CONFIRM' });
    try {
      const gateway = await gatewayLoader();
      const result = await gateway.verifyToken(token.token);
      dispatch(
        result.ok
          ? { type: 'SUCCEEDED' }
          : { type: 'FAILED', kind: result.error },
      );
    } catch {
      dispatch({ type: 'FAILED', kind: 'network' });
    } finally {
      inFlight.current = false;
    }
  }

  async function handleResetDemo() {
    try {
      const gateway = await gatewayLoader();
      await gateway.logout();
    } catch {
      // Demo reset: starting over matters more than a failed logout.
    }
    router.replace('/acceso/');
  }

  return (
    <>
      <section className={styles.card} aria-labelledby="verify-heading">
        <VerifyView
          view={view}
          onConfirm={() => void handleConfirm()}
          onResetDemo={() => void handleResetDemo()}
        />
      </section>
      <StepsPanel activeStep={verifyStepIndex(view)} />
    </>
  );
}

'use client';

import { useReducer, useState } from 'react';
import { loadGateway } from '@/lib/api';
import type { ApiGateway } from '@/lib/api/port';
import type { MagicLinkRequest } from '@/lib/api/types';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { login } from '@/content/login';
import styles from './LoginContainer.module.css';
import { LoginForm } from './LoginForm';
import { initialLoginState, loginReducer, stepIndex } from './loginReducer';
import { SentView } from './SentView';
import { StepsPanel } from './StepsPanel';

interface LoginContainerProps {
  /** Injected so tests use a fake gateway instead of module mocks. */
  gatewayLoader?: () => Promise<ApiGateway>;
}

export function LoginContainer({
  gatewayLoader = loadGateway,
}: LoginContainerProps) {
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const [focusEmail, setFocusEmail] = useState(false);

  async function handleSubmit(request: MagicLinkRequest) {
    dispatch({ type: 'SUBMIT', email: request.email });
    try {
      const gateway = await gatewayLoader();
      const result = await gateway.requestMagicLink(request);
      // Anti-enumeration: only a network failure is told apart. Any other
      // answer looks exactly like success.
      if (!result.ok && result.error === 'network') {
        dispatch({ type: 'FAILED', kind: 'network' });
      } else {
        dispatch({ type: 'SUCCEEDED' });
      }
    } catch {
      dispatch({ type: 'FAILED', kind: 'network' });
    }
  }

  return (
    <>
      <section className={styles.card} aria-labelledby="login-heading">
        {state.status === 'sent' ? (
          <SentView
            email={state.email}
            onReset={() => {
              setFocusEmail(true);
              dispatch({ type: 'RESET' });
            }}
          />
        ) : (
          <LoginForm
            onSubmit={(request) => void handleSubmit(request)}
            submitting={state.status === 'submitting'}
            networkError={state.status === 'error'}
            autoFocusEmail={focusEmail}
          />
        )}
        {/* Always mounted so the text change is announced; same text for every
            outcome that reaches `sent` (anti-enumeration). */}
        <div role="status" aria-live="polite">
          {state.status === 'sent' ? (
            <VisuallyHidden>
              {`${login.sent.title}. ${login.sent.before}${state.email}${login.sent.after}`}
            </VisuallyHidden>
          ) : null}
        </div>
      </section>
      <StepsPanel activeStep={stepIndex(state)} />
    </>
  );
}

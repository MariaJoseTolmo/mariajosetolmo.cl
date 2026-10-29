'use client';

import { useReducer, useState } from 'react';
import { loadGateway } from '@/lib/api';
import type { ApiGateway } from '@/lib/api/port';
import type { MagicLinkRequest } from '@/lib/api/types';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { login } from '@/content/login';
import styles from './LoginContainer.module.css';
import { LoginForm } from './LoginForm';
import { loginOverrides } from './loginOverrides';
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
      // "Sent" only on 2xx. No possible error depends on the email (format,
      // origin, IP limit, infrastructure), so showing them leaks nothing.
      if (result.ok) {
        dispatch({ type: 'SUCCEEDED' });
      } else {
        dispatch({ type: 'FAILED', failure: result });
      }
    } catch {
      dispatch({ type: 'FAILED', failure: { error: 'network' } });
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
            errorMessage={
              state.status === 'error'
                ? apiErrorMessage(state.failure, loginOverrides)
                : undefined
            }
            retry={
              state.status === 'error' &&
              (state.failure.error === 'server' ||
                state.failure.error === 'network')
            }
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

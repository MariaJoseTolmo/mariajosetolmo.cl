import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { LinkButton } from '@/components/ui/LinkButton';
import { verify } from '@/content/verify';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import styles from './VerifyView.module.css';
import type { VerifyViewState } from './verifyReducer';

interface VerifyViewProps {
  view: VerifyViewState;
  onConfirm: () => void;
  /** Mock-only: forget the demo session and start over. */
  onResetDemo: () => void;
}

interface StateProps {
  eyebrow?: string;
  title: string;
  /** Move focus to the heading: the card content was just swapped. */
  takeFocus?: boolean;
  /** Id of the text that explains the state: read out when the title takes focus. */
  describedBy?: string;
  children?: ReactNode;
}

function State({
  eyebrow,
  title,
  takeFocus = false,
  describedBy,
  children,
}: StateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (takeFocus) headingRef.current?.focus();
  }, [takeFocus]);

  return (
    <div className={styles.view}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1
        ref={headingRef}
        id="verify-heading"
        tabIndex={-1}
        aria-describedby={describedBy}
        className={styles.title}
      >
        {title}
      </h1>
      {children}
    </div>
  );
}

export function VerifyView({ view, onConfirm, onResetDemo }: VerifyViewProps) {
  // After "Reintentar" the button disappears with its error card, so focus
  // moves to the heading of the state that replaces it.
  const [retried, setRetried] = useState(false);
  const textId = useId();

  switch (view.status) {
    case 'pending':
      return <State title={verify.pending.title} />;
    case 'ready':
    case 'confirming': {
      const copy = verify.ready;
      const confirming = view.status === 'confirming';
      return (
        <State
          eyebrow={copy.eyebrow}
          title={copy.title}
          takeFocus={retried && confirming}
        >
          <p className={styles.text}>{copy.lead}</p>
          <div className={styles.actions}>
            {/* aria-disabled (not disabled): focus must stay on the button. */}
            <Button
              size={52}
              onClick={confirming ? undefined : onConfirm}
              aria-disabled={confirming}
            >
              {copy.confirm}
            </Button>
          </div>
          <p role="status" className={styles.status}>
            {confirming ? copy.confirming : ''}
          </p>
        </State>
      );
    }
    case 'done': {
      const copy = verify.done;
      return (
        <State eyebrow={copy.eyebrow} title={copy.title} takeFocus>
          <p className={styles.text}>{copy.lead}</p>
          <div className={styles.actions}>
            <LinkButton href="/reclutador/" size={52}>
              {copy.enter}
            </LinkButton>
            {process.env.NEXT_PUBLIC_API_MODE === 'mock' ? (
              <Button variant="outline" size={52} onClick={onResetDemo}>
                Reiniciar demo
              </Button>
            ) : null}
          </div>
        </State>
      );
    }
    case 'error': {
      const copy = verify.errors[view.variant];
      const text =
        view.variant === 'invalid'
          ? verify.errors.invalid.text
          : apiErrorMessage(view.failure);
      return (
        <State
          key={view.variant}
          eyebrow={copy.eyebrow}
          title={copy.title}
          takeFocus
          describedBy={textId}
        >
          <p id={textId} className={styles.text}>
            {text}
          </p>
          <div className={styles.actions}>
            {view.variant === 'invalid' ? (
              <LinkButton href="/acceso/" size={52}>
                {verify.newLink}
              </LinkButton>
            ) : (
              <Button
                size={52}
                onClick={() => {
                  setRetried(true);
                  onConfirm();
                }}
              >
                {verify.retry}
              </Button>
            )}
          </div>
        </State>
      );
    }
  }
}

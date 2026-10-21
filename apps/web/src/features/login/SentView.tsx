import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { LinkButton } from '@/components/ui/LinkButton';
import { login } from '@/content/login';
import { MOCK_TOKEN } from '@/lib/api/mock-token';
import styles from './SentView.module.css';

interface SentViewProps {
  email: string;
  onReset: () => void;
}

/** Identical for every outcome: it must never reveal whether the email exists. */
export function SentView({ email, onReset }: SentViewProps) {
  const copy = login.sent;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The card swaps content, so keyboard and screen-reader users would be left
  // on a removed button; land them on the new heading instead.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={styles.view}>
      <Eyebrow>{copy.eyebrow}</Eyebrow>
      <h1
        ref={headingRef}
        id="login-heading"
        tabIndex={-1}
        className={styles.title}
      >
        {copy.title}
      </h1>
      <p className={styles.text}>
        {copy.before}
        <strong className={styles.email}>{email}</strong>
        {copy.after}
      </p>
      <div className={styles.actions}>
        {process.env.NEXT_PUBLIC_API_MODE === 'mock' ? (
          <LinkButton href={`/acceso/verificar/#token=${MOCK_TOKEN}`}>
            Simular: abrir el enlace
          </LinkButton>
        ) : null}
        <Button variant="outline" onClick={onReset}>
          {copy.reset}
        </Button>
      </div>
    </div>
  );
}

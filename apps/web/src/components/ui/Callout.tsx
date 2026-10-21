import type { ReactNode } from 'react';
import styles from './Callout.module.css';

interface CalloutProps {
  label: string;
  children: ReactNode;
}

export function Callout({ label, children }: CalloutProps) {
  return (
    <p className={styles.callout}>
      <strong className={styles.label}>{label}:</strong> {children}
    </p>
  );
}

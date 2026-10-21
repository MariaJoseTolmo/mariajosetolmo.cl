import type { ReactNode } from 'react';
import styles from './InfoCard.module.css';

interface InfoCardProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function InfoCard({ id, title, children }: InfoCardProps) {
  const headingId = `${id}-heading`;
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        {title}
      </h2>
      {children}
    </section>
  );
}

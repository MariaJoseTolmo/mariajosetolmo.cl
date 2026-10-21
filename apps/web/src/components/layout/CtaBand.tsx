import { LinkButton } from '@/components/ui/LinkButton';
import type { NavLink } from '@/content/types';
import styles from './CtaBand.module.css';

interface CtaBandProps {
  title: string;
  text?: string;
  cta: Pick<NavLink, 'label' | 'href'>;
  /** `band` is the full-width dark section; `card` is the compact rounded box. */
  variant?: 'band' | 'card';
}

export function CtaBand({ title, text, cta, variant = 'band' }: CtaBandProps) {
  const headingId = `cta-${variant}-h`;
  const isBand = variant === 'band';
  return (
    <section
      className={isBand ? styles.band : styles.card}
      aria-labelledby={headingId}
    >
      <div className={isBand ? styles.inner : styles.cardInner}>
        <div className={styles.copy}>
          <h2
            id={headingId}
            className={isBand ? styles.title : styles.cardTitle}
          >
            {title}
          </h2>
          {text ? <p className={styles.text}>{text}</p> : null}
        </div>
        <LinkButton href={cta.href} variant="on-dark" size={isBand ? 52 : 48}>
          {cta.label}
        </LinkButton>
      </div>
    </section>
  );
}

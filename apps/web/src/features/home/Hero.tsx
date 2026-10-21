import { CodeWindow } from '@/components/ui/CodeWindow';
import { LinkButton } from '@/components/ui/LinkButton';
import { home } from '@/content/home';
import styles from './Hero.module.css';

const SAMPLE_NOTE = 'Ejemplo según el contrato previsto de la API';

export function Hero() {
  const { eyebrow, title, lead, ctas, sample } = home.hero;
  const [primary, secondary] = ctas;
  return (
    <section className={styles.hero}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        <div className={styles.actions}>
          {primary ? (
            <LinkButton href={primary.href}>{primary.label}</LinkButton>
          ) : null}
          {secondary ? (
            <LinkButton href={secondary.href} variant="secondary">
              {secondary.label}
            </LinkButton>
          ) : null}
        </div>
      </div>
      <div className={styles.card}>
        <CodeWindow
          method={sample.method}
          path={sample.path}
          status={sample.status}
          code={sample.json}
          note={SAMPLE_NOTE}
        />
      </div>
    </section>
  );
}

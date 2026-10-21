import { SectionHeading } from '@/components/ui/SectionHeading';
import { home } from '@/content/home';
import styles from './Contributions.module.css';

const HEADING_ID = 'aporte';

export function Contributions() {
  const { eyebrow, title, items } = home.contributions;
  return (
    <section className={styles.band} aria-labelledby={HEADING_ID}>
      <div className={styles.inner}>
        <SectionHeading id={HEADING_ID} eyebrow={eyebrow} title={title} />
        <div className={styles.grid}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <p className={styles.meta}>{item.meta}</p>
              <h3 className={styles.title}>{item.title}</h3>
              <p className={styles.text}>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

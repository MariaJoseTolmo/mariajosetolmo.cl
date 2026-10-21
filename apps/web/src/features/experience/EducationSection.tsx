import { experience } from '@/content/experience';
import styles from './EducationSection.module.css';

const HEADING_ID = 'form-h';

export function EducationSection() {
  const { title, items } = experience.education;
  return (
    <section className={styles.section} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className={styles.title}>
        {title}
      </h2>
      <ul className={styles.list} role="list">
        {items.map((item) => (
          <li key={item.id} className={styles.entry}>
            <span>{item.title}</span>
            <span className={styles.period}>{item.period}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

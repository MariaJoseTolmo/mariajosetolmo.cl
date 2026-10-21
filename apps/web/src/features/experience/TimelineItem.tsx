import { Callout } from '@/components/ui/Callout';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import type { ExperienceItem } from '@/content/types';
import styles from './TimelineItem.module.css';

export function TimelineItem({ item }: { item: ExperienceItem }) {
  const { period, company, sector, role, highlights, achievement } = item;
  return (
    <li className={styles.item}>
      <div className={styles.meta}>
        <span className={styles.period}>{period}</span>
        <span className={styles.company}>{company}</span>
        <span className={styles.sector}>{sector}</span>
      </div>
      <div className={styles.body}>
        <h2 className={styles.role}>
          {role}
          <VisuallyHidden> · {company}</VisuallyHidden>
        </h2>
        <ul className={styles.highlights}>
          {highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
        <Callout label="Logro">{achievement}</Callout>
        {item.technologies ? (
          <p className={styles.technologies}>{item.technologies.join(' · ')}</p>
        ) : null}
      </div>
    </li>
  );
}

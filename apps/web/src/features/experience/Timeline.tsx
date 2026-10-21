import { experience } from '@/content/experience';
import { TimelineItem } from './TimelineItem';
import styles from './Timeline.module.css';

export function Timeline() {
  return (
    <ol
      className={styles.timeline}
      role="list"
      aria-label="Trayectoria laboral"
    >
      {experience.items.map((item) => (
        <TimelineItem key={item.id} item={item} />
      ))}
    </ol>
  );
}

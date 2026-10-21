import { recruiter } from '@/content/recruiter';
import type { Availability } from '@/lib/api/types';
import styles from './DetailsCard.module.css';
import { InfoCard } from './InfoCard';

/** The labels are static; every value comes from the API (`me.availability`). */
export function DetailsCard({ availability }: { availability: Availability }) {
  const copy = recruiter.availability;
  const rows = [
    [copy.modality, availability.modality],
    [copy.start, availability.start],
    [copy.salary, availability.salary],
  ];
  return (
    <InfoCard id="availability" title={copy.title}>
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.row}>
            <dt className={styles.term}>{label}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
    </InfoCard>
  );
}

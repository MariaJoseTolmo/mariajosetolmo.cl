import { Eyebrow } from './Eyebrow';
import styles from './SectionHeading.module.css';

interface SectionHeadingProps {
  /** Anchor id of the h2; sections reference it with aria-labelledby. */
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
}: SectionHeadingProps) {
  return (
    <div className={styles.heading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </div>
  );
}

import { Button } from '@/components/ui/Button';
import { recruiter } from '@/content/recruiter';
import styles from './CvCard.module.css';
import { InfoCard } from './InfoCard';

interface CvCardProps {
  onDownload: () => void;
  busy: boolean;
  /** Ready-made message of the last failure, or `null` when there is none. */
  error: string | null;
}

export function CvCard({ onDownload, busy, error }: CvCardProps) {
  const copy = recruiter.cv;
  return (
    <InfoCard id="cv" title={copy.title}>
      <p className={styles.text}>{copy.text}</p>
      <div className={styles.actions}>
        {/* aria-disabled (not disabled): focus must stay on the button. */}
        <Button
          size={44}
          onClick={busy ? undefined : onDownload}
          aria-disabled={busy}
        >
          {copy.download}
        </Button>
        <p role="status" className={styles.status}>
          {busy ? copy.preparing : ''}
        </p>
        {error ? (
          <p role="alert" className={styles.failed}>
            {error}
          </p>
        ) : null}
      </div>
    </InfoCard>
  );
}

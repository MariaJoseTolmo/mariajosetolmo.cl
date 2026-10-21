import type { PlaygroundEndpoint } from '@/lib/api/types';
import styles from './EndpointButton.module.css';

interface EndpointButtonProps {
  endpoint: PlaygroundEndpoint;
  selected: boolean;
  /** A request is in flight: clicks are ignored, but focus stays put. */
  busy: boolean;
  onSelect: (endpoint: PlaygroundEndpoint) => void;
}

export function EndpointButton({
  endpoint,
  selected,
  busy,
  onSelect,
}: EndpointButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={selected}
      aria-disabled={busy}
      onClick={busy ? undefined : () => onSelect(endpoint)}
    >
      <span className={styles.method}>GET</span>
      <span className={styles.path}>{endpoint}</span>
    </button>
  );
}

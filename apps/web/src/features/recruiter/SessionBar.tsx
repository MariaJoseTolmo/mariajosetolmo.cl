import { Button } from '@/components/ui/Button';
import { recruiter } from '@/content/recruiter';
import type { Role } from '@/lib/api/types';
import styles from './SessionBar.module.css';

interface SessionBarProps {
  email: string;
  role: Role;
  onLogout: () => void;
}

/** Content of the `session` header variant: who is in, and how to leave. */
export function SessionBar({ email, role, onLogout }: SessionBarProps) {
  return (
    <div className={styles.bar}>
      <span className={styles.pill}>
        <span className={styles.dot} aria-hidden="true" />
        {`${email} · rol ${role}`}
      </span>
      <Button variant="outline" size={44} onClick={onLogout}>
        {recruiter.session.logout}
      </Button>
    </div>
  );
}

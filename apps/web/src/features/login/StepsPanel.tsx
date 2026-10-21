import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { login } from '@/content/login';
import styles from './StepsPanel.module.css';

interface StepsPanelProps {
  /** Zero-based index of the step being shown on the left. */
  activeStep: number;
}

export function StepsPanel({ activeStep }: StepsPanelProps) {
  const { eyebrow, title, items, footnote } = login.steps;
  return (
    <aside className={styles.panel} aria-labelledby="steps-heading">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id="steps-heading" className={styles.title}>
          {title}
        </h2>
      </div>
      <ol className={styles.steps} role="list">
        {items.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={step.id}
              className={active ? styles.rowActive : styles.row}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={
                  active || done ? styles.numberReached : styles.number
                }
                aria-hidden="true"
              >
                {done ? '✓' : i + 1}
              </span>
              {done ? <VisuallyHidden>Completado</VisuallyHidden> : null}
              <span className={styles.text}>
                <span className={styles.endpoint}>{step.endpoint}</span>
                <span className={styles.detail}>{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className={styles.footnote}>{footnote}</p>
    </aside>
  );
}

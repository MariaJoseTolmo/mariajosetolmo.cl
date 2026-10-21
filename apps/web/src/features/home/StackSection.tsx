import { SectionHeading } from '@/components/ui/SectionHeading';
import { stack } from '@/content/stack';
import styles from './StackSection.module.css';

const HEADING_ID = 'stack-h';

export function StackSection() {
  return (
    <section id="stack" className={styles.section} aria-labelledby={HEADING_ID}>
      <SectionHeading
        id={HEADING_ID}
        eyebrow="02 / Stack"
        title="Lo que uso a diario y lo que estoy sumando."
      />
      <div className={styles.grid}>
        {stack.map((column) => (
          <div
            key={column.id}
            className={column.muted ? styles.columnMuted : styles.column}
          >
            <h3 className={styles.title}>{column.title}</h3>
            <ul className={styles.list}>
              {column.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

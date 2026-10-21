import { SectionHeading } from '@/components/ui/SectionHeading';
import { home } from '@/content/home';
import styles from './ArchitectureSection.module.css';

const HEADING_ID = 'como-h';

export function ArchitectureSection() {
  const { eyebrow, title, lead, nodes, chips } = home.architecture;
  return (
    <section id="como" className={styles.section} aria-labelledby={HEADING_ID}>
      <SectionHeading
        id={HEADING_ID}
        eyebrow={eyebrow}
        title={title}
        lead={lead}
      />
      <ol
        className={styles.flow}
        role="list"
        aria-label="Flujo de la web: frontend, API y datos"
      >
        {nodes.map((node) => (
          <li
            key={node.id}
            className={node.emphasis ? styles.nodeEmphasis : styles.node}
          >
            <span className={styles.label}>{node.label}</span>
            <h3 className={styles.nodeTitle}>{node.title}</h3>
            <p className={styles.nodeText}>{node.text}</p>
          </li>
        ))}
      </ol>
      <div className={styles.chips}>
        {chips.map((chip) => (
          <a key={chip.href} className={styles.chip} href={chip.href}>
            {chip.label}
          </a>
        ))}
      </div>
    </section>
  );
}

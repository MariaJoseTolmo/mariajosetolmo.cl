import { SectionHeading } from '@/components/ui/SectionHeading';
import { PROJECTS_HEADING_LINK, projects } from '@/content/projects';
import type { Project } from '@/content/types';
import styles from './ProjectsSection.module.css';

const HEADING_ID = 'proy-h';

function ProjectRow({ project }: { project: Project }) {
  const body = (
    <>
      <span className={styles.tags}>{project.tags}</span>
      <h3 className={styles.title}>{project.title}</h3>
      <p className={styles.summary}>{project.summary}</p>
    </>
  );
  return (
    <li className={styles.item}>
      {project.href ? (
        <a
          className={styles.row}
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${project.title} (repositorio en GitHub)`}
        >
          {body}
          <span className={styles.external} aria-hidden="true">
            ↗
          </span>
        </a>
      ) : (
        <div className={styles.row}>{body}</div>
      )}
    </li>
  );
}

export function ProjectsSection() {
  return (
    <section
      id="proyectos"
      className={styles.band}
      aria-labelledby={HEADING_ID}
    >
      <div className={styles.inner}>
        <div className={styles.header}>
          <SectionHeading
            id={HEADING_ID}
            eyebrow="03 / Proyectos"
            title="Casos de estudio, con decisiones explicadas."
          />
          <a className={styles.profile} href={PROJECTS_HEADING_LINK.href}>
            {PROJECTS_HEADING_LINK.label}
          </a>
        </div>
        <ul className={styles.list} role="list">
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </ul>
      </div>
    </section>
  );
}

import type { ContactLink, Project } from './types';

export const REPOSITORY_URL =
  'https://github.com/MariaJoseTolmo/mariajosetolmo.cl';

export const PROJECTS_HEADING_LINK: ContactLink = {
  label: 'github.com/MariaJoseTolmo →',
  href: 'https://github.com/MariaJoseTolmo',
};

export const projects: Project[] = [
  {
    id: 'portfolio',
    tags: 'NestJS · Next.js',
    title: 'Este portafolio: magic link, JWT y eventos',
    summary:
      'Arquitectura hexagonal, Redis, Kafka en local / SQS en producción y tests E2E del login.',
    href: REPOSITORY_URL,
  },
  {
    id: 'migration',
    tags: 'Java → Node.js',
    title: 'Migración de microservicios (anonimizado)',
    summary: 'Estrategia de migración, contratos de API y pruebas de paridad.',
  },
];

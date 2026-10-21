import type { StackColumn } from './types';

export const stack: StackColumn[] = [
  {
    id: 'avanzado',
    title: 'Avanzado',
    items: ['JavaScript', 'Node.js', 'NestJS', 'PostgreSQL'],
  },
  {
    id: 'produccion',
    title: 'En producción',
    items: [
      'TypeScript · Express.js',
      'Kafka en local / SQS en producción',
      'Redis · TypeORM',
      'JWT · OAuth · Swagger',
      'Docker · Jest · CI/CD',
    ],
  },
  {
    id: 'arquitectura',
    title: 'Arquitectura y prácticas',
    items: [
      'Hexagonal · Microservicios',
      'SOLID · Código limpio',
      'Spec-Driven Development',
      'Scrum · Kanban',
    ],
  },
  {
    id: 'aprendiendo',
    title: 'Aprendiendo',
    muted: true,
    items: [
      'AWS (Cloud Computing): aprendiendo, aplicado en este proyecto',
      'Java · Spring Boot',
      'Python',
    ],
  },
];

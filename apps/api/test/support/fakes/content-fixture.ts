import type { ContentSeed } from '../../../src/content/infrastructure/persistence/in-memory-content.repository';

/** Neutral content for e2e: five experience entries and the four levels. */
export const CONTENT_FIXTURE: ContentSeed = {
  profile: {
    name: 'Ana Example',
    role: 'Software engineer',
    architecture: 'Hexagonal services with a thin web layer',
    domains: ['web', 'cloud'],
    openToWork: true,
  },
  experience: [1, 2, 3, 4, 5].map((position) => ({
    id: `entry-${position}`,
    position,
    company: `Company ${position}`,
    role: `Role ${position}`,
    sector: `Sector ${position}`,
    period: `Period ${position}`,
    highlights: [`Highlight ${position}`],
    technologies: position % 2 === 0 ? [] : [`Tech ${position}`],
  })),
  skills: [
    { level: 'advanced', skills: ['TypeScript', 'Angular'] },
    { level: 'production', skills: ['NestJS', 'Postgres'] },
    { level: 'architecture', skills: ['Hexagonal'] },
    { level: 'learning', skills: ['Rust'] },
  ],
};

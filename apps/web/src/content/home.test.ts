import { home } from './home';
import { stack } from './stack';

describe('home content', () => {
  it('ships a hero sample that is valid JSON for GET /api/v1/profile', () => {
    expect(home.hero.sample.path).toBe('/api/v1/profile');
    const parsed = JSON.parse(home.hero.sample.json) as { stack: string[] };
    expect(parsed.stack).toContain('Kafka en local / SQS en producción');
  });

  it('points the two hero calls to action at access and experience', () => {
    expect(home.hero.ctas.map((c) => c.href)).toEqual([
      '/acceso/',
      '/experiencia/',
    ]);
  });

  it('has three contributions', () => {
    expect(home.contributions.items).toHaveLength(3);
  });
});

describe('stack content', () => {
  it('has four columns in the agreed order', () => {
    expect(stack.map((c) => c.title)).toEqual([
      'Avanzado',
      'En producción',
      'Arquitectura y prácticas',
      'Aprendiendo',
    ]);
  });
});

describe('architecture content', () => {
  const { architecture } = home;

  it('describes frontend, api and data in order, with the api emphasized', () => {
    expect(architecture.nodes.map((n) => [n.id, n.emphasis ?? false])).toEqual([
      ['frontend', false],
      ['api', true],
      ['datos', false],
    ]);
  });

  it('keeps the diagram copy honest about hosting', () => {
    const copy = architecture.nodes
      .map((n) => `${n.title} ${n.text}`)
      .join(' ');
    expect(copy).toContain('Next.js estático');
    expect(copy).toContain('S3 + CloudFront');
    expect(copy).toContain('NestJS · hexagonal');
    expect(copy).toContain('AWS Lambda');
    expect(copy).toContain('PostgreSQL · Redis');
  });

  it('presents AWS as something being learned, with the agreed lead', () => {
    expect(architecture.lead).toBe(
      'Sitio estático servido por CloudFront y una API NestJS propia en AWS Lambda. AWS es lo que estoy aprendiendo, aplicado en este proyecto. Puedes revisar la documentación de los endpoints y el estado de la API.',
    );
    expect(architecture.lead).toContain('aprendiendo');
  });

  it('links the chips to the real endpoints and the repository', () => {
    expect(architecture.chips.map((c) => c.href)).toEqual([
      '/api/docs',
      '/api/health',
      'https://github.com/MariaJoseTolmo/mariajosetolmo.cl',
    ]);
  });
});

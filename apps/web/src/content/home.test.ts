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

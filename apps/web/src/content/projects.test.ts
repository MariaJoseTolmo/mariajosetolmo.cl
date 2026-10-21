import { projects, PROJECTS_HEADING_LINK } from './projects';

const REPO = 'https://github.com/MariaJoseTolmo/mariajosetolmo.cl';

describe('projects content', () => {
  it('lists the two case studies in order', () => {
    expect(projects.map((p) => p.id)).toEqual(['portfolio', 'migration']);
  });

  it('links the portfolio project to the real repository', () => {
    expect(projects[0]?.href).toBe(REPO);
  });

  it('keeps the anonymized migration without a link', () => {
    expect(projects[1]?.href).toBeUndefined();
    expect(projects[1]?.title).toContain('anonimizado');
  });

  it('states Kafka only as "Kafka en local / SQS en producción"', () => {
    expect(projects[0]?.summary).toContain(
      'Kafka en local / SQS en producción',
    );
  });

  it('links the section header to the GitHub profile', () => {
    expect(PROJECTS_HEADING_LINK).toEqual({
      label: 'github.com/MariaJoseTolmo →',
      href: 'https://github.com/MariaJoseTolmo',
    });
  });
});

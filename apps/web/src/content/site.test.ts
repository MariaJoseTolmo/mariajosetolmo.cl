import { site } from './site';

describe('site content', () => {
  it('defines the five shared nav items in the required order', () => {
    expect(site.nav.map(({ label, href }) => [label, href])).toEqual([
      ['Experiencia', '/experiencia/'],
      ['Proyectos', '/#proyectos'],
      ['Stack', '/#stack'],
      ['Cómo está hecha', '/#como'],
      ['Acceso reclutadores', '/acceso/'],
    ]);
  });

  it('marks only the recruiter access item as the emphasized call to action', () => {
    const emphasized = site.nav.filter((item) => item.emphasis);
    expect(emphasized.map((item) => item.label)).toEqual([
      'Acceso reclutadores',
    ]);
  });

  it('exposes the owner name, domain and footer line', () => {
    expect(site.ownerName).toBe('María José Tolmo Tolmo');
    expect(site.domain).toBe('mariajosetolmo.cl');
    expect(site.footer).toBe('María José Tolmo Tolmo · Desarrolladora Backend');
  });

  it('lists public contact links with email, LinkedIn and GitHub', () => {
    expect(site.contact.map((c) => [c.label, c.href])).toEqual([
      ['mariajosetolmo@gmail.com', 'mailto:mariajosetolmo@gmail.com'],
      ['LinkedIn', 'https://linkedin.com/in/mariajosetolmo'],
      ['GitHub', 'https://github.com/MariaJoseTolmo'],
    ]);
  });

  it('adds the public phone only to the recruiter contact list, not the footer', () => {
    expect(site.recruiterContact.map((c) => [c.label, c.href])).toEqual([
      ['mariajosetolmo@gmail.com', 'mailto:mariajosetolmo@gmail.com'],
      ['+56 9 7453 6288', 'tel:+56974536288'],
      ['LinkedIn', 'https://linkedin.com/in/mariajosetolmo'],
      ['GitHub', 'https://github.com/MariaJoseTolmo'],
    ]);
    expect(site.contact.map((c) => c.href)).not.toContain('tel:+56974536288');
  });
});

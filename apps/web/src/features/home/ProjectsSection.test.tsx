import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { ProjectsSection } from './ProjectsSection';

describe('ProjectsSection', () => {
  it('is the #proyectos anchor, labelled by its heading', () => {
    const { container } = render(<ProjectsSection />);
    const region = screen.getByRole('region', {
      name: 'Casos de estudio, con decisiones explicadas.',
    });
    expect(region).toHaveAttribute('id', 'proyectos');
    expect(container.querySelectorAll('#proyectos')).toHaveLength(1);
    expect(within(region).getByText('03 / Proyectos')).toBeInTheDocument();
  });

  it('links the header to the GitHub profile', () => {
    render(<ProjectsSection />);
    expect(
      screen.getByRole('link', { name: 'github.com/MariaJoseTolmo →' }),
    ).toHaveAttribute('href', 'https://github.com/MariaJoseTolmo');
  });

  it('lists the two projects with their h3', () => {
    render(<ProjectsSection />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(
      items.map(
        (li) => within(li).getByRole('heading', { level: 3 }).textContent,
      ),
    ).toEqual([
      'Este portafolio: magic link, JWT y eventos',
      'Migración de microservicios (anonimizado)',
    ]);
  });

  it('links the portfolio row to the real repository', () => {
    render(<ProjectsSection />);
    const [first] = screen.getAllByRole('listitem');
    expect(
      within(first!).getByRole('link', {
        name: 'Este portafolio: magic link, JWT y eventos (repositorio en GitHub)',
      }),
    ).toHaveAttribute(
      'href',
      'https://github.com/MariaJoseTolmo/mariajosetolmo.cl',
    );
  });

  it('marks the repository link as external with a visible hint', () => {
    render(<ProjectsSection />);
    const link = screen.getByRole('link', { name: /repositorio en GitHub/ });
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('↗');
  });

  it('keeps the anonymized migration row without a link', () => {
    render(<ProjectsSection />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[1]!).queryByRole('link')).toBeNull();
    expect(items[1]).toHaveTextContent('pruebas de paridad');
  });

  it('states Kafka only together with SQS', () => {
    const { container } = render(<ProjectsSection />);
    const text = container.textContent ?? '';
    expect(text).toContain('Kafka en local / SQS en producción');
    expect(text).not.toMatch(/kafka(?! en local \/ SQS en producción)/i);
  });

  it('keeps list semantics despite list-style: none', () => {
    const { container } = render(<ProjectsSection />);
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProjectsSection />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

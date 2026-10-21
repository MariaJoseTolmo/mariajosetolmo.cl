import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { ArchitectureSection } from './ArchitectureSection';

describe('ArchitectureSection', () => {
  it('is the #como anchor, labelled by its heading', () => {
    const { container } = render(<ArchitectureSection />);
    const region = screen.getByRole('region', {
      name: 'El portafolio también es el código de muestra.',
    });
    expect(region).toHaveAttribute('id', 'como');
    expect(container.querySelectorAll('#como')).toHaveLength(1);
    expect(
      within(region).getByText('04 / Cómo está hecha esta web'),
    ).toBeInTheDocument();
  });

  it('draws frontend, api and data as three nodes in order', () => {
    render(<ArchitectureSection />);
    const nodes = screen.getAllByRole('listitem');
    expect(nodes).toHaveLength(3);
    expect(
      nodes.map(
        (n) => within(n).getByRole('heading', { level: 3 }).textContent,
      ),
    ).toEqual(['Next.js estático', 'NestJS · hexagonal', 'PostgreSQL · Redis']);
    expect(nodes[0]).toHaveTextContent('S3 + CloudFront');
    expect(nodes[1]).toHaveTextContent('AWS Lambda');
  });

  it('has exactly three list items and no decorative arrow items', () => {
    const { container } = render(<ArchitectureSection />);
    const list = container.querySelector('ol');
    expect(list?.children).toHaveLength(3);
    expect(list).toHaveAttribute('role', 'list');
    expect(
      screen.getByRole('list', {
        name: 'Flujo de la web: frontend, API y datos',
      }),
    ).toBe(list);
  });

  it('mentions AWS as something being learned', () => {
    const { container } = render(<ArchitectureSection />);
    expect(container.textContent).toContain('aprendiendo');
  });

  it('links the chips to real endpoints', () => {
    render(<ArchitectureSection />);
    expect(screen.getByRole('link', { name: '/api/docs' })).toHaveAttribute(
      'href',
      '/api/docs',
    );
    expect(screen.getByRole('link', { name: '/api/health' })).toHaveAttribute(
      'href',
      '/api/health',
    );
    expect(screen.getByRole('link', { name: 'Repositorio' })).toHaveAttribute(
      'href',
      'https://github.com/MariaJoseTolmo/mariajosetolmo.cl',
    );
  });

  it('never links to /status, /api-docs or back to #como', () => {
    render(<ArchitectureSection />);
    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) {
      expect(href).not.toMatch(/\/status|\/api-docs|#como/);
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(<ArchitectureSection />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

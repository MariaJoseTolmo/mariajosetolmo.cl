import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import RootLayout from './layout';
import Page from './page';
import { SkipLink } from '@/components/layout/SkipLink';

describe('home page (smoke)', () => {
  it('renders a single h1', () => {
    render(<Page />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders main#contenido as the skip-link target', () => {
    const { container } = render(<Page />);
    const main = container.querySelector('main#contenido');
    expect(main).not.toBeNull();
    expect(screen.getByRole('main')).toBe(main);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Page />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the shared nav with the five items and no current page', () => {
    const { container } = render(<Page />);
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual([
      'Experiencia',
      'Proyectos',
      'Stack',
      'Cómo está hecha',
      'Acceso reclutadores',
    ]);
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('orders header, hero, contributions, stack, projects, architecture, cta and footer', () => {
    const { container } = render(<Page />);
    const order = [
      'header',
      'main h1',
      'main #aporte',
      'main #stack-h',
      'main #proyectos',
      'main #como',
      'main #cta-band-h',
      'footer',
    ].map((selector) => container.querySelector(selector));
    order.forEach((el) => expect(el).not.toBeNull());
    for (let i = 1; i < order.length; i += 1) {
      expect(
        order[i - 1]!.compareDocumentPosition(order[i]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it.each(['proyectos', 'stack', 'como'])(
    'exposes exactly one #%s anchor used by the nav',
    (id) => {
      const { container } = render(<Page />);
      expect(container.querySelectorAll(`#${id}`)).toHaveLength(1);
    },
  );

  it('links the architecture chips to the real endpoints', () => {
    const { container } = render(<Page />);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(expect.arrayContaining(['/api/docs', '/api/health']));
    for (const href of hrefs) {
      expect(href).not.toMatch(/\/status|\/api-docs/);
    }
  });

  it('closes with the access call to action', () => {
    render(<Page />);
    const cta = screen.getByRole('region', {
      name: '¿Buscas una desarrolladora backend Node.js?',
    });
    expect(within(cta).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/acceso\/?$/),
    );
  });

  it('shows the footer name', () => {
    render(<Page />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'María José Tolmo Tolmo',
    );
  });

  it('never mentions Kafka without SQS and has no Word or scheduling CTA', () => {
    const { container } = render(<Page />);
    const text = container.textContent ?? '';
    expect(text).toContain('Kafka en local / SQS en producción');
    expect(text).not.toMatch(/kafka(?! en local \/ SQS en producción)/i);
    expect(text).not.toMatch(/\bWord\b|agendar/i);
  });

  it('declares lang="es" on the root layout', () => {
    const tree = RootLayout({ children: null }) as ReactElement<{
      lang: string;
    }>;
    expect(tree.props.lang).toBe('es');
  });

  it('renders the skip link as the first element of the body', () => {
    const tree = RootLayout({ children: null }) as ReactElement<{
      children: ReactElement<{ children: ReactElement[] }>;
    }>;
    const [first] = tree.props.children.props.children;
    expect(first?.type).toBe(SkipLink);
  });
});

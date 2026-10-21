import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { site } from '@/content/site';
import { SiteHeader } from './SiteHeader';

// Jest renders next/link hrefs without the trailing slash; the production
// static export keeps it (trailingSlash: true), so compare slash-trimmed.
const trimSlash = (href: string) => href.replace(/(?<=[^/])\/$/, '');

function mainNavSummary() {
  const nav = screen.getByRole('navigation', { name: 'Principal' });
  return within(nav)
    .getAllByRole('link')
    .map((a) => [a.textContent, a.getAttribute('href')]);
}

describe('SiteHeader public variant', () => {
  it('lists the five shared items in the required order', () => {
    render(<SiteHeader variant="public" currentPath="/" />);
    expect(mainNavSummary()).toEqual(
      site.nav.map(({ label, href }) => [label, trimSlash(href)]),
    );
  });

  it('renders an identical nav regardless of the current page', () => {
    const { unmount } = render(<SiteHeader variant="public" currentPath="/" />);
    const onHome = mainNavSummary();
    unmount();
    render(<SiteHeader variant="public" currentPath="/experiencia/" />);
    expect(mainNavSummary()).toEqual(onHome);
    expect(onHome).toHaveLength(5);
  });

  it('marks only the current route with aria-current="page"', () => {
    const { container } = render(
      <SiteHeader variant="public" currentPath="/experiencia/" />,
    );
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Experiencia']);
    // The mobile panel mirrors the same rule.
    container
      .querySelectorAll('[aria-current]')
      .forEach((el) => expect(el.textContent).toBe('Experiencia'));
    expect(container.querySelectorAll('[aria-current]').length).toBeGreaterThan(
      0,
    );
  });

  it('marks no item on the home page and none for an unrelated path', () => {
    const { container, rerender } = render(
      <SiteHeader variant="public" currentPath="/" />,
    );
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0);
    rerender(<SiteHeader variant="public" currentPath="/acceso/" />);
    const current = [...container.querySelectorAll('[aria-current]')];
    expect(current.length).toBeGreaterThan(0);
    current.forEach((el) => expect(el.textContent).toBe('Acceso reclutadores'));
  });

  it('links the logo to the home page', () => {
    render(<SiteHeader variant="public" currentPath="/" />);
    expect(
      screen.getByRole('link', { name: 'mariajosetolmo.cl' }),
    ).toHaveAttribute('href', '/');
  });

  it('includes the mobile menu toggle', () => {
    render(<SiteHeader variant="public" currentPath="/" />);
    expect(screen.getByRole('button', { name: 'Menú' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <SiteHeader variant="public" currentPath="/experiencia/" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SiteHeader minimal variant', () => {
  it('keeps the logo and drops the main nav and the menu', () => {
    render(<SiteHeader variant="minimal" />);
    expect(
      screen.getByRole('link', { name: 'mariajosetolmo.cl' }),
    ).toHaveAttribute('href', '/');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<SiteHeader variant="minimal" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('SiteHeader session variant', () => {
  it('keeps the logo and renders the session slot instead of the nav', () => {
    render(
      <SiteHeader variant="session">
        <span>sesion activa</span>
      </SiteHeader>,
    );
    expect(
      screen.getByRole('link', { name: 'mariajosetolmo.cl' }),
    ).toHaveAttribute('href', '/');
    expect(screen.getByText('sesion activa')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <SiteHeader variant="session">
        <span>sesion activa</span>
      </SiteHeader>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

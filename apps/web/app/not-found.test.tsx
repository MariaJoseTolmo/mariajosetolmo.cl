import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import NotFound from './not-found';

describe('404 page', () => {
  it('has a single Spanish h1', () => {
    render(<NotFound />);
    expect(
      screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent),
    ).toEqual(['Página no encontrada']);
  });

  it('offers a way back to the home page', () => {
    render(<NotFound />);
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('link', { name: 'Volver al inicio' }),
    ).toHaveAttribute('href', '/');
  });

  it('keeps the site header and footer, and the skip-link target', () => {
    render(<NotFound />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Principal' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido');
  });

  it('marks no nav item as the current page', () => {
    const { container } = render(<NotFound />);
    expect(container.querySelector('[aria-current]')).toBeNull();
  });

  it('passes axe', async () => {
    const { container } = render(<NotFound />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

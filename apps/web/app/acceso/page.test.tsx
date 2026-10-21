import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import AccessPage from './page';

describe('access page', () => {
  it('renders a single h1 and the skip-link target', () => {
    const { container } = render(<AccessPage />);
    expect(
      screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent),
    ).toEqual(['Acceso para reclutadores']);
    expect(container.querySelectorAll('main#contenido')).toHaveLength(1);
  });

  it('uses the minimal header with a way back to the home page', () => {
    render(<AccessPage />);
    expect(
      screen.getByRole('link', { name: 'Volver al inicio' }),
    ).toHaveAttribute('href', '/');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows the form next to the steps panel inside main', () => {
    render(<AccessPage />);
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByLabelText('Correo corporativo'));
    expect(main).toContainElement(
      screen.getByRole('complementary', {
        name: 'Qué hace la API NestJS en cada paso',
      }),
    );
  });

  it('shows the shared footer', () => {
    render(<AccessPage />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'María José Tolmo Tolmo',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<AccessPage />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('access page layout', () => {
  const css = readFileSync(join(__dirname, 'page.module.css'), 'utf8');

  it('lets the card and the panel wrap on narrow screens', () => {
    const rule = /\.page\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/flex-wrap:\s*wrap/);
    expect(rule).toMatch(/max-width:\s*var\(--container\)/);
  });
});

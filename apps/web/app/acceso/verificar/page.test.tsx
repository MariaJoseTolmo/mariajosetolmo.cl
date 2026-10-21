import { act, render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import VerifyPage, { metadata } from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

afterEach(() => window.history.replaceState(null, '', '/'));

describe('verify page', () => {
  it('is excluded from search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('renders a single h1 and the skip-link target', async () => {
    window.history.replaceState(null, '', '/acceso/verificar/#token=abc');
    const { container } = render(<VerifyPage />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Confirma tu ingreso',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(container.querySelectorAll('main#contenido')).toHaveLength(1);
  });

  it('uses the minimal header and the shared footer', () => {
    render(<VerifyPage />);
    expect(
      screen.getByRole('link', { name: 'Volver al inicio' }),
    ).toHaveAttribute('href', '/');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'María José Tolmo Tolmo',
    );
  });

  it('lays the card and the steps panel out inside main', async () => {
    window.history.replaceState(null, '', '/acceso/verificar/#token=abc');
    render(<VerifyPage />);
    await screen.findByText('Confirma tu ingreso');
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByRole('complementary'));
    expect(main).toContainElement(
      screen.getByRole('button', { name: 'Confirmar ingreso' }),
    );
  });

  it('has no axe violations', async () => {
    window.history.replaceState(null, '', '/acceso/verificar/#token=abc');
    const { container } = render(<VerifyPage />);
    await screen.findByText('Confirma tu ingreso');
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(await axe(container)).toHaveNoViolations();
  });
});

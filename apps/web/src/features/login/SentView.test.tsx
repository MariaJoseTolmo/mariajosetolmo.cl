import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { SentView } from './SentView';

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;
afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
});

describe('SentView', () => {
  it('shows the neutral message with the email (announced by the container)', () => {
    const { container } = render(
      <SentView email="ana@empresa.com" onReset={jest.fn()} />,
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(container).toHaveTextContent(
      'Si ana@empresa.com es válido, recibirás un enlace en unos segundos. Vence en 15 minutos y sirve una sola vez.',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Revisa tu correo' }),
    ).toHaveAttribute('id', 'login-heading');
    expect(screen.getByText('202 Accepted')).toBeInTheDocument();
  });

  it('shows the email in a different position for a different address', () => {
    render(<SentView email="otra@firma.cl" onReset={jest.fn()} />);
    expect(screen.getByText('otra@firma.cl')).toBeInTheDocument();
  });

  it('moves focus to the heading on mount, and the heading is programmatically focusable', () => {
    render(<SentView email="a@b.cl" onReset={jest.fn()} />);
    const heading = screen.getByRole('heading', { name: 'Revisa tu correo' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading).toHaveFocus();
  });

  it('calls onReset from "Usar otro correo"', async () => {
    const onReset = jest.fn();
    render(<SentView email="a@b.cl" onReset={onReset} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Usar otro correo' }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('offers the simulate link only in mock mode', () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const { unmount } = render(<SentView email="a@b.cl" onReset={jest.fn()} />);
    const link = screen.getByRole('link', { name: 'Simular: abrir el enlace' });
    // next/link drops the trailing slash under Jest; the export keeps it.
    expect(link.getAttribute('href')).toMatch(
      /^\/acceso\/verificar\/?#token=mock-token$/,
    );
    // "Reiniciar demo" belongs to the verify done state, never to sent.
    expect(screen.queryByText(/Reiniciar demo/)).toBeNull();
    unmount();

    process.env.NEXT_PUBLIC_API_MODE = 'http';
    render(<SentView email="a@b.cl" onReset={jest.fn()} />);
    expect(screen.queryByText(/Simular/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('has no simulate control when the mode is unset', () => {
    delete process.env.NEXT_PUBLIC_API_MODE;
    render(<SentView email="a@b.cl" onReset={jest.fn()} />);
    expect(screen.queryByText(/Simular/)).toBeNull();
  });

  it('has no axe violations in either mode', async () => {
    for (const mode of ['mock', 'http']) {
      process.env.NEXT_PUBLIC_API_MODE = mode;
      const { container, unmount } = render(
        <SentView email="a@b.cl" onReset={jest.fn()} />,
      );
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(await axe(container)).toHaveNoViolations();
      unmount();
    }
  });
});

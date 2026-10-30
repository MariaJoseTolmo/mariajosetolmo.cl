import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import type { ApiFailure } from '@/lib/api/types';
import type { VerifyViewState } from './verifyReducer';
import { VerifyView } from './VerifyView';

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;
afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
});

function setup(view: VerifyViewState) {
  const onConfirm = jest.fn();
  const onResetDemo = jest.fn();
  const utils = render(
    <VerifyView view={view} onConfirm={onConfirm} onResetDemo={onResetDemo} />,
  );
  return { onConfirm, onResetDemo, ...utils };
}

const heading = () => screen.getByRole('heading', { level: 1 });

describe('VerifyView', () => {
  it('is neutral while pending: no verdict, no actions, no focus grab', () => {
    setup({ status: 'pending' });
    expect(heading()).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(heading()).not.toHaveFocus();
  });

  it('asks for an explicit confirmation when ready', async () => {
    const { onConfirm } = setup({ status: 'ready' });
    expect(heading()).toHaveTextContent('Confirma tu ingreso');
    expect(heading()).not.toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar ingreso' }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('marks the button aria-disabled (still focusable) and announces it while confirming', async () => {
    const { onConfirm } = setup({ status: 'confirming' });
    const button = screen.getByRole('button', { name: 'Confirmar ingreso' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando…');
    await userEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps one live region that is empty until confirming starts', () => {
    const { rerender } = setup({ status: 'ready' });
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    expect(
      screen.getByRole('button', { name: 'Confirmar ingreso' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
    rerender(
      <VerifyView
        view={{ status: 'confirming' }}
        onConfirm={jest.fn()}
        onResetDemo={jest.fn()}
      />,
    );
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Confirmando…');
  });

  it('welcomes the user when done, links to the recruiter zone and takes focus', () => {
    setup({ status: 'done' });
    expect(heading()).toHaveTextContent('Bienvenida, bienvenido');
    expect(heading()).toHaveAttribute('tabindex', '-1');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Entrar a la zona reclutador' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/reclutador\/?$/));
  });

  it('explains an invalid link and offers a new one', () => {
    setup({ status: 'error', variant: 'invalid' });
    expect(heading()).toHaveTextContent('Este enlace no es válido');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Pedir un nuevo enlace' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/acceso\/?$/));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('blocks with the 403 eyebrow and the official-site copy, with a retry', async () => {
    const { onConfirm } = setup({
      status: 'error',
      variant: 'blocked',
      failure: {
        error: 'forbidden',
        status: 403,
        reason: 'ORIGIN_NOT_ALLOWED',
      },
    });
    expect(screen.getByText('403 Forbidden')).toBeInTheDocument();
    expect(heading()).toHaveTextContent('Acceso bloqueado');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByText(/La solicitud no llegó desde el sitio oficial/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Este enlace no es válido/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('describes the title with the error text so it is announced on focus', () => {
    const { unmount } = setup({
      status: 'error',
      variant: 'rate-limited',
      failure: { error: 'rate-limited', status: 429, retryAfterSeconds: 120 },
    });
    expect(heading()).toHaveAccessibleDescription(
      'Hiciste demasiados intentos. Espera 2 minutos y vuelve a intentarlo.',
    );
    unmount();
    setup({
      status: 'error',
      variant: 'blocked',
      failure: { error: 'forbidden', status: 403, reason: 'ROLE_NOT_ALLOWED' },
    });
    expect(heading()).toHaveAccessibleDescription(
      'Tu rol no tiene permiso para ver este recurso.',
    );
  });

  it('describes the invalid-link title with its text too', () => {
    setup({ status: 'error', variant: 'invalid' });
    expect(heading()).toHaveAccessibleDescription(/Pide uno nuevo/);
  });

  it('uses a neutral eyebrow for unavailable, whatever the cause', () => {
    for (const failure of [
      { error: 'network' },
      { error: 'server', status: 503 },
      { error: 'unexpected', status: 418 },
    ] as const) {
      const { unmount } = setup({
        status: 'error',
        variant: 'unavailable',
        failure,
      });
      expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
      unmount();
    }
  });

  it('gives a role 403 its own copy instead of the official-site one', () => {
    setup({
      status: 'error',
      variant: 'blocked',
      failure: { error: 'forbidden', status: 403, reason: 'ROLE_NOT_ALLOWED' },
    });
    expect(screen.getByText(/Tu rol no tiene permiso/)).toBeInTheDocument();
    expect(screen.queryByText(/sitio oficial/)).toBeNull();
  });

  it('tells apart too many attempts, with the wait time and a retry', async () => {
    const { onConfirm } = setup({
      status: 'error',
      variant: 'rate-limited',
      failure: { error: 'rate-limited', status: 429, retryAfterSeconds: 120 },
    });
    expect(heading()).toHaveTextContent('Demasiados intentos');
    expect(screen.getByText(/Espera 2 minutos/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses a neutral wait when the API gave no time', () => {
    setup({
      status: 'error',
      variant: 'rate-limited',
      failure: { error: 'rate-limited', status: 429 },
    });
    expect(screen.getByText(/Espera unos minutos/)).toBeInTheDocument();
  });

  it('tells apart a network problem and lets the user retry', async () => {
    const { onConfirm } = setup({
      status: 'error',
      variant: 'unavailable',
      failure: { error: 'network' },
    });
    expect(heading()).toHaveTextContent('No pudimos confirmar tu ingreso');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByText(/No pudimos conectar con el servidor/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Este enlace no es válido')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it.each<[string, ApiFailure, RegExp]>([
    [
      'server 500',
      { error: 'server', status: 500 },
      /Algo falló de nuestro lado/,
    ],
    [
      'unavailable 503',
      { error: 'server', status: 503, reason: 'SERVICE_UNAVAILABLE' },
      /El servicio no está disponible/,
    ],
    [
      'unexpected',
      { error: 'unexpected', status: 418 },
      /respuesta inesperada/,
    ],
  ])('explains %s from the dictionary with a retry', (_n, failure, text) => {
    setup({ status: 'error', variant: 'unavailable', failure });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });

  it('offers "Reiniciar demo" in the done state of mock mode only', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const mock = setup({ status: 'done' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Reiniciar demo' }),
    );
    expect(mock.onResetDemo).toHaveBeenCalledTimes(1);
    // "Simular" belongs to the login sent state, never to done.
    expect(screen.queryByText(/Simular/)).toBeNull();
    mock.unmount();

    process.env.NEXT_PUBLIC_API_MODE = 'http';
    setup({ status: 'done' });
    expect(screen.queryByText(/Reiniciar demo/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('never shows "Reiniciar demo" outside the done state', () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    setup({ status: 'ready' });
    expect(screen.queryByText(/Reiniciar demo/)).toBeNull();
  });

  it.each<[string, VerifyViewState]>([
    ['pending', { status: 'pending' }],
    ['ready', { status: 'ready' }],
    ['confirming', { status: 'confirming' }],
    ['done', { status: 'done' }],
    ['invalid', { status: 'error', variant: 'invalid' }],
    [
      'blocked',
      {
        status: 'error',
        variant: 'blocked',
        failure: { error: 'forbidden', status: 403, reason: 'CDN_REQUIRED' },
      },
    ],
    [
      'rate-limited',
      {
        status: 'error',
        variant: 'rate-limited',
        failure: { error: 'rate-limited', status: 429, retryAfterSeconds: 60 },
      },
    ],
    [
      'unavailable',
      {
        status: 'error',
        variant: 'unavailable',
        failure: { error: 'server', status: 503 },
      },
    ],
  ])(
    'has no axe violations in the %s state (mock and http)',
    async (_n, view) => {
      for (const mode of ['mock', 'http']) {
        process.env.NEXT_PUBLIC_API_MODE = mode;
        const { container, unmount } = setup(view);
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
        expect(await axe(container)).toHaveNoViolations();
        unmount();
      }
    },
  );
});

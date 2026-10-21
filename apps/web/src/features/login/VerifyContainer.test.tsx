import { renderToString } from 'react-dom/server';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import type { ApiGateway } from '@/lib/api/port';
import type { ApiResult } from '@/lib/api/types';
import { VerifyContainer } from './VerifyContainer';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;
afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
  window.history.replaceState(null, '', '/');
  replace.mockClear();
});

const unused = () => Promise.reject(new Error('not used by the verify page'));
const OK: ApiResult<void> = { ok: true, data: undefined };

function fakeGateway(overrides: Partial<ApiGateway>): ApiGateway {
  return {
    requestMagicLink: unused,
    verifyToken: unused,
    getMe: unused,
    getCvLink: unused,
    logout: unused,
    call: unused,
    ...overrides,
  };
}

function setup(
  url: string,
  verifyToken: ApiGateway['verifyToken'] = jest.fn(() => Promise.resolve(OK)),
  extra: Partial<ApiGateway> = {},
) {
  window.history.replaceState(null, '', url);
  const gatewayLoader = jest.fn(() =>
    Promise.resolve(fakeGateway({ verifyToken, ...extra })),
  );
  const user = userEvent.setup();
  const view = render(<VerifyContainer gatewayLoader={gatewayLoader} />);
  return { verifyToken, gatewayLoader, user, ...view };
}

const confirmButton = () =>
  screen.getByRole('button', { name: 'Confirmar ingreso' });
const activeStep = () =>
  screen
    .getAllByRole('listitem')
    .findIndex((li) => li.getAttribute('aria-current') === 'step');

describe('VerifyContainer', () => {
  it('prerenders the neutral state, never the invalid-link verdict', () => {
    const html = renderToString(<VerifyContainer />);
    expect(html).toContain('Cargando…');
    expect(html).not.toContain('no es válido');
    expect(html).not.toContain('Confirmar ingreso');
  });

  it('captures the fragment token, clears the URL and does not consume it', async () => {
    const { verifyToken, gatewayLoader } = setup(
      '/acceso/verificar/#token=abc',
    );
    expect(
      await screen.findByRole('heading', { name: 'Confirma tu ingreso' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/acceso/verificar/');
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(gatewayLoader).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
    expect(activeStep()).toBe(2);
  });

  it('verifies once with the captured token on explicit confirmation', async () => {
    const { verifyToken, user } = setup('/acceso/verificar/#token=abc');
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    const done = await screen.findByRole('heading', {
      name: 'Bienvenida, bienvenido',
    });
    expect(verifyToken).toHaveBeenCalledTimes(1);
    expect(verifyToken).toHaveBeenCalledWith('abc');
    expect(done).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Entrar a la zona reclutador' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/reclutador\/?$/));
    expect(activeStep()).toBe(3);
  });

  it('verifies a different token when the fragment carries another one', async () => {
    const { verifyToken, user } = setup('/acceso/verificar/#token=xyz-9');
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    await screen.findByText('Bienvenida, bienvenido');
    expect(verifyToken).toHaveBeenCalledWith('xyz-9');
  });

  it('sends a single request when the handler fires twice before React re-renders', async () => {
    let resolve: (value: ApiResult<void>) => void = () => undefined;
    const pending = jest.fn(
      () =>
        new Promise<ApiResult<void>>((r) => {
          resolve = r;
        }),
    );
    setup('/acceso/verificar/#token=abc', pending);
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    const button = confirmButton();
    await act(async () => {
      // Both clicks run before React gets a chance to re-render.
      button.click();
      button.click();
      await Promise.resolve();
    });
    await waitFor(() => expect(pending).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando…');
    expect(
      screen.getByRole('button', { name: 'Confirmar ingreso' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await act(() => {
      resolve(OK);
      return Promise.resolve();
    });
    await screen.findByText('Bienvenida, bienvenido');
    expect(pending).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the confirm button while confirming', async () => {
    const pending = jest.fn(
      () => new Promise<ApiResult<void>>(() => undefined),
    );
    const { user } = setup('/acceso/verificar/#token=abc', pending);
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    await waitFor(() => expect(pending).toHaveBeenCalled());
    expect(confirmButton()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando…');
  });

  it('moves focus to the heading of the next state when retrying', async () => {
    const pending = jest
      .fn<ReturnType<ApiGateway['verifyToken']>, [string]>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockImplementationOnce(() => new Promise(() => undefined));
    const { user } = setup('/acceso/verificar/#token=abc', pending);
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    await screen.findByRole('heading', {
      name: 'No pudimos confirmar tu ingreso',
    });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    const heading = await screen.findByRole('heading', {
      name: 'Confirma tu ingreso',
    });
    expect(heading).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando…');
  });

  describe('when a new link is opened in the same tab', () => {
    function openLink(token: string) {
      window.history.replaceState(
        null,
        '',
        `/acceso/verificar/#token=${token}`,
      );
      act(() => {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
    }

    it('restarts at the confirmation with the new token (ready)', async () => {
      const { verifyToken, user } = setup('/acceso/verificar/#token=first');
      await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
      openLink('second');
      await user.click(confirmButton());
      await screen.findByText('Bienvenida, bienvenido');
      expect(verifyToken).toHaveBeenCalledTimes(1);
      expect(verifyToken).toHaveBeenCalledWith('second');
      expect(window.location.hash).toBe('');
    });

    it('restarts at the confirmation after a successful sign-in (done)', async () => {
      const { verifyToken, user } = setup('/acceso/verificar/#token=first');
      await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
      await user.click(confirmButton());
      await screen.findByText('Bienvenida, bienvenido');
      openLink('second');
      expect(
        await screen.findByRole('heading', { name: 'Confirma tu ingreso' }),
      ).toBeInTheDocument();
      await user.click(confirmButton());
      await screen.findByText('Bienvenida, bienvenido');
      expect(verifyToken).toHaveBeenNthCalledWith(2, 'second');
    });

    it('restarts after an invalid link (error)', async () => {
      const { verifyToken, user } = setup('/acceso/verificar/');
      await screen.findByRole('heading', { name: 'Este enlace no es válido' });
      openLink('fresh');
      await user.click(
        await screen.findByRole('button', { name: 'Confirmar ingreso' }),
      );
      await screen.findByText('Bienvenida, bienvenido');
      expect(verifyToken).toHaveBeenCalledWith('fresh');
    });

    it('drops a confirmation still in flight for the old token (confirming)', async () => {
      let resolveFirst: (value: ApiResult<void>) => void = () => undefined;
      const verifyToken = jest
        .fn<ReturnType<ApiGateway['verifyToken']>, [string]>()
        .mockImplementationOnce(
          () =>
            new Promise<ApiResult<void>>((r) => {
              resolveFirst = r;
            }),
        )
        .mockResolvedValue(OK);
      const { user } = setup('/acceso/verificar/#token=first', verifyToken);
      await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
      await user.click(confirmButton());
      await waitFor(() => expect(verifyToken).toHaveBeenCalledTimes(1));
      openLink('second');
      await act(() => {
        resolveFirst({ ok: false, error: 'invalid-token' });
        return Promise.resolve();
      });
      expect(
        screen.getByRole('heading', { name: 'Confirma tu ingreso' }),
      ).toBeInTheDocument();
      await user.click(confirmButton());
      await screen.findByText('Bienvenida, bienvenido');
      expect(verifyToken).toHaveBeenNthCalledWith(2, 'second');
    });
  });

  it('shows the invalid link, with a way back, when the API rejects the token', async () => {
    const rejected = jest.fn(() =>
      Promise.resolve<ApiResult<void>>({ ok: false, error: 'invalid-token' }),
    );
    const { user } = setup('/acceso/verificar/#token=old', rejected);
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    const heading = await screen.findByRole('heading', {
      name: 'Este enlace no es válido',
    });
    expect(heading).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Pedir un nuevo enlace' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/acceso\/?$/));
  });

  it('distinguishes a network failure and retries with the same token', async () => {
    const verifyToken = jest
      .fn<ReturnType<ApiGateway['verifyToken']>, [string]>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce(OK);
    const { user } = setup('/acceso/verificar/#token=abc', verifyToken);
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    await screen.findByRole('heading', {
      name: 'No pudimos confirmar tu ingreso',
    });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Bienvenida, bienvenido');
    expect(verifyToken).toHaveBeenCalledTimes(2);
    expect(verifyToken).toHaveBeenNthCalledWith(2, 'abc');
  });

  it('treats a gateway that cannot load as a network failure', async () => {
    window.history.replaceState(null, '', '/acceso/verificar/#token=abc');
    const user = userEvent.setup();
    render(
      <VerifyContainer
        gatewayLoader={() => Promise.reject(new Error('chunk failed'))}
      />,
    );
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos confirmar tu ingreso',
      }),
    ).toBeInTheDocument();
  });

  it('shows the invalid link without a token and never calls the API', async () => {
    const { verifyToken, gatewayLoader } = setup('/acceso/verificar/');
    expect(
      await screen.findByRole('heading', { name: 'Este enlace no es válido' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Pedir un nuevo enlace' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/acceso\/?$/));
    expect(gatewayLoader).not.toHaveBeenCalled();
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('ignores ?token= in the query string', async () => {
    const { verifyToken } = setup('/acceso/verificar/?token=abc');
    expect(
      await screen.findByRole('heading', { name: 'Este enlace no es válido' }),
    ).toBeInTheDocument();
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('keeps the steps panel next to the card', async () => {
    setup('/acceso/verificar/#token=abc');
    await screen.findByText('Confirma tu ingreso');
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Confirma tu ingreso' }),
    ).toBeInTheDocument();
  });

  it('resets the demo: logs out and goes back to the login', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const logout = jest.fn(() => Promise.resolve(OK));
    const { user } = setup(
      '/acceso/verificar/#token=abc',
      jest.fn(() => Promise.resolve(OK)),
      { logout },
    );
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    await user.click(
      await screen.findByRole('button', { name: 'Reiniciar demo' }),
    );
    expect(logout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/acceso/'));
  });

  it('goes back to the login even if the demo logout cannot run', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const { user } = setup(
      '/acceso/verificar/#token=abc',
      jest.fn(() => Promise.resolve(OK)),
      { logout: () => Promise.reject(new Error('boom')) },
    );
    await screen.findByRole('heading', { name: 'Confirma tu ingreso' });
    await user.click(confirmButton());
    await user.click(
      await screen.findByRole('button', { name: 'Reiniciar demo' }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/acceso/'));
  });

  it('works end to end with the default (mock) gateway', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    window.history.replaceState(
      null,
      '',
      '/acceso/verificar/#token=mock-token',
    );
    const user = userEvent.setup();
    render(<VerifyContainer />);
    await user.click(
      await screen.findByRole('button', { name: 'Confirmar ingreso' }),
    );
    expect(
      await screen.findByText('Bienvenida, bienvenido'),
    ).toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(1);
    window.sessionStorage.clear();
  });

  it.each(['ready', 'done', 'invalid'] as const)(
    'has no axe violations in the %s state',
    async (state) => {
      process.env.NEXT_PUBLIC_API_MODE = 'mock';
      const { user, container } = setup(
        state === 'invalid'
          ? '/acceso/verificar/'
          : '/acceso/verificar/#token=abc',
      );
      await screen.findByRole('heading', { level: 1 });
      if (state === 'done') {
        await user.click(
          await screen.findByRole('button', { name: 'Confirmar ingreso' }),
        );
        await screen.findByText('Bienvenida, bienvenido');
      }
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(await axe(container)).toHaveNoViolations();
      expect(
        within(container).getAllByRole('heading', { level: 1 }),
      ).toHaveLength(1);
    },
  );
});

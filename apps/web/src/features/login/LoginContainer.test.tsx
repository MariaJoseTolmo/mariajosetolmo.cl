import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import type { ApiGateway } from '@/lib/api/port';
import type { ApiFailure, ApiResult, MagicLinkRequest } from '@/lib/api/types';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { login } from '@/content/login';
import { loginOverrides } from './loginOverrides';
import { LoginContainer } from './LoginContainer';

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;
afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
  window.sessionStorage.clear();
});

const unused = () => Promise.reject(new Error('not used by the login page'));

function fakeGateway(
  requestMagicLink: ApiGateway['requestMagicLink'],
): ApiGateway {
  return {
    requestMagicLink,
    verifyToken: unused,
    getMe: unused,
    getCvLink: unused,
    logout: unused,
    call: unused,
  };
}

const respondWith = (result: ApiResult<void>) =>
  jest.fn(() => Promise.resolve(result));

function setup(
  requestMagicLink: ApiGateway['requestMagicLink'] = respondWith({
    ok: true,
    data: undefined,
  }),
) {
  const gatewayLoader = jest.fn(() =>
    Promise.resolve(fakeGateway(requestMagicLink)),
  );
  const user = userEvent.setup();
  const view = render(<LoginContainer gatewayLoader={gatewayLoader} />);
  return { requestMagicLink, gatewayLoader, user, ...view };
}

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  address = 'ana@empresa.com',
) {
  await user.type(screen.getByLabelText('Correo corporativo'), address);
  await user.click(
    screen.getByRole('button', { name: 'Enviar enlace de acceso' }),
  );
}

const activeStep = () =>
  screen
    .getAllByRole('listitem')
    .findIndex((li) => li.getAttribute('aria-current') === 'step');

describe('LoginContainer', () => {
  it('starts on the form with the first step highlighted', () => {
    setup();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Acceso para reclutadores',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(activeStep()).toBe(0);
  });

  it('labels the card by the current heading', () => {
    setup();
    expect(
      screen.getByRole('region', { name: 'Acceso para reclutadores' }),
    ).toBeInTheDocument();
  });

  it('sends the request through the gateway and shows the sent state', async () => {
    const { requestMagicLink, user } = setup();
    await submit(user);
    expect(requestMagicLink).toHaveBeenCalledTimes(1);
    expect(requestMagicLink).toHaveBeenCalledWith({ email: 'ana@empresa.com' });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Revisa tu correo',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Revisa tu correo. Si ana@empresa.com es válido',
    );
    expect(activeStep()).toBe(1);
    expect(screen.queryByLabelText('Correo corporativo')).toBeNull();
  });

  it('does not call the gateway for an invalid email', async () => {
    const { requestMagicLink, gatewayLoader, user } = setup();
    await submit(user, 'no-es-correo');
    expect(requestMagicLink).not.toHaveBeenCalled();
    expect(gatewayLoader).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows progress while the request is pending', async () => {
    let resolve: (value: ApiResult<void>) => void = () => undefined;
    const pending = jest.fn(
      () =>
        new Promise<ApiResult<void>>((r) => {
          resolve = r;
        }),
    );
    const { user } = setup(pending);
    await submit(user);
    const button = await screen.findByRole('button', { name: 'Enviando…' });
    expect(button).toBeDisabled();
    await act(() => {
      resolve({ ok: true, data: undefined });
      return Promise.resolve();
    });
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
  });

  it.each<[string, unknown]>([
    ['an empty 2xx body', undefined],
    ['a different 2xx body', { delivered: false, note: 'whatever' }],
  ])(
    'renders the same sent HTML for %s (anti-enumeration)',
    async (_n, data) => {
      const baseline = setup();
      await submit(baseline.user);
      await screen.findByText('Revisa tu correo');
      const expected = screen.getByRole('region').innerHTML;
      baseline.unmount();

      const { user, container } = setup(
        respondWith({ ok: true, data } as ApiResult<void>),
      );
      await submit(user);
      await screen.findByText('Revisa tu correo');
      expect(screen.getByRole('region').innerHTML).toBe(expected);
      expect(container.querySelector('aside')?.innerHTML).toContain(
        'aria-current="step"',
      );
    },
  );

  it('shows a generic error and allows retrying after a network failure', async () => {
    const requestMagicLink = jest
      .fn<ReturnType<ApiGateway['requestMagicLink']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce({ ok: true, data: undefined });
    const { user } = setup(requestMagicLink);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos enviar el enlace',
    );
    expect(screen.getByLabelText('Correo corporativo')).toHaveValue(
      'ana@empresa.com',
    );
    expect(screen.queryByText('Revisa tu correo')).toBeNull();
    expect(activeStep()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
    expect(requestMagicLink).toHaveBeenCalledTimes(2);
  });

  it('treats a gateway that cannot even load as a network failure', async () => {
    const user = userEvent.setup();
    render(
      <LoginContainer
        gatewayLoader={() => Promise.reject(new Error('chunk failed'))}
      />,
    );
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos enviar el enlace',
    );
  });

  it('keeps a persistent polite live region that is empty until the sent state', async () => {
    const { user } = setup();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
    await submit(user);
    await screen.findByRole('heading', { name: 'Revisa tu correo' });
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Revisa tu correo. Si ana@empresa.com');
  });

  it('moves focus to the sent heading, then back to the email on reset', async () => {
    const { user } = setup();
    expect(screen.getByLabelText('Correo corporativo')).not.toHaveFocus();
    await submit(user);
    const heading = await screen.findByRole('heading', {
      name: 'Revisa tu correo',
    });
    expect(heading).toHaveFocus();
    expect(document.activeElement).toBe(heading);
    await user.click(screen.getByRole('button', { name: 'Usar otro correo' }));
    expect(screen.getByLabelText('Correo corporativo')).toHaveFocus();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('sends only one request for two rapid submits', async () => {
    let resolve: (value: ApiResult<void>) => void = () => undefined;
    const pending = jest.fn(
      () =>
        new Promise<ApiResult<void>>((r) => {
          resolve = r;
        }),
    );
    const { user, container } = setup(pending);
    await user.type(
      screen.getByLabelText('Correo corporativo'),
      'ana@empresa.com',
    );
    const form = container.querySelector('form');
    if (!form) throw new Error('form not rendered');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(pending).toHaveBeenCalled());
    await act(() => {
      resolve({ ok: true, data: undefined });
      return Promise.resolve();
    });
    await screen.findByText('Revisa tu correo');
    expect(pending).toHaveBeenCalledTimes(1);
  });

  it('goes back to an empty form with "Usar otro correo"', async () => {
    const { user } = setup();
    await submit(user);
    await user.click(
      await screen.findByRole('button', { name: 'Usar otro correo' }),
    );
    expect(screen.getByLabelText('Correo corporativo')).toHaveValue('');
    expect(activeStep()).toBe(0);
  });

  it('uses the configured gateway by default (mock mode)', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const user = userEvent.setup();
    render(<LoginContainer />);
    await submit(user);
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
  });

  it('offers "Simular: abrir el enlace" in mock mode only', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const mock = setup();
    await submit(mock.user);
    expect(
      await screen.findByRole('link', { name: 'Simular: abrir el enlace' }),
    ).toBeInTheDocument();
    mock.unmount();

    process.env.NEXT_PUBLIC_API_MODE = 'http';
    const http = setup();
    await submit(http.user);
    await screen.findByText('Revisa tu correo');
    expect(screen.queryByText(/Simular/)).toBeNull();
  });

  it.each(['form', 'error', 'sent'] as const)(
    'has no axe violations in the %s state',
    async (state) => {
      process.env.NEXT_PUBLIC_API_MODE = 'mock';
      const requestMagicLink =
        state === 'error'
          ? respondWith({ ok: false, error: 'network' })
          : respondWith({ ok: true, data: undefined });
      const { user, container } = setup(requestMagicLink);
      if (state !== 'form') await submit(user);
      if (state === 'error') await screen.findByRole('alert');
      if (state === 'sent') await screen.findByText('Revisa tu correo');
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(await axe(container)).toHaveNoViolations();
      expect(
        within(container).getAllByRole('heading', { level: 1 }),
      ).toHaveLength(1);
    },
  );
});

const BAD_INPUT: ApiFailure = {
  error: 'invalid-input',
  status: 400,
  reason: 'INVALID_INPUT',
};
const FORBIDDEN: ApiFailure = {
  error: 'forbidden',
  status: 403,
  reason: 'ORIGIN_NOT_ALLOWED',
};
const RATE_LIMITED: ApiFailure = {
  error: 'rate-limited',
  status: 429,
  reason: 'RATE_LIMITED',
  retryAfterSeconds: 60,
};
const UNAVAILABLE: ApiFailure = {
  error: 'server',
  status: 503,
  reason: 'SERVICE_UNAVAILABLE',
};
const NETWORK: ApiFailure = { error: 'network' };

const FAILURES: [string, ApiFailure][] = [
  ['400', BAD_INPUT],
  ['403', FORBIDDEN],
  ['429', RATE_LIMITED],
  ['503', UNAVAILABLE],
  ['network', NETWORK],
];

const failWith = (failure: ApiFailure) =>
  respondWith({ ok: false, ...failure });

describe('LoginContainer API failures', () => {
  it('never shows "sent" and gives five different alerts for 400, 403, 429, 503 and network', async () => {
    const texts: string[] = [];
    for (const [, failure] of FAILURES) {
      const { user, unmount } = setup(failWith(failure));
      await submit(user);
      const alert = await screen.findByRole('alert');
      texts.push(alert.textContent ?? '');
      expect(screen.queryByText('Revisa tu correo')).toBeNull();
      expect(
        screen.queryByRole('heading', { name: 'Revisa tu correo' }),
      ).toBeNull();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(screen.getByLabelText('Correo corporativo')).toHaveValue(
        'ana@empresa.com',
      );
      expect(activeStep()).toBe(0);
      unmount();
    }
    expect(texts.every((t) => t.length > 0)).toBe(true);
    expect(new Set(texts).size).toBe(5);
  });

  it.each(FAILURES)(
    'does not move focus when %s fails',
    async (_n, failure) => {
      let resolve: (value: ApiResult<void>) => void = () => undefined;
      const pending = jest.fn(
        () =>
          new Promise<ApiResult<void>>((r) => {
            resolve = r;
          }),
      );
      const { user } = setup(pending);
      await submit(user);
      await waitFor(() => expect(pending).toHaveBeenCalled());
      const before = document.activeElement;
      expect(before).toBe(screen.getByRole('button'));
      await act(() => {
        resolve({ ok: false, ...failure });
        return Promise.resolve();
      });
      await screen.findByRole('alert');
      expect(document.activeElement).toBe(before);
    },
  );

  it.each(FAILURES)('shows the dictionary copy for %s', async (_n, failure) => {
    const { user } = setup(failWith(failure));
    await submit(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(apiErrorMessage(failure, loginOverrides));
  });

  it('shows the login copy for 400 and the 429 wait estimate', async () => {
    const bad = setup(failWith(BAD_INPUT));
    await submit(bad.user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisa los datos. El correo debe tener el formato nombre@empresa.com.',
    );
    bad.unmount();
    const limited = setup(failWith(RATE_LIMITED));
    await submit(limited.user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Espera un minuto',
    );
  });

  it('uses the login server copy for a 500 with INTERNAL_ERROR and without code', async () => {
    for (const failure of [
      { error: 'server', status: 500, reason: 'INTERNAL_ERROR' },
      { error: 'server', status: 500 },
    ] as ApiFailure[]) {
      const { user, unmount } = setup(failWith(failure));
      await submit(user);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Algo falló de nuestro lado y el enlace no se envió. Inténtalo de nuevo.',
      );
      unmount();
    }
  });

  it('shows the network copy when the gateway cannot load', async () => {
    const user = userEvent.setup();
    render(
      <LoginContainer gatewayLoader={() => Promise.reject(new Error('x'))} />,
    );
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      login.form.networkError,
    );
  });

  it.each<[string, ApiFailure, boolean]>([
    ['400', BAD_INPUT, false],
    ['403', FORBIDDEN, false],
    ['429', RATE_LIMITED, false],
    ['503', UNAVAILABLE, true],
    ['network', NETWORK, true],
  ])('submit button for %s', async (_n, failure, retry) => {
    const { user } = setup(failWith(failure));
    await submit(user);
    await screen.findByRole('alert');
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(
      retry ? 'Reintentar' : 'Enviar enlace de acceso',
    );
  });

  it('shows an alert, no sent state and no retry label for an unexpected failure', async () => {
    const { user } = setup(failWith({ error: 'unexpected', status: 404 }));
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      apiErrorMessage({ error: 'unexpected', status: 404 }, loginOverrides),
    );
    expect(screen.queryByText('Revisa tu correo')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Enviar enlace de acceso',
    );
  });

  it('sends one request per manual retry even on a double click', async () => {
    let resolve: (value: ApiResult<void>) => void = () => undefined;
    const requestMagicLink = jest
      .fn<ReturnType<ApiGateway['requestMagicLink']>, []>()
      .mockResolvedValueOnce({ ok: false, ...UNAVAILABLE })
      .mockImplementationOnce(
        () =>
          new Promise<ApiResult<void>>((r) => {
            resolve = r;
          }),
      );
    const { user } = setup(requestMagicLink);
    await submit(user);
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    await user.dblClick(retry);
    await waitFor(() => expect(requestMagicLink).toHaveBeenCalledTimes(2));
    await act(() => {
      resolve({ ok: true, data: undefined });
      return Promise.resolve();
    });
    await screen.findByText('Revisa tu correo');
    expect(requestMagicLink).toHaveBeenCalledTimes(2);
  });

  it('retries manually and shows sent when the second attempt succeeds', async () => {
    const requestMagicLink = jest
      .fn<ReturnType<ApiGateway['requestMagicLink']>, []>()
      .mockResolvedValueOnce({ ok: false, ...UNAVAILABLE })
      .mockResolvedValueOnce({ ok: true, data: undefined });
    const { user } = setup(requestMagicLink);
    await submit(user);
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Revisa tu correo')).toBeInTheDocument();
    expect(requestMagicLink).toHaveBeenCalledTimes(2);
  });

  it.each(FAILURES)('has no axe violations on %s', async (_n, failure) => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    const { user, container } = setup(failWith(failure));
    await submit(user);
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoginContainer without automatic retry or live countdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('calls requestMagicLink exactly once after a 503 even as time passes', async () => {
    const requestMagicLink = failWith(UNAVAILABLE);
    const gatewayLoader = () => Promise.resolve(fakeGateway(requestMagicLink));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<LoginContainer gatewayLoader={gatewayLoader} />);
    await submit(user);
    await screen.findByRole('alert');
    await act(() => jest.advanceTimersByTimeAsync(10 * 60 * 1000));
    expect(requestMagicLink).toHaveBeenCalledTimes(1);
  });

  it('keeps the 429 text unchanged as the clock advances', async () => {
    const gatewayLoader = () =>
      Promise.resolve(fakeGateway(failWith(RATE_LIMITED)));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<LoginContainer gatewayLoader={gatewayLoader} />);
    await submit(user);
    const before = (await screen.findByRole('alert')).textContent;
    expect(before).toContain('un minuto');
    await act(() => jest.advanceTimersByTimeAsync(5 * 60 * 1000));
    expect(screen.getByRole('alert').textContent).toBe(before);
  });
});

describe('LoginContainer anti-enumeration of errors', () => {
  const normalize = (html: string) => html.replace(/ value="[^"]*"/g, '');

  it.each(FAILURES)(
    'renders the same DOM for a registered and an unknown email on %s',
    async (_n, failure) => {
      const emails = [
        'registrada@empresa.example.test',
        'desconocida@otra.example.test',
      ];
      const requestMagicLink = jest.fn((request: MagicLinkRequest) => {
        void request;
        return Promise.resolve({ ok: false, ...failure } as ApiResult<void>);
      });
      const htmls: string[] = [];
      for (const address of emails) {
        const { user, unmount } = setup(requestMagicLink);
        await submit(user, address);
        await screen.findByRole('alert');
        htmls.push(normalize(screen.getByRole('region').innerHTML));
        unmount();
      }
      expect(requestMagicLink.mock.calls.map(([r]) => r.email)).toEqual(emails);
      expect(htmls[0]).toBe(htmls[1]);
    },
  );

  it('never renders the API message nor CloudFront', async () => {
    const leaky = {
      ok: false,
      error: 'forbidden',
      status: 403,
      reason: 'CDN_REQUIRED',
      message: 'Blocked by CloudFront: raw API message',
    } as ApiResult<void>;
    const { user, container } = setup(respondWith(leaky));
    await submit(user);
    await screen.findByRole('alert');
    expect(container.innerHTML).not.toMatch(/CloudFront|raw API message/);
  });
});

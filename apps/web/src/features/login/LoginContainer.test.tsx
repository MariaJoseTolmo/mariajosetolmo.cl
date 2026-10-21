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
import type { ApiResult } from '@/lib/api/types';
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

function setup(requestMagicLink = respondWith({ ok: true, data: undefined })) {
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

  it.each<[string, ApiResult<void>]>([
    ['success', { ok: true, data: undefined }],
    ['rate limit', { ok: false, error: 'rate-limited', status: 429 }],
    ['server error', { ok: false, error: 'server', status: 500 }],
    ['unexpected answer', { ok: false, error: 'unexpected', status: 404 }],
  ])(
    'renders the same sent HTML for %s (anti-enumeration)',
    async (_n, result) => {
      const baseline = setup();
      await submit(baseline.user);
      await screen.findByText('Revisa tu correo');
      const expected = screen.getByRole('region').innerHTML;
      baseline.unmount();

      const { user, container } = setup(respondWith(result));
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

    await user.click(
      screen.getByRole('button', { name: 'Enviar enlace de acceso' }),
    );
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

import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import type { ApiGateway } from '@/lib/api/port';
import { PLAYGROUND_ENDPOINTS } from '@/lib/api/playground-endpoints';
import type {
  ApiResult,
  PlaygroundEndpoint,
  RawResponse,
} from '@/lib/api/types';
import { ApiPlayground } from './ApiPlayground';

/** The visible line, not the (visually hidden) live region that repeats it. */
const VISIBLE = { ignore: '[role="status"]' };

const unused = () => Promise.reject(new Error('not used by the playground'));

const okResponse = (endpoint: PlaygroundEndpoint): ApiResult<RawResponse> =>
  endpoint === '/api/v1/admin/visits'
    ? {
        ok: true,
        data: {
          status: 403,
          statusText: 'Forbidden',
          body: { statusCode: 403, code: 'ROLE_NOT_ALLOWED' },
          failure: {
            error: 'forbidden',
            status: 403,
            reason: 'ROLE_NOT_ALLOWED',
          },
        },
      }
    : {
        ok: true,
        data: { status: 200, statusText: 'OK', body: { from: endpoint } },
      };

function setup(
  call: ApiGateway['call'] = (endpoint) =>
    Promise.resolve(okResponse(endpoint)),
  strict = false,
) {
  const callMock = jest.fn(call);
  const gateway: ApiGateway = {
    requestMagicLink: unused,
    verifyToken: unused,
    getMe: unused,
    getCvLink: unused,
    logout: unused,
    call: callMock,
  };
  const gatewayLoader = jest.fn(() => Promise.resolve(gateway));
  const onUnauthorized = jest.fn();
  const ui = (
    <ApiPlayground
      gatewayLoader={gatewayLoader}
      onUnauthorized={onUnauthorized}
    />
  );
  const view = render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { callMock, onUnauthorized, user: userEvent.setup(), ...view };
}

const endpointButtons = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
const pressed = () =>
  endpointButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');
const viewer = () => screen.getByRole('figure');

describe('ApiPlayground', () => {
  it('renders five endpoint buttons in a labelled group, exactly one pressed', async () => {
    setup();
    expect(
      screen.getByRole('group', { name: 'Endpoints' }),
    ).toBeInTheDocument();
    expect(endpointButtons()).toHaveLength(5);
    expect(pressed()).toHaveLength(1);
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
  });

  it('requests the first endpoint on mount and shows its response', async () => {
    const { callMock } = setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    expect(callMock).toHaveBeenCalledTimes(1);
    expect(callMock).toHaveBeenCalledWith(PLAYGROUND_ENDPOINTS[0]);
    expect(pressed()[0]).toHaveTextContent('/api/v1/profile');
    expect(viewer()).toHaveTextContent('"from": "/api/v1/profile"');
  });

  it('does not double-request under StrictMode', async () => {
    const { callMock } = setup(undefined, true);
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    expect(callMock).toHaveBeenCalledTimes(1);
  });

  it('switches the selection and shows the new response', async () => {
    const { user, callMock } = setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    await user.click(
      screen.getByRole('button', { name: /skills\?level=advanced/ }),
    );
    await waitFor(() =>
      expect(viewer()).toHaveTextContent(
        '"from": "/api/v1/skills?level=advanced"',
      ),
    );
    expect(callMock).toHaveBeenLastCalledWith('/api/v1/skills?level=advanced');
    expect(pressed()).toHaveLength(1);
    expect(pressed()[0]).toHaveTextContent('skills?level=advanced');
    expect(
      screen.getByRole('button', { name: /\/api\/v1\/profile/ }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows 403 for admin/visits as a response, not as an error', async () => {
    const { user } = setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    await user.click(screen.getByRole('button', { name: /admin\/visits/ }));
    await waitFor(() => expect(viewer()).toHaveTextContent('403 Forbidden'));
    expect(screen.queryByText(/No pudimos obtener/)).toBeNull();
    expect(viewer()).toHaveTextContent('"code": "ROLE_NOT_ALLOWED"');
    expect(
      screen.getByText(
        'Respuesta esperada: este endpoint es solo para el rol ADMIN.',
        VISIBLE,
      ),
    ).toBeInTheDocument();
    expect(pressed()).toHaveLength(1);
    expect(pressed()[0]).toHaveTextContent('admin/visits');
  });

  it('shows no explanation for a 200 response', async () => {
    setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    expect(screen.queryByText(/Respuesta esperada/)).toBeNull();
    expect(screen.queryByText(/El servicio no está disponible/)).toBeNull();
  });

  it('shows the dictionary line for a 5xx, and drops it on the next 200', async () => {
    const { user } = setup((endpoint) =>
      Promise.resolve(
        endpoint === '/api/v1/me'
          ? {
              ok: true,
              data: {
                status: 503,
                statusText: 'Service Unavailable',
                body: { code: 'SERVICE_UNAVAILABLE' },
                failure: {
                  error: 'server',
                  status: 503,
                  reason: 'SERVICE_UNAVAILABLE',
                },
              },
            }
          : okResponse(endpoint),
      ),
    );
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    await user.click(screen.getByRole('button', { name: /api\/v1\/me/ }));
    await waitFor(() => expect(viewer()).toHaveTextContent('503'));
    expect(viewer()).toHaveTextContent('"code": "SERVICE_UNAVAILABLE"');
    expect(
      screen.getByText(/El servicio no está disponible/, VISIBLE),
    ).toBeInTheDocument();
    expect(screen.queryByText(/rol ADMIN/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /api\/v1\/profile/ }));
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    expect(screen.queryByText(/El servicio no está disponible/)).toBeNull();
  });

  it('ignores clicks while a request is in flight (guard) and announces loading', async () => {
    let release: (r: ApiResult<RawResponse>) => void = () => undefined;
    const { user, callMock } = setup(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Cargando respuesta…',
      ),
    );
    expect(
      endpointButtons().every(
        (b) => b.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: /me$/ }));
    expect(callMock).toHaveBeenCalledTimes(1);
    expect(pressed()[0]).toHaveTextContent('/api/v1/profile');
    await act(async () => {
      release(okResponse('/api/v1/profile'));
      await Promise.resolve();
    });
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    expect(
      endpointButtons().some(
        (b) =>
          b.hasAttribute('aria-disabled') &&
          b.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(false);
  });

  it('two synchronous clicks produce a single request', async () => {
    const { callMock } = setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    const target = screen.getByRole('button', { name: /\/api\/v1\/me$/ });
    await act(async () => {
      target.click();
      target.click();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(viewer()).toHaveTextContent('"from": "/api/v1/me"'),
    );
    expect(callMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a rejected promise', () => Promise.reject(new Error('boom'))],
    [
      'a network failure',
      () => Promise.resolve({ ok: false as const, error: 'network' as const }),
    ],
    [
      'a server failure',
      () => Promise.resolve({ ok: false as const, error: 'server' as const }),
    ],
  ])(
    'shows a recoverable error on %s and lets the user retry',
    async (_name, failing) => {
      let fail = true;
      const { user } = setup((endpoint) =>
        fail ? failing() : Promise.resolve(okResponse(endpoint)),
      );
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'No pudimos obtener la respuesta',
        ),
      );
      expect(viewer()).toHaveTextContent('Sin respuesta');
      expect(
        endpointButtons().some(
          (b) => b.getAttribute('aria-disabled') === 'true',
        ),
      ).toBe(false);
      fail = false;
      await user.click(
        screen.getByRole('button', { name: /\/api\/v1\/profile/ }),
      );
      await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    },
  );

  it('asks the zone to redirect when the session is gone', async () => {
    const { onUnauthorized } = setup(() =>
      Promise.resolve({ ok: false, error: 'unauthorized' }),
    );
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('does not touch state after unmount', async () => {
    let release: (r: ApiResult<RawResponse>) => void = () => undefined;
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { unmount, onUnauthorized } = setup(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Cargando'),
    );
    unmount();
    await act(async () => {
      release({ ok: false, error: 'unauthorized' });
      await Promise.resolve();
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the explanation line, and no CloudFront in the DOM', async () => {
    const { container, user } = setup();
    await waitFor(() => expect(viewer()).toHaveTextContent('200 OK'));
    await user.click(screen.getByRole('button', { name: /admin\/visits/ }));
    await screen.findByText(/Respuesta esperada/, VISIBLE);
    expect(await axe(container)).toHaveNoViolations();
    expect(container.textContent).not.toMatch(/CloudFront/);
  });
});

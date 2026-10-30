import { renderToString } from 'react-dom/server';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { createHttpGateway, type ResponseLike } from '@/lib/api/http';
import type { ApiGateway } from '@/lib/api/port';
import type {
  ApiFailure,
  ApiResult,
  CvLink,
  Me,
  RawResponse,
} from '@/lib/api/types';
import { RecruiterZone } from './RecruiterZone';

const replace = jest.fn();
const router = { replace };
jest.mock('next/navigation', () => ({ useRouter: () => router }));

afterEach(() => replace.mockClear());

const ME: Me = {
  email: 'ana@empresa.com',
  role: 'RECRUITER',
  company: 'Acme',
  name: 'Ana',
  availability: {
    modality: 'API-MODALIDAD',
    start: 'API-INICIO',
    salary: 'API-RENTA',
  },
};
const OK: ApiResult<void> = { ok: true, data: undefined };
const LINK: CvLink = {
  url: 'https://cdn.example.com/cv.pdf?sig=abc',
  expiresAt: '2030-01-01T00:00:00.000Z',
};

const unused = () => Promise.reject(new Error('not used by the zone'));

function setup(overrides: Partial<ApiGateway> = {}, openUrl = jest.fn()) {
  const mocks = {
    getMe: jest.fn(() => Promise.resolve({ ok: true as const, data: ME })),
    getCvLink: jest.fn(() =>
      Promise.resolve({ ok: true as const, data: LINK }),
    ),
    logout: jest.fn(() => Promise.resolve(OK)),
    call: jest.fn((): Promise<ApiResult<RawResponse>> =>
      Promise.resolve({
        ok: true,
        data: { status: 200, statusText: 'OK', body: { demo: true } },
      }),
    ),
  };
  const gateway: ApiGateway = {
    requestMagicLink: unused,
    verifyToken: unused,
    ...mocks,
    ...overrides,
  };
  const gatewayLoader = jest.fn(() => Promise.resolve(gateway));
  const user = userEvent.setup();
  const view = render(
    <RecruiterZone gatewayLoader={gatewayLoader} openUrl={openUrl} />,
  );
  return { ...mocks, gatewayLoader, openUrl, user, ...view };
}

const cardTitles = () =>
  screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

describe('RecruiterZone playground', () => {
  it('mounts the playground only once authorized, with five endpoints', async () => {
    const { call } = setup();
    expect(screen.queryByRole('group', { name: 'Endpoints' })).toBeNull();
    const group = await screen.findByRole('group', { name: 'Endpoints' });
    expect(within(group).getAllByRole('button')).toHaveLength(5);
    await waitFor(() => expect(call).toHaveBeenCalledWith('/api/v1/profile'));
  });

  it('never requests endpoints while the session is being checked', async () => {
    const { call } = setup({
      getMe: () => Promise.resolve({ ok: false, error: 'network' }),
    });
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(call).not.toHaveBeenCalled();
  });

  it('sends the visitor to /acceso/ when the playground finds no session', async () => {
    setup({
      call: () => Promise.resolve({ ok: false, error: 'unauthorized' }),
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/acceso/'));
  });
});

describe('RecruiterZone session guard', () => {
  it('shows "Verificando sesión" and no protected content while checking', () => {
    let resolve: (value: ApiResult<Me>) => void = () => undefined;
    setup({
      getMe: () =>
        new Promise<ApiResult<Me>>((r) => {
          resolve = r;
        }),
    });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Verificando sesión');
    expect(status).not.toHaveAttribute('aria-busy');
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.queryByText(/Gracias por tu interés/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    return act(() => {
      resolve({ ok: true, data: ME });
      return Promise.resolve();
    });
  });

  it('prerenders an empty live region and fills it only after mount', () => {
    const html = renderToString(<RecruiterZone />);
    const container = document.createElement('div');
    container.innerHTML = html;
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region).toBeEmptyDOMElement();
    expect(html).not.toContain('aria-busy');
    expect(container.querySelector('h1')).toHaveTextContent(
      'Verificando sesión',
    );
  });

  it('keeps the same live region from checking to error and back', async () => {
    const getMe = jest
      .fn<ReturnType<ApiGateway['getMe']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockImplementationOnce(() => new Promise(() => undefined));
    const { user } = setup({ getMe });
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Verificando sesión');
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent(
      'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Verificando sesión');
  });

  it('moves focus to the checking heading when retrying', async () => {
    const getMe = jest
      .fn<ReturnType<ApiGateway['getMe']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockImplementationOnce(() => new Promise(() => undefined));
    const { user } = setup({ getMe });
    await screen.findByRole('button', { name: 'Reintentar' });
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Verificando sesión',
    });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading).toHaveFocus();
  });

  it('does not grab focus on the first load', () => {
    setup({ getMe: () => new Promise(() => undefined) });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Verificando sesión' }),
    ).not.toHaveFocus();
  });

  it('redirects to /acceso/ when there is no session and shows nothing protected', async () => {
    setup({
      getMe: () => Promise.resolve({ ok: false, error: 'unauthorized' }),
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/acceso/'));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando sesión');
  });

  it('does not redirect on a network error: offers "Reintentar", then recovers', async () => {
    const getMe = jest
      .fn<ReturnType<ApiGateway['getMe']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce({ ok: true, data: ME });
    const { user } = setup({ getMe });
    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'No pudimos verificar tu sesión',
    });
    expect(heading).toHaveFocus();
    expect(replace).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByText(/Gracias por tu interés/),
    ).toBeInTheDocument();
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not redirect on a server error either', async () => {
    setup({ getMe: () => Promise.resolve({ ok: false, error: 'server' }) });
    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  describe('failure copy', () => {
    const CAUSES: [string, ApiFailure][] = [
      [
        '403',
        { error: 'forbidden', status: 403, reason: 'ORIGIN_NOT_ALLOWED' },
      ],
      ['429', { error: 'rate-limited', status: 429, retryAfterSeconds: 120 }],
      ['503', { error: 'server', status: 503, reason: 'SERVICE_UNAVAILABLE' }],
      ['network', { error: 'network' }],
    ];

    async function textFor(failure: ApiFailure) {
      const getMe = jest.fn(() => Promise.resolve({ ok: false, ...failure }));
      const view = setup({ getMe: getMe as ApiGateway['getMe'] });
      await screen.findByRole('button', { name: 'Reintentar' });
      const text = screen.getByRole('status').textContent;
      view.unmount();
      return { text, replace: replace.mock.calls.length };
    }

    it('gives 403, 429, 503 and network four different texts and never redirects', async () => {
      const texts: (string | null)[] = [];
      for (const [, failure] of CAUSES) {
        const result = await textFor(failure);
        expect(result.replace).toBe(0);
        texts.push(result.text);
      }
      expect(texts.every((t) => t && t.length > 0)).toBe(true);
      expect(new Set(texts).size).toBe(4);
      expect(texts[0]).toMatch(/sitio oficial/);
      expect(texts[1]).toMatch(/Espera 2 minutos/);
      expect(texts[2]).toMatch(/El servicio no está disponible/);
      expect(texts[3]).toMatch(/No pudimos conectar/);
    });

    it('announces the text in the status region and focuses the title', async () => {
      setup({
        getMe: () =>
          Promise.resolve({ ok: false, error: 'server', status: 500 }),
      });
      const heading = await screen.findByRole('heading', {
        level: 1,
        name: 'No pudimos verificar tu sesión',
      });
      expect(heading).toHaveFocus();
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(screen.getByRole('status')).toHaveTextContent(
        'Algo falló de nuestro lado. Inténtalo de nuevo.',
      );
    });

    it('asks again exactly once when "Reintentar" is pressed', async () => {
      const getMe = jest
        .fn<ReturnType<ApiGateway['getMe']>, []>()
        .mockResolvedValueOnce({
          ok: false,
          error: 'rate-limited',
          status: 429,
        })
        .mockImplementationOnce(() => new Promise(() => undefined));
      const { user } = setup({ getMe });
      await user.click(
        await screen.findByRole('button', { name: 'Reintentar' }),
      );
      expect(getMe).toHaveBeenCalledTimes(2);
    });

    it('shows the official-site copy, without redirecting, when the refresh is blocked', async () => {
      setup({
        getMe: () =>
          Promise.resolve({
            ok: false,
            error: 'forbidden',
            status: 403,
            reason: 'CDN_REQUIRED',
          }),
      });
      await screen.findByRole('button', { name: 'Reintentar' });
      expect(screen.getByRole('status')).toHaveTextContent(
        'La solicitud no llegó desde el sitio oficial',
      );
      expect(replace).not.toHaveBeenCalled();
    });

    it('has no axe violations and none of the API internals in the error state', async () => {
      const { container } = setup({
        getMe: () =>
          Promise.resolve({
            message: 'served via CloudFront',
            ok: false,
            error: 'forbidden',
            status: 403,
            reason: 'CDN_REQUIRED',
          }),
      });
      await screen.findByRole('button', { name: 'Reintentar' });
      expect(await axe(container)).toHaveNoViolations();
      expect(container.textContent).not.toMatch(/CloudFront|CDN_REQUIRED/);
    });
  });
});

describe('RecruiterZone content', () => {
  it('greets by company and moves focus to the greeting', async () => {
    setup();
    const h1 = await screen.findByRole('heading', {
      level: 1,
      name: 'Gracias por tu interés, equipo de Acme',
    });
    expect(h1).toHaveFocus();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('greets by name when there is no company', async () => {
    setup({
      getMe: () =>
        Promise.resolve({ ok: true, data: { ...ME, company: null } }),
    });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Gracias por tu interés, Ana',
      }),
    ).toBeInTheDocument();
  });

  it('shows exactly the three cards and the playground, without Word or scheduling', async () => {
    const { container } = setup();
    await screen.findByText(/Gracias por tu interés/);
    expect(cardTitles()).toEqual([
      'CV completo',
      'Contacto directo',
      'Disponibilidad',
      'Prueba la API que alimenta este sitio',
    ]);
    expect(container).not.toHaveTextContent(
      /Word|\.docx|Agendar|Proponer horario/,
    );
    const cv = screen.getByRole('region', { name: 'CV completo' });
    expect(
      within(cv)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Descargar PDF']);
  });

  it('shows the availability that getMe returned, with no extra request', async () => {
    const { getMe } = setup();
    const card = await screen.findByRole('region', { name: 'Disponibilidad' });
    expect(card).toHaveTextContent('API-MODALIDAD');
    expect(card).toHaveTextContent('API-INICIO');
    expect(card).toHaveTextContent('API-RENTA');
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('lists the direct contact, including the phone', async () => {
    setup();
    const card = await screen.findByRole('region', {
      name: 'Contacto directo',
    });
    expect(
      within(card).getByRole('link', { name: '+56 9 7453 6288' }),
    ).toHaveAttribute('href', 'tel:+56974536288');
    expect(within(card).getAllByRole('link')).toHaveLength(4);
  });

  it('uses the session header with the identity pill and the shared footer', async () => {
    setup();
    await screen.findByText(/Gracias por tu interés/);
    expect(
      screen.getByText('ana@empresa.com · rol RECRUITER'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Volver al inicio' })).toBeNull();
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'María José Tolmo Tolmo',
    );
    expect(document.querySelectorAll('main#contenido')).toHaveLength(1);
  });
});

describe('RecruiterZone CV download', () => {
  it('asks for the signed link on click and opens it', async () => {
    const { getCvLink, openUrl, user } = setup();
    await screen.findByText(/Gracias por tu interés/);
    expect(getCvLink).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith(LINK.url));
    expect(getCvLink).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('requests the link once when the handler fires twice before re-render', async () => {
    let resolve: (value: ApiResult<CvLink>) => void = () => undefined;
    const getCvLink = jest.fn(
      () =>
        new Promise<ApiResult<CvLink>>((r) => {
          resolve = r;
        }),
    );
    const { openUrl } = setup({ getCvLink });
    await screen.findByText(/Gracias por tu interés/);
    const button = screen.getByRole('button', { name: 'Descargar PDF' });
    await act(async () => {
      // Both clicks run before React gets a chance to re-render.
      button.click();
      button.click();
      await Promise.resolve();
    });
    await waitFor(() => expect(getCvLink).toHaveBeenCalled());
    await act(() => {
      resolve({ ok: true, data: LINK });
      return Promise.resolve();
    });
    await waitFor(() => expect(openUrl).toHaveBeenCalledTimes(1));
    expect(getCvLink).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the download button and announces progress', async () => {
    const getCvLink = jest.fn(
      () => new Promise<ApiResult<CvLink>>(() => undefined),
    );
    const { user } = setup({ getCvLink });
    await screen.findByText(/Gracias por tu interés/);
    const button = screen.getByRole('button', { name: 'Descargar PDF' });
    await user.click(button);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // The playground has its own live region: scope to the CV card.
    expect(
      within(screen.getByRole('region', { name: 'CV completo' })).getByRole(
        'status',
      ),
    ).toHaveTextContent('Preparando…');
  });

  it('allows downloading again after a failure', async () => {
    const getCvLink = jest
      .fn<ReturnType<ApiGateway['getCvLink']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'server' })
      .mockResolvedValueOnce({ ok: true, data: LINK });
    const { openUrl, user } = setup({ getCvLink });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith(LINK.url));
  });

  it('shows the service-unavailable copy, not the connection one, on a 503', async () => {
    const { openUrl, user } = setup({
      getCvLink: () =>
        Promise.resolve({
          ok: false,
          error: 'server',
          status: 503,
          reason: 'SERVICE_UNAVAILABLE',
        }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El servicio no está disponible');
    expect(alert).not.toHaveTextContent('No pudimos conectar');
    expect(openUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeEnabled();
  });

  it('tells a network failure apart from a 503 and from a rate limit', async () => {
    const texts: (string | null)[] = [];
    for (const failure of [
      { error: 'network' },
      { error: 'rate-limited', status: 429, retryAfterSeconds: 60 },
      { error: 'forbidden', status: 403, reason: 'CDN_REQUIRED' },
    ] as const) {
      const { user, unmount } = setup({
        getCvLink: () => Promise.resolve({ ok: false, ...failure }),
      });
      await screen.findByText(/Gracias por tu interés/);
      await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
      texts.push((await screen.findByRole('alert')).textContent);
      unmount();
    }
    expect(new Set(texts).size).toBe(3);
    expect(texts[0]).toMatch(/No pudimos conectar/);
    expect(texts[1]).toMatch(/Espera un minuto/);
    expect(texts[2]).toMatch(/sitio oficial/);
  });

  it('keeps the CV-specific copy for an unexpected answer', async () => {
    const { openUrl, user } = setup({
      getCvLink: () =>
        Promise.resolve({ ok: false, error: 'unexpected', status: 418 }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos generar el enlace del CV. Inténtalo de nuevo.',
    );
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('refuses to open a URL that is not https', async () => {
    const { openUrl, user } = setup({
      getCvLink: () =>
        Promise.resolve({
          ok: true,
          data: { ...LINK, url: 'javascript:alert(1)' },
        }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos generar el enlace del CV',
    );
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('sends the user to sign in again if the session expired meanwhile', async () => {
    const { openUrl, user } = setup({
      getCvLink: () => Promise.resolve({ ok: false, error: 'unauthorized' }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/acceso/'));
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('treats a gateway failure while downloading as a failed download', async () => {
    const { user } = setup({ getCvLink: () => Promise.reject(new Error('x')) });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos generar el enlace del CV',
    );
  });
});

describe('RecruiterZone logout', () => {
  it('logs out and then goes to the home page', async () => {
    const { logout, user } = setup();
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('calls logout once when the handler fires twice before re-render', async () => {
    let resolve: (value: ApiResult<void>) => void = () => undefined;
    const logout = jest.fn(
      () =>
        new Promise<ApiResult<void>>((r) => {
          resolve = r;
        }),
    );
    setup({ logout });
    await screen.findByText(/Gracias por tu interés/);
    const button = screen.getByRole('button', { name: 'Cerrar sesión' });
    await act(async () => {
      // Both clicks run before React gets a chance to re-render.
      button.click();
      button.click();
      await Promise.resolve();
    });
    await waitFor(() => expect(logout).toHaveBeenCalled());
    await act(() => {
      resolve(OK);
      return Promise.resolve();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('allows trying again after a failed logout', async () => {
    const logout = jest
      .fn<ReturnType<ApiGateway['logout']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce(OK);
    const { user } = setup({ logout });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it('also leaves when the session was already gone', async () => {
    const { user } = setup({
      logout: () => Promise.resolve({ ok: false, error: 'unauthorized' }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('shows the wait copy with role="alert" on a rate limit, and stays', async () => {
    const { user } = setup({
      logout: () =>
        Promise.resolve({
          ok: false,
          error: 'rate-limited',
          status: 429,
          reason: 'RATE_LIMITED',
          retryAfterSeconds: 120,
        }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Espera 2 minutos',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('stays and says it could not connect on a network failure', async () => {
    const { user } = setup({
      logout: () => Promise.resolve({ ok: false, error: 'network' }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the logout-specific copy for an unexpected answer', async () => {
    const { user } = setup({
      logout: () =>
        Promise.resolve({ ok: false, error: 'unexpected', status: 418 }),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cerrar la sesión. Inténtalo de nuevo.',
    );
  });

  it('stays and warns if the gateway throws', async () => {
    const { user } = setup({ logout: () => Promise.reject(new Error('x')) });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cerrar la sesión',
    );
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('RecruiterZone accessibility', () => {
  it.each(['checking', 'error', 'authorized'] as const)(
    'has no axe violations in the %s state',
    async (state) => {
      const getMe: ApiGateway['getMe'] =
        state === 'checking'
          ? () => new Promise(() => undefined)
          : state === 'error'
            ? () => Promise.resolve({ ok: false, error: 'network' })
            : () => Promise.resolve({ ok: true, data: ME });
      const { container } = setup({ getMe });
      if (state === 'error')
        await screen.findByRole('button', { name: 'Reintentar' });
      if (state === 'authorized')
        await screen.findByText(/Gracias por tu interés/);
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(await axe(container)).toHaveNoViolations();
      expect(
        within(container).getAllByRole('heading', { level: 1 }),
      ).toHaveLength(1);
    },
  );
});

describe('RecruiterZone failure alerts', () => {
  const leaky = {
    ok: false,
    error: 'server',
    status: 503,
    reason: 'SERVICE_UNAVAILABLE',
    message: 'served via CloudFront',
  } as const;

  it('has no axe violations with the CV and logout alerts, and never shows the API message', async () => {
    const { container, user } = setup({
      getCvLink: () => Promise.resolve(leaky),
      logout: () => Promise.resolve(leaky),
    });
    await screen.findByText(/Gracias por tu interés/);
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(await axe(container)).toHaveNoViolations();
    expect(container.textContent).not.toMatch(/CloudFront/);
  });
});

describe('RecruiterZone with the real http adapter', () => {
  const reply = (status: number, body?: unknown): ResponseLike => ({
    status,
    ok: status >= 200 && status < 300,
    statusText: `status ${status}`,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
    headers: { get: () => null },
  });

  it('recovers the session: GET /me 401, refresh 200, retry 200, then shows the authorized view', async () => {
    const calls: string[] = [];
    let meCalls = 0;
    const fetchImpl = (path: string, init: RequestInit) => {
      const call = `${init.method ?? 'GET'} ${path}`;
      calls.push(call);
      if (call === 'GET /api/v1/me') {
        meCalls += 1;
        return Promise.resolve(meCalls === 1 ? reply(401) : reply(200, ME));
      }
      if (call === 'POST /api/auth/refresh') return Promise.resolve(reply(200));
      return Promise.resolve(reply(200, { demo: true }));
    };
    const gateway = createHttpGateway(fetchImpl);
    render(<RecruiterZone gatewayLoader={() => Promise.resolve(gateway)} />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Gracias por tu interés, equipo de Acme',
      }),
    ).toBeInTheDocument();
    expect(calls.slice(0, 3)).toEqual([
      'GET /api/v1/me',
      'POST /api/auth/refresh',
      'GET /api/v1/me',
    ]);
    expect(replace).not.toHaveBeenCalled();
    expect(cardTitles()).toEqual(
      expect.arrayContaining([
        'CV completo',
        'Contacto directo',
        'Disponibilidad',
      ]),
    );
    expect(
      screen.getByRole('region', { name: 'Disponibilidad' }),
    ).toHaveTextContent('API-MODALIDAD');
  });
});

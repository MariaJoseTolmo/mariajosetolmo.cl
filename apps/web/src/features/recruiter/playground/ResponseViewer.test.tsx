import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { ResponseViewer, type ViewState } from './ResponseViewer';

/** The visible line, not the (visually hidden) live region that repeats it. */
const VISIBLE = { ignore: '[role="status"]' };

const ENDPOINT = '/api/v1/skills?level=advanced';

function setup(view: ViewState) {
  return render(<ResponseViewer endpoint={ENDPOINT} view={view} />);
}

describe('ResponseViewer', () => {
  it('keeps a persistent, empty live region while idle', () => {
    setup({ phase: 'idle' });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('announces loading and shows the request line without a body', () => {
    setup({ phase: 'loading' });
    expect(screen.getByRole('status')).toHaveTextContent('Cargando respuesta…');
    const figure = screen.getByRole('figure');
    expect(figure).toHaveTextContent('GET');
    expect(figure).toHaveTextContent(ENDPOINT);
    expect(figure).toHaveTextContent('Cargando…');
  });

  it('shows method, path, status line and the formatted JSON', () => {
    setup({
      phase: 'done',
      response: { status: 200, statusText: 'OK', body: { level: 'advanced' } },
    });
    const figure = screen.getByRole('figure');
    expect(figure).toHaveTextContent('200 OK');
    expect(figure.querySelector('pre')?.textContent).toBe(
      '{\n  "level": "advanced"\n}',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      `GET ${ENDPOINT}: 200 OK`,
    );
  });

  it('shows a 403 as a normal response', () => {
    setup({
      phase: 'done',
      response: {
        status: 403,
        statusText: 'Forbidden',
        body: { statusCode: 403, message: 'Forbidden' },
      },
    });
    expect(screen.getByRole('figure')).toHaveTextContent('403 Forbidden');
  });

  it('explains a role 403 under the code window and keeps status and raw body', () => {
    setup({
      phase: 'done',
      response: {
        status: 403,
        statusText: 'Forbidden',
        body: { statusCode: 403, code: 'ROLE_NOT_ALLOWED', message: 'raw' },
        failure: {
          error: 'forbidden',
          status: 403,
          reason: 'ROLE_NOT_ALLOWED',
        },
      },
    });
    const figure = screen.getByRole('figure');
    expect(figure).toHaveTextContent('403 Forbidden');
    expect(figure.querySelector('pre')?.textContent).toContain(
      '"code": "ROLE_NOT_ALLOWED"',
    );
    const line = screen.getByText(
      'Respuesta esperada: este endpoint es solo para el rol ADMIN.',
      VISIBLE,
    );
    expect(line.tagName).toBe('P');
    expect(line).not.toHaveAttribute('role');
    expect(figure).not.toContainElement(line);
    expect(figure.compareDocumentPosition(line)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // The status line is already announced: the explanation adds no second one.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('also speaks the explanation, and not for a 200', () => {
    const { unmount } = setup({
      phase: 'done',
      response: {
        status: 403,
        statusText: 'Forbidden',
        body: {},
        failure: {
          error: 'forbidden',
          status: 403,
          reason: 'ROLE_NOT_ALLOWED',
        },
      },
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      `GET ${ENDPOINT}: 403 Forbidden. Respuesta esperada: este endpoint es solo para el rol ADMIN.`,
    );
    unmount();
    setup({
      phase: 'done',
      response: { status: 200, statusText: 'OK', body: {} },
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      new RegExp(`^GET ${ENDPOINT.replace('?', '\\?')}: 200 OK$`),
    );
  });

  it('explains a 5xx with the dictionary, not with the role copy', () => {
    setup({
      phase: 'done',
      response: {
        status: 503,
        statusText: 'Service Unavailable',
        body: { code: 'SERVICE_UNAVAILABLE' },
        failure: {
          error: 'server',
          status: 503,
          reason: 'SERVICE_UNAVAILABLE',
        },
      },
    });
    expect(
      screen.getByText(/El servicio no está disponible/, VISIBLE),
    ).toBeInTheDocument();
    expect(screen.queryByText(/rol ADMIN/)).toBeNull();
  });

  it('adds no explanation line to a 2xx response', () => {
    setup({
      phase: 'done',
      response: { status: 200, statusText: 'OK', body: { ok: true } },
    });
    expect(
      screen.getByRole('figure').parentElement?.querySelectorAll('p'),
    ).toHaveLength(1); // only the live region
  });

  it('falls back to the standard reason phrase when the transport sends none', () => {
    setup({
      phase: 'done',
      response: { status: 403, statusText: '', body: null },
    });
    expect(screen.getByRole('figure')).toHaveTextContent('403 Forbidden');
    expect(screen.getByRole('figure').querySelector('pre')?.textContent).toBe(
      'null',
    );
  });

  it('shows just the status code for an unknown reason phrase', () => {
    setup({
      phase: 'done',
      response: { status: 418, statusText: '', body: 1 },
    });
    expect(screen.getByRole('figure')).toHaveTextContent(/418(?! \w)/);
  });

  it('announces and shows the error text when there is no response', () => {
    setup({ phase: 'error' });
    const message =
      'No pudimos obtener la respuesta. Vuelve a elegir el endpoint para reintentar.';
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('figure')).toHaveTextContent('Sin respuesta');
  });

  it.each<ViewState>([
    { phase: 'idle' },
    { phase: 'loading' },
    { phase: 'error' },
    { phase: 'done', response: { status: 200, statusText: 'OK', body: {} } },
    {
      phase: 'done',
      response: {
        status: 403,
        statusText: 'Forbidden',
        body: {},
        failure: {
          error: 'forbidden',
          status: 403,
          reason: 'ROLE_NOT_ALLOWED',
        },
      },
    },
  ])('has no axe violations (%j)', async (view) => {
    const { container } = setup(view);
    expect(await axe(container)).toHaveNoViolations();
  });
});

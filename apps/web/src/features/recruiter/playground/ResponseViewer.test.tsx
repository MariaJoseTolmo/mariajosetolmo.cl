import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { ResponseViewer, type ViewState } from './ResponseViewer';

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
  ])('has no axe violations (%j)', async (view) => {
    const { container } = setup(view);
    expect(await axe(container)).toHaveNoViolations();
  });
});

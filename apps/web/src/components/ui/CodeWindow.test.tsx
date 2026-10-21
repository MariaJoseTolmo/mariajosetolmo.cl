import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { CodeWindow } from './CodeWindow';

const props = {
  method: 'GET',
  path: '/api/v1/profile',
  status: '200 OK',
  code: '{\n  "name": "Maria",\n  "open": true\n}',
  note: 'Ejemplo de respuesta',
};

describe('CodeWindow', () => {
  it('names the figure after the request line and shows the status', () => {
    render(<CodeWindow {...props} />);
    const figure = screen.getByRole('figure');
    expect(figure).toHaveAccessibleName('GET /api/v1/profile 200 OK');
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('renders the code verbatim, preserving its text', () => {
    const { container } = render(<CodeWindow {...props} />);
    expect(container.querySelector('pre')?.textContent).toBe(props.code);
  });

  it('wraps keys and string values in highlight spans but not literals', () => {
    const { container } = render(<CodeWindow {...props} />);
    const highlighted = [...container.querySelectorAll('pre span')].map(
      (el) => el.textContent,
    );
    expect(highlighted).toEqual(['"name"', '"Maria"', '"open"']);
  });

  it('renders the example note when given and omits it otherwise', () => {
    const { rerender } = render(<CodeWindow {...props} />);
    expect(screen.getByText('Ejemplo de respuesta')).toBeInTheDocument();
    rerender(<CodeWindow {...props} note={undefined} />);
    expect(screen.queryByText('Ejemplo de respuesta')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<CodeWindow {...props} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

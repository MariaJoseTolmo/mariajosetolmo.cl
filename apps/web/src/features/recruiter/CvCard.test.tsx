import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CvCard } from './CvCard';

describe('CvCard', () => {
  it('offers only "Descargar PDF"', async () => {
    const onDownload = jest.fn();
    render(<CvCard onDownload={onDownload} busy={false} failed={false} />);
    expect(
      screen.getByRole('heading', { name: 'CV completo' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Descargar PDF',
    ]);
    expect(screen.queryByRole('link')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Descargar PDF' }),
    );
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('stays focusable but aria-disabled, and announces it, while preparing', async () => {
    const onDownload = jest.fn();
    render(<CvCard onDownload={onDownload} busy failed={false} />);
    const button = screen.getByRole('button', { name: 'Descargar PDF' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Preparando…');
    await userEvent.click(button);
    expect(onDownload).not.toHaveBeenCalled();
  });

  it('keeps focus on the button when it becomes busy, with a persistent live region', () => {
    const { rerender } = render(
      <CvCard onDownload={jest.fn()} busy={false} failed={false} />,
    );
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    const button = screen.getByRole('button', { name: 'Descargar PDF' });
    button.focus();
    rerender(<CvCard onDownload={jest.fn()} busy failed={false} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Preparando…');
    expect(document.activeElement).toBe(button);
  });

  it('announces a failure next to the button', () => {
    render(<CvCard onDownload={jest.fn()} busy={false} failed />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos generar el enlace del CV. Inténtalo de nuevo.',
    );
    expect(
      screen.getByRole('button', { name: 'Descargar PDF' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('has no alert when nothing failed', () => {
    render(<CvCard onDownload={jest.fn()} busy={false} failed={false} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

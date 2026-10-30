import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CvCard } from './CvCard';

describe('CvCard', () => {
  it('offers only "Descargar PDF"', async () => {
    const onDownload = jest.fn();
    render(<CvCard onDownload={onDownload} busy={false} error={null} />);
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
    render(<CvCard onDownload={onDownload} busy error={null} />);
    const button = screen.getByRole('button', { name: 'Descargar PDF' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Preparando…');
    await userEvent.click(button);
    expect(onDownload).not.toHaveBeenCalled();
  });

  it('keeps focus on the button when it becomes busy, with a persistent live region', () => {
    const { rerender } = render(
      <CvCard onDownload={jest.fn()} busy={false} error={null} />,
    );
    const region = screen.getByRole('status');
    expect(region).toBeEmptyDOMElement();
    const button = screen.getByRole('button', { name: 'Descargar PDF' });
    button.focus();
    rerender(<CvCard onDownload={jest.fn()} busy error={null} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Preparando…');
    expect(document.activeElement).toBe(button);
  });

  it('announces a failure next to the button', () => {
    render(
      <CvCard
        onDownload={jest.fn()}
        busy={false}
        error="El servicio no está disponible en este momento."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El servicio no está disponible en este momento.',
    );
    expect(
      screen.getByRole('button', { name: 'Descargar PDF' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows whatever message it is given, and nothing of its own', () => {
    const { rerender } = render(
      <CvCard onDownload={jest.fn()} busy={false} error="Primer texto" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/^Primer texto$/);
    rerender(<CvCard onDownload={jest.fn()} busy={false} error="Otro texto" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/^Otro texto$/);
  });

  it('has no alert when nothing failed', () => {
    render(<CvCard onDownload={jest.fn()} busy={false} error={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

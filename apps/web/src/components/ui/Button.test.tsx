import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { Button } from './Button';

// Class assertions: CSS-module class names are identity-mapped in Jest, so
// `toHaveClass('outline')` only proves the variant is wired. The visual result
// is checked by the build and in the browser.
describe('Button', () => {
  it('renders a non-submitting button by default', () => {
    render(<Button>Enviar</Button>);
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('applies the requested variant and size', () => {
    render(
      <Button variant="outline" size={52}>
        Ver
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Ver' });
    expect(button).toHaveClass('outline');
    expect(button).toHaveClass('size52');
  });

  it('defaults to the primary variant at 48px', () => {
    render(<Button>Ok</Button>);
    const button = screen.getByRole('button', { name: 'Ok' });
    expect(button).toHaveClass('primary');
    expect(button).toHaveClass('size48');
  });

  it('calls onClick when enabled and not when disabled', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('allows submit buttons', () => {
    render(<Button type="submit">Enviar</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('has no axe violations', async () => {
    const { container } = render(<Button>Accesible</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

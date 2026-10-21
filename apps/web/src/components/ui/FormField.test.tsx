import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { FormField } from './FormField';

describe('FormField', () => {
  it('associates the label with the input and forwards input props', () => {
    render(
      <FormField
        id="email"
        label="Correo corporativo"
        type="email"
        autoComplete="email"
        placeholder="nombre@empresa.com"
        defaultValue=""
      />,
    );
    const input = screen.getByLabelText('Correo corporativo');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('id', 'email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('placeholder', 'nombre@empresa.com');
  });

  it('shows the optional marker inside the label', () => {
    render(<FormField id="empresa" label="Empresa" optional />);
    expect(screen.getByLabelText('Empresa (opcional)')).toBeInTheDocument();
  });

  it('does not mark required fields as optional', () => {
    render(<FormField id="email" label="Correo" required />);
    expect(screen.getByLabelText('Correo')).toBeRequired();
    expect(screen.queryByText('(opcional)')).toBeNull();
  });

  it('is valid and undescribed without an error', () => {
    render(<FormField id="email" label="Correo" />);
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces the error and links it with aria-describedby', () => {
    render(<FormField id="email" label="Correo" error="Escribe tu correo." />);
    const input = screen.getByLabelText('Correo');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Escribe tu correo.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(alert.id).toBe('email-error');
  });

  it('lets the user type (uncontrolled use)', async () => {
    const user = userEvent.setup();
    render(<FormField id="nombre" label="Nombre" />);
    const input = screen.getByLabelText('Nombre');
    await user.type(input, 'Ana');
    expect(input).toHaveValue('Ana');
  });

  it('has no axe violations, with and without an error', async () => {
    const { container, rerender } = render(
      <FormField id="email" label="Correo" />,
    );
    expect(await axe(container)).toHaveNoViolations();
    rerender(<FormField id="email" label="Correo" error="Error de ejemplo" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

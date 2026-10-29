import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { LoginForm } from './LoginForm';

function setup(
  props: { submitting?: boolean; errorMessage?: string; retry?: boolean } = {},
) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  const view = render(<LoginForm onSubmit={onSubmit} {...props} />);
  return { onSubmit, user, ...view };
}

const email = () => screen.getByLabelText('Correo corporativo');
const send = () =>
  screen.getByRole('button', { name: /Enviar enlace|Enviando|Reintentar/ });

describe('LoginForm layout', () => {
  it('renders the heading, lead and the three labelled fields', () => {
    setup();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Acceso para reclutadores',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acceso sin contraseña')).toBeInTheDocument();
    expect(email()).toBeRequired();
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Empresa (opcional)')).toHaveAttribute(
      'autocomplete',
      'organization',
    );
    expect(screen.getByLabelText('Nombre (opcional)')).toHaveAttribute(
      'autocomplete',
      'name',
    );
    expect(screen.getByLabelText('Empresa (opcional)')).not.toBeRequired();
    expect(
      screen.getByText(/Solo guardo tu correo, empresa y nombre/),
    ).toBeVisible();
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoginForm double submit', () => {
  it('ignores a submit while one is in flight, even if the button is not disabled', async () => {
    const { onSubmit, user, container } = setup({ submitting: true });
    await user.type(email(), 'ana@empresa.com');
    const form = container.querySelector('form');
    if (!form) throw new Error('form not rendered');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('focuses the email on mount only when asked to', () => {
    const { unmount } = setup();
    expect(email()).not.toHaveFocus();
    unmount();
    render(<LoginForm onSubmit={jest.fn()} autoFocusEmail />);
    expect(email()).toHaveFocus();
  });
});

describe('LoginForm validation', () => {
  it('rejects an empty email without calling onSubmit', async () => {
    const { onSubmit, user } = setup();
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe tu correo para recibir el enlace.',
    );
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveFocus();
  });

  it('rejects an invalid email with a different message', async () => {
    const { onSubmit, user } = setup();
    await user.type(email(), 'no-es-correo');
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Revisa el correo/);
    expect(email()).toHaveAccessibleDescription(/Revisa el correo/);
  });

  it('clears the error as soon as the email becomes valid', async () => {
    const { user } = setup();
    await user.click(send());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(email(), 'ana@empresa.com');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email()).toHaveAttribute('aria-invalid', 'false');
  });

  it('has no axe violations while showing a field error', async () => {
    const { user, container } = setup();
    await user.click(send());
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoginForm validation on blur', () => {
  it('shows the invalid error when leaving a non-empty invalid email', async () => {
    const { user } = setup();
    await user.type(email(), 'no-es-correo');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent(/Revisa el correo/);
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveAccessibleDescription(/Revisa el correo/);
  });

  it('does not move focus on blur', async () => {
    const { user } = setup();
    await user.type(email(), 'no-es-correo');
    await user.tab();
    expect(email()).not.toHaveFocus();
    expect(screen.getByLabelText('Empresa (opcional)')).toHaveFocus();
  });

  it('does not nag about an empty email on blur', async () => {
    const { user } = setup();
    await user.click(email());
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email()).toHaveAttribute('aria-invalid', 'false');
  });

  it('does not flag a whitespace-only email on blur', async () => {
    const { user } = setup();
    await user.type(email(), '   ');
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not error on blur for a valid email', async () => {
    const { user } = setup();
    await user.type(email(), 'ana@empresa.com');
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the blur error while typing, without another blur', async () => {
    const { user } = setup();
    await user.type(email(), 'ana@empresa');
    await user.tab();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(email());
    await user.type(email(), '.com');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email()).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps the same alert node while the value stays invalid', async () => {
    const { user } = setup();
    await user.type(email(), 'ana');
    await user.tab();
    const alert = screen.getByRole('alert');
    await user.click(email());
    await user.type(email(), 'x');
    expect(screen.getByRole('alert')).toBe(alert);
    expect(alert).toHaveTextContent(/Revisa el correo/);
  });

  it('still focuses the email when submitting an invalid value', async () => {
    const { onSubmit, user } = setup();
    await user.type(email(), 'no-es-correo');
    await user.tab();
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(email()).toHaveFocus();
  });

  it('has no axe violations with the blur error shown', async () => {
    const { user, container } = setup();
    await user.type(email(), 'no-es-correo');
    await user.tab();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('LoginForm submit', () => {
  it('sends only the email when the optionals are empty', async () => {
    const { onSubmit, user } = setup();
    await user.type(email(), 'ana@empresa.com');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@empresa.com' });
  });

  it('sends email, company and name when all are filled', async () => {
    const { onSubmit, user } = setup();
    await user.type(email(), 'ana@empresa.com');
    await user.type(screen.getByLabelText('Empresa (opcional)'), 'Acme');
    await user.type(screen.getByLabelText('Nombre (opcional)'), 'Ana');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'ana@empresa.com',
      company: 'Acme',
      name: 'Ana',
    });
  });

  it('trims every value and omits whitespace-only optionals', async () => {
    const { onSubmit, user } = setup();
    await user.type(email(), '  ana@empresa.com ');
    await user.type(screen.getByLabelText('Empresa (opcional)'), '   ');
    await user.type(screen.getByLabelText('Nombre (opcional)'), '  Ana ');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'ana@empresa.com',
      name: 'Ana',
    });
  });

  it('submits with the Enter key', async () => {
    const { onSubmit, user } = setup();
    await user.type(email(), 'ana@empresa.com{Enter}');
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@empresa.com' });
  });
});

describe('LoginForm states', () => {
  it('disables the button and announces progress while submitting', () => {
    setup({ submitting: true });
    expect(send()).toBeDisabled();
    expect(send()).toHaveTextContent('Enviando…');
    expect(
      screen.getByRole('form', { name: 'Acceso para reclutadores' }),
    ).toHaveAttribute('aria-busy', 'true');
  });

  it('is idle and enabled by default', () => {
    setup();
    expect(send()).toBeEnabled();
    expect(send()).toHaveTextContent('Enviar enlace de acceso');
    expect(
      screen.getByRole('form', { name: 'Acceso para reclutadores' }),
    ).toHaveAttribute('aria-busy', 'false');
  });

  it('shows the given error message in an alert and keeps what was typed', async () => {
    const { rerender, user, onSubmit } = setup();
    await user.type(email(), 'ana@empresa.com');
    rerender(<LoginForm onSubmit={onSubmit} errorMessage="Algo salió mal." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal.');
    expect(email()).toHaveValue('ana@empresa.com');
    expect(send()).toHaveTextContent('Enviar enlace de acceso');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@empresa.com' });
  });

  it('turns the only submit button into "Reintentar" when retry is set', async () => {
    const { user, onSubmit } = setup({ errorMessage: 'Falló.', retry: true });
    await user.type(email(), 'ana@empresa.com');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(send()).toHaveTextContent('Reintentar');
    expect(send()).toHaveAttribute('type', 'submit');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('hides the API alert and the retry label while a local email error is shown', async () => {
    const { user, onSubmit } = setup({
      errorMessage: 'Falló.',
      retry: true,
    });
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.click(send());
    expect(onSubmit).not.toHaveBeenCalled();
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(
      'Escribe tu correo para recibir el enlace.',
    );
    expect(screen.queryByText('Falló.')).toBeNull();
    expect(send()).toHaveTextContent('Enviar enlace de acceso');
    await user.type(email(), 'ana@empresa.com');
    expect(screen.getByRole('alert')).toHaveTextContent('Falló.');
    expect(send()).toHaveTextContent('Reintentar');
  });

  it('shows "Enviando…" while submitting even if retry is set', () => {
    setup({ errorMessage: 'Falló.', retry: true, submitting: true });
    expect(send()).toHaveTextContent('Enviando…');
  });

  it('shows no alert when there is no failure', () => {
    setup();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has no axe violations on an error', async () => {
    const { container } = setup({ errorMessage: 'Falló.', retry: true });
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { LoginForm } from './LoginForm';

function setup(props: { submitting?: boolean; networkError?: boolean } = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  const view = render(<LoginForm onSubmit={onSubmit} {...props} />);
  return { onSubmit, user, ...view };
}

const email = () => screen.getByLabelText('Correo corporativo');
const send = () =>
  screen.getByRole('button', { name: /Enviar enlace|Enviando/ });

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

  it('clears the error as soon as the user edits the email', async () => {
    const { user } = setup();
    await user.click(send());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(email(), 'a');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email()).toHaveAttribute('aria-invalid', 'false');
  });

  it('has no axe violations while showing a field error', async () => {
    const { user, container } = setup();
    await user.click(send());
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

  it('shows a generic alert on network failure and keeps what was typed', async () => {
    const { rerender, user, onSubmit } = setup();
    await user.type(email(), 'ana@empresa.com');
    rerender(<LoginForm onSubmit={onSubmit} networkError />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos enviar el enlace. Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(email()).toHaveValue('ana@empresa.com');
    await user.click(send());
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@empresa.com' });
  });

  it('shows no alert when there is no failure', () => {
    setup();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('has no axe violations on network failure', async () => {
    const { container } = setup({ networkError: true });
    expect(await axe(container)).toHaveNoViolations();
  });
});

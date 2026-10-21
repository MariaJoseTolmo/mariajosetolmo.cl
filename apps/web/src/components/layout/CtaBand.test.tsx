import { act, render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { CtaBand } from './CtaBand';

const CTA = { label: 'Recibir enlace de acceso', href: '/acceso/' };

// next/link schedules a state update on an idle callback; let it settle inside act.
const flushIdleCallbacks = () => new Promise<void>((r) => setTimeout(r, 20));

describe('CtaBand', () => {
  it('renders the band with heading, text and the access link', () => {
    render(
      <CtaBand
        title="¿Buscas una desarrolladora backend Node.js?"
        text="Ingresa con tu correo, sin contraseña."
        cta={{ label: 'Recibir enlace de acceso', href: '/acceso/' }}
      />,
    );
    const region = screen.getByRole('region', {
      name: '¿Buscas una desarrolladora backend Node.js?',
    });
    expect(region).toHaveTextContent('Ingresa con tu correo, sin contraseña.');
    expect(
      screen.getByRole('link', { name: 'Recibir enlace de acceso' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/acceso\/?$/));
  });

  it('renders the card variant without text', () => {
    render(
      <CtaBand
        variant="card"
        title="¿Quieres el CV completo en PDF y mi contacto directo?"
        cta={{ label: 'Recibir enlace de acceso', href: '/acceso/' }}
      />,
    );
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '¿Quieres el CV completo en PDF y mi contacto directo?',
      }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('paragraph')).toHaveLength(0);
  });

  it('has no axe violations in the band variant', async () => {
    const { container } = render(
      <CtaBand title="Titulo uno" text="Texto" cta={CTA} />,
    );
    await act(flushIdleCallbacks);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the card variant', async () => {
    const { container } = render(
      <CtaBand variant="card" title="Titulo dos" cta={CTA} />,
    );
    await act(flushIdleCallbacks);
    expect(await axe(container)).toHaveNoViolations();
  });
});

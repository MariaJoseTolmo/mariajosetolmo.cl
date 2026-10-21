import { render, screen } from '@testing-library/react';
import { home } from '@/content/home';
import { axe } from '@/test/axe';
import { Hero } from './Hero';

describe('Hero', () => {
  it('renders one h1 with the headline and the eyebrow', () => {
    render(<Hero />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Microservicios con NestJS para banca y minería.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Desarrolladora Backend · Node.js / NestJS · Santiago, Chile',
      ),
    ).toBeInTheDocument();
  });

  it('renders the two calls to action', () => {
    render(<Hero />);
    expect(
      screen.getByRole('link', { name: 'Solicitar CV completo' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/acceso\/?$/));
    expect(
      screen.getByRole('link', { name: 'Ver experiencia' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/experiencia\/?$/));
  });

  it('shows the GET /api/v1/profile card labeled as an example', () => {
    render(<Hero />);
    const card = screen.getByRole('figure');
    expect(card).toHaveTextContent('GET');
    expect(card).toHaveTextContent('/api/v1/profile');
    expect(card).toHaveTextContent('200 OK');
    expect(card).toHaveTextContent(/ejemplo/i);
  });

  it('states Kafka only together with SQS in the sample', () => {
    render(<Hero />);
    const text = screen.getByRole('figure').textContent ?? '';
    expect(text).toContain('Kafka en local / SQS en producción');
    expect(text).not.toMatch(/kafka(?! en local \/ SQS en producción)/i);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Hero />);
    expect(await axe(container)).toHaveNoViolations();
  });

  describe('when a call to action is missing', () => {
    const original = [...home.hero.ctas];
    const setCtas = (ctas: typeof home.hero.ctas) => {
      (home.hero as { ctas: typeof home.hero.ctas }).ctas = ctas;
    };
    afterEach(() => setCtas(original));

    it('renders only the secondary link when there is no primary one', () => {
      setCtas([undefined, original[1]] as unknown as typeof home.hero.ctas);
      render(<Hero />);
      expect(
        screen.queryByRole('link', { name: 'Solicitar CV completo' }),
      ).toBeNull();
      expect(
        screen.getByRole('link', { name: 'Ver experiencia' }),
      ).toBeInTheDocument();
    });

    it('renders only the primary link when there is no secondary one', () => {
      setCtas([original[0]] as unknown as typeof home.hero.ctas);
      render(<Hero />);
      expect(
        screen.getByRole('link', { name: 'Solicitar CV completo' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Ver experiencia' }),
      ).toBeNull();
    });
  });
});

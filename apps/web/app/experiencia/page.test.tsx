import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import HomePage from '../page';
import { experience } from '@/content/experience';
import ExperiencePage from './page';

function navLinks(ui: React.ReactElement) {
  const { unmount } = render(ui);
  const nav = screen.getByRole('navigation', { name: 'Principal' });
  const links = within(nav)
    .getAllByRole('link')
    .map((a) => [a.textContent, a.getAttribute('href')]);
  unmount();
  return links;
}

describe('experience page', () => {
  it('renders a single h1', () => {
    render(<ExperiencePage />);
    expect(
      screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent),
    ).toEqual(['Trayectoria']);
  });

  it('shows the API eyebrow right before the h1', () => {
    render(<ExperiencePage />);
    const eyebrow = screen.getByText(experience.eyebrow);
    expect(eyebrow).toHaveTextContent('GET /api/v1/experience');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(
      eyebrow.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(eyebrow.parentElement).toBe(h1.parentElement);
  });

  it('never mentions Kafka without SQS in the rendered page', () => {
    const { container } = render(<ExperiencePage />);
    expect(container.textContent).not.toMatch(
      /kafka(?! en local \/ SQS en producción)/i,
    );
  });

  it('renders main#contenido as the skip-link target', () => {
    const { container } = render(<ExperiencePage />);
    expect(container.querySelectorAll('main#contenido')).toHaveLength(1);
  });

  it('uses the same shared nav as the home page', () => {
    const home = navLinks(<HomePage />);
    const experience = navLinks(<ExperiencePage />);
    expect(home).toHaveLength(5);
    expect(experience).toEqual(home);
  });

  it('marks only Experiencia as the current page', () => {
    const { container } = render(<ExperiencePage />);
    const current = container.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBeGreaterThan(0);
    for (const el of Array.from(current)) {
      expect(el).toHaveTextContent('Experiencia');
    }
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(
      current.length,
    );
  });

  it('has the timeline with 5 items, Formación and the closing call to action', () => {
    render(<ExperiencePage />);
    const list = screen.getByRole('list', { name: 'Trayectoria laboral' });
    expect(within(list).getAllByRole('heading', { level: 2 })).toHaveLength(5);
    expect(
      screen.getByRole('region', { name: 'Formación' }),
    ).toBeInTheDocument();
    const cta = screen.getByRole('region', {
      name: '¿Quieres el CV completo en PDF y mi contacto directo?',
    });
    expect(within(cta).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/acceso\/?$/),
    );
  });

  it('shows the footer name', () => {
    render(<ExperiencePage />);
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'María José Tolmo Tolmo',
    );
  });

  it('has no axe violations', async () => {
    const { container } = render(<ExperiencePage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

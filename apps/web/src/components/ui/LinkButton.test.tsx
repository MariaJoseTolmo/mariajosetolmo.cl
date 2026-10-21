import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { LinkButton } from './LinkButton';

// Class assertions: CSS-module class names are identity-mapped in Jest, so
// `toHaveClass('outline')` only proves the variant is wired. The visual result
// is checked by the build and in the browser.
describe('LinkButton', () => {
  it('renders a link with the given href', () => {
    render(<LinkButton href="/experiencia/">Experiencia</LinkButton>);
    expect(screen.getByRole('link', { name: 'Experiencia' })).toHaveAttribute(
      'href',
      // Link only appends the trailing slash from next.config in a real build.
      expect.stringMatching(/^\/experiencia\/?$/),
    );
  });

  it('applies variant and size classes', () => {
    render(
      <LinkButton href="/" variant="on-dark" size={44}>
        Inicio
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Inicio' });
    expect(link).toHaveClass('on-dark');
    expect(link).toHaveClass('size44');
  });

  it('defaults to the primary variant at 48px', () => {
    render(<LinkButton href="/">Ok</LinkButton>);
    const link = screen.getByRole('link', { name: 'Ok' });
    expect(link).toHaveClass('primary');
    expect(link).toHaveClass('size48');
  });

  it('has no axe violations', async () => {
    const { container } = render(<LinkButton href="/">Accesible</LinkButton>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

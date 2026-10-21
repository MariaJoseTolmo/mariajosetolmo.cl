import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { Footer } from './Footer';

describe('Footer', () => {
  it('shows the owner name and role', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(
      'María José Tolmo Tolmo · Desarrolladora Backend',
    );
  });

  it('links the public contact channels', () => {
    render(<Footer />);
    const footer = within(screen.getByRole('contentinfo'));
    expect(
      footer.getByRole('link', { name: 'mariajosetolmo@gmail.com' }),
    ).toHaveAttribute('href', 'mailto:mariajosetolmo@gmail.com');
    expect(footer.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://linkedin.com/in/mariajosetolmo',
    );
    expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/MariaJoseTolmo',
    );
  });

  it('does not render a phone number', () => {
    render(<Footer />);
    const text = screen.getByRole('contentinfo').textContent ?? '';
    expect(text).not.toMatch(/\+?\d[\d\s().-]{6,}\d/);
    expect(
      within(screen.getByRole('contentinfo'))
        .getAllByRole('link')
        .every((a) => !a.getAttribute('href')?.startsWith('tel:')),
    ).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Footer />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

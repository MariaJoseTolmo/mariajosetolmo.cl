import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { Contributions } from './Contributions';

describe('Contributions', () => {
  it('is a labelled region with the section heading', () => {
    render(<Contributions />);
    const region = screen.getByRole('region', {
      name: 'Experiencia en contextos donde un error cuesta caro.',
    });
    expect(within(region).getByText('01 / Lo que aporto')).toBeInTheDocument();
  });

  it('renders three articles with their own h3', () => {
    render(<Contributions />);
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);
    expect(
      articles.map(
        (a) => within(a).getByRole('heading', { level: 3 }).textContent,
      ),
    ).toEqual([
      'APIs con datos cifrados, en producción',
      'Migración Java → Node.js y desarrollo agéntico',
      'De modelar edificios a modelar dominios',
    ]);
  });

  it('keeps employer and client names from the approved copy', () => {
    render(<Contributions />);
    expect(screen.getByText('Banca · Accenture / Itaú')).toBeInTheDocument();
    expect(screen.getByText('Minería · Kabeli, Amecs')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Contributions />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

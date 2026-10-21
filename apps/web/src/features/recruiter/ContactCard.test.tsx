import { render, screen, within } from '@testing-library/react';
import { ContactCard } from './ContactCard';

describe('ContactCard', () => {
  it('lists email, phone, LinkedIn and GitHub in that order', () => {
    render(<ContactCard />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(
      items.map((li) => {
        const a = within(li).getByRole('link');
        return [a.textContent, a.getAttribute('href')];
      }),
    ).toEqual([
      ['mariajosetolmo@gmail.com', 'mailto:mariajosetolmo@gmail.com'],
      ['+56 9 7453 6288', 'tel:+56974536288'],
      ['LinkedIn', 'https://linkedin.com/in/mariajosetolmo'],
      ['GitHub', 'https://github.com/MariaJoseTolmo'],
    ]);
  });

  it('is titled "Contacto directo"', () => {
    render(<ContactCard />);
    expect(
      screen.getByRole('region', { name: 'Contacto directo' }),
    ).toBeInTheDocument();
  });
});

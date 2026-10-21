import { render, screen } from '@testing-library/react';
import { DetailsCard } from './DetailsCard';

describe('DetailsCard', () => {
  it('shows the availability the API returned under static labels', () => {
    render(
      <DetailsCard
        availability={{
          modality: 'API-MODALIDAD',
          start: 'API-INICIO',
          salary: 'API-RENTA',
        }}
      />,
    );
    expect(
      screen.getByRole('region', { name: 'Disponibilidad' }),
    ).toBeInTheDocument();
    const terms = screen.getAllByRole('term').map((t) => t.textContent);
    const values = screen.getAllByRole('definition').map((d) => d.textContent);
    expect(terms).toEqual(['Modalidad', 'Inicio', 'Renta']);
    expect(values).toEqual(['API-MODALIDAD', 'API-INICIO', 'API-RENTA']);
  });

  it('renders other values just as faithfully', () => {
    render(
      <DetailsCard availability={{ modality: 'x', start: 'y', salary: 'z' }} />,
    );
    expect(screen.getAllByRole('definition').map((d) => d.textContent)).toEqual(
      ['x', 'y', 'z'],
    );
  });
});

import { render, screen } from '@testing-library/react';
import { InfoCard } from './InfoCard';

describe('InfoCard', () => {
  it('is a region named by its h2', () => {
    render(
      <InfoCard id="demo" title="Mi tarjeta">
        <p>contenido</p>
      </InfoCard>,
    );
    const region = screen.getByRole('region', { name: 'Mi tarjeta' });
    expect(region).toContainElement(
      screen.getByRole('heading', { level: 2, name: 'Mi tarjeta' }),
    );
    expect(region).toHaveTextContent('contenido');
  });
});

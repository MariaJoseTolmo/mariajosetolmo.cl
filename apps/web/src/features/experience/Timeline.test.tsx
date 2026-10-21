import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { Timeline } from './Timeline';

describe('Timeline', () => {
  it('is an ordered list with the five roles', () => {
    render(<Timeline />);
    const list = screen.getByRole('list', { name: 'Trayectoria laboral' });
    expect(list.tagName).toBe('OL');
    expect(list).toHaveAttribute('role', 'list');
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      'Desarrolladora Backend · Kabeli',
      'Desarrolladora Backend · Amecs',
      'Desarrolladora Backend Node.js · Accenture Chile',
      'Desarrolladora Frontend JavaScript · Independiente',
      'Coordinadora CAD/BIM · Consultoría',
    ]);
  });

  it('shows each employer in order, keeping the approved names', () => {
    render(<Timeline />);
    const items = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.closest('li'));
    expect(items).toHaveLength(5);
    expect(
      items.map(
        (li) =>
          within(li!).getByText(
            /^(Kabeli|Amecs|Accenture Chile|Independiente|Consultoría)$/,
          ).textContent,
      ),
    ).toEqual([
      'Kabeli',
      'Amecs',
      'Accenture Chile',
      'Independiente',
      'Consultoría',
    ]);
  });

  it('names the first role with its company (Kabeli)', () => {
    render(<Timeline />);
    expect(
      screen.getByRole('heading', { name: /Desarrolladora Backend.*Kabeli/ }),
    ).toBeInTheDocument();
  });

  it('gives every role a Logro callout', () => {
    render(<Timeline />);
    expect(screen.getAllByText('Logro:')).toHaveLength(5);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Timeline />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { EducationSection } from './EducationSection';

describe('EducationSection', () => {
  it('is a region labelled by the Formación heading', () => {
    render(<EducationSection />);
    const region = screen.getByRole('region', { name: 'Formación' });
    expect(
      within(region).getByRole('heading', { level: 2, name: 'Formación' }),
    ).toBeInTheDocument();
  });

  it('lists five entries with their period', () => {
    render(<EducationSection />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('Técnico en Informática, CIISA IPSS');
    expect(items[0]).toHaveTextContent('2025 · en curso');
    expect(items[4]).toHaveTextContent(
      'Diplomado BIM, Pontificia Universidad Católica de Chile',
    );
    expect(items[4]).toHaveTextContent('2013');
  });

  it('keeps list semantics despite list-style: none', () => {
    const { container } = render(<EducationSection />);
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('has no axe violations', async () => {
    const { container } = render(<EducationSection />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

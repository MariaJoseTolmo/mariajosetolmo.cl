import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { StackSection } from './StackSection';

function column(name: string) {
  const heading = screen.getByRole('heading', { level: 3, name });
  const group = heading.closest('div');
  if (!group) throw new Error(`no column for ${name}`);
  return within(group);
}

describe('StackSection', () => {
  it('is the #stack anchor, labelled by its heading', () => {
    const { container } = render(<StackSection />);
    const region = screen.getByRole('region', {
      name: 'Lo que uso a diario y lo que estoy sumando.',
    });
    expect(region).toHaveAttribute('id', 'stack');
    expect(container.querySelectorAll('#stack')).toHaveLength(1);
  });

  it('renders the four columns in order', () => {
    render(<StackSection />);
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual([
      'Avanzado',
      'En producción',
      'Arquitectura y prácticas',
      'Aprendiendo',
    ]);
  });

  it('lists the items of each column', () => {
    render(<StackSection />);
    expect(
      column('Avanzado')
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['JavaScript', 'Node.js', 'NestJS', 'PostgreSQL']);
  });

  it('presents AWS under Aprendiendo as applied in this project, nowhere else', () => {
    render(<StackSection />);
    expect(column('Aprendiendo').getByText(/^AWS/)).toHaveTextContent(
      'aprendiendo, aplicado en este proyecto',
    );
    for (const name of [
      'Avanzado',
      'En producción',
      'Arquitectura y prácticas',
    ]) {
      expect(column(name).queryByText(/AWS/)).toBeNull();
    }
  });

  it('states Kafka only together with SQS', () => {
    const { container } = render(<StackSection />);
    const text = container.textContent ?? '';
    expect(text).toContain('Kafka en local / SQS en producción');
    expect(text).not.toMatch(/Kafka(?! en local \/ SQS en producción)/);
  });

  it('shows no levels as numbers or percentages', () => {
    const { container } = render(<StackSection />);
    expect(container.textContent).not.toMatch(/\d+\s?(%|\/\s?\d+)/);
  });

  it('has no axe violations', async () => {
    const { container } = render(<StackSection />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

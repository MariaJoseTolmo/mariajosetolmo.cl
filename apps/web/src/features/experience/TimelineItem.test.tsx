import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import type { ExperienceItem } from '@/content/types';
import { TimelineItem } from './TimelineItem';

const full: ExperienceItem = {
  id: 'acme',
  period: '2023 – 2024 · remoto',
  company: 'Acme',
  sector: 'Banca',
  role: 'Desarrolladora Backend',
  highlights: ['Primer punto.', 'Segundo punto.'],
  achievement: 'ascendí de Trainee a Junior.',
  technologies: ['NestJS', 'Swagger'],
};

function renderInList(item: ExperienceItem) {
  return render(
    <ol>
      <TimelineItem item={item} />
    </ol>,
  );
}

describe('TimelineItem', () => {
  it('is a list item with company, sector and period', () => {
    renderInList(full);
    const [li] = screen.getAllByRole('listitem');
    expect(li).toHaveTextContent('2023 – 2024 · remoto');
    expect(li).toHaveTextContent('Acme');
    expect(li).toHaveTextContent('Banca');
  });

  it('titles the role as an h2 and lists the highlights', () => {
    renderInList(full);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Desarrolladora Backend · Acme',
      }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('listitem')
        .slice(1)
        .map((li) => li.textContent),
    ).toEqual(['Primer punto.', 'Segundo punto.']);
  });

  it('includes the company in the accessible name of the role heading', () => {
    renderInList(full);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /Desarrolladora Backend.*Acme/,
      }),
    ).toBeInTheDocument();
  });

  it('renders the achievement as a Logro callout', () => {
    renderInList(full);
    expect(screen.getByText('Logro:')).toBeInTheDocument();
    expect(
      screen.getByText(/ascendí de Trainee a Junior\./),
    ).toBeInTheDocument();
  });

  it('joins the technologies with a middle dot', () => {
    renderInList(full);
    expect(screen.getByText('NestJS · Swagger')).toBeInTheDocument();
  });

  it('omits the technologies line when there are none', () => {
    const { container } = renderInList({ ...full, technologies: undefined });
    expect(within(container).queryByText(/NestJS/)).toBeNull();
    expect(container.querySelectorAll('li li')).toHaveLength(2);
  });

  it('has no axe violations', async () => {
    const { container } = renderInList(full);
    expect(await axe(container)).toHaveNoViolations();
  });
});

import { render, screen, within } from '@testing-library/react';
import { axe } from '@/test/axe';
import { login } from '@/content/login';
import { StepsPanel } from './StepsPanel';

describe('StepsPanel', () => {
  it('is a complementary landmark labelled by its heading', () => {
    render(<StepsPanel activeStep={0} />);
    const aside = screen.getByRole('complementary', {
      name: 'Qué hace la API NestJS en cada paso',
    });
    expect(
      within(aside).getByText('Detrás de este formulario'),
    ).toBeInTheDocument();
    expect(within(aside).getByText(login.steps.footnote)).toBeInTheDocument();
  });

  it('lists the four steps in order', () => {
    render(<StepsPanel activeStep={0} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    login.steps.items.forEach((step, i) => {
      expect(items[i]).toHaveTextContent(step.endpoint);
      expect(items[i]).toHaveTextContent(step.detail);
    });
  });

  it('keeps role="list" because the list is restyled with list-style: none', () => {
    render(<StepsPanel activeStep={0} />);
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(screen.getByRole('list')).toHaveAttribute('role', 'list');
  });

  it.each([0, 1, 2, 3])('highlights only step %i', (active) => {
    render(<StepsPanel activeStep={active} />);
    const items = screen.getAllByRole('listitem');
    const current = items.filter(
      (li) => li.getAttribute('aria-current') === 'step',
    );
    expect(current).toEqual([items[active]]);
  });

  it('numbers pending steps and checks the completed ones', () => {
    render(<StepsPanel activeStep={2} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('✓');
    expect(items[1]).toHaveTextContent('✓');
    expect(items[2]).toHaveTextContent('3');
    expect(items[2]).not.toHaveTextContent('✓');
    expect(items[3]).toHaveTextContent('4');
    expect(within(items[0]!).getByText('Completado')).toBeInTheDocument();
    expect(within(items[3]!).queryByText('Completado')).toBeNull();
  });

  it('always hides the check mark from assistive technology', () => {
    render(<StepsPanel activeStep={2} />);
    const marks = screen
      .getAllByRole('listitem')
      .slice(0, 2)
      .map((li) => within(li).getByText('✓'));
    expect(marks).toHaveLength(2);
    for (const mark of marks)
      expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByText('Completado')).toHaveLength(2);
  });

  it('has no axe violations', async () => {
    const { container } = render(<StepsPanel activeStep={1} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

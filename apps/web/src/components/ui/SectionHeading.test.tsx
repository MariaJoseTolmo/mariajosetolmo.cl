import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { SectionHeading } from './SectionHeading';

describe('SectionHeading', () => {
  it('renders the eyebrow and a level-2 heading with the given id', () => {
    render(
      <SectionHeading id="stack-h" eyebrow="02 / Stack" title="Lo que uso" />,
    );
    expect(screen.getByText('02 / Stack')).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Lo que uso');
    expect(heading).toHaveAttribute('id', 'stack-h');
  });

  it('renders an optional lead paragraph', () => {
    const { rerender } = render(
      <SectionHeading id="a" eyebrow="e" title="t" lead="Texto de apoyo" />,
    );
    expect(screen.getByText('Texto de apoyo')).toBeInTheDocument();
    rerender(<SectionHeading id="a" eyebrow="e" title="t" />);
    expect(screen.queryByText('Texto de apoyo')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <SectionHeading id="a" eyebrow="e" title="t" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

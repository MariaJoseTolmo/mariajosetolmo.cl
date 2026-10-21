import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { Callout } from './Callout';

describe('Callout', () => {
  it('shows the label in bold followed by the text', () => {
    render(<Callout label="Logro">ascendí de Trainee a Junior.</Callout>);
    expect(screen.getByText('Logro:').tagName).toBe('STRONG');
    expect(screen.getByText(/ascendí de Trainee a Junior\./)).toHaveTextContent(
      'Logro: ascendí de Trainee a Junior.',
    );
  });

  it('uses the label it is given', () => {
    render(<Callout label="Nota">otro texto</Callout>);
    expect(screen.getByText('Nota:')).toBeInTheDocument();
    expect(screen.queryByText('Logro:')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Callout label="Logro">texto</Callout>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

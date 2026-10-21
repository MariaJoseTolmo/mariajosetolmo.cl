import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import { Eyebrow } from './Eyebrow';

describe('Eyebrow', () => {
  it('renders its text as a paragraph', () => {
    render(<Eyebrow>01 / Stack</Eyebrow>);
    expect(screen.getByText('01 / Stack').tagName).toBe('P');
  });

  it('does not introduce a heading', () => {
    render(<Eyebrow>Etiqueta</Eyebrow>);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Eyebrow>Etiqueta</Eyebrow>);
    expect(await axe(container)).toHaveNoViolations();
  });
});

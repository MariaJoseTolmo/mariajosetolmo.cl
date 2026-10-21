import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('keeps its text in the DOM for assistive technology', () => {
    render(
      <h2>
        Rol<VisuallyHidden> · Acme</VisuallyHidden>
      </h2>,
    );
    expect(
      screen.getByRole('heading', { name: 'Rol · Acme' }),
    ).toBeInTheDocument();
  });

  it('hides itself visually without display:none or hidden', () => {
    const css = readFileSync(
      join(__dirname, 'VisuallyHidden.module.css'),
      'utf8',
    );
    expect(css).toMatch(/position:\s*absolute/);
    expect(css).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(css).toMatch(/width:\s*1px/);
    expect(css).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });
});

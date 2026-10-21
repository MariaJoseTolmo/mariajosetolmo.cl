import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(
  join(__dirname, 'ArchitectureSection.module.css'),
  'utf8',
);

describe('ArchitectureSection.module.css', () => {
  it('draws the flow arrows with ::after on the nodes, not extra list items', () => {
    expect(css).toMatch(
      /\.node[^{]*:not\(:last-child\)::after\s*{[^}]*content:\s*'→'/,
    );
    expect(css).not.toMatch(/^\.arrow\b/m);
  });

  it('rotates the arrow 90 degrees on mobile and resets it from 761px', () => {
    const [base, desktop] = css.split('@media (min-width: 761px)') as [
      string,
      string,
    ];
    expect(base).toMatch(/::after\s*{[^}]*rotate\(90deg\)/);
    expect(desktop).toMatch(
      /::after\s*{[^}]*transform:\s*translate\(50%, -50%\);/,
    );
    expect(desktop).not.toMatch(/rotate\(/);
  });
});

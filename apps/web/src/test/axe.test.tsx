import { render } from '@testing-library/react';
import { axe } from './axe';

describe('axe helper', () => {
  it('detects a real violation (image without alt text)', async () => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { container } = render(<img src="/x.png" />);
    const results = await axe(container);
    expect(results.violations.map((v) => v.id)).toContain('image-alt');
  });
});

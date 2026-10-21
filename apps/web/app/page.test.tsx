import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import RootLayout from './layout';
import Page from './page';
import { SkipLink } from '@/components/layout/SkipLink';

describe('home page (smoke)', () => {
  it('renders a single h1', () => {
    render(<Page />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders main#contenido as the skip-link target', () => {
    const { container } = render(<Page />);
    const main = container.querySelector('main#contenido');
    expect(main).not.toBeNull();
    expect(screen.getByRole('main')).toBe(main);
  });

  it('has no axe violations', async () => {
    const { container } = render(<Page />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('declares lang="es" on the root layout', () => {
    const tree = RootLayout({ children: null }) as ReactElement<{
      lang: string;
    }>;
    expect(tree.props.lang).toBe('es');
  });

  it('renders the skip link as the first element of the body', () => {
    const tree = RootLayout({ children: null }) as ReactElement<{
      children: ReactElement<{ children: ReactElement[] }>;
    }>;
    const [first] = tree.props.children.props.children;
    expect(first?.type).toBe(SkipLink);
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { site } from '@/content/site';
import { MobileMenu } from './MobileMenu';

function setup(currentPath = '/') {
  const user = userEvent.setup();
  const view = render(
    <MobileMenu items={site.nav} currentPath={currentPath} />,
  );
  const button = screen.getByRole('button', { name: 'Menú' });
  return { user, button, ...view };
}

describe('MobileMenu', () => {
  it('starts closed with aria-expanded="false"', () => {
    const { button } = setup();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('aria-controls points to an element that exists in the DOM', () => {
    const { button, container } = setup();
    const id = button.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    expect(container.querySelector(`#${id}`)).not.toBeNull();
  });

  it('opens on activation, exposes the five links and keeps the static name', async () => {
    const { user, button } = setup();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAccessibleName('Menú');
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(
      site.nav.map((n) => n.label),
    );
  });

  it('closes on Escape and returns focus to the button', async () => {
    const { user, button } = setup();
    await user.click(button);
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('returns focus to the button when Escape is pressed from inside the panel', async () => {
    const { user, button } = setup();
    await user.click(button);
    await user.tab();
    expect(screen.getByRole('link', { name: 'Experiencia' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('ignores Escape while closed', async () => {
    const { user, button } = setup();
    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveFocus();
  });

  it('toggles closed when the button is activated again', async () => {
    const { user, button } = setup();
    await user.click(button);
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after choosing a link', async () => {
    const { user, button } = setup();
    await user.click(button);
    await user.click(screen.getByRole('link', { name: 'Stack' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('returns focus to the toggle when a panel link closes the menu', async () => {
    const { user, button } = setup();
    await user.click(button);
    await user.click(screen.getByRole('link', { name: 'Stack' }));
    expect(button).toHaveFocus();
  });

  it('marks the current route in the panel', async () => {
    const { user, button } = setup('/experiencia/');
    await user.click(button);
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Experiencia']);
  });

  it('has no axe violations closed or open', async () => {
    const { user, button, container } = setup();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(button);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('MobileMenu desktop breakpoint', () => {
  type Listener = (event: { matches: boolean }) => void;
  let listeners: Listener[];
  let queries: string[];

  beforeEach(() => {
    listeners = [];
    queries = [];
    const matchMedia = (query: string) => {
      queries.push(query);
      return {
        matches: false,
        media: query,
        addEventListener: (_: string, fn: Listener) => listeners.push(fn),
        removeEventListener: (_: string, fn: Listener) => {
          listeners = listeners.filter((l) => l !== fn);
        },
      };
    };
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMedia,
    });
  });

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('closes the open menu when the viewport reaches the header breakpoint', async () => {
    const { user, button } = setup();
    expect(queries).toContain('(min-width: 900px)');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    act(() => listeners.forEach((fn) => fn({ matches: true })));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the menu open when the viewport stays below the breakpoint', async () => {
    const { user, button } = setup();
    await user.click(button);
    act(() => listeners.forEach((fn) => fn({ matches: false })));
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('removes the listener on unmount', () => {
    const { unmount } = setup();
    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});

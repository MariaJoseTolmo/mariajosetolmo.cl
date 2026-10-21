import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { EndpointButton } from './EndpointButton';

function setup(props: Partial<Parameters<typeof EndpointButton>[0]> = {}) {
  const onSelect = jest.fn();
  const view = render(
    <EndpointButton
      endpoint="/api/v1/profile"
      selected={false}
      busy={false}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect, ...view };
}

describe('EndpointButton', () => {
  it('shows the method and the path, with a path-based accessible name', () => {
    setup();
    const button = screen.getByRole('button', {
      name: /GET.*\/api\/v1\/profile/,
    });
    expect(button).toHaveAttribute('type', 'button');
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('selected=%s exposes aria-pressed="%s"', (selected, pressed) => {
    setup({ selected });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', pressed);
  });

  it('reports the endpoint on click', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('/api/v1/profile');
  });

  it('stays focusable but ignores clicks while busy (aria-disabled)', async () => {
    const { onSelect } = setup({ busy: true });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = setup({ selected: true });
    expect(await axe(container)).toHaveNoViolations();
  });
});

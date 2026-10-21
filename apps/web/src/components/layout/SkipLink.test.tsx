import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@/test/axe';
import { SkipLink } from './SkipLink';

describe('SkipLink', () => {
  it('points to the main content anchor', () => {
    render(<SkipLink />);
    expect(
      screen.getByRole('link', { name: 'Saltar al contenido' }),
    ).toHaveAttribute('href', '#contenido');
  });

  it('receives the first focus on Tab, before any other control', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SkipLink />
        <a href="/otra">Otra</a>
        <button type="button">Boton</button>
      </>,
    );
    await user.tab();
    expect(
      screen.getByRole('link', { name: 'Saltar al contenido' }),
    ).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Otra' })).toHaveFocus();
  });

  it('has no axe violations', async () => {
    const { container } = render(<SkipLink />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

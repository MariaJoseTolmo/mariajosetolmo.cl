import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionBar } from './SessionBar';

describe('SessionBar', () => {
  it('shows who is signed in and with which role', () => {
    render(
      <SessionBar
        email="ana@empresa.com"
        role="RECRUITER"
        onLogout={jest.fn()}
      />,
    );
    expect(
      screen.getByText('ana@empresa.com · rol RECRUITER'),
    ).toBeInTheDocument();
  });

  it('shows another identity and role as given', () => {
    render(<SessionBar email="b@c.cl" role="ADMIN" onLogout={jest.fn()} />);
    expect(screen.getByText('b@c.cl · rol ADMIN')).toBeInTheDocument();
  });

  it('calls onLogout from "Cerrar sesión"', async () => {
    const onLogout = jest.fn();
    render(<SessionBar email="a@b.cl" role="RECRUITER" onLogout={onLogout} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

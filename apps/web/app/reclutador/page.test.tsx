import { act, render, screen } from '@testing-library/react';
import { axe } from '@/test/axe';
import RecruiterPage, { metadata } from './page';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const ORIGINAL_MODE = process.env.NEXT_PUBLIC_API_MODE;
afterEach(() => {
  process.env.NEXT_PUBLIC_API_MODE = ORIGINAL_MODE;
  window.sessionStorage.clear();
  replace.mockClear();
});

describe('recruiter page', () => {
  it('is excluded from search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('sends visitors without a session to the login (mock gateway)', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    render(<RecruiterPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Verificando sesión');
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(replace).toHaveBeenCalledWith('/acceso/');
  });

  it('shows the zone for a visitor with a session and passes axe', async () => {
    process.env.NEXT_PUBLIC_API_MODE = 'mock';
    window.sessionStorage.setItem('web-cv-mock-session', '1');
    const { container } = render(<RecruiterPage />);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /Gracias por tu interés/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(replace).not.toHaveBeenCalled();
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(await axe(container)).toHaveNoViolations();
  });
});

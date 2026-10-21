import { act, renderHook, waitFor } from '@testing-library/react';
import type { ApiGateway } from '@/lib/api/port';
import type { ApiResult, Me } from '@/lib/api/types';
import { useRecruiterSession } from './useRecruiterSession';

const ME: Me = {
  email: 'ana@empresa.com',
  role: 'RECRUITER',
  company: 'Acme',
  name: 'Ana',
  availability: { modality: 'm', start: 's', salary: 'r' },
};

const unused = () => Promise.reject(new Error('not used'));

function loaderFor(getMe: ApiGateway['getMe']) {
  const gateway: ApiGateway = {
    requestMagicLink: unused,
    verifyToken: unused,
    getMe,
    getCvLink: unused,
    logout: unused,
    call: unused,
  };
  return jest.fn(() => Promise.resolve(gateway));
}

const answer = (result: ApiResult<Me>) =>
  jest.fn(() => Promise.resolve(result));

describe('useRecruiterSession', () => {
  it('starts checking and calls getMe once on mount', async () => {
    const getMe = answer({ ok: true, data: ME });
    const loader = loaderFor(getMe);
    const { result } = renderHook(() => useRecruiterSession(loader));
    expect(result.current.state).toEqual({ status: 'checking' });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'authorized', me: ME }),
    );
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('redirects when the session is not valid', async () => {
    const loader = loaderFor(answer({ ok: false, error: 'unauthorized' }));
    const { result } = renderHook(() => useRecruiterSession(loader));
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'redirecting' }),
    );
  });

  it.each(['network', 'server', 'unexpected'] as const)(
    'reports a %s problem as an error, never as a redirect',
    async (kind) => {
      const loader = loaderFor(answer({ ok: false, error: kind }));
      const { result } = renderHook(() => useRecruiterSession(loader));
      await waitFor(() =>
        expect(result.current.state).toEqual({ status: 'error', kind }),
      );
    },
  );

  it('treats a gateway that cannot load as a network error', async () => {
    const loader = () => Promise.reject<ApiGateway>(new Error('chunk failed'));
    const { result } = renderHook(() => useRecruiterSession(loader));
    await waitFor(() =>
      expect(result.current.state).toEqual({
        status: 'error',
        kind: 'network',
      }),
    );
  });

  it('retry goes back to checking and asks again', async () => {
    const getMe = jest
      .fn<ReturnType<ApiGateway['getMe']>, []>()
      .mockResolvedValueOnce({ ok: false, error: 'network' })
      .mockResolvedValueOnce({ ok: true, data: ME });
    const loader = loaderFor(getMe);
    const { result } = renderHook(() => useRecruiterSession(loader));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: 'checking' });
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'authorized', me: ME }),
    );
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it('ignores an answer that arrives after unmount', async () => {
    let resolve: (value: ApiResult<Me>) => void = () => undefined;
    const getMe = jest.fn(
      () =>
        new Promise<ApiResult<Me>>((r) => {
          resolve = r;
        }),
    );
    const loader = loaderFor(getMe);
    const { result, unmount } = renderHook(() => useRecruiterSession(loader));
    await waitFor(() => expect(getMe).toHaveBeenCalled());
    unmount();
    await act(() => {
      resolve({ ok: true, data: ME });
      return Promise.resolve();
    });
    expect(result.current.state).toEqual({ status: 'checking' });
  });
});

import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import { useMagicLinkToken } from './useMagicLinkToken';

const VERIFY_PATH = '/acceso/verificar/';

function visit(url: string) {
  window.history.replaceState(null, '', url);
}

afterEach(() => visit('/'));

describe('useMagicLinkToken', () => {
  it('is pending during the first (server) render, before any effect runs', () => {
    visit(`${VERIFY_PATH}#token=abc`);
    const seen: string[] = [];
    function Probe() {
      seen.push(useMagicLinkToken().status);
      return null;
    }
    renderToString(<Probe />);
    expect(seen).toEqual(['pending']);
  });

  it('captures the token from the fragment and clears the fragment', () => {
    visit(`${VERIFY_PATH}#token=abc`);
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'found', token: 'abc' });
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe(VERIFY_PATH);
  });

  it('captures a different token verbatim', () => {
    visit(`${VERIFY_PATH}#token=Zx-9_k.Q`);
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'found', token: 'Zx-9_k.Q' });
  });

  it('removes the fragment with history.replaceState, without reloading', () => {
    visit(`${VERIFY_PATH}#token=abc`);
    const spy = jest.spyOn(window.history, 'replaceState');
    renderHook(() => useMagicLinkToken());
    expect(spy).toHaveBeenCalledWith(null, '', VERIFY_PATH);
    spy.mockRestore();
  });

  it('keeps the token when React StrictMode runs the effect twice', () => {
    visit(`${VERIFY_PATH}#token=abc`);
    const { result } = renderHook(() => useMagicLinkToken(), {
      wrapper: StrictMode,
    });
    expect(result.current).toEqual({ status: 'found', token: 'abc' });
  });

  it('reports a missing token when there is no fragment', () => {
    visit(VERIFY_PATH);
    const spy = jest.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'missing' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('ignores ?token= in the query string', () => {
    visit(`${VERIFY_PATH}?token=abc`);
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'missing' });
  });

  it('ignores the query even when the fragment has a token too', () => {
    visit(`${VERIFY_PATH}?token=query#token=fragment`);
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'found', token: 'fragment' });
  });

  it('treats an empty token as missing and still clears the fragment', () => {
    visit(`${VERIFY_PATH}#token=`);
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'missing' });
    expect(window.location.hash).toBe('');
  });

  it('treats an unrelated fragment as missing and clears it', () => {
    visit(`${VERIFY_PATH}#otro=1`);
    const { result } = renderHook(() => useMagicLinkToken());
    expect(result.current).toEqual({ status: 'missing' });
    expect(window.location.hash).toBe('');
  });

  describe('when the fragment changes while the page is open', () => {
    function changeHash(hash: string) {
      window.history.replaceState(null, '', `${VERIFY_PATH}${hash}`);
      act(() => {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
    }

    it('replaces a token that was already captured and clears the fragment', () => {
      visit(`${VERIFY_PATH}#token=first`);
      const { result } = renderHook(() => useMagicLinkToken());
      changeHash('#token=second');
      expect(result.current).toEqual({ status: 'found', token: 'second' });
      expect(window.location.hash).toBe('');
    });

    it('replaces a missing token with the new one', () => {
      visit(VERIFY_PATH);
      const { result } = renderHook(() => useMagicLinkToken());
      expect(result.current).toEqual({ status: 'missing' });
      changeHash('#token=late');
      expect(result.current).toEqual({ status: 'found', token: 'late' });
    });

    it('ignores a hash change that carries no token', () => {
      visit(`${VERIFY_PATH}#token=first`);
      const { result } = renderHook(() => useMagicLinkToken());
      changeHash('#otro=1');
      expect(result.current).toEqual({ status: 'found', token: 'first' });
      expect(window.location.hash).toBe('#otro=1');
    });

    it('stops listening on unmount', () => {
      visit(`${VERIFY_PATH}#token=first`);
      const { result, unmount } = renderHook(() => useMagicLinkToken());
      unmount();
      changeHash('#token=second');
      expect(result.current).toEqual({ status: 'found', token: 'first' });
      expect(window.location.hash).toBe('#token=second');
    });
  });
});

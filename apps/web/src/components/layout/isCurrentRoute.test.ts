import { isCurrentRoute } from './isCurrentRoute';

describe('isCurrentRoute', () => {
  it('matches a route href against the current path', () => {
    expect(isCurrentRoute('/experiencia/', '/experiencia/')).toBe(true);
    expect(isCurrentRoute('/acceso/', '/experiencia/')).toBe(false);
  });

  it('ignores a missing trailing slash on either side', () => {
    expect(isCurrentRoute('/experiencia/', '/experiencia')).toBe(true);
    expect(isCurrentRoute('/experiencia', '/experiencia/')).toBe(true);
  });

  it('never marks in-page anchors as the current page', () => {
    expect(isCurrentRoute('/#stack', '/')).toBe(false);
    expect(isCurrentRoute('/#stack', '/#stack')).toBe(false);
  });

  it('marks nothing when there is no current path', () => {
    expect(isCurrentRoute('/experiencia/', undefined)).toBe(false);
  });
});

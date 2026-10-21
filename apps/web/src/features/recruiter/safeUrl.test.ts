import { isNavigableUrl } from './safeUrl';

describe('isNavigableUrl', () => {
  it.each(['https://cdn.example.com/cv.pdf?sig=abc'])('accepts %s', (url) => {
    expect(isNavigableUrl(url)).toBe(true);
  });

  it.each([
    'http://cdn.example.com/cv.pdf',
    'HTTP://localhost/cv',
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
    'not a url',
    '',
  ])('rejects %p', (url) => {
    expect(isNavigableUrl(url)).toBe(false);
  });
});

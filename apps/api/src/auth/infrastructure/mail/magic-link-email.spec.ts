import { renderMagicLinkEmail } from './magic-link-email';

const LINK = `https://app.example.test/acceso/verificar/#token=${'T'.repeat(43)}`;

describe('renderMagicLinkEmail', () => {
  it('has a subject and says how long the link lasts', () => {
    const email = renderMagicLinkEmail(LINK);
    expect(email.subject).toBe('Tu enlace de acceso');
    expect(email.text).toContain('15 minutos');
    expect(email.html).toContain('15 minutos');
  });

  it('carries the link in both bodies, with the token in the fragment', () => {
    const email = renderMagicLinkEmail(LINK);
    expect(email.text).toContain(LINK);
    expect(email.html).toContain(`href="${LINK}"`);
    for (const body of [email.text, email.html]) {
      expect(body).toContain('/acceso/verificar/#token=');
      expect(body).not.toContain('?token=');
    }
  });

  it('escapes the link inside the HTML attribute and text', () => {
    const tricky = 'https://app.example.test/x/#token=a&b"c<d>';
    const email = renderMagicLinkEmail(tricky);
    expect(email.html).toContain(
      'href="https://app.example.test/x/#token=a&amp;b&quot;c&lt;d&gt;"',
    );
    expect(email.html).not.toContain('b"c<d>');
    // The plain-text body is verbatim.
    expect(email.text).toContain(tricky);
  });

  it('tells a recipient who did not ask to ignore the message', () => {
    expect(renderMagicLinkEmail(LINK).text).toContain('ignora este correo');
  });
});

import { login } from './login';

describe('login content', () => {
  it('explains four steps with distinct endpoints, in order', () => {
    expect(login.steps.items.map((s) => s.endpoint)).toEqual([
      'POST /auth/magic-link',
      'Correo vía SES',
      'Abres el enlace: página /acceso/verificar/',
      'POST /auth/verify',
    ]);
    expect(new Set(login.steps.items.map((s) => s.id)).size).toBe(4);
    for (const step of login.steps.items) {
      expect(step.detail.length).toBeGreaterThan(20);
    }
  });

  it('keeps the sent copy neutral: it never says the email exists', () => {
    expect(login.sent.before).toBe('Si ');
    expect(login.sent.after).toMatch(/^ es válido, recibirás un enlace/);
    expect(JSON.stringify(login.sent)).not.toMatch(
      /registrad|existe|no existe/i,
    );
  });

  it('states honestly that name is stored when given', () => {
    expect(login.form.privacy).toMatch(
      /^Solo guardo tu correo, empresa y nombre \(si los indicas\) para saber quién revisó mi perfil\./,
    );
    expect(login.form.privacy).toMatch(/Puedes pedir que lo elimine/);
  });

  it('does not advertise a GET verify endpoint (the token travels in a fragment)', () => {
    expect(JSON.stringify(login.steps)).not.toContain('GET /auth/verify');
  });

  it('asks for the corporate email and marks no personal data', () => {
    expect(login.form.emailLabel).toBe('Correo corporativo');
    expect(login.form.title).toBe('Acceso para reclutadores');
  });

  it('keeps the login error copy free of the email, raw messages and CloudFront', () => {
    expect(login.form.retryLabel).toBe('Reintentar');
    const copy = [login.form.invalidInputError, login.form.serverError];
    for (const text of copy) {
      expect(text).not.toMatch(/CloudFront|registrad|existe/i);
    }
    expect(new Set([...copy, login.form.networkError]).size).toBe(3);
  });
});

import type { Me, PlaygroundEndpoint } from '../types';

/**
 * Unique string that must never reach `out/` in an http build. It is part of
 * the profile returned by `getMe`, so the minifier cannot drop it.
 */
export const MOCK_MARKER = '__WEB_CV_MOCK__';

export const SESSION_KEY = 'web-cv-mock-session';

/** Every value is an obvious placeholder: no real personal data lives here. */
export const MOCK_ME: Me = {
  email: 'reclutadora@example.com',
  role: 'RECRUITER',
  company: '[EMPRESA]',
  name: `[NOMBRE] ${MOCK_MARKER}`,
  availability: {
    modality: '[MODALIDAD]',
    start: '[INICIO]',
    salary: '[RENTA]',
  },
};

export const MOCK_CV_LINK = {
  url: 'https://example.invalid/[cv-de-ejemplo]',
  expiresAt: '2000-01-01T00:00:00.000Z',
};

export const MOCK_BODIES: Record<
  Exclude<PlaygroundEndpoint, '/api/v1/admin/visits'>,
  unknown
> = {
  '/api/v1/profile': { name: '[NOMBRE]', title: '[CARGO]' },
  '/api/v1/experience?limit=2': [
    { company: '[EMPRESA 1]', role: '[ROL]' },
    { company: '[EMPRESA 2]', role: '[ROL]' },
  ],
  '/api/v1/skills?level=advanced': [{ name: '[HABILIDAD]', level: 'advanced' }],
  '/api/v1/me': MOCK_ME,
};

export const MOCK_FORBIDDEN_BODY = { statusCode: 403, message: 'Forbidden' };

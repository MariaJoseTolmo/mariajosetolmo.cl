export type Role = 'RECRUITER' | 'ADMIN';

export interface MagicLinkRequest {
  email: string;
  company?: string;
  name?: string;
}

/** Always delivered by the API; never embedded in the repository. */
export interface Availability {
  modality: string;
  start: string;
  salary: string;
}

export interface Me {
  email: string;
  role: Role;
  company: string | null;
  name: string | null;
  availability: Availability;
}

export interface CvLink {
  url: string;
  expiresAt: string;
}

/** The five GET endpoints the recruiter playground may call (design §8). */
export type PlaygroundEndpoint =
  | '/api/v1/profile'
  | '/api/v1/experience?limit=2'
  | '/api/v1/skills?level=advanced'
  | '/api/v1/me'
  | '/api/v1/admin/visits';

export interface RawResponse {
  status: number;
  statusText: string;
  body: unknown;
}

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid-token'
  | 'rate-limited'
  | 'network'
  | 'server'
  | 'unexpected';

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: ApiErrorKind; status?: number };

import type { ApiErrorReason } from './error-codes';

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
  /** Set only for status >= 400 and != 401; the playground shows its copy. */
  failure?: ApiFailure;
}

export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid-token'
  | 'invalid-input'
  | 'rate-limited'
  | 'network'
  | 'server'
  | 'unexpected';

export interface ApiFailure {
  error: ApiErrorKind;
  /** Absent when there was no HTTP response (network failure). */
  status?: number;
  /** Derived only from a `code` that belongs to the catalog. */
  reason?: ApiErrorReason;
  retryAfterSeconds?: number;
}

export type ApiResult<T> = { ok: true; data: T } | ({ ok: false } & ApiFailure);

import type {
  ApiResult,
  CvLink,
  MagicLinkRequest,
  Me,
  PlaygroundEndpoint,
  RawResponse,
} from './types';

/**
 * The only way components reach the API. Session refresh is deliberately not
 * part of the port: the `http` adapter owns it, so no container can forget or
 * duplicate it.
 */
export interface ApiGateway {
  requestMagicLink(req: MagicLinkRequest): Promise<ApiResult<void>>;
  verifyToken(token: string): Promise<ApiResult<void>>;
  /** GET /api/v1/me. */
  getMe(): Promise<ApiResult<Me>>;
  getCvLink(): Promise<ApiResult<CvLink>>;
  logout(): Promise<ApiResult<void>>;
  /** Playground queries: any HTTP response (4xx included) is `ok: true`. */
  call(endpoint: PlaygroundEndpoint): Promise<ApiResult<RawResponse>>;
}

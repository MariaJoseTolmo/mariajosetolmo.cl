import type { NextFunction, Request, Response } from 'express';

// Paths whose responses carry session state and must never be cached.
const UNCACHEABLE_PREFIXES = ['/api/auth', '/api/v1'];

/** Exact prefix or prefix followed by a slash, so `/api/v10` does not match. */
export function isUncacheablePath(path: string): boolean {
  return UNCACHEABLE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function noStore(req: Request, res: Response, next: NextFunction): void {
  if (isUncacheablePath(req.path)) res.setHeader('Cache-Control', 'no-store');
  next();
}

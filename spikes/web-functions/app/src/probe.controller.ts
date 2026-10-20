import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

// Module-level state: no constructor injection (esbuild omits decorator metadata).
const bootedAt = Date.now();
const bootId = randomUUID();
const coldBootMs = Math.round(process.uptime() * 1000);

// Minimal shapes instead of @types/express (throwaway spike).
type Request = { headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader(n: string, v: string[]): void; json(b: unknown): void };

const header = (req: Request, name: string): string => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value.join(', ') : value) ?? '';
};

@Controller()
export class ProbeController {
  @Get('health')
  health() {
    return { bootId, coldBootMs, uptimeMs: Date.now() - bootedAt };
  }

  @Post('echo')
  echo(@Req() req: Request) {
    return { body: req.body ?? null, sha256Header: header(req, 'x-amz-content-sha256') };
  }

  @Get('cookies/set')
  setCookies(@Res() res: Response) {
    const attrs = 'HttpOnly; Secure; SameSite=Strict; Path=/api';
    res.setHeader('Set-Cookie', ['probe_a=1', 'probe_b=2', 'probe_c=3'].map((c) => `${c}; ${attrs}`));
    res.json({ set: 3 });
  }

  @Get('cookies/echo')
  echoCookies(@Req() req: Request) {
    const cookieNames = header(req, 'cookie')
      .split(';')
      .map((c) => c.split('=')[0].trim())
      .filter(Boolean);
    return { cookieNames };
  }

  @Get('headers')
  headers(@Req() req: Request) {
    return {
      'cloudfront-viewer-address': header(req, 'cloudfront-viewer-address'),
      'x-forwarded-for': header(req, 'x-forwarded-for'),
      'x-real-ip': header(req, 'x-real-ip'), // expected empty: Lambda strips it
      origin: header(req, 'origin'),
      host: header(req, 'host'),
    };
  }
}

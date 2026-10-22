import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Env } from './app-config';
import type { Secrets, SecretsProvider } from './secrets.port';

type ReadFile = (path: string) => string;

// src/config and dist/config are both four levels below the repository root.
const REPO_ROOT = resolve(__dirname, '../../../..');

const readUtf8: ReadFile = (path) => readFileSync(path, 'utf8');

/** Local and test secrets: environment variables plus a key file on disk. */
export class EnvSecretsProvider implements SecretsProvider {
  constructor(
    private readonly env: Env,
    private readonly readFile: ReadFile = readUtf8,
    private readonly baseDir: string = REPO_ROOT,
  ) {}

  load(): Promise<Secrets> {
    // A throw inside the executor becomes a rejection.
    return new Promise((resolve) => resolve(this.read()));
  }

  private read(): Secrets {
    const previousFile = this.optional('JWT_PREVIOUS_PUBLIC_KEY_FILE');
    return {
      jwtPrivateKeyPem: this.readKeyFile(
        this.required('JWT_PRIVATE_KEY_FILE'),
        'JWT_PRIVATE_KEY_FILE',
      ),
      jwtKeyId: this.required('JWT_KEY_ID'),
      jwtPreviousPublicKeyPem:
        previousFile === null
          ? null
          : this.readKeyFile(previousFile, 'JWT_PREVIOUS_PUBLIC_KEY_FILE'),
      jwtPreviousKeyId:
        previousFile === null ? null : this.required('JWT_PREVIOUS_KEY_ID'),
      adminEmail: this.required('ADMIN_EMAIL'),
      databaseUrl: this.required('DATABASE_URL'),
      redisUrl: this.required('REDIS_URL'),
    };
  }

  private readKeyFile(path: string, variable: string): string {
    try {
      return this.readFile(resolve(this.baseDir, path));
    } catch {
      // Never echo the path contents or the underlying error text.
      throw new Error(`Cannot read ${variable}`);
    }
  }

  private required(key: string): string {
    const value = this.optional(key);
    if (value === null) throw new Error(`Missing secret: ${key}`);
    return value;
  }

  private optional(key: string): string | null {
    return this.env[key]?.trim() || null;
  }
}

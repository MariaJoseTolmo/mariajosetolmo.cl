import {
  GetParametersCommand,
  type GetParametersCommandOutput,
} from '@aws-sdk/client-ssm';
import type { Secrets, SecretsProvider } from './secrets.port';

export type SsmSend = (
  command: GetParametersCommand,
) => Promise<GetParametersCommandOutput>;

const REQUIRED = ['jwt-private-key', 'jwt-key-id', 'admin-email'] as const;
const OPTIONAL = [
  'jwt-previous-public-key',
  'jwt-previous-key-id',
  'database-url',
  'redis-url',
] as const;

/** Production secrets: one decrypting GetParameters call per environment. */
export class SsmSecretsProvider implements SecretsProvider {
  private cached: Promise<Secrets> | null = null;

  constructor(
    private readonly prefix: string,
    private readonly send: SsmSend,
  ) {}

  load(): Promise<Secrets> {
    this.cached ??= this.fetch();
    return this.cached;
  }

  private async fetch(): Promise<Secrets> {
    const names = [...REQUIRED, ...OPTIONAL].map((name) => this.path(name));
    const output = await this.send(
      new GetParametersCommand({ Names: names, WithDecryption: true }),
    );
    const values = new Map(
      (output.Parameters ?? []).map((p) => [p.Name, p.Value]),
    );
    const read = (name: string): string | null =>
      values.get(this.path(name)) || null;
    const need = (name: string): string => {
      const value = read(name);
      // Name only: never echo values in errors.
      if (value === null) throw new Error(`Missing secret: ${this.path(name)}`);
      return value;
    };
    return {
      jwtPrivateKeyPem: need('jwt-private-key'),
      jwtKeyId: need('jwt-key-id'),
      jwtPreviousPublicKeyPem: read('jwt-previous-public-key'),
      jwtPreviousKeyId: read('jwt-previous-key-id'),
      adminEmail: need('admin-email'),
      databaseUrl: read('database-url'),
      redisUrl: read('redis-url'),
    };
  }

  private path(name: string): string {
    return `${this.prefix}/${name}`;
  }
}

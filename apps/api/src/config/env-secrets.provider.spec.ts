import { resolve } from 'node:path';
import { EnvSecretsProvider } from './env-secrets.provider';

const FAKE_PEM = 'fake-private-key-contents';
const FAKE_PUBLIC_PEM = 'fake-public-key-contents';

const files: Record<string, string> = {
  '/keys/private.pem': FAKE_PEM,
  '/keys/previous-public.pem': FAKE_PUBLIC_PEM,
};
const readFile = (path: string): string => {
  const content = files[path];
  if (content === undefined) throw new Error(`ENOENT: ${path}`);
  return content;
};

const BASE_ENV = {
  JWT_PRIVATE_KEY_FILE: '/keys/private.pem',
  JWT_KEY_ID: 'kid-1',
  ADMIN_EMAIL: 'admin@example.test',
  DATABASE_URL: 'postgres://user:pw@127.0.0.1:5432/db',
  REDIS_URL: 'redis://127.0.0.1:6379',
};

describe('EnvSecretsProvider', () => {
  it('reads the private key from the file and the rest from env', async () => {
    const secrets = await new EnvSecretsProvider(BASE_ENV, readFile).load();
    expect(secrets).toEqual({
      jwtPrivateKeyPem: FAKE_PEM,
      jwtKeyId: 'kid-1',
      jwtPreviousPublicKeyPem: null,
      jwtPreviousKeyId: null,
      adminEmail: 'admin@example.test',
      databaseUrl: 'postgres://user:pw@127.0.0.1:5432/db',
      redisUrl: 'redis://127.0.0.1:6379',
    });
  });

  it('loads the previous public key when provided', async () => {
    const secrets = await new EnvSecretsProvider(
      {
        ...BASE_ENV,
        JWT_PREVIOUS_PUBLIC_KEY_FILE: '/keys/previous-public.pem',
        JWT_PREVIOUS_KEY_ID: 'kid-0',
      },
      readFile,
    ).load();
    expect(secrets.jwtPreviousPublicKeyPem).toBe(FAKE_PUBLIC_PEM);
    expect(secrets.jwtPreviousKeyId).toBe('kid-0');
  });

  it.each([
    'JWT_PRIVATE_KEY_FILE',
    'JWT_KEY_ID',
    'ADMIN_EMAIL',
    'DATABASE_URL',
    'REDIS_URL',
  ])('rejects when %s is missing, naming the variable only', async (key) => {
    const env: Record<string, string | undefined> = { ...BASE_ENV };
    delete env[key];
    await expect(new EnvSecretsProvider(env, readFile).load()).rejects.toThrow(
      new RegExp(`^Missing secret: ${key}$`),
    );
  });

  it('does not leak file contents when the key file cannot be read', async () => {
    await expect(
      new EnvSecretsProvider(
        { ...BASE_ENV, JWT_PRIVATE_KEY_FILE: '/keys/absent.pem' },
        readFile,
      ).load(),
    ).rejects.toThrow('Cannot read JWT_PRIVATE_KEY_FILE');
  });

  it('requires the previous key id together with the previous public key', async () => {
    await expect(
      new EnvSecretsProvider(
        {
          ...BASE_ENV,
          JWT_PREVIOUS_PUBLIC_KEY_FILE: '/keys/previous-public.pem',
        },
        readFile,
      ).load(),
    ).rejects.toThrow('Missing secret: JWT_PREVIOUS_KEY_ID');
  });

  describe('key file paths', () => {
    const seen: string[] = [];
    const recording = (path: string): string => {
      seen.push(path);
      return FAKE_PEM;
    };

    beforeEach(() => {
      seen.length = 0;
    });

    it('resolves a relative path against the base directory', async () => {
      await new EnvSecretsProvider(
        { ...BASE_ENV, JWT_PRIVATE_KEY_FILE: 'apps/api/.keys/jwt-private.pem' },
        recording,
        '/repo/root',
      ).load();
      expect(seen).toEqual(['/repo/root/apps/api/.keys/jwt-private.pem']);
    });

    it('keeps an absolute path untouched', async () => {
      await new EnvSecretsProvider(
        { ...BASE_ENV, JWT_PRIVATE_KEY_FILE: '/abs/key.pem' },
        recording,
        '/repo/root',
      ).load();
      expect(seen).toEqual(['/abs/key.pem']);
    });

    it('defaults the base directory to the repository root', async () => {
      await new EnvSecretsProvider(
        { ...BASE_ENV, JWT_PRIVATE_KEY_FILE: 'package.json' },
        recording,
      ).load();
      expect(seen[0]).toMatch(/\/package\.json$/);
      expect(seen[0]).not.toContain('apps/api/package.json');
      expect(seen[0]).toBe(resolve(__dirname, '../../../../package.json'));
    });
  });
});

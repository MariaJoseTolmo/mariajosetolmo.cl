import type {
  GetParametersCommand,
  GetParametersCommandOutput,
} from '@aws-sdk/client-ssm';
import { SsmSecretsProvider } from './ssm-secrets.provider';

const PREFIX = '/example/test';

function fakeSsm(values: Record<string, string>): {
  send: (command: GetParametersCommand) => Promise<GetParametersCommandOutput>;
  calls: GetParametersCommand[];
} {
  const calls: GetParametersCommand[] = [];
  return {
    calls,
    send: (command) => {
      calls.push(command);
      const names = command.input.Names ?? [];
      return Promise.resolve({
        $metadata: {},
        Parameters: names
          .filter((name) => name in values)
          .map((name) => ({ Name: name, Value: values[name] })),
        InvalidParameters: names.filter((name) => !(name in values)),
      });
    },
  };
}

const REQUIRED = {
  [`${PREFIX}/jwt-private-key`]: 'PRIVATE-PEM',
  [`${PREFIX}/jwt-key-id`]: 'kid-1',
  [`${PREFIX}/admin-email`]: 'admin@example.test',
  [`${PREFIX}/database-url`]: 'postgres://example.test/db?sslmode=require',
  [`${PREFIX}/redis-url`]: 'rediss://example.test:6379',
};

describe('SsmSecretsProvider', () => {
  it('reads every secret with a single decrypting GetParameters call', async () => {
    const ssm = fakeSsm({
      ...REQUIRED,
      [`${PREFIX}/jwt-previous-public-key`]: 'PREVIOUS-PEM',
      [`${PREFIX}/jwt-previous-key-id`]: 'kid-0',
    });
    const secrets = await new SsmSecretsProvider(PREFIX, ssm.send).load();
    expect(ssm.calls).toHaveLength(1);
    expect(ssm.calls[0]?.input.WithDecryption).toBe(true);
    expect(ssm.calls[0]?.input.Names).toHaveLength(7);
    expect(secrets).toEqual({
      jwtPrivateKeyPem: 'PRIVATE-PEM',
      jwtKeyId: 'kid-1',
      jwtPreviousPublicKeyPem: 'PREVIOUS-PEM',
      jwtPreviousKeyId: 'kid-0',
      adminEmail: 'admin@example.test',
      databaseUrl: 'postgres://example.test/db?sslmode=require',
      redisUrl: 'rediss://example.test:6379',
    });
  });

  it('treats only the rotation key as optional', async () => {
    const secrets = await new SsmSecretsProvider(
      PREFIX,
      fakeSsm(REQUIRED).send,
    ).load();
    expect(secrets.jwtPreviousPublicKeyPem).toBeNull();
    expect(secrets.jwtPreviousKeyId).toBeNull();
    expect(secrets.databaseUrl).toBe(
      'postgres://example.test/db?sslmode=require',
    );
  });

  it.each(['admin-email', 'database-url', 'redis-url'])(
    'fails naming the missing required parameter %s, without values',
    async (missing) => {
      const partial = Object.fromEntries(
        Object.entries(REQUIRED).filter(
          ([name]) => !name.endsWith(`/${missing}`),
        ),
      );
      await expect(
        new SsmSecretsProvider(PREFIX, fakeSsm(partial).send).load(),
      ).rejects.toThrow(`Missing secret: ${PREFIX}/${missing}`);
    },
  );

  it('memoizes the result so SSM is read once per environment', async () => {
    const ssm = fakeSsm(REQUIRED);
    const provider = new SsmSecretsProvider(PREFIX, ssm.send);
    const first = await provider.load();
    const second = await provider.load();
    expect(second).toBe(first);
    expect(ssm.calls).toHaveLength(1);
  });

  describe('transport security of the stores (a deployed environment)', () => {
    const load = (overrides: Record<string, string>): Promise<unknown> =>
      new SsmSecretsProvider(
        PREFIX,
        fakeSsm({ ...REQUIRED, ...overrides }).send,
      ).load();

    it.each(['require', 'verify-full'])(
      'accepts a database URL with sslmode=%s',
      async (mode) => {
        await expect(
          load({
            [`${PREFIX}/database-url`]: `postgres://u:pw@example.test/db?sslmode=${mode}`,
          }),
        ).resolves.toBeDefined();
      },
    );

    it.each([
      ['no sslmode', 'postgres://u:secretpw@example.test/db'],
      [
        'sslmode=disable',
        'postgres://u:secretpw@example.test/db?sslmode=disable',
      ],
      [
        'sslmode=prefer',
        'postgres://u:secretpw@example.test/db?sslmode=prefer',
      ],
      [
        'sslmode=allow',
        'postgresql://u:secretpw@example.test/db?sslmode=allow',
      ],
      ['not a URL', 'secretpw-not-a-url'],
    ])(
      'rejects a database URL with %s, naming the parameter only',
      async (_l, url) => {
        const failure = await load({ [`${PREFIX}/database-url`]: url }).catch(
          (e: unknown) => e,
        );
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain(`${PREFIX}/database-url`);
        expect((failure as Error).message).not.toContain('secretpw');
      },
    );

    it('accepts rediss:// and rejects plain redis://', async () => {
      await expect(
        load({ [`${PREFIX}/redis-url`]: 'rediss://:pw@example.test:6379' }),
      ).resolves.toBeDefined();
      const failure = await load({
        [`${PREFIX}/redis-url`]: 'redis://:secretpw@example.test:6379',
      }).catch((e: unknown) => e);
      expect((failure as Error).message).toContain(`${PREFIX}/redis-url`);
      expect((failure as Error).message).not.toContain('secretpw');
    });
  });
});

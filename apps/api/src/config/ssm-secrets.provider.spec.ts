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
};

describe('SsmSecretsProvider', () => {
  it('reads every secret with a single decrypting GetParameters call', async () => {
    const ssm = fakeSsm({
      ...REQUIRED,
      [`${PREFIX}/jwt-previous-public-key`]: 'PREVIOUS-PEM',
      [`${PREFIX}/jwt-previous-key-id`]: 'kid-0',
      [`${PREFIX}/database-url`]: 'postgres://example.test/db',
      [`${PREFIX}/redis-url`]: 'rediss://example.test:6379',
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
      databaseUrl: 'postgres://example.test/db',
      redisUrl: 'rediss://example.test:6379',
    });
  });

  it('treats the rotation key and the urls as optional', async () => {
    const secrets = await new SsmSecretsProvider(
      PREFIX,
      fakeSsm(REQUIRED).send,
    ).load();
    expect(secrets.jwtPreviousPublicKeyPem).toBeNull();
    expect(secrets.jwtPreviousKeyId).toBeNull();
    expect(secrets.databaseUrl).toBeNull();
    expect(secrets.redisUrl).toBeNull();
  });

  it('fails naming the missing required parameter, without values', async () => {
    const partial = Object.fromEntries(
      Object.entries(REQUIRED).filter(
        ([name]) => !name.endsWith('/admin-email'),
      ),
    );
    await expect(
      new SsmSecretsProvider(PREFIX, fakeSsm(partial).send).load(),
    ).rejects.toThrow(`Missing secret: ${PREFIX}/admin-email`);
  });

  it('memoizes the result so SSM is read once per environment', async () => {
    const ssm = fakeSsm(REQUIRED);
    const provider = new SsmSecretsProvider(PREFIX, ssm.send);
    const first = await provider.load();
    const second = await provider.load();
    expect(second).toBe(first);
    expect(ssm.calls).toHaveLength(1);
  });
});

import { createHmac, generateKeyPairSync } from 'node:crypto';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { testKeyPair } from '../../../../test/support/keys';
import { JoseAccessTokenService } from './jose-access-token.service';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const IAT = NOW.getTime() / 1000;
const secondsAfter = (seconds: number): Date =>
  new Date(NOW.getTime() + seconds * 1000);

const ISSUER = 'https://issuer.example.test';
const AUDIENCE = 'web_cv-api';
const USER_ID = '7f1f0c1e-aaaa-4bbb-8ccc-dddddddddddd';

function service(
  overrides: Partial<
    ConstructorParameters<typeof JoseAccessTokenService>[0]
  > = {},
): JoseAccessTokenService {
  return new JoseAccessTokenService({
    privateKeyPem: testKeyPair().privatePem,
    keyId: 'kid-1',
    previousPublicKeyPem: null,
    previousKeyId: null,
    issuer: ISSUER,
    audience: AUDIENCE,
    ...overrides,
  });
}

const b64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

function forged(header: object, payload: object, signature = ''): string {
  return `${b64url(header)}.${b64url(payload)}.${signature}`;
}

const validClaims = {
  sub: USER_ID,
  role: 'RECRUITER',
  iss: ISSUER,
  aud: AUDIENCE,
  iat: IAT,
  exp: IAT + 900,
};

describe('JoseAccessTokenService', () => {
  describe('issue', () => {
    it('signs RS256 with the key id and a 900 s lifetime', async () => {
      const jwt = await service().issue(
        { sub: USER_ID, role: 'RECRUITER' },
        NOW,
      );
      expect(decodeProtectedHeader(jwt)).toEqual({
        alg: 'RS256',
        kid: 'kid-1',
      });
      const claims = decodeJwt(jwt);
      expect(claims).toEqual({
        sub: USER_ID,
        role: 'RECRUITER',
        iss: ISSUER,
        aud: AUDIENCE,
        iat: IAT,
        exp: IAT + 900,
      });
      expect(claims.exp! - claims.iat!).toBe(900);
    });

    it('carries the role and never an email', async () => {
      const jwt = await service().issue({ sub: USER_ID, role: 'ADMIN' }, NOW);
      expect(decodeJwt(jwt)['role']).toBe('ADMIN');
      expect(decodeJwt(jwt)).not.toHaveProperty('email');
    });
  });

  describe('verify', () => {
    it('returns the principal for a token it issued', async () => {
      const svc = service();
      const jwt = await svc.issue({ sub: USER_ID, role: 'ADMIN' }, NOW);
      await expect(svc.verify(jwt, secondsAfter(60))).resolves.toEqual({
        userId: USER_ID,
        role: 'ADMIN',
      });
    });

    it('rejects an expired token but allows 5 s of clock tolerance', async () => {
      const svc = service();
      const jwt = await svc.issue({ sub: USER_ID, role: 'RECRUITER' }, NOW);
      await expect(svc.verify(jwt, secondsAfter(904))).resolves.not.toBeNull();
      await expect(svc.verify(jwt, secondsAfter(906))).resolves.toBeNull();
      await expect(svc.verify(jwt, secondsAfter(3600))).resolves.toBeNull();
    });

    it('rejects alg none', async () => {
      const jwt = forged({ alg: 'none', typ: 'JWT' }, validClaims);
      await expect(service().verify(jwt, secondsAfter(1))).resolves.toBeNull();
    });

    it('rejects HS256 signed with the public key as secret (alg confusion)', async () => {
      const header = { alg: 'HS256', typ: 'JWT', kid: 'kid-1' };
      const signingInput = `${b64url(header)}.${b64url(validClaims)}`;
      const signature = createHmac('sha256', testKeyPair().publicPem)
        .update(signingInput)
        .digest('base64url');
      const jwt = `${signingInput}.${signature}`;
      await expect(service().verify(jwt, secondsAfter(1))).resolves.toBeNull();
    });

    it('rejects a tampered payload and a tampered signature', async () => {
      const svc = service();
      const jwt = await svc.issue({ sub: USER_ID, role: 'RECRUITER' }, NOW);
      const [header, , signature] = jwt.split('.');
      const elevated = b64url({ ...validClaims, role: 'ADMIN' });
      await expect(
        svc.verify(`${header}.${elevated}.${signature}`, secondsAfter(1)),
      ).resolves.toBeNull();
      const flipped = signature!.startsWith('A') ? 'B' : 'A';
      const badSignature = `${flipped}${signature!.slice(1)}`;
      const [h, p] = jwt.split('.');
      await expect(
        svc.verify(`${h}.${p}.${badSignature}`, secondsAfter(1)),
      ).resolves.toBeNull();
    });

    it('rejects a token signed by a different key with the same kid', async () => {
      const other = service({ privateKeyPem: testKeyPair('other').privatePem });
      const jwt = await other.issue({ sub: USER_ID, role: 'RECRUITER' }, NOW);
      await expect(service().verify(jwt, secondsAfter(1))).resolves.toBeNull();
    });

    it('rejects an unknown kid, wrong issuer, wrong audience and garbage', async () => {
      const jwt = await service().issue(
        { sub: USER_ID, role: 'RECRUITER' },
        NOW,
      );
      await expect(
        service({ keyId: 'kid-9' }).verify(jwt, secondsAfter(1)),
      ).resolves.toBeNull();
      await expect(
        service({ issuer: 'https://other.example.test' }).verify(
          jwt,
          secondsAfter(1),
        ),
      ).resolves.toBeNull();
      await expect(
        service({ audience: 'another-api' }).verify(jwt, secondsAfter(1)),
      ).resolves.toBeNull();
      await expect(
        service().verify('not-a-jwt', secondsAfter(1)),
      ).resolves.toBeNull();
      await expect(service().verify('', secondsAfter(1))).resolves.toBeNull();
    });
  });

  describe('jwks', () => {
    const PRIVATE_PARAMS = ['d', 'p', 'q', 'dp', 'dq', 'qi'];

    it('publishes only the public parameters of the active key', () => {
      const { keys } = service().jwks();
      expect(keys).toHaveLength(1);
      const [key] = keys;
      expect(key).toMatchObject({
        kty: 'RSA',
        kid: 'kid-1',
        alg: 'RS256',
        use: 'sig',
      });
      expect(typeof key?.n).toBe('string');
      expect(key?.e).toBe('AQAB');
      for (const param of PRIVATE_PARAMS) expect(key).not.toHaveProperty(param);
    });

    it('publishes two keys during manual rotation', () => {
      const { keys } = service({
        previousPublicKeyPem: testKeyPair('old').publicPem,
        previousKeyId: 'kid-0',
      }).jwks();
      expect(keys.map((key) => key.kid)).toEqual(['kid-1', 'kid-0']);
      expect(keys[0]?.n).not.toBe(keys[1]?.n);
      for (const key of keys) {
        for (const param of PRIVATE_PARAMS)
          expect(key).not.toHaveProperty(param);
      }
    });

    it('verifies tokens signed by the previous key after rotation', async () => {
      const oldService = service({
        privateKeyPem: testKeyPair('old').privatePem,
        keyId: 'kid-0',
      });
      const jwt = await oldService.issue(
        { sub: USER_ID, role: 'RECRUITER' },
        NOW,
      );
      const rotated = service({
        previousPublicKeyPem: testKeyPair('old').publicPem,
        previousKeyId: 'kid-0',
      });
      await expect(rotated.verify(jwt, secondsAfter(1))).resolves.toEqual({
        userId: USER_ID,
        role: 'RECRUITER',
      });
      await expect(service().verify(jwt, secondsAfter(1))).resolves.toBeNull();
    });
  });

  describe('key validation at boot', () => {
    const pems = (
      type: 'rsa' | 'ec',
      bits = 2048,
    ): { privatePem: string; publicPem: string } => {
      const encodings = {
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      } as const;
      const pair =
        type === 'rsa'
          ? generateKeyPairSync('rsa', { modulusLength: bits, ...encodings })
          : generateKeyPairSync('ec', { namedCurve: 'P-256', ...encodings });
      const { privateKey, publicKey } = pair as unknown as {
        privateKey: string;
        publicKey: string;
      };
      return { privatePem: privateKey, publicPem: publicKey };
    };

    it('rejects a non-RSA signing key', () => {
      expect(() => service({ privateKeyPem: pems('ec').privatePem })).toThrow(
        /RSA/,
      );
    });

    it('rejects an RSA signing key below 2048 bits', () => {
      expect(() =>
        service({ privateKeyPem: pems('rsa', 1024).privatePem }),
      ).toThrow(/2048/);
    });

    it('rejects a weak or non-RSA previous public key', () => {
      expect(() =>
        service({
          previousPublicKeyPem: pems('ec').publicPem,
          previousKeyId: 'kid-0',
        }),
      ).toThrow(/RSA/);
      expect(() =>
        service({
          previousPublicKeyPem: pems('rsa', 1024).publicPem,
          previousKeyId: 'kid-0',
        }),
      ).toThrow(/2048/);
    });

    it('accepts RSA 2048 and larger keys', () => {
      expect(() => service()).not.toThrow();
      expect(() =>
        service({ privateKeyPem: pems('rsa', 3072).privatePem }),
      ).not.toThrow();
    });
  });
});

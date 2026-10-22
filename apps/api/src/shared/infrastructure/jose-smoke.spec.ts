import {
  type CryptoKey,
  SignJWT,
  decodeProtectedHeader,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
} from 'jose';

// Smoke test: proves the ESM-only `jose` package works under Jest with the
// VM-modules flag, with the project's typecheck and with the CommonJS build.
describe('jose smoke', () => {
  const issuedAt = new Date('2026-01-01T00:00:00Z');
  const iat = Math.floor(issuedAt.getTime() / 1000);

  async function sign(privateKey: CryptoKey): Promise<string> {
    return new SignJWT({ role: 'RECRUITER' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid' })
      .setSubject('user-1')
      .setIssuedAt(iat)
      .setExpirationTime(iat + 900)
      .sign(privateKey);
  }

  it('signs RS256 and verifies against the public JWK at an injected date', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256', {
      extractable: true,
    });
    const jwt = await sign(privateKey);
    expect(decodeProtectedHeader(jwt)).toEqual({
      alg: 'RS256',
      kid: 'test-kid',
    });

    const publicJwk = await exportJWK(publicKey);
    expect(publicJwk.kty).toBe('RSA');
    expect(publicJwk).not.toHaveProperty('d');

    const verifyKey = await importJWK(publicJwk, 'RS256');
    const { payload } = await jwtVerify(jwt, verifyKey, {
      algorithms: ['RS256'],
      currentDate: new Date((iat + 60) * 1000),
    });
    expect(payload.sub).toBe('user-1');
    expect(payload['role']).toBe('RECRUITER');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);
  });

  it('rejects an expired token when currentDate is after exp', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwt = await sign(privateKey);
    await expect(
      jwtVerify(jwt, publicKey, {
        algorithms: ['RS256'],
        currentDate: new Date((iat + 901) * 1000),
      }),
    ).rejects.toMatchObject({ code: 'ERR_JWT_EXPIRED' });
  });
});

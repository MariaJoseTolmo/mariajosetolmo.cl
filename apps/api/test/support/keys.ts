import { generateKeyPairSync } from 'node:crypto';

export interface TestKeyPair {
  readonly privatePem: string;
  readonly publicPem: string;
}

const cache = new Map<string, TestKeyPair>();

/**
 * RSA test keys are generated in memory on first use and cached per process,
 * under a label. No PEM ever lives in the repository.
 */
export function testKeyPair(label = 'primary'): TestKeyPair {
  const cached = cache.get(label);
  if (cached) return cached;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const pair = { privatePem: privateKey, publicPem: publicKey };
  cache.set(label, pair);
  return pair;
}

// Generates a throwaway RSA key pair for local development into
// apps/api/.keys/ (gitignored). Never commit the output.
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const dir = join(__dirname, '..', '.keys');
const privatePath = join(dir, 'jwt-private.pem');

if (existsSync(privatePath) && !process.argv.includes('--force')) {
  console.error(`${privatePath} already exists; pass --force to replace it.`);
  process.exit(1);
}

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
mkdirSync(dir, { recursive: true, mode: 0o700 });
writeFileSync(privatePath, privateKey, { mode: 0o600 });

const keyId = `dev-${randomBytes(4).toString('hex')}`;
console.log(`Wrote ${privatePath}`);
console.log(`Set in your environment: JWT_PRIVATE_KEY_FILE=${privatePath}`);
console.log(`                         JWT_KEY_ID=${keyId}`);

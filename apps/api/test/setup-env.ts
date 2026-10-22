import { TEST_ENV } from './support/test-config';

// Placeholder environment for e2e suites. Nothing here is a secret: the JWT
// keys are generated in memory by test/support/keys.ts and injected through an
// overridden SECRETS_PROVIDER.
for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}

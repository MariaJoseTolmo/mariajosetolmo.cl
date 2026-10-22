# Apply progress: auth-backend

Mode: Strict TDD. Delivery: 4 stacked-to-main PRs with `size:exception` (user decision). Runner: `npm test -w apps/api` (unit), `npm run test:e2e -w apps/api`, `npm run test:cov -w apps/api`.

## Batch 1 - PR1 (U1, U2, U3): tasks 1.1-3.8 complete (19/19 of the batch)

Baseline before starting (safety net): 8 unit tests + 5 e2e tests green (`health`, `docs`, `health-report`, `check-health`).

Totals after the batch: 180 unit tests (23 suites), 30 e2e tests (5 suites), domain/application coverage 100 % (threshold 80 %).

### TDD Cycle Evidence

RED = spec written first and run (or referencing a symbol that does not exist yet, so it cannot compile: "TS2307" means module not found). GREEN = the spec file executed and passing after the minimum implementation. Counts are tests in that spec file.

| Task | Test file | RED | GREEN | TRIANGULATE | SAFETY NET | REFACTOR |
|------|-----------|-----|-------|-------------|------------|----------|
| 1.1 | `src/shared/infrastructure/jose-smoke.spec.ts` | Run: TS2307 `jose` not found; after install, TS2749 (`CryptoKey` is not a type under `lib: ES2023`) | 2/2 under Jest VM-modules; `typecheck` and `build` green; `require('jose')` works on Node 24 | 2 cases (sign+verify with `currentDate` and `exportJWK`; expired token rejected) | N/A (new) | Switched to `jose`'s exported `CryptoKey` type, no tsconfig change |
| 1.2 | `src/config/app-config.spec.ts` | Run: TS2307 `./app-config` | 16/16 | Defaults, origin list parsing, `COOKIE_SECURE` 3 values, `RATE_LIMITS` merge, 9 invalid-value rows, SSM and SMTP conditional requirements | N/A (new) | Test omissions rewritten with `undefined` overrides (lint) |
| 1.3 | `src/config/env-secrets.provider.spec.ts` | Run: TS2307 `./env-secrets.provider` (`secrets.port.ts` is types-only and was written first) | 7/7 | Required keys x3, rotation key pair, unreadable file, no content leak | N/A (new) | `load()` simplified to a promise executor (lint: reject reasons) |
| 1.4 | `src/config/ssm-secrets.provider.spec.ts` | Run: TS2307 `@aws-sdk/client-ssm` and `./ssm-secrets.provider` | 4/4 (single decrypting `GetParameters`, fake `send`, no mock library) | Optional keys absent, missing required key (name only), memoization | N/A (new) | None needed |
| 1.5 | `src/shared/domain/hash.spec.ts`, `errors.spec.ts`; `system-clock.spec.ts`, `crypto-random.spec.ts` | Run: 4 suites failed TS2307 | 13/13 (4+3+1+3 at that point) | `sha256Hex` 2 known vectors + UTF-8 vector computed with `shasum`; error codes and message hygiene; random bytes differ; UUID v4 format and uniqueness | N/A (new) | None needed |
| 1.6 | Structural: `config.module.ts`, `shared.module.ts`, `scripts/dev-keys.js`, `.gitignore`, `.env.example`, `eslint.config.mjs`, `scripts/check-boundaries.mjs` | Boundary self-test got two new cases (`domain` imports `jose`, `application` imports `pg`) that need the `frameworkLibs` change | `lint:boundaries` 6/6 PASS; `dev-keys.js` run manually (writes 0600 key, refuses overwrite without `--force`) | Triangulation skipped: wiring and tooling, one possible output. No automated test for `dev-keys.js` (dev tool) and none for the real `SSMClient` branch of `config.module.ts` (needs AWS) | N/A (new) / boundary self-test 4/4 before | Prettier and lint fixes |
| 2.1 | `src/auth/domain/session-policy.spec.ts` | Run: TS2307 | 9/9 | Constants; expiry; max-age at login (604800), mid-session (518400), partial seconds, negative; grace boundary 10 s / 10.001 s / 1 h; expired at/after | N/A (new) | None needed |
| 2.2 | `src/auth/infrastructure/jose/jose-access-token.service.spec.ts` (+ `test/support/keys.ts`) | Run: TS2307 | 12/12 | RS256+`kid`+900 s; role and no email; verify OK; clock tolerance 904/906 s; `alg:none`; HS256 with public key as secret; tampered payload and signature; other key same `kid`; unknown `kid`, wrong `iss`/`aud`, garbage; JWKS public-only; two keys; rotation verifies the old token | N/A (new) | None needed |
| 2.3 | `src/auth/infrastructure/http/session-cookie.writer.spec.ts` | Run: TS2307 | 10/10 | Access attrs exact; refresh attrs exact; remaining-time Max-Age; two headers; `COOKIE_SECURE=false` names and flags; injection refused (2 cases); `clear` secure and insecure; `cookieNamesFor` both modes | N/A (new) | None needed |
| 2.4 | `src/auth/infrastructure/http/client-ip.resolver.spec.ts` (+ `Forbidden` in `errors.spec.ts`) | Run: TS2305/TS2307 | 17/17 across the two files | IPv4, IPv6 last-colon, bracketed IPv6, 4 fail-closed rows, XFF ignored (with and without the CF header), socket resolver (plain, IPv4-mapped, unknown), factory | `errors.spec.ts` 3/3 before | None needed |
| 2.5 | `test/jwks.e2e-spec.ts` (+ `test/support/test-app.ts`, `setup-env.ts`) | Run: 3 failed (no route/providers) | 3/3 e2e; runtime check: `node dist/main.js` served `GET /api/.well-known/jwks.json` 200 with `Cache-Control: public, max-age=300` and `GET /api/health` (confirms `require(esm)` of `jose` at runtime) | Headers/public; no private params; token verified using only the published JWKS | e2e 5/5 before (health, docs) | `docs`/`health` e2e migrated to `createTestApp()` (still 5/5) |
| 3.1 | `src/auth/infrastructure/http/guards/origin.guard.spec.ts` | Run: TS2307 (first attempt also TS2352, fixed with `testConfig`) | 17/17 | 4 methods without Origin; foreign Origin; 6 non-exact forms; 2 allowed origins; GET/HEAD/OPTIONS; empty allow-list | N/A (new) | Config built through `loadConfig` in `test/support/test-config.ts` |
| 3.2 | `jwt-auth.guard.spec.ts`, `roles.guard.spec.ts` (+ health/jwks e2e as safety net) | Run: TS2307 for both; after registering the global guards, e2e: 5 failed (health and JWKS answered 401) | 10/10 + 4/4; e2e back to 8/8 after `@Public()` on `HealthController` and `JwksController` | Valid cookie; injected clock; 5 rejection rows; insecure cookie name; `@Public` on handler and on class; roles: none/not in list/allowed/no principal | e2e 8/8 before registering guards | Handler lookup helper `test/support/handler-of.ts` (lint `unbound-method`) |
| 3.3 | `src/shared/infrastructure/http/domain-exception.filter.spec.ts` (+ `Unauthenticated` in `errors.spec.ts`) | Run: TS2307 | 7/7 | 400/401/403 mapped; 503 generic body with cause containing SQL and a stack path; cause logged server-side only; 4xx not logged; unmapped code gives 500 | `errors.spec.ts` 4/4 before | `configureApp` (cookie-parser, filter, `no-store`, cookie scheme) is driven by 3.7/3.8 e2e |
| 3.4 | `src/identity/domain/email.spec.ts`, `user.spec.ts`, `role.spec.ts` | Run: TS2307 x2 (`role.ts` was needed by 2.2 and got its own spec then: 10 cases) | 22 + 11 + 10 | Normalization; 3 valid; 11 invalid; control chars; 254 boundary; non-strings; equality. Text: trim, absent forms, 120/121, control chars, accents | N/A (new) | None needed |
| 3.5 | `test/support/{test-app,keys,test-config,handler-of}.ts`, `fakes/{fake-clock,in-memory-repositories}.ts`, `test/setup-env.ts`, `jest-e2e.config.js` | Infrastructure for 3.7/3.8: `createTestApp` referencing missing providers made `me.e2e` fail first | Used by 30 e2e tests | N/A: test support, exercised by every e2e | e2e 5/5 before `health`/`docs` migration, 5/5 after | None needed |
| 3.6 | `src/identity/application/get-me.use-case.spec.ts` | Run: TS2307 | 4/4 | Full profile; null optionals and exact key set; stored role wins; deleted user gives `Unauthenticated` | N/A (new) | None needed |
| 3.7 | `test/me.e2e-spec.ts` | Run: 11 failed (`createTestApp` could not resolve `USER_REPOSITORY`) | 11/11 | Exact keys and `no-store`; nulls; ADMIN; 401 JSON; deleted user; `alg:none`; HS256; expired; valid at 899 s; tampered; GET without Origin | e2e 8/8 before | None needed |
| 3.8 | `test/admin.e2e-spec.ts`, `src/admin/application/list-visits.use-case.spec.ts` | Run: 6 failed of 11 (no route; guard-order tests hit unmatched routes and got 404) | 11/11 + 1/1 | 403 / `[]` / 401; three content routes 404 with session; `/admin` absent from docs and `/api/v1/me` present; no cookie/JWT/key text in docs; 401, 403, 404, 403 bodies without stack, path or SQL; guard order (403 before 401) | e2e 19/19 before | Test-only `ProbeController` added through `createTestApp({ controllers })`. Unit spec for the stub asserts `[]` on purpose: the stub's contract IS emptiness (spec scenario); triangulation skipped (single possible output) and covered end-to-end |

### Test Summary

- Total tests written in this batch: 197 new (172 unit + 25 e2e; 5 existing e2e were migrated, not new); suite totals 180 unit + 30 e2e, all passing.
- Layers: Unit (all domain/application/infra units), E2E (supertest with the real modules and guards). No integration layer yet (starts in U4).
- Approval tests: None, no refactoring of existing behavior beyond migrating `health`/`docs` e2e to `createTestApp()` (same assertions, 5/5 before and after).
- Mocks: none (`jest.mock` not used); hand-written fakes only.

### Gates (final run)

`npm run lint` OK; `npm run lint:boundaries` OK (6/6); `npm run format:check` OK; `npm run typecheck` OK; `npm test -w apps/api` 180/180; `npm run test:cov -w apps/api` 100 % (domain+application); `npm run test:e2e -w apps/api` 30/30; `npm run build` OK; `bash spikes/web-functions/scripts/scan-secrets.sh` exit 0 (gitleaks clean, no account data).

### Dependencies added (exact, all at least 14 days old on 2026-10-21)

| Package | Version | Where | Published |
|---------|---------|-------|-----------|
| `jose` | 6.2.12 | dependencies | 2026-09-05 (6.2.13 is from 2026-10-20, too new) |
| `@aws-sdk/client-ssm` | 3.1147.0 | dependencies | 2026-10-06 |
| `cookie-parser` | 1.4.7 | dependencies | 2024-10-08 |
| `@types/cookie-parser` | 1.4.10 | devDependencies | 2025-10-24 |
| `@types/express` | 5.0.6 | devDependencies (was already transitive) | 2025-12-01 |

### Deviations from tasks/design

1. `Secrets.databaseUrl` and `redisUrl` are `string | null` for now (nothing consumes them until PR2); PR2 tightens them.
2. `JwksProvider.jwks()` is synchronous: public JWKs are exported once with `node:crypto` `KeyObject.export({ format: 'jwk' })`; `jose` is used for signing and verification. Design wrote it as a Promise.
3. Errors: added `InvalidInput`, `Forbidden`, `Unauthenticated` to `shared/domain/errors.ts` (design only named `DomainError` and `InfrastructureUnavailable`). The filter maps by `code`; guards throw Nest `ForbiddenException`/`UnauthorizedException`.
4. `Principal` lives in `identity/domain/principal.ts` and `role.ts` was created with 2.2 (needed by the token port), not 3.4.
5. `AppConfig` adds `jwtAudience` (constant `web_cv-api`), `secretsSource`, `ssmPrefix`, `awsRegion`; `CLIENT_IP_SOURCE` defaults to `cloudfront` (fail closed). CV, Redis and DB config arrive with their slices.
6. `GetMe` returns the role stored for the user, not the JWT claim.
7. The guard-order e2e uses a test-only `ProbeController`: there is no mutating route until PR2. Discovery: Nest global guards do not run on unmatched routes, so `POST` to an unknown path is 404 even with a bad Origin. The real `POST /api/auth/*` Origin scenarios must be asserted in PR2 on the real routes.
8. Task 1.1 `build` does not import `jose` (specs are excluded from the build), so the runtime `require(esm)` proof was done in 2.5 with the real `JoseAccessTokenService` via `node dist/main.js`.
9. `AppModule` now needs the environment at boot (fail fast). There is no dotenv loader: export the variables from `.env.example` (documented there) to run `start:dev`.
10. Gate C3 (fresh-context review) and the repeated CIERRE checklist items are left for the orchestrator.

### Workload / PR boundary

- Mode: stacked PR slice with `size:exception` (user decision), PR1 = U1-U3, base `main`.
- Boundary: starts at current `main` (health slice only), ends with `GET /api/v1/me`, admin stub, JWKS and guards over in-memory repositories; rollback is `git revert` of the PR (no persisted state, no infra).
- Size: about 3,620 changed lines excluding lockfile and openspec artifacts (about 1,900 tests and support, about 1,700 production and config), far above the forecast of ~620 and the 400 budget.

### Remaining

U4-U10 (PR2-PR4) not started.

## Fixes de revisión (PR1)

Fresh review: 0 CRITICAL. Each fix: spec edited first (new rows failing or referencing missing params), then minimal change. Safety net before: 180 unit + 30 e2e green.

| Fix | Test file | RED | GREEN | TRIANGULATE | SAFETY NET | REFACTOR |
|-----|-----------|-----|-------|-------------|------------|----------|
| 1. Key validation at boot (RSA, >= 2048 bits) | `src/auth/infrastructure/jose/jose-access-token.service.spec.ts` | Run: 6 new rows failed (EC and 1024-bit keys were accepted) | 16/16 in file | EC signing key, 1024-bit RSA signing key, EC and 1024-bit previous public key, RSA 2048 and 3072 accepted | 12/12 before | Key-pair helper typed without `as const` unions |
| 2A. `ALLOWED_ORIGINS` exact origins | `src/config/app-config.spec.ts` | Run: new rows failed (trailing slash, path, bare host, uppercase host, `*`) | 28/28 in file | 6 bad entries, one bad entry in a list, port accepted | 16/16 before | Wildcard check made explicit: `new URL('https://*.x').origin` parses |
| 2B. Production marker (`SECRETS_SOURCE=ssm`) | `src/config/app-config.spec.ts` | Run: new rows failed | (same run) | `socket` rejected, `COOKIE_SECURE=false` rejected, safe combo accepted, local env keeps both escapes | (same) | `cookieSecure`/`clientIpSource` hoisted above the return |
| 3. Port and IPv4-mapped in CloudFront resolver | `src/auth/infrastructure/http/client-ip.resolver.spec.ts` | Run: 4 new rows failed (empty, non-numeric, oversized port; mapped address) | 20/20 in file | 3 bad ports, mapped address unwrapped | 17/17 before | `stripIpv4Mapped` shared by both resolvers |
| 4. Role-claim tradeoff | Docs only: `design.md` section 14.1 | N/A | N/A | N/A | N/A | N/A |
| 5. Relative `JWT_PRIVATE_KEY_FILE` | `src/config/env-secrets.provider.spec.ts` | Spec written first with a third constructor parameter that did not exist (compile error; not executed separately) | 10/10 in file | Relative with base dir, absolute untouched, default base = repo root | 7/7 before | None needed |
| 6. Exact prefix matching for `no-store` | `src/bootstrap/no-store.spec.ts` (new) | Spec first, module missing (not executed separately) | 13/13 | 5 matching paths, 8 non-matching (`/api/v10`, `/api/authors`, `/api/auth-docs`...) | e2e 30/30 before and after | Logic moved from `configure-app.ts` to `bootstrap/no-store.ts` |
| 7. Note under U4 in `tasks.md` | Docs only | N/A | N/A | N/A | N/A | N/A |

Totals after fixes: 216 unit tests (24 suites), 30 e2e, coverage 100 %.

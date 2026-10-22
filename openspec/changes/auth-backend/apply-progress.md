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

## Batch 2 - PR2 (U4, U5, U6): tasks 4.1-6.4 complete (13/13 of the batch)

Mode: Strict TDD, `size:exception` (user decision), stacked-to-main PR2 on top of merged PR1 (#19). Branch `feat/auth-backend-magic-link`.

Safety net before touching existing files: 216 unit (24 suites) + 30 e2e green (PR1 totals); config specs 42/42 before the secrets change; `errors.spec` 4/4 and filter spec 7/7 before the 429 mapping.

Totals after the batch: 348 unit tests (39 suites, domain/application lines 100 %, branches 91 %), 72 e2e (7 suites), 32 integration (5 suites) against real Redis and Postgres.

RED rule used in this batch: each RED was RUN. Where a module did not exist, a wrong-on-purpose skeleton was written first so the failure is behavioral (assertion output below), not TS2307. Three exceptions stayed compile-only REDs (marked "compile").

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (run, failing output) | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|---------------------------|-------|-------------|----------|
| 4.1 | `test/jest-int.config.js`, `test/integration/support/env.ts`, `.github/workflows/ci.yml` (job `integration`), `package.json` scripts | Structural | N/A (new) | Exercised by 4.2: first run TS2307 (compile) | `test:int` runs 32 tests; `prettier --check` on ci.yml; services pinned by digest identical to compose, actions pinned by SHA, `permissions: contents: read`, no `pull_request_target`; CI job itself cannot run locally (needs GitHub) | Triangulation skipped: config and workflow, one possible output | None needed |
| 4.2 | `test/integration/redis-client.int-spec.ts` | Integration | N/A (new) | Skeleton as the design wrote it (`lazyConnect` + `enableOfflineQueue:false`): 1 failed, `Stream isn't writeable and enableOfflineQueue options is false` on the first `ping` | 2/2 | Lazy creation (`status wait`) and first command connects; unreachable Redis rejects in < 5 s | Doc comment explaining why the offline queue stays on |
| 4.3 | `test/integration/redis-magic-link.int-spec.ts` (+ `in-memory-magic-link.store.spec.ts`) | Integration + Unit | N/A (new) | Skeleton store (no-ops): 5 failed of 7 (`ttl Expected > 895, Received -2`, `exists Expected 0, Received 1`, concurrent consumers `Received length` 0 winners, NX overwrite resolved instead of rejected) | 7/7 real Redis; fake 5/5 | TTL 900 + once-only; unknown hash; no clear token in key or value; expiry (1 s); 20 concurrent `consume` give exactly 1 winner; corrupted JSON gives null and the key is removed; NX refuses a live key | `toPayload` keeps only known fields (strips smuggled ones) |
| 4.4 | `test/integration/redis-rate-limiter.int-spec.ts`, `src/auth/domain/rate-limit-key.spec.ts`, `in-memory-rate-limiter.spec.ts` | Integration + Unit | N/A (new) | Key builder skeleton returning the raw IP: 8 failed of 13; limiter skeleton allowing everything: 6 failed of 6 (`Expected length: 5, Received length: 20`) | 6/6 real Redis; 13/13 key; 3/3 fake | Window, per-subject, window reopening (1 s), no counter without TTL, no clear subject in key, IPv6 /64 shared counter and neighbour /64 apart, 20 concurrent hits with limit 5 give exactly 5 allowed | Rate-limit key and `/64` logic kept in the domain; `RateLimitKey` type moved there from the port |
| 4.5 | `src/auth/infrastructure/redis/redis-errors.spec.ts` + unreachable cases in both Redis int-specs | Unit + Integration | int 13/13 before | Skeleton `withRedis = op => op()`: 2 failed of 4; then int: 2 failed (`Expected constructor: InfrastructureUnavailable, Received: MaxRetriesPerRequestError`) | 4/4 unit; 17/17 int | Success value; connection error keeps cause and a generic message; sync throw; no double wrap | None needed |
| (4.x extra) | `src/config/env-secrets.provider.spec.ts`, `ssm-secrets.provider.spec.ts` | Unit | 42/42 before | 4 failed (`DATABASE_URL`/`REDIS_URL` and `database-url`/`redis-url` accepted when missing) | 46/46 | Both providers, both URLs | `Secrets.databaseUrl/redisUrl` are `string` |
| 5.1 | `opaque-token.spec.ts`, `magic-link-token.spec.ts`, `auth-errors.spec.ts` | Unit | N/A (new) | Skeletons returning empty values: 24 failed of 27 | 30/30 | 32 bytes requested; known vector (`0xff` gives `_`x42 + `8`, computed independently with Node); 10 invalid shapes; hash of the exact text; fragment not query; trailing slash kept; query and fragment of the base dropped | Domain takes a structural `ByteSource` (lint: domain cannot import the port) |
| 5.2 | `src/auth/application/request-magic-link.use-case.spec.ts` (+ `RateLimited` in `errors.spec.ts`, filter spec) | Unit | `errors.spec` 4/4, filter 7/7 | Skeleton no-op: 23 failed of 23. `RateLimited` skeleton: `errors.spec` and filter 429 test failed | 25/25 (+ filter 9/9, errors 5/5) | Same work for known/new; normalisation; hash-only store; link shape; company/name trimmed/empty/invalid; 4 invalid email shapes; IP limit with exact `retryAfterSeconds`, per-address, IPv6 /64, no email budget spent when refused; silent email limit; mail failure logged without address/token (plus provider `code` and non-Error rejections); limiter and store down | Filter sets `Retry-After`; `Logger` port added |
| 5.3 | `magic-link-email.spec.ts`, `smtp-mail.sender.spec.ts`, `ses-mail.sender.spec.ts`, `mail-sender.factory.spec.ts` | Unit | N/A (new) | Skeletons returning empty: 9 failed of 31 | 33/33 | Fragment not query; HTML escaping; both bodies; SES exact command shape; failures propagate; factory picks SMTP or SES | None needed |
| 5.4 | `test/auth-magic-link.e2e-spec.ts` | E2E | e2e 30/30 before | 22 failed of 23 (all answered 404: no route; `compile` error first for `users.all()` then fixed) | 23/23 (53 e2e total) | Identical bytes known/new; 4 invalid bodies + non-JSON; user untouched; mail failure; hash only + link; CloudFront header missing/no port/not an address, IPv6; 429 with `Retry-After: 800`; other IP passes; XFF ignored; silent email; real-route Origin missing/foreign/allowed; socket resolver; 503 limiter and store | Test-app overrides for Redis, store, limiter, mail, logger, config |
| 6.1 | `src/identity/domain/admin-policy.spec.ts` | Unit | N/A (new) | Skeleton always RECRUITER: 3 failed of 9 | 9/9 | Case both sides, whitespace, 4 look-alike emails, empty config | None needed |
| 6.2 | `test/integration/migrations.int-spec.ts`, `typeorm-user.repository.int-spec.ts`, `in-memory-user.repository.spec.ts` | Integration + Unit | N/A (new) | Migration no-op skeleton: 7 failed of 8; repo skeleton: 7 failed of 7; in-memory spec first run: compile (upsert missing) | 8/8, 7/7, 5/5; CLI smoke: `migration:run` then `migration:revert` in a throwaway schema | up-down-up, idempotent; defaults; unique; lower-case CHECK; role CHECK both ways; 120-char CHECKs; `COMMENT ON`; upsert insert/COALESCE keep/replace/role both ways; 12 concurrent upserts give one row; unknown and malformed id give null; database down gives `InfrastructureUnavailable` | `withDatabase` wrapper; pool 2, `connectTimeoutMS` 5000 |
| 6.3 | `src/auth/application/verify-magic-link.use-case.spec.ts` | Unit | N/A (new) | Skeleton rejecting: 21 failed of 21 | 21/21 (after fixing a test that advanced past the link TTL) | New and existing user, hash-only refresh row with 7 d expiry, distinct families, COALESCE vs replace, role (default, admin with case/spaces, recomputed demotion, smuggled `role`), reuse, 899/900 s expiry, unknown, 3 malformed, 2 concurrent, IP limit that does not burn the link, other IP, store/limiter/user store down | Refresh token generation shares `opaque-token.ts` |
| 6.4 | `test/auth-verify.e2e-spec.ts` | E2E | e2e 53/53 before | 19 failed of 19 (first run failed in `createTestApp` for a missing provider; after wiring the provider, all answered 404) | 19/19 (72 e2e total) | Exact two `Set-Cookie` lines; session works on `/me`; hash only; company/name only on verify; COALESCE; ADMIN and `/admin` 200; recruiter 403; smuggled role; reused/expired/unknown/malformed/missing all 400 without cookies; never 403/404 for a bad token; concurrent 204+400; 429 with `Retry-After: 540`; Origin missing/foreign and missing viewer address (links not burned); 503 store and limiter; `COOKIE_SECURE=false` | None needed |

Manual runtime proof (throwaway schema, built `dist`, real Mailpit/Redis/Postgres): `POST magic-link` without Origin 403; with Origin 202; Mailpit message captured, token read from the fragment; `verify` 204 with `access`/`refresh` cookies; `GET /api/v1/me` returned the user with `company: Acme`; reuse 400; users row has role RECRUITER and `last_login_at` set.

### Test Summary

- New tests in the batch: 132 unit (216 to 348), 42 e2e (30 to 72), 32 integration (new layer).
- Layers: Unit, E2E, Integration (real Redis 8 and Postgres 18 via docker-compose).
- Mocks: none (`jest.mock` not used); hand-written fakes only.
- Approval tests: none; the only edits to existing behavior were additive (filter 429, secrets now required) and went through RED first.

### Gates (final run, after the last change)

`npm run lint` OK; `lint:boundaries` OK; `format:check` OK; `typecheck` OK; `npm test -w apps/api` 348/348; `test:cov` 100 % lines (domain+application), branches 91 %; `test:e2e` 72/72; `test:int` 32/32 (local Redis and Postgres through docker-compose); `build` OK; `scan-secrets.sh` exit 0 (it flagged the dev JWT key that the smoke test generated into the gitignored `apps/api/.keys/`; that file was deleted).

### Dependencies added (exact; all at least 14 days old on 2026-10-21)

| Package | Version | Where | Published |
|---------|---------|-------|-----------|
| `ioredis` | 6.0.0 | dependencies | 2026-07-31 |
| `typeorm` | 1.1.1 | dependencies | 2026-09-01 (1.1.2 is newer than 14 days) |
| `pg` | 8.23.1 | dependencies | 2026-09-30 |
| `@types/pg` | 8.23.1 | devDependencies | 2026-08-17 |
| `nodemailer` | 10.0.15 | dependencies | 2026-10-05 (10.0.16 is from 2026-10-07, under 14 days); bundles its own types |
| `@aws-sdk/client-sesv2` | 3.1147.0 | dependencies | 2026-10-06 (same release train as `client-ssm` from PR1) |

### Deviations from tasks/design (PR2)

1. Redis client keeps the offline queue ON (design: off). Proven RED: with `lazyConnect` and the queue disabled, the first command always fails. Failure stays bounded by `maxRetriesPerRequest: 1` and `connectTimeout: 2000`.
2. No `user.schema.ts` (EntitySchema): both repository operations are parameterised SQL and the table is defined by the migration, so a schema would be dead code and would force `shared` to import `identity`.
3. `RateLimited` (429 + `Retry-After`) lives in `shared/domain/errors.ts`; `MalformedToken` and `InvalidMagicLink` (400) in `auth/domain/auth-errors.ts`. `Logger` port added (application cannot use Nest's logger).
4. `opaque-token.ts` (shared by magic-link and refresh tokens) and `rate-limit-key.ts` are in the domain with a structural `ByteSource`; lint forbids domain importing application ports. `refresh-token.ts` (7.2) is still untouched.
5. SUPERSEDED by review fix 2: `DATA_SOURCE` is registered unopened and opened lazily on first use (memoised, retried after a failure), so a down or cold Postgres never stops boot; Redis is lazy too.
6. The link is consumed (`GETDEL`) before the database write: if Postgres fails right after, the answer is 503 and that link is spent (the user asks for a new one). Fail closed, by design of the atomic consume.
7. `Secrets.databaseUrl/redisUrl` are now required strings (SSM: `database-url`, `redis-url` required).
8. Email copy is Spanish (the site's language). SMTP timeouts 5 s. SES region from `AWS_REGION`.
9. In-memory fakes live in `src/**/in-memory` and are re-exported by `test/support/fakes/*` because application specs cannot import infrastructure paths (lint). Integration specs use a private schema per file through `options=-c search_path` (test only; the app uses no session state). `typeorm` 1.1.1 contains no `pg_advisory` calls (searched).
10. Runtime still uses `InMemoryRefreshTokenRepository` (Q-C): refresh rows do not survive a restart until U7. There is no refresh endpoint yet.
11. Gate C3 (fresh-context review) and the CIERRE checkboxes are left for the orchestrator; adding `integration` as a required check in the GitHub ruleset (today only `quality` and `secrets` are required) needs the user.

### Workload / PR boundary

- Mode: stacked PR slice with `size:exception` (user decision), PR2 = U4-U6, base `main` (PR1 merged).
- Boundary: starts at `main` with `GET /me`, JWKS and guards over in-memory stores; ends with Redis stores, magic-link request and verify over Redis, Postgres `users`, the `integration` CI job and the in-memory refresh repo. Rollback: `git revert` of the PR plus `npm run migration:revert -w apps/api` (one migration, `users`).
- Size: about 4,170 changed lines excluding lockfile and openspec (about 1,430 production/config, about 2,735 tests and support), far above the forecast of ~700.

### Remaining

U7-U10 (PR3-PR4) not started.

## Batch 2 — Fixes de revisión

Fresh review of PR2: 0 CRITICAL. Safety net before: 348 unit, 72 e2e, 32 integration green.

| Fix | Test file | RED (run) | GREEN | TRIANGULATE | REFACTOR |
|-----|-----------|-----------|-------|-------------|----------|
| 1. Email local part limited to RFC atext dot-atoms | `src/identity/domain/email.spec.ts`; `test/auth-magic-link.e2e-spec.ts` | Unit: 14 failed (`x,victim@`, `x;victim@`, `x<`, `x>`, quoted, `x"y`, `(`, `[`, `:`, `\`, leading/trailing/double dot, non-ASCII local part were accepted). The 3 e2e rows were added in the same step as the fix, so their RED was not run separately | 37/37 unit; 26/26 e2e file (400 and MailSender empty for comma, semicolon, angle bracket) | All separators; atext symbols still accepted (`{a}!#$%&*/=?^_\`\|~-x@`) | Regex built from a named `ATEXT` part |
| 2. Lazy DataSource | `src/shared/infrastructure/persistence/lazy-initialize.spec.ts`; `test/integration/typeorm-user.repository.int-spec.ts`; `test/postgres-down.e2e-spec.ts` | Unit (skeleton no-op): 4 of 5 failed. Integration: 2 failed (`Received promise rejected instead of resolved`: unopened DataSource not opened, no retry). The e2e was written after the fix (regression test), so no RED for it | 5/5 unit; 9/9 integration; 2/2 e2e: boot with Postgres unreachable (0 `initialize` calls), `/api/health` 200, JWKS 200, verify 503 with generic body and no cookie, then 204 after recovery | Open on first use, already open, simultaneous callers share one attempt, failure then retry, repeated failure retries each call; real Postgres: lazy open + first failure then success | `ensureInitialized` memo per DataSource, cleared on rejection; module registers `DATA_SOURCE` unopened |
| 3. Open handle in `test:int` | `--detectOpenHandles` | Found a lingering ioredis `disconnectTimeout` timer (default 2000 ms) kept by a client that never connected (`redis-client.int-spec.ts`) and `Jest did not exit one second after the test run` | Clean: 2 runs without the warning, `--detectOpenHandles` reports nothing; no `forceExit` | N/A | Factory sets `disconnectTimeout: 200` (shutdown no longer waits 2 s on a dead socket) |
| 4. TLS to the stores when `SECRETS_SOURCE=ssm` | `src/config/ssm-secrets.provider.spec.ts` | 6 failed (no sslmode, `disable`, `prefer`, `allow`, not a URL, plain `redis://` accepted) | 54/54 config specs | `require` and `verify-full` accepted; `rediss://` accepted; errors name the parameter only and never the URL (asserted) | `assertTlsStores` in the SSM provider (SSM is the deployed-environment marker) |
| 5. Design risk | `design.md` section 17 | N/A | One line: a known email can have its quota exhausted and its links suppressed for the window; accepted consequence of the silent 202 | N/A | N/A |

Totals after the fixes: 376 unit (40 suites, domain/application lines 100 %, branches 91 %), 77 e2e (8 suites), 34 integration (5 suites). Gates: lint, lint:boundaries, format:check, typecheck, test:cov, test:e2e, test:int, build, scan-secrets all green (scan exit 0). Diff size: about 4,530 changed lines excluding lockfile and openspec.

## Batch 3 - PR3 (U7, U8): tasks 7.1-8.3 complete (5/5 of the batch)

Mode: Strict TDD, `size:exception` (user decision), stacked-to-main PR3 on top of merged PR2 (#20). Branch `feat/auth-backend-sessions`.

Safety net before touching existing files: 376 unit (40 suites), 77 e2e (8 suites), 34 integration (5 suites), all green.

Totals after the batch: 436 unit (44 suites; domain/application lines 100 %, branches 93.6 %), 110 e2e (9 suites), 57 integration (6 suites) against real Redis and Postgres.

RED rule: every RED below was RUN and its failing output recorded before the fix. Skeletons (wrong on purpose) make the failure behavioral. The e2e RED ran against routes that did not exist yet (all 404; note that the Origin guard does not run on unmatched routes, so the Origin rows could only be proven on the real routes).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (run, failing output) | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|---------------------------|-------|-------------|----------|
| 7.1 | `test/integration/typeorm-refresh-token.int-spec.ts`, `migrations.int-spec.ts` (new `refresh_tokens` block) | Integration | migrations 8/8 and user repo 9/9 before | Skeleton repo (no-ops) and empty migration: 22 failed of 31 (`relation "refresh_tokens" does not exist`; `Expected: {userId, familyId, expiresAt} Received: null`; index, FK, CHECK and COMMENT rows) | 31/31 (57/57 whole layer). Up-down-up expectation changed: each `down` undoes only its own migration (newest first), so the test now undoes twice | create (bytea 32, defaults, duplicate hash); consume (once, null the second time with `used_at` unmoved, unknown, revoked and not marked used, expiry exclusive at the instant and valid 1 ms before, 20 simultaneous callers give exactly 1 winner on a pool of 2); findByHash unused/used/revoked/unknown; revokeFamily (only that family, first revocation time kept); revokeFamilyOf (through a used token, unknown ignored); FK `ON DELETE CASCADE`; UNIQUE hash; CHECK length 32 (62 and 66 hex rejected); indexes on hash, family and user; COMMENTs; database down gives `InfrastructureUnavailable`; lazy DataSource | `normalizeRows` because TypeORM returns `[rows, affected]` for `UPDATE ... RETURNING` |
| 7.2a | `src/auth/domain/refresh-token.spec.ts` | Unit | N/A (new) | Skeleton (empty token, null parse, never revoke): 9 failed of 20 (`Expected "AQEB..." Received ""`; judge rows `Expected - 2 Received + 2`) | 20/20 (27/27 with later edits) | generate vs known bytes and sha256; different bytes; parse round trip; 10 malformed shapes give `null`; judge: unknown, expired unused, revoked, revoked and used, used 11 s, exactly 10 s, 1 s, 10.001 s | Domain takes a structural `RefusedTokenState` (lint: domain cannot import the port) |
| 7.2b | `src/auth/infrastructure/in-memory/in-memory-refresh-token.repository.spec.ts` | Unit | verify use case and e2e green before | Skeleton with no-op methods: 6 failed of 7 | 7/7 | Same contract rows as the Postgres spec (once, unknown, revoked, expiry exclusive, 10 simultaneous, state, family revocation, `revokeFamilyOf`) and `all()` keeps the created shape | `all()` returns rows as created, so earlier specs are untouched |
| 7.2c | `test/postgres-down.e2e-spec.ts` (new row) | E2E | e2e 77/77 before | 1 failed: `Expected length: 1 Received length: 0` (no `INSERT INTO refresh_tokens` reached the DataSource: runtime still bound to memory) | 78/78 after binding `TypeOrmRefreshTokenRepository` in `auth.module.ts` and overriding the port with the in-memory repo in `createTestApp` (unless a stand-in DataSource is passed) | Hash is the bound parameter and the clear token is nowhere in the parameters | None needed |
| 8.1 | `src/auth/application/refresh-session.use-case.spec.ts` | Unit | N/A (new) | Skeleton that refuses everything: 24 failed of 24 | 24/24 | Rotation (new token, JWT from the stored role, old token spent); family and absolute end kept through 3 chained refreshes; only the new hash stored; demotion visible at refresh; expiry at 7 d refused and 1 s before accepted; missing/empty/number/wrong shape never reach limiter or database; unknown token counted; reuse after 11 s kills the newest token too; 10 s grace leaves the family alive; 10.001 s boundary; revoked-never-used; another family untouched; simultaneous refreshes give one `issued` and one race outcome; deleted user revokes the family; per-IP limit with exact `retryAfterSeconds` 800, per IP, IPv6 /64; limiter down, consume down and create down (token spent, no JWT) | `ipRule` option shaped like `VerifyMagicLinkOptions`; rejected outcome is a typed result, not an exception, so the controller can decide the cookies |
| 8.2 | `src/auth/application/logout.use-case.spec.ts` | Unit | request-magic-link spec 25/25 before moving `describeFailure` | Skeleton no-op: 3 failed of 9 (the other 6 pass trivially on a no-op; the 3 positive rows force the logic and make the negative rows real) | 9/9 | Whole family revoked; other family untouched; already-spent token; missing/number/wrong shape; unknown well formed; database down is swallowed and logged with kind only (no token, no host); silent on success | `describeFailure` moved from `request-magic-link.use-case.ts` to `shared/application/describe-failure.ts` (25/25 still green) |
| 8.3 | `test/refresh.e2e-spec.ts` | E2E | e2e 78/78 before | 31 failed of 32 (all answered 404; the only pass was `GET /api/auth/refresh` 404, correct by absence) | 32/32 after `refresh` and `logout` in `auth.controller.ts` and the module providers (110/110 whole layer). One test fix: the expired access JWT needs 910 s because the verifier tolerates 5 s of clock skew | Exact `Set-Cookie` strings (rotation, `Max-Age` 518400 after a day, chain 6/5/4 days, `Max-Age=1` one second before expiry), 204 empty body and `no-store`; hash only stored; insecure cookie names; no cookie/garbage/unknown/expired give 401 JSON with exact clearing lines; reuse >10 s clears and kills R2; reuse <=10 s has no `Set-Cookie`; other session of the same user survives; simultaneous requests give 204 + 401 without cookies; 429 with `Retry-After: 540`, token not spent, other IP passes; POST without/foreign Origin 403 on both real routes with the session surviving; missing viewer address 403 on refresh, not needed on logout; Redis down and Postgres down give 503 generic, no cookies; logout always 204 + exact clearing (none/unknown/garbage/twice), kills the rotated family, JWT lives until expiry, database down still 204 and logged; both routes in `docs-json` under `auth` | `cookieValue` helper in the controller |

Manual runtime proof (built `dist`, real Postgres, Redis and Mailpit, throwaway schema, `COOKIE_SECURE=false`): `migration:run` applied both migrations; magic-link 202; verify 204 (refresh `Max-Age=604799`); `/me` 200; refresh 204 with a different token; reuse inside 10 s 401 with zero `Set-Cookie` lines; 8 simultaneous refreshes with one token gave exactly one 204 and seven 401; reuse after 11 s 401 with both cookies cleared; the table shows 3 rows, 32-byte hashes, all revoked, expiry about 7 days after creation for every row; logout without cookies 204. Schema dropped, dev key deleted.

### Test Summary

- New tests in the batch: 60 unit (376 to 436), 33 e2e (77 to 110), 23 integration (34 to 57).
- Layers: Unit, E2E, Integration (real Postgres for the repository and migration).
- Mocks: none (`jest.mock` not used); hand-written fakes only. One existing integration spec used `jest.spyOn` already (PR2).
- Approval tests: none; edits to existing behavior were additive, plus the up-down-up expectation that now counts two migrations.

### Gates (final run, after the last change)

`lint` OK; `lint:boundaries` OK; `format:check` OK; `typecheck` OK; `npm test -w apps/api` 436/436; `test:cov` all files 100 % lines, branches 93.6 % (domain/application 100 % lines); `test:e2e` 110/110; `test:int` 57/57 (3 consecutive clean runs); `build` OK; `scan-secrets.sh` exit 0 (it first flagged a 12-digit UUID in a new test; replaced with the `ffffffff-...` id used elsewhere; dev key deleted).

### Dependencies added

None.

### Deviations from tasks/design (PR3)

1. SUPERSEDED by review fix 1 (Batch 3 — Fixes de revisión): rotation is now ONE atomic statement (`rotate`), not `consume` then `create`. A failure leaves the old token unspent.
2. `RefreshSession` returns `{ kind: 'issued' | 'rejected', clearCookies }` instead of throwing, so the controller can clear cookies only when it should and then throw `Unauthenticated` (401). A malformed or absent cookie is rejected before the rate limiter, so a missing cookie does not need Redis.
3. `refresh` with missing/unknown/expired cookie clears cookies (design table says so); spec only mandates 401.
4. An index on `refresh_tokens(user_id)` was added (not in the design) because the FK cascade and any per-user lookup would otherwise scan the table.
5. `refresh-token.ts` in the domain holds both the `RefreshToken` value object and the pure decision `judgeRefusedRefresh`.
6. A flaky PR2 integration test was fixed: `redis-rate-limiter.int-spec.ts` built the "neighbour /64" by replacing the last hex digit with `f`, which collided with the same /64 one run in 16 (observed once in 6 runs: `allowed: false` expected true). It now flips to `e` when the digit is already `f`.
7. `SequenceRandomSource` got an optional start offset (test support) so login and rotated tokens never share bytes.
8. No cleanup job for expired or revoked `refresh_tokens` rows (not in scope); the table grows by one row per refresh. Worth a follow-up before real traffic.
9. Gate C3 (fresh-context review) and the CIERRE checkboxes are left for the orchestrator. Adding `integration` as a required check in the ruleset still needs the user.

### Workload / PR boundary

- Mode: stacked PR slice with `size:exception` (user decision), PR3 = U7-U8, base `main` (PR2 merged).
- Boundary: starts at `main` with Redis stores, magic link request/verify and an in-memory refresh repo; ends with the `refresh_tokens` migration and TypeORM repository bound at runtime, `POST /api/auth/refresh` and `POST /api/auth/logout`. Rollback: `git revert` of the PR plus `npm run migration:revert -w apps/api` (one migration, `refresh_tokens`); sessions issued by then become unusable for refresh (users sign in again).
- Size: about 2,210 changed lines excluding lockfile and openspec (about 580 production, about 1,630 tests and support), far above the forecast of ~520 and the 400 budget.

### Remaining

U9-U10 (PR4) not started.

## Batch 3 — Fixes de revisión

Fresh review of PR3: 0 CRITICAL, 2 WARNING, 3 SUGGESTION. Safety net before: 436 unit, 110 e2e, 57 integration green.

| Fix | Test file | RED (run, failing output) | GREEN | TRIANGULATE | REFACTOR |
|-----|-----------|---------------------------|-------|-------------|----------|
| 1. Rotation in one statement; revoked family can never get a live token | `test/integration/typeorm-refresh-token.int-spec.ts`, `in-memory-refresh-token.repository.spec.ts` | Port changed to `rotate(old, new, now)` with the OLD two-statement logic as skeleton. Integration: 2 failed of 22 (`refuses a live token whose family has a revoked row`: Received `{expiresAt, familyId, userId}` instead of null; `never leaves a live token in a revoked family when revoke races rotate (40 trials)`: Expected 0 Received 1, a live successor in a revoked family). In-memory: 1 failed of 10 (same straggler row) | Single `WITH spent AS (UPDATE ... AND NOT EXISTS (revoked row in family) RETURNING) INSERT ... SELECT FROM spent RETURNING`: 22/22, but the race trial then failed 1 run in 5 (`Expected 0 Received 1`): a revocation waiting on the lock of the rotating row never sees the successor. Fix: `revokeFamily`/`revokeFamilyOf` repeat (fresh snapshot per pass, max 5) until a pass revokes nothing: 12 consecutive runs 22/22. In-memory 10/10 | Revoke then rotate refused and writes nothing; straggler live row in a revoked family refused; successor in same family with same end; refused rotation writes no row (unknown, used, expired); 40 trials with three revoke timings (`revokeFamily`, `revokeFamilyOf`, delayed); 20 simultaneous rotations still give 1 winner | `consume` removed from the port; helper `next()` in the int spec |
| 2. A transient failure no longer logs the user out | `src/auth/application/refresh-session.use-case.spec.ts` | 2 failed of 27 (`database down on the read`: promise resolved instead of rejected; `user lookup failing`: old token was already spent, `usedAt` not null) | Flow is now: `findByHash` (read) -> usable? -> `users.findById` -> `rotate` -> sign JWT: 27/27 | User lookup failure: 503, token unspent, retry succeeds; rotation failure: 503, no JWT, 1 row, retry succeeds; read failure; order is `rotate` then `issue`; revoke landing between read and rotation gives a cleared 401, no JWT, no new row | `judge()` shared by the unusable-read and rotate-refused paths; the old "create down: token is spent" test was replaced |
| 3. Logout swallowing a DB error logs at `warn` | `src/auth/application/logout.use-case.spec.ts`, `test/refresh.e2e-spec.ts` | 1 failed of 9 (`warnings` empty: it logged at error) | `Logger` port gained `warn`; `NestLogger`, `CapturingLogger` implement it; 9/9 and e2e 110/110 | Warning text has the failure kind only (no token, no host); no `error`; silent on success | Documented in `design.md` section 17 |
| 4. Grace window uses the app clock | `design.md` section 17 | Docs only | N/A | N/A | N/A |
| 5. Cleanup job follow-up | `tasks.md` section "Seguimiento" (F1) | Docs only | N/A | N/A | N/A |

Also updated in `design.md`: port signature (`rotate`), the atomic-statement list, the multi-pass revocation rationale, and the refresh sequence.

Totals after the fixes: 442 unit (44 suites, lines 100 %, branches 94.1 %), 110 e2e (9 suites), 62 integration (6 suites). Gates: lint, lint:boundaries, format:check, typecheck, test:cov, test:e2e, test:int (4 clean runs), build, scan-secrets (exit 0) all green; no dev keys left. Diff size after the fixes: about 2,510 changed lines excluding lockfile and openspec.

Residual note: with `READ COMMITTED` the revocation loop is what closes the lock-wait window; the cap of 5 passes only guards an endless loop (an attacker cannot rotate faster than a pass in practice).

## Batch 4 - PR4 (U9, U10): tasks 9.1-10.4 complete (6/6 of the batch; 28/28 in total, Seguimiento F1/F2 untouched)

Mode: Strict TDD, `size:exception` (user decision), stacked-to-main PR4 on top of merged PR3 (#21). Branch `feat/auth-backend-data-endpoints`.

Safety net before touching existing files: 442 unit (44 suites), 110 e2e (9 suites), 62 integration (6 suites), all green.

Totals after the batch: 472 unit (49 suites; domain/application lines 100 %, all files 100 % lines, branches 94 %), 121 e2e (10 suites), 74 integration (7 suites) against real Postgres and Redis.

RED rule: every RED below was RUN and its failing output recorded before the fix (skeletons wrong on purpose so the failure is behavioral; "compile" marks the two cases where only a type error could be shown).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED (run, failing output) | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|---------------------------|-------|-------------|----------|
| 9.1 | `test/integration/typeorm-availability.int-spec.ts`, `migrations.int-spec.ts` | Integration | migrations 14/14 and 62 int before | Skeleton migration (`SELECT 1`) and repo returning empty strings: 12 failed of 12 (`relation "availability" does not exist`; `Expected "[dato de ejemplo]" Received ""`; down-database case `Received promise resolved instead of rejected`). Migrations spec updated to 3 tables: 1 failed (`availability` missing). Registration of the migration in `index.ts` was missing on the first run (a failed edit), so RED included "table absent" | 12/12 and migrations 14/14 after the real migration, repo and registration | Seed is placeholders only in one row; migration re-run after revert does not duplicate; `CHECK (id = 1)` refuses id 2; PK refuses a second id 1; NOT NULL; `updated_at` moves on the documented UPDATE; `COMMENT ON` table and columns; `get` maps `start_label` to `start`; out-of-band UPDATE visible; missing row gives `InfrastructureUnavailable`; database down gives `InfrastructureUnavailable`; lazy DataSource opens on first use; up-down-up now counts three migrations | Unused imports removed; `withDatabase` wraps the missing-row error |
| 9.2 | `test/postgres-down.e2e-spec.ts` (2 new rows, fake extended for `FROM availability`/`FROM users`) | E2E | e2e 110/110 and the 3 existing rows of the file before | 2 failed: `/me` returned `[dato de ejemplo]` instead of `db modality` (module still bound the in-memory repo); missing row returned 200 instead of 503 | 112/112 whole layer after binding `TypeOrmAvailabilityRepository` in `availability.module.ts` (inject `DATA_SOURCE`) and overriding the port with the in-memory repo in `createTestApp` (unless a stand-in DataSource is passed) | Labels from the table with `start_label` exposed as `start`; the SQL really ran (`FROM availability` captured); missing row 503 with the generic body | `me.e2e-spec.ts` unchanged and green (it uses the in-memory repo through `t.availability`) |
| 10.1 | `src/cv/application/get-cv-link.use-case.spec.ts`, `src/cv/infrastructure/fake-cv-link.signer.spec.ts` | Unit | N/A (new) | Use case skeleton returning empty strings: 5 failed of 5 (`Received string: ""`, `Expected: 2` calls). Fake signer spec: compile error TS2554 (skeleton `sign()` took no argument) | 7/7 after the real use case and fake signer (13/13 with 10.2) | Clock 10:00 + 300 s and clock 23:59:30 + 60 s; two calls give two different urls and signer called twice; the signer receives the current instant; signer failure passes through unchanged; fake: ttl 300 and 90, counter | None needed |
| 10.1b | `fake-cv-link.signer.spec.ts` (added after the smoke) | Unit | 17/17 in `src/cv` | Smoke showed `expires=1792666683.17`: 1 failed (`Expected ...expires=1772359500 Received ...1772359500.17`) | 17/17 with `Math.floor` | Milliseconds in the clock input | None needed |
| 10.2 | `src/cv/infrastructure/s3-cv-link.signer.spec.ts`, `aws-presign.spec.ts` | Unit | N/A (new) | Skeletons (signer returns empty url, presign returns ''): 6 failed of 6 (`calls` empty array; `Expected constructor: InfrastructureUnavailable, Received: Object`) | 6/6 (13/13 for `src/cv`) | Injected presign: bucket/key/ttl/instant forwarded; second object, ttl 45 and instant 2026-12-31; presigns on every call; failure becomes a generic `InfrastructureUnavailable` with no bucket, key or url. Real SDK offline with fake credentials: host `bucket.s3.us-east-1.amazonaws.com`, path, `X-Amz-Expires=300`, `X-Amz-Date=20260301T100000Z`, credential scope, 64-hex signature, secret absent; second case sa-east-1, key with a space (`%20`), ttl 60, other instant, different signature | None needed |
| 10.2b | `src/cv/infrastructure/cv-link-signer.factory.spec.ts` | Unit | `src/cv` 16/16 | Compile TS2307 (factory did not exist; logic was inline in `cv.module.ts`) | 3/3 | Fake with ttl 90; S3 wired offline through env fake credentials (host, path, expires 120, region from config); s3 without bucket or key refused (`CV_BUCKET`, `CV_OBJECT_KEY`) | Factory moved out of the module so it is testable |
| (10.x config) | `src/config/app-config.spec.ts` | Unit | 30/30 before | Added type and a wrong skeleton: 11 failed (`cv` defaults, s3 fields, bucket/key required, invalid signer, 5 invalid lifetimes, ssm rejects fake) | 41/41 (67/67 across `src/config`) | Defaults; s3 with custom ttl; missing bucket and key; signer `gcs`/`S3`/empty; ttl `0`, `-5`, `1.5`, `abc`, `3601`; bounds 1 and 3600; deployed (ssm) with fake or unset signer refused; existing ssm rows updated to a valid s3 config | `parseCv`/`parseCvTtl` helpers |
| 10.3 | `test/cv.e2e-spec.ts` | E2E | e2e 112/112 before | 9 failed of 9 (all answered 404; docs row `Received has value: undefined`) | 121/121 whole layer after `cv.controller.ts`, `cv-link-response.dto.ts`, `cv.module.ts` and `CvModule` in `AppModule` | Exact keys, `no-store`, `expiresAt` = clock + 300 s; ADMIN and clock advanced 120 s; two requests give two links; 401 JSON without session and with a garbage cookie, signer never called; url absent from logs; documented in `docs-json` (no admin, no signature text); default local config serves the example link; signer failure gives 503 with the generic body | None needed |
| 10.4 | Docs: `ADR-012-s3-privado-url-prefirmada-cv.md`, `stack-adrs/README.md` index and README table | N/A | N/A | N/A | N/A | N/A | N/A |

### Test Summary

- New tests in the batch: 30 unit (442 to 472), 11 e2e (110 to 121), 12 integration (62 to 74; the migrations spec only had one expectation edited).
- Layers: Unit, E2E, Integration (real Postgres for the availability table).
- Mocks: none (`jest.mock` not used); hand-written fakes only. The S3 presigner is tested both injected and through the real SDK with no network.
- Approval tests: none; edits to existing behavior were additive (config, test-app binding, migrations count).

### Gates (final run, after the last change)

`lint` OK; `lint:boundaries` OK; `format:check` OK; `typecheck` OK; `npm test -w apps/api` 472/472; `test:cov` 100 % lines (all files), branches 94 %; `test:e2e` 121/121; `test:int` 74/74; `build` OK; `scan-secrets.sh` exit 0 (dev key deleted).

Manual runtime proof (built `dist`, real Postgres, Redis and Mailpit, throwaway schema, `COOKIE_SECURE=false`, `CV_SIGNER=fake`): `migration:run` applied the availability migration (seed row of placeholders); magic-link 202; verify 204; `/me` 200 with `availability` placeholders; `/cv` 200 `{url, expiresAt}` (first run exposed the fractional `expires=...17`, fixed as 10.1b); `/cv` without session 401; refresh 204; `/me` after refresh 200; logout 204; refresh after logout 401; after an out-of-band `UPDATE` of `modality` a new login showed the new value; docs list `/api/v1/cv` and `/api/v1/me` and no `/admin`; the server log had no error lines and no URL. Schema dropped, dev key deleted.

### Dependencies added (exact; both published 2026-10-06, 16 days before 2026-10-22; same release train as `client-ssm`/`client-sesv2` 3.1147.0)

| Package | Version | Where |
|---------|---------|-------|
| `@aws-sdk/client-s3` | 3.1147.0 | dependencies |
| `@aws-sdk/s3-request-presigner` | 3.1147.0 | dependencies |

### Deviations from tasks/design (PR4)

1. No `availability.schema.ts` (EntitySchema), same reason as `users` (PR2): the repository runs one parameterised SQL and the table is defined by the migration.
2. Missing `availability` row (spec silent): `GET /api/v1/me` answers 503 with the generic body instead of inventing values or returning empty strings. Recorded in `design.md` section 17.
3. Task 9.2 says to replace the binding "in `identity.module.ts`"; the binding lives in `availability.module.ts` (the in-memory repo was provided there), so that is where it changed.
4. New config (design section 10 already named `CV_SIGNER`, `CV_BUCKET`, `CV_OBJECT_KEY`): `CV_LINK_TTL_SECONDS` (1 to 3600, default 300). With `SECRETS_SOURCE=ssm` the `fake` signer is refused at boot. Bucket and key come from plain config (not secrets); the bucket name is not sensitive.
5. `Presign` port takes `signingDate` so the URL and `expiresAt` are computed from the same instant (the app clock), which also makes the real SDK output deterministic in tests.
6. `aws-presign.ts` and `cv-link-signer.factory.ts` are separate files (not in the design tree) to keep the module wiring testable.
7. ADR-012 status is "Propuesta": the bucket and the role do not exist yet, and the claim about presigned URLs and temporary credentials is marked NO VERIFICADO.
8. `.env.example` gained the CV block (`CV_SIGNER=fake`, `CV_LINK_TTL_SECONDS=300`, bucket/key commented placeholders).
9. Gate C3 (fresh-context review) and the CIERRE checkboxes are left for the orchestrator.

### Workload / PR boundary

- Mode: stacked PR slice with `size:exception` (user decision), PR4 = U9-U10, base `main` (PR3 merged).
- Boundary: starts at `main` with sessions over Postgres (users, refresh_tokens) and an in-memory availability repo; ends with the `availability` migration and repo bound at runtime, `GET /api/v1/cv` with the `CvLinkSigner` port (fake locally, S3 presigned in deployed environments) and ADR-012. Rollback: `git revert` of the PR plus `npm run migration:revert -w apps/api` (one migration, `availability`).
- Size: about 1,140 changed lines excluding lockfile and openspec (about 400 production/config, about 740 tests and support), far above the 400 budget and the forecast of ~460; `size:exception` applies.

### Remaining

Nothing in U1-U10. Seguimiento F1 and F2 stay open (out of this change).

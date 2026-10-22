# Tareas: Auth Backend — magic link, sesión JWT RS256 y endpoints del reclutador

> 10 unidades de trabajo (U1–U10), agrupables en 4 PRs (opción a) o entregables 1 a 1 (opción b). `stacked-to-main`. Strict TDD (`openspec/config.yaml`): cada tarea es RED (spec que falla, archivo nombrado primero) → GREEN (mínimo) → REFACTOR. Rutas relativas a `apps/api/`. Identificadores en inglés. Shell: `rg`/`bat`/`fd`/`sd`/`eza`. Sin secretos, ARNs, cuentas ni emails reales (`*.example.test`). Sin `cdk`/AWS.

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas cambiadas estimadas | ~2.300 en total (sin lockfile): PR1 ~620, PR2 ~700, PR3 ~520, PR4 ~460 |
| Riesgo de presupuesto de 400 líneas | High (los 4 PRs superan 400) |
| PRs encadenados recomendados | Sí |
| División sugerida | Opción a: PR1 → PR2 → PR3 → PR4 con `size:exception`. Opción b: 10 PRs ≤ ~400 |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Opciones (decide la usuaria antes de apply):**

- **(a) ~4 PRs con `size:exception`:** PR1 = U1–U3 (~620), PR2 = U4–U6 (~700), PR3 = U7–U8 (~520), PR4 = U9–U10 (~460). Menos overhead; revisión pesada por PR.
- **(b) 10 PRs ≤ ~400 (una por unidad):** U1 ~380 · U2 ~380 · U3 ~400 · U4 ~380 · U5 ~380 · U6 ~400 · U7 ~250 · U8 ~350 · U9 ~200 · U10 ~330. Cada una verde en CI con su e2e; más PRs, revisión corta.

### Unidades de trabajo (base = `main` tras mergear la anterior)

| Unidad | Objetivo | PR (opción a) | Depende de |
|--------|----------|---------------|------------|
| U1 | Smoke `jose`, config, secretos, ports compartidos | PR1 | — |
| U2 | `SessionPolicy`, tokens RS256, JWKS, cookies, IP | PR1 | U1 |
| U3 | Guards, filtro, `test-app`, `GET /me` (repos en memoria), admin stub, 404, Swagger | PR1 | U2 |
| U4 | Redis, `RateLimiter`, `MagicLinkStore`, `test:int` + job CI `integration` | PR2 | U3 |
| U5 | `MailSender`, `RequestMagicLink`, `POST /magic-link` | PR2 | U4 |
| U6 | Migración y repo `users`, `AdminPolicy`, `VerifyMagicLink` (refresh en memoria) | PR2 | U5 |
| U7 | Migración y repo `refresh_tokens` (reemplaza el de memoria) | PR3 | U6 |
| U8 | `RefreshSession`, `Logout` | PR3 | U7 |
| U9 | Migración `availability` + repo (reemplaza el de memoria) | PR4 | U8 |
| U10 | `CvLinkSigner`, `GET /cv`, ADR-012 | PR4 | U9 |

Un solo hilo de escritura. Cada PR pasa por revisión de contexto fresco antes de abrirse.

## Preguntas abiertas (NO decidir en apply; preguntar a la usuaria)

- [x] Q-A (resuelto: el design se alineó a 400). Spec dice `verify` inválido/vencido/usado → **400**; design §11 dice **401**. Las tareas 6.4 siguen la spec; reconciliar antes de U6.
- [x] Q-B (resuelto: la spec se alineó a los nombres del design). Nombres: spec usa `TokenStore`/`TokenSigner`; design `MagicLinkStore`/`AccessTokenIssuer`. Las tareas usan los del design.
- [x] Q-C (aceptado). Proposal pone la migración `refresh_tokens` en PR3 pero `verify` (PR2) necesita crearlos: se usa un repo en memoria en U6 y se reemplaza en U7.

## Cierre estándar de PR («CIERRE»)

- [ ] C1. Contar líneas (`additions + deletions`, sin lockfile); si excede 400 y no hay `size:exception` aprobado, STOP.
- [ ] C2. `npm run lint && npm run lint:boundaries && npm run format:check && npm run typecheck && npm run test:cov && npm run test:e2e && npm run build` en verde; desde U4 también `npm run test:int -w apps/api`.
- [ ] C3. Cobertura `domain`/`application` ≥ 80 %; gitleaks sin hallazgos; revisión de contexto fresco.

## U1 — Fundación (PR1)

- [x] 1.1 **Smoke `jose` (STOP si falla y preguntar; plan B `node:crypto`).** RED `src/shared/infrastructure/jose-smoke.spec.ts`: par RS256, firma, verify con `currentDate`, `exportJWK`. `npm view jose version` + revisar `exports`; fijar versión exacta en `package.json`. GREEN con `npm test` (VM modules), `npm run typecheck`, `npm run build`.
- [x] 1.2 RED `src/config/app-config.spec.ts` → GREEN `src/config/app-config.ts` (`loadConfig` pura, falla rápido, `COOKIE_SECURE` por defecto `true`, `RATE_LIMITS`).
- [x] 1.3 RED `src/config/env-secrets.provider.spec.ts` → GREEN `secrets.port.ts`, `env-secrets.provider.ts` (`JWT_PRIVATE_KEY_FILE`, `ADMIN_EMAIL`).
- [x] 1.4 RED `src/config/ssm-secrets.provider.spec.ts` (`send` falso, un solo `GetParameters`) → GREEN `ssm-secrets.provider.ts`; dep `@aws-sdk/client-ssm`.
- [x] 1.5 RED `src/shared/domain/hash.spec.ts`, `errors.spec.ts` → GREEN `hash.ts`, `errors.ts`; puertos `Clock`/`RandomSource`/`IdGenerator` + adaptadores y `FakeClock`.
- [x] 1.6 `config.module.ts`, `shared.module.ts`, `scripts/dev-keys.js`, `.gitignore` (`apps/api/.keys/`), `.env.example` (placeholders), `eslint.config.mjs` (`frameworkLibs`: `jose`, `nodemailer`, `pg`, `cookie-parser`). REFACTOR. CIERRE.

## U2 — Tokens, cookies, IP (PR1)

- [x] 2.1 RED `src/auth/domain/session-policy.spec.ts` → GREEN `session-policy.ts` (900/900/7 d/10 s).
- [x] 2.2 RED `src/auth/infrastructure/jose/jose-access-token.service.spec.ts` (RS256, `kid`, `exp-iat=900`, rechaza `none`/HS256/vencido/manipulado, JWKS sin `d,p,q,dp,dq,qi`, dos claves) con `test/support/keys.ts` → GREEN `jose-access-token.service.ts`.
- [x] 2.3 RED `src/auth/infrastructure/http/session-cookie.writer.spec.ts` (atributos, sin `Domain`, `Max-Age`, `COOKIE_SECURE=false`, `clear`) → GREEN `session-cookie.writer.ts`.
- [x] 2.4 RED `src/auth/infrastructure/http/client-ip.resolver.spec.ts` (IPv4/IPv6 por último `:`, falta cabecera → 403 prod, socket local, ignora `X-Forwarded-For`) → GREEN `client-ip.resolver.ts`.
- [x] 2.5 RED `test/jwks.e2e-spec.ts` (público, `Cache-Control`) → GREEN `jwks.controller.ts`. Verificación runtime: `node dist/main.js` + `GET /api/.well-known/jwks.json` (`require(esm)`). CIERRE.

## U3 — Guards y `GET /me` (PR1)

- [x] 3.1 RED `src/auth/infrastructure/http/guards/origin.guard.spec.ts` → GREEN `origin.guard.ts`, `public.decorator.ts`.
- [x] 3.2 RED `jwt-auth.guard.spec.ts` y `roles.guard.spec.ts` → GREEN guards + `roles.decorator.ts`, `principal.decorator.ts`; `@Public()` en `health.controller.ts`.
- [x] 3.3 RED `src/shared/infrastructure/http/domain-exception.filter.spec.ts` (sin `stack`/SQL) → GREEN `domain-exception.filter.ts`; `configure-app.ts` (`cookie-parser`, filtro, `no-store`).
- [x] 3.4 RED `src/identity/domain/email.spec.ts`, `user.spec.ts` → GREEN `email.ts`, `role.ts`, `user.ts`.
- [x] 3.5 `test/support/{test-app.ts,keys.ts,fakes/*}`, `test/setup-env.ts`, `jest-e2e.config.js`; migrar `health` y `docs` e2e a `createTestApp()`.
- [x] 3.6 RED `src/identity/application/get-me.use-case.spec.ts` → GREEN `get-me.use-case.ts` + repos en memoria (`USER_REPOSITORY`, `AvailabilityRepository`).
- [x] 3.7 RED `test/me.e2e-spec.ts` (claves exactas, `null`, ADMIN, 401, `alg` inválido, GET sin `Origin`) → GREEN `me.controller.ts`, `me-response.dto.ts`.
- [x] 3.8 RED `test/admin.e2e-spec.ts` (403 JSON, `[]`, 401, `/admin` fuera de `/api/docs-json`, sin secretos, 404 de `/profile|/experience|/skills` con sesión, errores sin filtraciones) → GREEN `admin-visits.controller.ts` (`@ApiExcludeController`), `list-visits.use-case.ts`. REFACTOR. CIERRE.

## U4 — Redis e integración (PR2)

> Nota de revisión de PR1: `ClientIpResolver` debe inyectarse mediante el token `CLIENT_IP_RESOLVER` (hoy solo existe la factory `createClientIpResolver`; registrar el proveedor con `APP_CONFIG.clientIpSource`), y el 403 por falta de `CloudFront-Viewer-Address` debe ejercitarse e2e sobre la ruta `POST /api/auth/magic-link` (con `CLIENT_IP_SOURCE=cloudfront` en esa suite).

- [x] 4.1 `package.json` (`ioredis`, scripts `test:int`), `test/jest-int.config.js`, `docker-compose` sin cambios; `.github/workflows/ci.yml`: job `integration` con service containers (digest = compose).
- [x] 4.2 `src/shared/infrastructure/redis/redis-client.factory.ts` (`lazyConnect`, sin offline queue, `rediss://`).
- [x] 4.3 RED `test/integration/redis-magic-link.int-spec.ts` (`GETDEL`, TTL 900, solo hash, consumo concurrente) → GREEN `redis-magic-link.store.ts` + `InMemoryMagicLinkStore`.
- [x] 4.4 RED `test/integration/redis-rate-limiter.int-spec.ts` (ventana, `retryAfterSeconds`, IPv6 `/64`) → GREEN `redis-rate-limiter.ts` + `InMemoryRateLimiter`.
- [x] 4.5 RED `src/auth/infrastructure/redis/redis-errors.spec.ts` → GREEN mapeo a `InfrastructureUnavailable` (503). CIERRE.

## U5 — Petición de magic link (PR2)

- [x] 5.1 RED `src/auth/domain/magic-link-token.spec.ts` → GREEN `magic-link-token.ts` (43 chars base64url).
- [x] 5.2 RED `src/auth/application/request-magic-link.use-case.spec.ts` (mismo trabajo, límite email silencioso, fallo de correo, sin tocar `users`) → GREEN `request-magic-link.use-case.ts`.
- [x] 5.3 RED `smtp-mail.sender.spec.ts`, `magic-link-email.spec.ts` (`#token=`, nunca `?token=`) → GREEN `smtp-mail.sender.ts`, `ses-mail.sender.ts`, `magic-link-email.ts`; deps `nodemailer`, `@aws-sdk/client-sesv2`.
- [x] 5.4 RED `test/auth-magic-link.e2e-spec.ts` (202 idéntico, 400, 429, 202 silencioso, XFF, Origin, CloudFront 403, 503) → GREEN `auth.controller.ts` (`magic-link`), `auth.module.ts` con `APP_GUARD` en orden. CIERRE.

## U6 — Verificación (PR2)

- [x] 6.1 RED `src/identity/domain/admin-policy.spec.ts` (case/espacios, sin elevar por payload) → GREEN `admin-policy.ts`.
- [x] 6.2 `data-source.factory.ts`, `data-source.cli.ts`, migración `…-users.ts` (`up`/`down`, `COMMENT ON`), scripts `migration:run|revert`. RED `test/integration/migrations.int-spec.ts` (up→down→up) y `typeorm-user.repository.int-spec.ts` (upsert `COALESCE`) → GREEN `user.schema.ts`, `typeorm-user.repository.ts`; deps `typeorm`, `pg`.
- [x] 6.3 RED `src/auth/application/verify-magic-link.use-case.spec.ts` (usuario nuevo/existente, rol, concurrencia, 503) → GREEN `verify-magic-link.use-case.ts` + `InMemoryRefreshTokenRepository` (solo `create`).
- [x] 6.4 RED `test/auth-verify.e2e-spec.ts` (flujo feliz con cookies, reutilizado/vencido/basura → 400 según spec, ver Q-A, concurrente, rol, 503) → GREEN `verify` en `auth.controller.ts`. CIERRE.

## U7 — Persistencia de refresh (PR3)

- [ ] 7.1 RED `test/integration/typeorm-refresh-token.int-spec.ts` (`consume` concurrente → uno gana, `bytea` 32, solo hash, `revokeFamilyOf`) → GREEN migración `…-refresh-tokens.ts`, `refresh-token.schema.ts`, `typeorm-refresh-token.repository.ts`.
- [ ] 7.2 Reemplazar el repo en memoria en `auth.module.ts`; RED `src/auth/domain/refresh-token.spec.ts` → GREEN `refresh-token.ts`. CIERRE.

## U8 — Refresh y logout (PR3)

- [ ] 8.1 RED `src/auth/application/refresh-session.use-case.spec.ts` (rotación, expiración absoluta, gracia 10 s, revocación de familia, otra familia) → GREEN `refresh-session.use-case.ts`.
- [ ] 8.2 RED `src/auth/application/logout.use-case.spec.ts` (nunca falla) → GREEN `logout.use-case.ts`.
- [ ] 8.3 RED `test/refresh.e2e-spec.ts` (todos los escenarios de refresh y logout, `Set-Cookie` leído a mano) → GREEN `refresh`/`logout` en `auth.controller.ts`. CIERRE.

## U9 — Disponibilidad (PR4)

- [ ] 9.1 RED `test/integration/typeorm-availability.int-spec.ts` (seed placeholder `[dato de ejemplo]`, `CHECK id=1`) → GREEN migración `…-availability.ts`, `availability.schema.ts`, `typeorm-availability.repository.ts`, `availability.module.ts`.
- [ ] 9.2 Reemplazar el repo en memoria en `identity.module.ts`; `me.e2e-spec.ts` sigue verde. CIERRE.

## U10 — CV (PR4)

- [ ] 10.1 RED `src/cv/application/get-cv-link.use-case.spec.ts` (300 s, un signer por petición) → GREEN `get-cv-link.use-case.ts`, `fake-cv-link.signer.ts`.
- [ ] 10.2 RED `src/cv/infrastructure/s3-cv-link.signer.spec.ts` (presigner inyectado, sin URL en logs) → GREEN `s3-cv-link.signer.ts`; deps `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- [ ] 10.3 RED `test/cv.e2e-spec.ts` (200, 401, signer invocado 2 veces) → GREEN `cv.controller.ts`, `cv.module.ts`.
- [ ] 10.4 ADR-012 `openspec/changes/stack-adrs/adrs/ADR-012-*.md` + índice en el README de `stack-adrs` (S3 privado + presign ~5 min). CIERRE.

## Trazabilidad escenario → tarea

| Spec | Escenarios | Tareas |
|------|-----------|--------|
| magic-link-login | Email nuevo y registrado · Formato inválido · Sin efectos sobre usuario · Fallo del envío | 5.2, 5.4 |
| | Solo se guarda el hash · Forma del enlace | 4.3, 5.1, 5.3 |
| | Falta CloudFront-Viewer-Address · Límite por IP · Límite por email · XFF ignorado | 2.4, 4.4, 5.4 |
| | Flujo feliz · Token reutilizado · vencido · desconocido/mal formado · concurrentes | 4.3, 6.3, 6.4 |
| | company/name al verificar · Usuario conserva datos | 6.2, 6.3, 6.4 |
| | Reclutador por defecto · Administrador · Rol no se eleva | 6.1, 6.4 |
| | Redis caído en magic-link · en verify | 4.5, 5.4, 6.4 |
| session-tokens | Verificable con JWKS · JWKS sin privado · `alg` distinto · vencido/manipulado | 2.2, 2.5, 3.7 |
| | Atributos access · refresh · Secure desactivable | 2.3, 6.4 |
| | Refresh rota · sin cookie · vencido · solo hash | 7.1, 8.1, 8.3 |
| | Reutilización fuera/dentro de gracia · otra familia | 8.1, 8.3 |
| | Logout con sesión · sin sesión · refresh desconocido | 8.2, 8.3 |
| | Ruta protegida · rutas públicas · rol insuficiente | 3.2, 3.7, 3.8 |
| | POST sin Origin · Origin ajeno · permitido · GET sin Origin | 3.1, 3.7, 5.4 |
| recruiter-endpoints | Forma completa · null · ADMIN · sin sesión | 3.6, 3.7 |
| | Sin valores personales en el seed | 9.1 |
| | CV respuesta válida · sin sesión · enlace nuevo | 10.1, 10.3 |
| | Admin: 403 JSON · `[]` · sin sesión | 3.8 |
| | 404 con sesión · Admin oculto · sin secretos en docs · errores sin filtraciones | 3.3, 3.8 |

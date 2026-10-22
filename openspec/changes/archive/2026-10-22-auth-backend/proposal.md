# Propuesta: Auth Backend — magic link, sesión JWT RS256 y endpoints del reclutador

## Intención

`apps/web` ya llama a `/api/auth/*`, `/api/v1/me` y `/api/v1/cv`, pero `apps/api` solo tiene `health`. Este cambio implementa en NestJS hexagonal el contrato que el cliente ya consume (ver `exploration.md` §2) y cumple lo que la UI promete: token de 15 min y de un solo uso, solo el hash en Redis, rate limit por IP y por email, sesión de 7 días y JWT RS256.

## Alcance

### Dentro del alcance
- `POST /api/auth/magic-link` (202 idéntico), `POST /api/auth/verify`, `POST /api/auth/refresh`, `POST /api/auth/logout` (204 siempre).
- `GET /api/v1/me`, `GET /api/v1/cv` (URL firmada + `expiresAt`), `GET /api/.well-known/jwks.json`.
- `GET /api/v1/admin/visits` como stub: 403 JSON para RECRUITER, lista vacía para ADMIN, oculto en Swagger.
- Guards `JwtAuthGuard`, `RolesGuard` y `OriginGuard`; cookies `__Host-access` y `__Secure-refresh`.
- Migraciones TypeORM: `users`, `refresh_tokens`, `availability` (seed con valores de ejemplo).
- `docker-compose.yml`, `.env.example` (placeholders), `eslint.config.mjs` (`jose`, `nodemailer` en `frameworkLibs`).

### Decisiones (vinculantes, 2026-10-21)

| # | Decisión |
|---|----------|
| D1 | Registro abierto: todo email válido puede pedir enlace y queda como RECRUITER. Antienumeración: 202 idéntico; límite por email silencioso (202) y por IP visible (429). `company`/`name` se guardan solo al verificar con éxito. |
| D2 | ADMIN = el email configurado en SSM (variable de entorno en local). Al verificar, ese email recibe rol ADMIN. Nunca se commitea. |
| D3 | `/api/v1/profile`, `/experience`, `/skills` quedan fuera: responden 404. |
| D4 | Por defecto (revisable en revisión): persistencia híbrida, `MailSender` síncrono (Mailpit local, SES prod), `jose` para RS256 + JWKS, `ioredis`. |

### Fuera del alcance
Endpoints de contenido (cambio posterior), registro real de visitas, envío vía SQS/`EventPublisher`, infra/CDK (SES, S3, SSM, CloudFront), proxy local para el frontend, rotación automática de claves, mensajes de error detallados en el frontend (cambio posterior: informar al usuario qué error devuelve la API, como un `403`, y por qué).

## Capacidades

### Capacidades nuevas
- `api-magic-link-login`: petición y verificación del magic link, antienumeración, rate limits, `MailSender`, asignación de rol (D1, D2).
- `api-session-tokens`: JWT RS256 + JWKS, cookies, refresh rotativo con detección de reutilización, logout, guards de JWT, roles y `Origin`.
- `api-recruiter-endpoints`: `GET /me` (forma estricta de `Me`), `GET /cv`, stub de `/admin/visits`, 404 de contenido, exclusión en Swagger.

### Capacidades modificadas
Ninguna. Las specs `web-*` describen el cliente; este cambio las cumple sin cambiar sus requisitos.

## Enfoque

Recomendación de la exploración (§5) con D1–D4. Porciones `auth/`, `identity/`, `availability/`, `cv/`, `shared/`, `config/`. Redis guarda `sha256(token)` (TTL 900 s, `GETDEL`) y los contadores; Postgres guarda usuarios y familias de refresh. Todo adaptador detrás de un puerto; e2e con `overrideProvider`. La extracción de IP (`ClientIpResolver`) y la escritura de cookies (`SessionCookieWriter`) son adaptadores pequeños, porque dependen de Q2/Q3. Secretos vía puerto `SecretsProvider` (SSM prod, env local); claves de test generadas en el setup. Fallo de Redis → 503 (fallo cerrado).

**ADR (regla del proyecto):** verificar contra el CV `jose`, `ioredis`, `nodemailer`, `cookie-parser`, SES y S3 para el CV; cada uno ausente del CV necesita ADR en la fase de diseño.

## Plan de PRs (stacked-to-main, cada uno con su e2e)

| PR | Contenido | Líneas |
|----|-----------|--------|
| 1 | Config, `Clock`, `SecretsProvider`, `TokenSigner` + JWKS, guards, cookies, `GET /me` con repos en memoria, stub `/admin/visits` (403/200) | ~550 |
| 2 | `TokenStore` + `RateLimiter` (Redis), `MailSender`, `RequestMagicLink`, `VerifyMagicLink`, migración y repo `users`, regla ADMIN | ~600 |
| 3 | Migración `refresh_tokens`, `RefreshSession` con reutilización, `Logout` | ~450 |
| 4 | Tabla `availability` + seed de ejemplo, `CvLinkSigner` (S3 / fake), `GET /cv`, 404 de contenido, Swagger | ~400 |

Superan el presupuesto de 400 líneas: decidir en `sdd-tasks` (`size:exception` por PR o más cortes).

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `apps/api/src/{auth,identity,availability,cv,shared,config}/` | Nuevo |
| `apps/api/src/app.module.ts`, `bootstrap/configure-app.ts`, `apps/api/package.json` | Modificado |
| `docker-compose.yml`, `.env.example`, `eslint.config.mjs` | Modificado |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Q1–Q3 sin verificar, ADR-009 "Proposed" | Alta | IP y cookies en adaptadores aislados; ajustar solo esos |
| SES sandbox bloquea a reclutadores reales (~96 h para salir) | Alta | Dependencia externa; Mailpit en local |
| `jose` ESM/CJS en Jest | Media | Primera tarea del PR 1 = smoke test; si falla, parar y consultar |
| TypeORM con pooler de Neon (transacción) | Media | Sin `SET` ni advisory locks; migraciones por URL directa |
| Canal lateral de tiempo / abuso de correo | Media | Mismo trabajo para todo email válido; límites por email e IP |
| Arranque en frío de Redis en Lambda | Media | 503 explícito; medir en el cambio de infra |
| Datos personales en el repo | Baja | Seeds y `.env.example` con placeholders; email ADMIN solo en SSM/env |

## Plan de reversión

Cada PR se revierte con `git revert` del merge, en orden inverso (4 → 1). Cada migración tiene `down`; revertir PR 2–4 exige ejecutar antes `migration:revert` en local. Sin despliegue en este cambio: no hay estado en AWS que revertir. Sin el PR 1 la API vuelve a ser solo `health` y el frontend sigue en modo mock.

## Dependencias

- Spike de infra Q1–Q3 y ADR-009 (para cookies e IP en producción).
- Acceso de producción de SES (externo).
- Cambio de infra: SSM (claves, email ADMIN), bucket S3 privado del CV, reenvío de cookies y `Origin` en CloudFront.

## Criterios de éxito

- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde, local y CI.
- [ ] e2e: magic link → `MailSender` fake captura el enlace → verify → cookies → `GET /me` 200 con forma estricta.
- [ ] e2e: email registrado y nuevo reciben 202 idéntico; el límite por IP da 429.
- [ ] e2e: token reutilizado o vencido → 400/401/410, nunca 403.
- [ ] e2e: refresh reutilizado revoca la familia y responde 401; logout responde 204 sin sesión.
- [ ] e2e: RECRUITER recibe 403 JSON en `/admin/visits`; ADMIN recibe `[]`; `/admin` no aparece en `/api/docs`.
- [ ] POST sin `Origin` permitido → 403.
- [ ] Cobertura de `domain`/`application` ≥ 80 %; sin secretos, ARNs ni datos personales en el repo.

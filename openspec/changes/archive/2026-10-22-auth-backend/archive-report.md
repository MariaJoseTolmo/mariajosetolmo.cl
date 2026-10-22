# Informe de archivo: auth-backend

**Proyecto**: web_cv · **Cambio**: `auth-backend` · **Fecha de archivo**: 2026-10-22
**Modo de persistencia**: openspec (con traza en Engram)
**Estado**: archivado. Specs principales creadas y carpeta del cambio movida al archivo.

## 1. Resumen

El cambio `auth-backend` implementa en `apps/api` (NestJS, hexagonal) el contrato que el cliente de `apps/web` ya consumía: magic link con respuesta antienumeración, verificación de un solo uso, sesión con JWT RS256 y JWKS, cookies `__Host-access` y `__Secure-refresh`, refresh rotativo con detección de reutilización, logout idempotente, endpoints `GET /api/v1/me` y `GET /api/v1/cv`, el stub de `/api/v1/admin/visits` y los guards globales (JWT, roles y `Origin`). Se implementó en los PRs #19 a #23, todos mergeados.

Se verificó con Strict TDD. El veredicto original fue **PASS WITH WARNINGS** (0 CRITICAL, 5 WARNING, 6 SUGGESTION). Tras el PR #23 se cerraron los WARNING W1, W2, W4 y W5 y las SUGGESTION S2 y S4.

Las tres capacidades son nuevas. `openspec/specs/` no tenía specs previas de la API, así que no hubo requisitos MODIFIED ni REMOVED y no hubo merges destructivos.

## 2. Implementación (PRs)

| PR | Contenido |
|----|-----------|
| #19 | Unidades U1–U3. Fundaciones: configuración, secretos, puertos compartidos, tokens RS256 y JWKS, cookies, resolución de IP, guards, filtro de errores, `GET /api/v1/me` con repositorios en memoria, stub de `/admin/visits`, 404 de contenido y Swagger |
| #20 | Unidades U4–U6. Redis (`MagicLinkStore`, `RateLimiter`), job CI `integration`, petición de magic link, `MailSender`, migración y repositorio `users`, `AdminPolicy`, verificación |
| #21 | Unidades U7–U8. Migración y repositorio `refresh_tokens` (sustituye al de memoria), `RefreshSession` con gracia de 10 s y revocación de familia, `Logout` |
| #22 | Unidades U9–U10. Migración y repositorio `availability` (sustituye al de memoria), `CvLinkSigner`, `GET /api/v1/cv`, ADR-012 |
| #23 | Correcciones de verificación: W1, W2, W4, W5, S2 y S4 |

El reparto por PR sigue el plan de `tasks.md` (opción a, 4 PRs con `size:exception`). Las unidades se dividieron así: U1–U3 en #19, U4–U6 en #20, U7–U8 en #21 y U9–U10 en #22.

## 3. Specs promovidas a `openspec/specs/`

| Capacidad | Requisitos | Escenarios | Acción | Destino |
|-----------|-----------:|-----------:|--------|---------|
| `api-magic-link-login` | 6 | 22 | Creada (capacidad nueva) | `openspec/specs/api-magic-link-login/spec.md` |
| `api-session-tokens` | 7 | 24 | Creada (capacidad nueva) | `openspec/specs/api-session-tokens/spec.md` |
| `api-recruiter-endpoints` | 6 | 15 | Creada (capacidad nueva) | `openspec/specs/api-recruiter-endpoints/spec.md` |

Total: 19 requisitos y 61 escenarios. Los conteos se tomaron de los archivos delta. La observación de Engram #699 tiene conteos de resumen distintos (20 y 21 escenarios), así que los archivos son la fuente de verdad.

Normalización aplicada (solo encabezados, sin cambiar texto de requisitos ni escenarios):
- El encabezado de cada capacidad ya tenía el formato final `# <capacidad>`.
- Se conservó la sección `## Purpose` con el párrafo "Capacidad nueva…" original y se agregó una línea de origen que enlaza este informe.
- `## ADDED Requirements` pasó a `## Requirements`.
- Todos los `### Requirement:` y `#### Scenario:` se conservan literalmente, en español y con las palabras clave RFC 2119.

Los archivos delta de `openspec/changes/archive/2026-10-22-auth-backend/specs/` no se modificaron. Son historial.

## 4. Verificación

Fuente: `verify-report.md` (en esta carpeta), veredicto original sobre `main` @ `439136d` con PRs #19 a #22 mergeados. Modo Strict TDD.

- Veredicto original: **PASS WITH WARNINGS**. 0 CRITICAL, 5 WARNING, 6 SUGGESTION.
- Gates ejecutados: lint, lint:boundaries, format:check, typecheck, test de `apps/api` (49 suites, 472 tests), test:cov (dominio y aplicación: líneas 100 %, ramas 94,05 %), test:e2e (10 suites, 121 tests), test:int contra Postgres y Redis reales (7 suites, 74 tests), build y escaneo de secretos (`scan-secrets.sh` sin hallazgos).
- Escenarios en la verificación original: 60 de 61 PASS, 1 PARTIAL (escenario "Token verificable con el JWKS", W1), 0 FAIL. Por requisito: 19 de 19 cumplidos.
- Mutaciones: M1 a M6 ejecutadas en una copia; M6 sobrevivió a e2e y quedó cubierta por el test unitario (S4).

Estado tras PR #23:

| Hallazgo | Estado |
|----------|--------|
| W1. Escenario JWKS↔cookie PARTIAL | Cerrado en PR #23 |
| W2. Desalineación de `design.md` con el código | Cerrado en PR #23 |
| W3. Algunos RED no se observaron | Abierto (divulgado en `apply-progress.md`; no bloquea) |
| W4. Checklist CIERRE (C1–C3) sin marcar | Cerrado en PR #23 |
| W5. Aserciones solo de tipo (`resolves.toBeDefined()`) | Cerrado en PR #23 |
| S1. Ramas de `rate-limit-key.ts` al 60 % | Abierto |
| S2. Comentario obsoleto en `admin.e2e-spec.ts` | Cerrado en PR #23 |
| S3. `integration` como check requerido en el ruleset | Abierto (requiere a la usuaria) |
| S4. Normalización del email ADMIN sin cobertura e2e | Cerrado en PR #23 |
| S5, S6. Riesgos aceptados informativos | Aceptados en el diseño |

La verificación no se volvió a ejecutar en esta fase de archivo. Los cierres de PR #23 se toman del estado indicado por la orquestación.

## 5. Movimiento de la carpeta

La carpeta del cambio queda archivada en `openspec/changes/archive/2026-10-22-auth-backend/`. Contiene:

- `proposal.md`
- `exploration.md`
- `design.md`
- `tasks.md`
- `apply-progress.md`
- `verify-report.md`
- `specs/` con 3 deltas: `api-magic-link-login`, `api-session-tokens` y `api-recruiter-endpoints`
- `archive-report.md` (este informe)

Las specs de `openspec/specs/` son la fuente de verdad. Las copias delta de `specs/` son historial y no se deben editar.

## 6. Trazabilidad (Engram, proyecto web_cv)

| Artefacto | Topic key | Observación |
|-----------|-----------|-------------|
| Proposal | `sdd/auth-backend/proposal` | #698 |
| Spec (delta) | `sdd/auth-backend/spec` | #699 |
| Design | `sdd/auth-backend/design` | #700 |
| Tasks | `sdd/auth-backend/tasks` | #703 |
| Apply progress | `sdd/auth-backend/apply-progress` | #705 |
| Verify report | `sdd/auth-backend/verify-report` | #714 |
| Archive report | `sdd/auth-backend/archive-report` | Esta observación (mirror de este informe) |

Los archivos en openspec son la fuente completa. Las observaciones de Engram son resúmenes espejo. La observación #709 (decisión) registra las correcciones de revisión del PR2 y complementa `apply-progress`.

## 7. Advertencias abiertas y pendientes

**Pendientes del cambio (seguimiento fuera de alcance, F1–F3):**
- F1. Job programado que borre de `refresh_tokens` las filas vencidas o revocadas. Hoy la tabla crece una fila por cada refresh.
- F2. Tabla `refresh_families` con `revoked_at` propio para reemplazar la revocación por pasadas (hasta 5). Permite que rotar y revocar compitan por el lock de la misma fila.
- F3. Chequeo de deploy (o smoke test posterior) que falle si la fila de `availability` sigue con los valores de ejemplo `[dato de ejemplo]`.

**Otros pendientes:**
- Frontend: mostrar al usuario el error que devuelve la API (por ejemplo 403) y el motivo. Es una petición de la usuaria.
- S3: hacer `integration` un check requerido en el ruleset `protect-main`. Requiere decisión de la usuaria.
- W3 y S1: quedan abiertos tal como se describen en la sección 4.
- SES: acceso de producción antes de enviar magic links a reclutadas reales. El envío sigue en sandbox hasta entonces.
- Spike Q1–Q3 y ADR-009 (lambda web functions OAC): sin verificar en este cambio.
- ADR-012 (S3 privado con URL prefirmada para el CV) está en estado "Propuesta". Pasa a aceptado cuando exista la infraestructura.

## 8. Dependencias para los próximos cambios

**Cambio de infra** (los endpoints ya existen en `apps/api`; falta desplegarlos):
- Parámetros SSM por entorno: secretos de la API, claves de firma (activa y anterior para JWKS), `DATABASE_URL` con `sslmode`, URL `rediss://` de Redis, correo administrador y configuración de SES.
- Bucket privado del CV y clave del objeto, usados por `CvLinkSigner` (ADR-012).
- CloudFront debe reenviar cookies, la cabecera `Origin` y la cabecera `CloudFront-Viewer-Address` en `/api/*`. Sin `CloudFront-Viewer-Address`, producción responde `403` en magic link, verify y refresh.
- `ALLOWED_ORIGINS` debe coincidir con el dominio público (el `OriginGuard` exige coincidencia exacta).
- Chequeo de deploy de F3.

**Cambio de endpoints de contenido:**
- `GET /api/v1/profile`, `/experience` y `/skills` siguen en `404` (decisión D3). Su implementación es un cambio posterior.

**Decisiones ya tomadas** (no reabrir sin motivo):
- Gracia de reutilización de refresh de 10 s (A9).
- Respuesta `403` por falta de `CloudFront-Viewer-Address` en producción.
- Errores de verify: `400` para todo token inválido, nunca `403` ni `404`.
- Token en fragmento `#token=` (decisión de la usuaria, 2026-10-21).

## 9. Riesgos del archivo

- Ningún artefacto se perdió ni se sobrescribió. Las specs nuevas son copias de los deltas con encabezados normalizados.
- No se tocaron otros cambios (`frontend-site`, `infra-spike`, `project-scaffold`, `stack-adrs`, `stack-decisions`).

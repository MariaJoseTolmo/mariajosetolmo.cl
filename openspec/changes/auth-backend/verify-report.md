# Informe de verificación: auth-backend

**Fecha**: 2026-10-22. **Base**: `main` @ `439136d` (PRs #19 U1–U3, #20 U4–U6, #21 U7–U8, #22 U9–U10 mergeados), árbol de trabajo limpio. **Modo**: Strict TDD.
**Veredicto**: **PASS WITH WARNINGS**. 0 CRITICAL, 5 WARNING, 6 SUGGESTION. Se puede archivar.

Verificación de solo lectura: no se editó código ni tests y no hubo mutaciones de git, `cdk` ni AWS. Las mutaciones de la sección 3 se hicieron sobre una copia (`cp -Rc`) en el scratchpad, y cada archivo se restauró después (`diff -rq` sin diferencias).

## 1. Gates (ejecutados en esta verificación)

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | exit 0 (`--max-warnings 0`) |
| `npm run lint:boundaries` | exit 0 (6/6 casos del autotest de reglas; la aplicación real de las fronteras la hace `eslint`) |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 (api y web) |
| `npm run test -w apps/api` | exit 0. **49 suites / 472 tests**, 0 fallos, 0 skipped |
| `npm run test:cov -w apps/api` | exit 0. Alcance `domain`/`application` (umbral 80 %): Stmts 100 · **Branch 94.05** · Funcs 100 · Lines 100. Única rama baja: `auth/domain/rate-limit-key.ts` 60 % (L28, L40-41: valores por defecto defensivos) |
| `npm run test:e2e -w apps/api` | exit 0. **10 suites / 121 tests** |
| `npm run test:int -w apps/api` (Postgres `:55432`, Redis `:56379` de docker-compose) | exit 0. **7 suites / 74 tests** |
| `npm run build` | exit 0 (api `tsc -p tsconfig.build.json`; web `next build` → `prune-out` → `check-out: out OK`) |
| `bash spikes/web-functions/scripts/scan-secrets.sh` | **exit 0**, `RESULT: clean` (gitleaks sin hallazgos, sin datos de cuenta, nada sensible trackeado ni staged) |

Total: 667 tests en verde. Los conteos coinciden con los totales finales de `apply-progress.md` (472 / 121 / 74).

## 2. Completitud de tareas

| Métrica | Valor |
|---------|-------|
| Tareas U1–U10 | 28/28 `[x]` |
| Preguntas abiertas Q-A, Q-B, Q-C | resueltas `[x]` |
| Checklist «CIERRE» C1–C3 | sin marcar en `tasks.md` (ver W4) |
| Seguimiento F1–F3 | abiertos; **fuera de alcance**, no se cuentan como fallos |

La revisión de código coincide con las tareas: hay migraciones `users`, `refresh_tokens` y `availability`; repos TypeORM con SQL parametrizado; Redis `SET NX EX`/`GETDEL` y `MULTI(SET NX EX, INCR)`; guards en el orden `Origin → JWT → Roles` (`auth.module.ts` L131-134); job `integration` en `ci.yml` con imágenes fijadas por digest; ADR-012 indexado en `stack-adrs/README.md`.

## 3. Evidencia TDD (`apply-progress.md`)

| Chequeo | Resultado | Detalle |
|---------|-----------|---------|
| Evidencia TDD reportada | ✅ | Tablas por lote (1–4) y por cada ronda de correcciones de revisión, con RED / GREEN / TRIANGULATE / SAFETY NET / REFACTOR |
| Archivos de test citados existen | ✅ | Comprobado con `fd`: todos los `*.spec.ts`, `*.e2e-spec.ts` e `*.int-spec.ts` citados existen |
| GREEN confirmado | ✅ | Las 3 capas pasan ahora; los conteos finales coinciden |
| RED ejecutado | ⚠️ | Lote 1: RED por compilación (`TS2307`), que strict-tdd admite. Lotes 2–4: RED ejecutado con esqueletos erróneos a propósito y la salida de falla registrada. Casos declarados sin RED observado: correcciones PR1 #5 y #6, filas e2e de la corrección PR2 #1 y el e2e de regresión de la corrección PR2 #2 (ver W3) |
| Triangulación | ✅ | `it.each` con positivos y negativos, bordes (10 s / 10.001 s, 899/900 s, 7 d − 1 s) y concurrencia (20 consumidores → 1 ganador). Se omitió solo en tareas estructurales, con su motivo |
| Safety net | ✅ | Línea base registrada antes de cada lote y de cada corrección |
| Mocks | ✅ | Sin `jest.mock`; fakes escritos a mano |

**Mutaciones (copia en el scratchpad):**

| # | Mutación | Test | Resultado |
|---|----------|------|-----------|
| M1 | `REUSE_GRACE_SECONDS: 10 → 0` | `refresh.e2e-spec.ts` | 1 falla (detectada) |
| M2 | `OriginGuard` acepta todo | `auth-magic-link` + `refresh` e2e | 4 fallan |
| M3 | Se quita el corte silencioso por email | `auth-magic-link.e2e-spec.ts` | 1 falla |
| M4 | Se quita `HttpOnly` del escritor de cookies | `auth-verify.e2e-spec.ts` | 2 fallan |
| M5 | Se anula el `NOT EXISTS` de familia revocada en `rotate` | `typeorm-refresh-token.int-spec.ts` (Postgres real) | 1 falla |
| M6 | `AdminPolicy` sin `trim().toLowerCase()` del email configurado | `auth-verify.e2e` / `admin-policy.spec.ts` | e2e **sobrevive** (19/19); el unitario falla 2 (ver S4) |

**Calidad de aserciones**: 0 CRITICAL. No hay tautologías, bucles fantasma ni aserciones sobre clases CSS. Todos los `toHaveLength(0)` y `toEqual([])` tienen un test compañero no vacío (`mail.sent`, `issuer.issued`) o son el contrato mismo (`/admin/visits` → `[]`). Hay 5 `resolves.toBeDefined()` sin aserción de valor (ver W5).

**Capas**: Unit 472 (49 archivos), E2E con supertest 121 (10), Integración contra Redis 8 y Postgres 18 reales 74 (7).

## 4. Matriz de cumplimiento (61 escenarios)

### api-magic-link-login (22)

| Requisito | Escenario | Evidencia (test en verde) | Estado |
|-----------|-----------|---------------------------|--------|
| Respuesta idéntica | Email nuevo y registrado | `auth-magic-link.e2e › gives a registered and a new email the same bytes…` | PASS |
| | Formato inválido | `auth-magic-link.e2e › invalid input › %s: 400 JSON and nothing is sent` | PASS |
| | Sin efectos sobre el usuario | `auth-magic-link.e2e › does not create or change the user` | PASS |
| | Fallo del envío | `auth-magic-link.e2e › keeps answering 202 when the email cannot be delivered, and logs it` | PASS |
| Token hasheado + TTL | Solo se guarda el hash | `auth-magic-link.e2e › stores only the hash…` (TTL 900) + `redis-magic-link.int-spec` (TTL real, sin token en claro) | PASS |
| | Forma del enlace | mismo e2e (regex `#token=[A-Za-z0-9_-]{43}$`, sin `?token=`) + `magic-link-email.spec` | PASS |
| Límites | Falta CloudFront-Viewer-Address (prod) | `auth-magic-link.e2e › answers 403 when CloudFront-Viewer-Address %s, and sends nothing` (falta / sin puerto / no es dirección) | PASS |
| | Límite por IP visible | `› answers 429 with Retry-After once one IP has used its budget` | PASS |
| | Límite por email silencioso | `› stays silent per email: same 202, no extra message` | PASS |
| | XFF ignorado | `› is not evaded by X-Forwarded-For` + `client-ip.resolver.spec` | PASS |
| Verificación de un solo uso | Flujo feliz | `auth-verify.e2e › answers 204 with exactly the two session cookies` + `creates the user as RECRUITER…` | PASS |
| | Token reutilizado | `auth-verify.e2e › reused` (400, sin cookies) | PASS |
| | Token vencido | `› expired, but fine one second before` | PASS |
| | Desconocido o mal formado | `› unknown, malformed or missing` + `never answers 403 or 404…` | PASS |
| | Concurrentes | `› lets exactly one of two simultaneous requests through` + `redis-magic-link.int-spec` (20 → 1) | PASS |
| | company/name solo al verificar | `› applies company and name only when the link is verified` | PASS |
| | Usuario existente conserva datos | `› keeps the stored company when a later link brings none` + `typeorm-user.repository.int-spec` (COALESCE) | PASS |
| Rol | Reclutador por defecto | `auth-verify.e2e › creates the user as RECRUITER…` | PASS |
| | Administrador configurado | `› makes the configured email ADMIN whatever its case…` + `admin-policy.spec` | PASS |
| | Rol no se eleva por payload | `› ignores a role the visitor tries to send…` | PASS |
| Fallo cerrado de Redis | Redis caído en magic-link | `auth-magic-link.e2e › answers 503 when the rate limiter fails` | PASS |
| | Redis caído en verify | `auth-verify.e2e › answers 503 and sets no cookie when the link store fails` | PASS |

### api-session-tokens (24)

| Requisito | Escenario | Evidencia | Estado |
|-----------|-----------|-----------|--------|
| JWT RS256 + JWKS | Token verificable con el JWKS | `jwks.e2e › verifies a token issued by the app using only the published keys` (`alg`, `kid`, `exp-iat=900`) | **PARTIAL** (ver W1) |
| | JWKS sin material privado | `jwks.e2e › exposes no private key material` | PASS |
| | Algoritmo distinto rechazado | `me.e2e › alg none`, `HS256 signed with the public key as secret` | PASS |
| | Vencido o manipulado | `me.e2e › expired`, `tampered signature` | PASS |
| Cookies | Atributos de acceso | `auth-verify.e2e › answers 204 with exactly the two session cookies` (cadena exacta, sin `Domain`) | PASS |
| | Atributos de refresh | mismo test (`Path=/api/auth; Max-Age=604800`) | PASS |
| | Secure desactivable | `auth-verify.e2e › uses the unprefixed names and drops Secure` + `session-cookie.writer.spec` | PASS |
| Refresh rotativo | Refresh exitoso rota | `refresh.e2e › answers 204 with a new pair of cookies and spends the old token` | PASS |
| | Sin cookie | `refresh.e2e › without a cookie: 401 JSON…` | PASS |
| | Refresh vencido | `› past the 7 days of the family: 401…` | PASS |
| | Solo se persiste el hash | `refresh.e2e › stores only the hash…` + `typeorm-refresh-token.int-spec` (`bytea` de 32 bytes) | PASS |
| Reutilización | Fuera de la gracia revoca la familia | `› reuse after 10 s revokes the family…` | PASS |
| | Dentro de la gracia no revoca | `› reuse within 10 s: 401 without Set-Cookie, family intact…` (M1 lo rompe) | PASS |
| | Otra familia no se afecta | `› does not touch another session of the same user` | PASS |
| Logout | Con sesión | `refresh.e2e › logout › with a session: 204, both cookies cleared…` | PASS |
| | Sin sesión | `› no cookies at all: still 204…` | PASS |
| | Refresh desconocido | `› an unknown refresh token: still 204…` | PASS |
| Guards | Ruta protegida sin cookie | `me.e2e › answers 401 JSON without a session` | PASS |
| | Rutas públicas accesibles | `health.e2e`, `jwks.e2e › is public…` | PASS |
| | Rol insuficiente | `admin.e2e › answers 403 JSON for a RECRUITER` | PASS |
| Origin | POST sin Origin (`logout`) | `refresh.e2e › logout › POST without Origin or with a foreign Origin: 403…` | PASS |
| | Origin ajeno (`magic-link`) | `auth-magic-link.e2e › answers 403 for a foreign Origin` (sin correo) | PASS |
| | Origin permitido (`logout`) | `refresh.e2e › logout` (todas las filas usan `TEST_ORIGIN` → 204) | PASS |
| | GET sin Origin | `me.e2e › does not require an Origin header on GET` | PASS |

### api-recruiter-endpoints (15)

| Requisito | Escenario | Evidencia | Estado |
|-----------|-----------|-----------|--------|
| `/me` | Forma completa | `me.e2e › returns exactly the contract keys, uncached` | PASS |
| | Opcionales como null | `› serialises missing company and name as null…` | PASS |
| | Rol ADMIN | `› reflects the ADMIN role` + `auth-verify.e2e` (flujo real) | PASS |
| | Sin sesión | `› answers 401 JSON without a session` | PASS |
| | Seed sin valores personales | `typeorm-availability.int-spec › ships placeholders only…` (`[dato de ejemplo]`) | PASS |
| `/cv` | Respuesta válida | `cv.e2e › returns exactly url and expiresAt (clock + 300 s…)` | PASS |
| | Sin sesión | `› answers 401 JSON without a session, and never calls the signer` | PASS |
| | Enlace nuevo por petición | `› asks the signer on every request…` | PASS |
| `/admin/visits` | RECRUITER → 403 JSON | `admin.e2e › answers 403 JSON for a RECRUITER` | PASS |
| | ADMIN → `[]` | `› answers 200 with an empty list for an ADMIN` | PASS |
| | Sin sesión | `› answers 401 without a session` | PASS |
| Contenido (D3) | 404 con sesión | `admin.e2e › %s answers 404 JSON even with a valid session` | PASS |
| Swagger | Admin oculto | `› does not document any /api/v1/admin path` | PASS |
| | Sin secretos | `› contains no cookie values, tokens or key material` | PASS |
| Errores JSON | Sin filtraciones | `› 401, 403 and 404 are JSON without stack, paths or SQL` | PASS |

**Resumen**: 60/61 PASS, 1 PARTIAL, 0 FAIL, 0 UNTESTED.

### Por requisito

| Capacidad | Requisitos | Estado |
|-----------|-----------|--------|
| api-magic-link-login | 6/6 | Cumplidos |
| api-session-tokens | 7/7 | Cumplidos (el escenario JWKS↔cookie queda PARTIAL por la forma del test, no por el comportamiento) |
| api-recruiter-endpoints | 6/6 | Cumplidos |

## 5. Coherencia con el diseño y desvíos documentados

| Desvío (apply-progress) | Juicio |
|-------------------------|--------|
| `JwksProvider.jwks()` síncrono (export JWK con `node:crypto`) | Aceptable: es más simple y el contrato HTTP no cambia |
| Errores extra (`InvalidInput`, `Forbidden`, `Unauthenticated`, `RateLimited`) | Aceptable: el filtro mapea por `code`, probado en `domain-exception.filter.spec` |
| `CLIENT_IP_SOURCE` por defecto `cloudfront`; con `ssm` se rechaza `socket` y `COOKIE_SECURE=false` | Mejora: falla cerrado por defecto |
| Cola offline de Redis encendida (el diseño decía apagada) | Justificado con un RED ejecutado (`lazyConnect` + cola apagada rompe el primer comando). Sigue fallando cerrado: `maxRetriesPerRequest: 1`, `connectTimeout`, y los int-spec con Redis inaccesible dan `InfrastructureUnavailable` |
| Sin `EntitySchema` (`user`/`refresh-token`/`availability.schema.ts`) | Aceptable: SQL parametrizado y la tabla la define la migración. **El diseño no se actualizó** (ver W2) |
| `DATA_SOURCE` perezoso (se abre al primer uso) | Mejora: el arranque no depende de Postgres (`postgres-down.e2e`) |
| `GETDEL` antes de escribir en la base: si Postgres falla, 503 y el enlace queda gastado | Aceptable: falla cerrado; el usuario pide otro enlace |
| `rotate` en una sola sentencia + revocación por pasadas (hasta 5) | Correcto y probado contra Postgres real (40 intentos de carrera; M5 lo rompe). F2 propone la versión estructural |
| `refresh` sin cookie / desconocida / vencida limpia cookies | Coherente con el diseño §11; la spec solo exige 401 |
| Índice extra en `refresh_tokens(user_id)` | Aceptable |
| Fila de `availability` ausente → 503 | Razonable (la spec no lo cubre); registrado en el diseño §17 |
| `CV_LINK_TTL_SECONDS` 1–3600; `ssm` rechaza el signer `fake` | Mejora |
| Binding de 9.2 en `availability.module.ts` (no en `identity.module.ts`) | Aceptable: es el módulo dueño del puerto |
| ADR-012 en estado "Propuesta" | Correcto: la infraestructura no existe todavía |

Decisiones de la usuaria: la gracia de 10 s (A9) está implementada y probada a ambos lados del borde. El 403 por falta de `CloudFront-Viewer-Address` en prod está implementado en `magic-link`, `verify` y `refresh` (`logout` no lleva contador y no lo exige; tiene test).

## 6. Contrato con el frontend (`apps/web/src/lib/api/http.ts`, `types.ts`, `errors.ts`)

| Punto del cliente | API | Estado |
|-------------------|-----|--------|
| `requestMagicLink` → `POST /api/auth/magic-link` `{email, company?, name?}`, cualquier 2xx | 202 `{"status":"accepted"}` idéntico | ✅ |
| `verifyToken` → `POST /api/auth/verify` `{token}`; 400/401/410 → `invalid-token` | 204 + cookies; 400 para todo token inválido; nunca 403/404 | ✅ |
| `getMe` / `isMe` (`email`, `role` RECRUITER/ADMIN, `company`/`name` string\|null, `availability.{modality,start,salary}` string) | Claves exactas, `null` explícito | ✅ |
| `getCvLink` / `isCvLink` (`url`, `expiresAt` string) | `{url, expiresAt}` ISO UTC | ✅ |
| 401 fuera de `/api/auth/*` → un `POST /api/auth/refresh` sin cuerpo y un reintento | Refresh lee la cookie `Path=/api/auth`, responde 204 o 401; 429 → `rate-limited`; 5xx → `server` | ✅ |
| `logout` → `POST /api/auth/logout` | 204 siempre + cookies limpiadas | ✅ |
| `credentials: 'same-origin'`; el navegador envía `Origin` en POST | `OriginGuard` exige `Origin` exacto en POST | ✅ (depende de `ALLOWED_ORIGINS` en el deploy) |
| Playground: `/profile`, `/experience?limit=2`, `/skills?level=advanced` → 404; `/admin/visits` → 403/200 | Igual | ✅ |
| `verify` con 403 (Origin o viewer address) → `unexpected` en la UI | Es el seguimiento ya previsto en la propuesta (mensajes de error detallados en el frontend) | Informativo |

## 7. Seguridad

- `scan-secrets.sh` exit 0; gitleaks sin hallazgos.
- No hay `.env`, `*.pem` ni `.keys/` trackeados; `apps/api/.keys/` no existe en disco; `.env*` y `apps/api/.keys/` están en `.gitignore`.
- Emails: solo `*.example.test`, `example.org` y `a@b.co` (fixtures de parsing). No hay emails reales; `ADMIN_EMAIL=admin@example.test`.
- No hay ARNs, IDs de cuenta de 12 dígitos ni PEM en `apps/api` ni en `.env.example`. El bucket y la clave del CV están comentados como placeholders.
- El seed de `availability` es `[dato de ejemplo]`; no hay valores de renta en el repo.
- Los logs de fallos de correo, logout y CV no incluyen email, token, host ni URL (está asertado en los tests).

## 8. Hallazgos

### CRITICAL
Ninguno.

### WARNING
1. **W1 – Escenario JWKS↔cookie PARTIAL.** `jwks.e2e` verifica un token emitido con `ACCESS_TOKEN_ISSUER` directamente, no el `__Host-access` que fija `POST /api/auth/verify`. El comportamiento está cubierto de forma compuesta (el mismo binding firma la cookie y `/me` la acepta), pero falta un test que tome la cookie de `verify` y la valide solo con `GET /api/.well-known/jwks.json`.
2. **W2 – El diseño quedó desalineado con el código.** `design.md` §2 todavía lista `user.schema.ts`, `refresh-token.schema.ts` y `availability.schema.ts`, y §3 A2 dice `EntitySchema`. §7 dice `enableOfflineQueue: false`. La secuencia de §12 dice `GETDEL … null ⇒ 401`, mientras que la spec, §11 y el código usan 400. Conviene corregirlo antes de archivar, o al hacerlo.
3. **W3 – Algunos RED no se observaron.** Declarado con transparencia en `apply-progress`: correcciones PR1 #5 y #6 (RED solo por compilación, sin ejecutar), filas e2e de la corrección PR2 #1 (escritas junto con el fix) y el e2e de regresión `postgres-down` (escrito después del fix). No bloquea: el comportamiento tiene tests unitarios con RED ejecutado.
4. **W4 – Checklist CIERRE (C1–C3) sin marcar en `tasks.md`.** `apply-progress` no registra una revisión de contexto fresco de PR4 (las de PR1–PR3 sí constan, con sus correcciones). Los gates de C2/C3 quedan cubiertos por esta verificación.
5. **W5 – Aserciones solo de tipo.** Hay 5 `resolves.toBeDefined()` sin valor: `verify-magic-link.use-case.spec.ts` L248, L302, L309 y `ssm-secrets.provider.spec.ts` L109, L143. Prueban que la promesa no rechaza (y cada una tiene un test o una fila de rechazo como compañero), pero conviene asertar el valor resuelto (por ejemplo, `refreshToken` con forma de 43 caracteres, o la URL cargada).

### SUGGESTION
1. **S1** – En `auth/domain/rate-limit-key.ts` las ramas quedan al 60 % (L28, L40-41: valores por defecto inalcanzables). Se pueden simplificar o cubrir con IPv6 de cola punteada sin octetos completos.
2. **S2** – El comentario de `admin.e2e-spec.ts` L11 ("There is no mutating route yet") quedó obsoleto desde PR2. Ahora `ProbeController` solo hace falta para el caso 401 con un Origin válido.
3. **S3** – Agregar `integration` como check requerido en el ruleset de GitHub (hoy solo `quality` y `secrets`). Requiere a la usuaria.
4. **S4** – La normalización del email ADMIN configurado solo se prueba a nivel unitario (M6 sobrevive en e2e porque la config de test ya viene en minúsculas). Se puede agregar una fila e2e con `ADMIN_EMAIL` en mayúsculas y con espacios.
5. **S5** – Informativo: el límite silencioso por email permite suprimir los enlaces de un email conocido durante la ventana (riesgo aceptado en el diseño §17).
6. **S6** – Informativo: si Postgres falla después de `GETDEL`, el enlace queda gastado (diseño de falla cerrada; el usuario debe pedir otro).

### Seguimientos fuera de alcance (no son fallos)
- F1: limpieza programada de `refresh_tokens` vencidos o revocados.
- F2: tabla `refresh_families` para reemplazar la revocación por pasadas.
- F3: chequeo de deploy que falle si `availability` sigue con `[dato de ejemplo]`.
- Frontend: mostrar al usuario qué error devuelve la API (403, etc.) y por qué.

## 9. Veredicto

**PASS WITH WARNINGS.** Los 10 gates están en verde (667 tests en tres capas, cobertura del dominio y la aplicación al 100 % de líneas y 94 % de ramas). 60/61 escenarios tienen un test en verde que los cubre completos y 1 está PARTIAL. No hay CRITICAL y el contrato con el frontend se cumple. Los WARNING son de documentación y de proceso y no bloquean el archivo: se recomienda corregir W2 (diseño) durante `sdd-archive`.

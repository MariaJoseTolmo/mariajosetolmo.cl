# Exploración: auth-backend

**Proyecto**: web_cv · **Cambio**: `auth-backend` · **Fecha**: 2026-10-21
**Espejo en Engram**: `sdd/auth-backend/explore` (#694)

## 1. Estado actual

- `apps/api` solo tiene la porción hexagonal `health`. `AppModule` importa únicamente `HealthModule`.
- `configureApp` fija el prefijo `api` y Swagger en `api/docs`. Un comentario indica que las rutas `/admin` deben excluirse de la documentación "con el cambio de auth".
- Dependencias actuales: Nest 12.2, swagger, rxjs, jest/supertest. No hay typeorm, ioredis, jose, aws-sdk ni cookie-parser.
- Límites de ESLint: `domain` no puede importar `@nestjs/*`, express, typeorm, ioredis, kafkajs, reflect-metadata ni `@aws-sdk/*`. `application` solo puede usar `Injectable` e `Inject`. Controladores, guards, cookies y adaptadores viven en `infrastructure`.
- La cobertura de Jest abarca solo `domain` y `application` (umbral 80 %). Los e2e usan `Test.createTestingModule` con `overrideProvider` y `configureApp` (`test/health.e2e-spec.ts`). Ese es el patrón para simular los puertos de correo, Redis y reloj.
- docker-compose tiene Postgres 18.6, Redis 8.10.2, Kafka y Mailpit (1025/8025). `.env.example` no tiene URL de Redis, JWT ni SMTP.
- `infra-spike/results.md` está vacío. Q1 (POST con OAC), Q2 (varios `Set-Cookie`) y Q3 (`CloudFront-Viewer-Address`) no están verificados, y ADR-009 sigue "Proposed". El diseño de cookies y del rate limit depende de ellos.
- El texto de la UI ya promete lo siguiente, y el backend debe cumplirlo:
  - el token dura 15 minutos y sirve una sola vez;
  - en Redis solo se guarda el hash del token;
  - hay rate limit por IP y por email;
  - la sesión dura 7 días;
  - el JWT es RS256.

## 2. Contrato de red extraído de `apps/web/src/lib/api`

| Llamada | Petición | Éxito que acepta el cliente | Fallos en el cliente |
|---|---|---|---|
| `requestMagicLink` | `POST /api/auth/magic-link`, JSON `{email, company?, name?}`. Los opcionales vacíos se omiten. | Cualquier 2xx; el cuerpo no se lee. Usar 202 con cuerpo idéntico. | 429 → `rate-limited`. Cualquier otro error, salvo red, muestra la misma UI de "enviado". |
| `verifyToken` | `POST /api/auth/verify`, `{token}`. Solo tras confirmar. | 2xx; el cuerpo se ignora. Debe fijar las cookies de sesión. | 400/401/410 → `invalid-token`; 429 → `rate-limited`; 5xx → `server` |
| `getMe` | `GET /api/v1/me` | 200 JSON validado estrictamente | 401 → un refresh y un reintento; 403 → `forbidden` |
| refresh (interno) | `POST /api/auth/refresh`, sin cuerpo, solo cookie | 2xx | 429 → `rate-limited`; 5xx → `server`; resto → `unauthorized` |
| `getCvLink` | `GET /api/v1/cv` | 200 `{url: string, expiresAt: string}` | Igual que los demás GET |
| `logout` | `POST /api/auth/logout` | 2xx; el cliente navega a `/` | — |
| `call` (playground) | `GET` sobre 5 rutas fijas | Cualquier código HTTP cuenta como `ok` y el cuerpo se muestra tal cual | 401 → `unauthorized` tras un refresh |

**Forma de `Me`:**
- `{email, role: 'RECRUITER'|'ADMIN', company: string|null, name: string|null, availability: {modality, start, salary}}`.
- Un campo con tipo incorrecto da `unexpected`.
- `company` y `name` deben venir como `null`, no ausentes.

**Rutas del playground:**
- Son `/api/v1/profile`, `/api/v1/experience?limit=2`, `/api/v1/skills?level=advanced`, `/api/v1/me` y `/api/v1/admin/visits`.
- Un RECRUITER debe recibir un 403 real en `/api/v1/admin/visits`, con cuerpo JSON.

**Detalles de la petición:**
- `credentials: 'same-origin'`, `cache: 'no-store'` y timeout de 15 s.
- El navegador envía `Origin` en los POST, así que se puede validar `Origin`.

**Rutas `/api/auth/*`:**
- Nunca disparan refresh, así que no deben usar 401 para resultados normales.
- `logout` responde 204 aunque la sesión haya vencido.
- `verify` usa 400/401/410 y nunca 403.

**Enlace del correo:**
- Es `https://mariajosetolmo.cl/acceso/verificar/#token=<token>`.
- El fragmento nunca llega al servidor.
- El token va en base64url.

## 3. Áreas afectadas

- **Porciones nuevas** en `apps/api/src/`: `auth/`, `identity/`, `availability/`, `cv/`, `shared/` (reloj, ids) y `config/`.
- **`app.module.ts`**: los módulos nuevos y un guard global.
- **`bootstrap/configure-app.ts`**:
  - `cookie-parser`;
  - el guard de `Origin`;
  - la exclusión de `/admin` en Swagger.
- **`apps/api/package.json`**: las dependencias nuevas.
- **`docker-compose.yml` y `.env.example`**:
  - la URL de Redis, la ruta de la clave JWT de desarrollo y el host SMTP;
  - las claves privadas de desarrollo no se commitean.
- **`eslint.config.mjs`**: agregar `jose` y `nodemailer` a `frameworkLibs`.
- **`apps/web/docs/delivery-contract.md`** (solo lectura): CloudFront debe reenviar las cookies y `Origin` en `/api/*`.

## 4. Alternativas

### 4.1 Dónde viven tokens y sesiones

| Opción | Ventajas | Desventajas |
|---|---|---|
| A. Todo en Redis | Un solo almacén, TTL nativo, `GETDEL` atómico | Un desalojo o una pérdida cierra todas las sesiones. Sin auditoría durable. Cuota de Upstash: 500K comandos/mes. |
| B. Todo en Postgres | Durable, transaccional, auditable | Arranque en frío de Neon en el login. Contradice ADR-005 y el texto de la UI. Necesita una tarea de limpieza. |
| **C. Híbrido (recomendado)** | Hash del magic link y rate limit en Redis. Usuarios y familias de refresh en Postgres. El JWT de acceso no guarda estado. | Hay que simular dos almacenes en los tests |

**Cómo funciona el refresh en la opción C:**
- **Filas**: cada fila de refresh guarda familia, hash, `used_at`, `expires_at` y `revoked_at`.
- **Detección de reutilización**: si se presenta un hash ya usado o revocado, se revoca la familia entera y se responde 401.
- **Logout**: revoca la familia. El JWT de acceso sigue válido hasta 15 minutos; esto es aceptable y queda documentado.

### 4.2 Librería JWT

| Opción | Ventajas | Desventajas |
|---|---|---|
| **`jose` (recomendado)** | RS256 y `exportJWK` (JWKS trivial). Sin acoplamiento a Nest; va detrás de un puerto `TokenSigner`. | Hay que verificar la carga ESM/CJS en Jest |
| `@nestjs/jwt` | Conocida | Sin JWKS. Acopla la firma a Nest. Compatibilidad con Nest 12 sin verificar. |

- El JWT lleva `kid` y la clave pública se publica en `GET /api/.well-known/jwks.json`.
- La rotación de claves es manual (ADR-008), así que JWKS debe poder servir dos claves.

### 4.3 Acceso a datos

- TypeORM ya está decidido (brief y ADR-004).
- **NO VERIFICADO**: el comportamiento con el pooler de Neon en modo transacción. Evitar estado de sesión, `SET` y advisory locks.
- Las migraciones usan la URL directa.

### 4.4 Cliente Redis

| Opción | Ventajas | Desventajas |
|---|---|---|
| **`ioredis` (recomendado)** | Ya está en `frameworkLibs`. Mismo código en local y en Upstash con TLS. | Una conexión TCP por entorno Lambda; latencia sin medir |
| `@upstash/redis` (REST) | Sin estado, apto para Lambda | No funciona contra el Redis local sin un adaptador intermedio |

- Va detrás de los puertos `TokenStore` y `RateLimiter`.
- `GETDEL` garantiza el uso único del token.
- La ventana del rate limit usa `INCR` + `EXPIRE`.

### 4.5 Envío de correo

| Opción | Ventajas | Desventajas |
|---|---|---|
| **Síncrono vía puerto `MailSender` (recomendado)** | Una sola función. e2e simple contra Mailpit. | Suma la latencia de SES (~100–300 ms) |
| Encolar vía `EventPublisher` y SQS | Muestra el puerto en acción | Requiere un Lambda consumidor, infra extra y un consumidor Kafka local. ADR-006 lo deja para cambios posteriores. |

- No enviar el correo después de responder, porque Lambda puede congelar el entorno.
- Si el envío falla, responder igual 202 y registrar el error.

### 4.6 Token del magic link y cookies

**Token:**
- Son 32 bytes aleatorios en base64url. Redis guarda `sha256(token)` con un TTL de 900 s.
- El payload en Redis es `{email, company?, name?}`. `company` y `name` se aplican al usuario solo al verificar con éxito; si no, cualquiera podría cambiarlos en nombre de otro.

**Cookies:**

| Cookie | Atributos | Duración |
|---|---|---|
| `__Host-access` | `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict` | 15 min |
| `__Secure-refresh` | `Path=/api/auth` | 7 días |

- La de refresh no usa `__Host-` porque ese prefijo exige `Path=/`.
- `Secure` es configurable por entorno y está activo por defecto. Safari no lo acepta en localhost por HTTP.

**Guard de `Origin`:**
- Es global para POST, PUT, PATCH y DELETE.
- Compara contra una lista permitida que viene de la configuración.
- Si `Origin` falta o no coincide, responde 403.

## 5. Recomendación

Persistencia híbrida (Postgres + Redis), `jose`, `ioredis`, TypeORM, `MailSender` síncrono y un puerto `TokenSigner`.

**Capas hexagonales:**

| Capa | Contenido |
|---|---|
| `domain` | `MagicLinkToken`, `RefreshFamily`, `Role`, reglas de TTL |
| `application` | Casos de uso `RequestMagicLink`, `VerifyMagicLink`, `RefreshSession`, `Logout`, `GetMe`, `GetCvLink` |
| Puertos | `TokenStore`, `RateLimiter`, `MailSender`, `TokenSigner`, `UserRepository`, `RefreshTokenRepository`, `Clock`, `CvLinkSigner`, `AvailabilityRepository` |
| `infrastructure` | Controladores, guards (`JwtAuthGuard`, `RolesGuard`, `OriginGuard`), cookies y los adaptadores de Redis, TypeORM, SES/SMTP y S3 |

**Antienumeración:**
- Supone registro abierto (ver pregunta 1).
- Todo email válido recibe la misma respuesta 202 y dispara el mismo trabajo.
- Un formato inválido devuelve 400.
- El límite por email responde 202 en silencio; el límite por IP responde 429 visible.

**IP para el rate limit:**
- Se toma de `CloudFront-Viewer-Address`, nunca de `X-Forwarded-For`.
- La dirección del socket solo se usa en local y en tests.
- Depende de Q3.

**Disponibilidad:**
- Vive en una tabla `availability`, con valores de ejemplo en local.
- Los valores reales se cargan fuera del repo.

**Enlace al CV:**
- Puerto `CvLinkSigner`.
- En producción, una URL prefirmada de S3 privado (unos 5 min) con `expiresAt` en ISO.
- En local, una URL falsa.
- El frontend la abre navegando, así que la CSP `connect-src 'self'` no la bloquea.

**Admin:**
- `RolesGuard` con `@Roles('ADMIN')`.
- `GET /api/v1/admin/visits` es un stub mínimo, con e2e que verifica el 403 para un RECRUITER.
- Queda oculto en Swagger.

**Secretos:**
- Un puerto `SecretsProvider`, con SSM en producción y variables de entorno en local y test.
- Las claves de test se generan en el setup.

## 6. Corte sugerido en PRs (stacked-to-main)

1. **Fundaciones (~450–550 líneas)**:
   - config, `Clock`, `TokenSigner` con JWKS;
   - los guards JWT, de roles y de `Origin`, y las cookies;
   - `GET /api/v1/me` con un usuario en memoria;
   - el test del 403 en `/admin/visits`.
2. **Magic link (~500–600 líneas)**:
   - `TokenStore` y `RateLimiter` sobre Redis, `MailSender`;
   - los casos de uso `RequestMagicLink` y `VerifyMagicLink`;
   - la migración y el repositorio `users`.
3. **Sesiones (~400–500 líneas)**: la migración `refresh_tokens`, `RefreshSession` con detección de reutilización, y `Logout`.
4. **Endpoints de datos (~350–450 líneas)**: disponibilidad, enlace al CV y, si entran en el alcance, los endpoints de contenido.

El total estimado es de 1800 a 2400 líneas con tests. Supera el presupuesto de 400 líneas, así que se recomiendan PRs encadenados.

## 7. Preguntas abiertas

1. ¿Quién puede ingresar? ¿Cualquier email válido (registro abierto) o solo una lista permitida?
2. ¿Cómo se define ADMIN? Opciones: un email en config/SSM, o una actualización manual en la base de datos.
3. ¿Qué devuelven `/api/v1/profile`, `/experience` y `/skills`, y entran en este cambio? ¿Qué devuelve `/admin/visits` para ADMIN?
4. ¿Se confirma el refresh en Postgres (persistencia híbrida)?
5. ¿El correo se envía síncrono, o vía SQS en un cambio posterior?

## 8. Riesgos

- **Supuestos de plataforma sin verificar**: Q1, Q2 y Q3, y ADR-009 sigue "Proposed". Mitigación: aislar la extracción de IP y la escritura de cookies en adaptadores pequeños.
- **TypeORM con el pooler de Neon** en modo transacción: NO VERIFICADO.
- **Lambda**: las conexiones a Redis pueden ser lentas en un arranque en frío. Mitigación: fallar cerrado en magic-link y verify, respondiendo 503, que el cliente muestra como `server`.
- **Canal lateral de tiempo** entre emails válidos e inválidos. Se mitiga haciendo el mismo trabajo para todo email válido.
- **Abuso de correo**:
  - mitigación: límites por email y por IP;
  - el sandbox de SES (200 correos al día, solo destinatarios verificados) bloquea a reclutadores reales hasta pedir acceso a producción;
  - pedir ese acceso tarda unas 96 h y es una dependencia externa a este cambio.
- **Pruebas locales en navegador**: `next export` no tiene rewrites. Probar el frontend en modo `http` contra la API local requiere un proxy inverso que todavía no existe.
- **Carga de `jose`** (ESM/CJS) en Jest con el flag experimental: hay que probarla antes de comprometerse.
- **ADR posible**: S3 como almacén del CV es nuevo en el stack. Revisar si la regla del brief exige un ADR.
- **Contenido**: no se commitean salario, disponibilidad ni archivos del CV. Los seeds usan valores de ejemplo.
- **Swagger**: debe excluir `/admin` y no exponer ejemplos de cookies ni de secretos.

## 9. Listo para propuesta

Sí, una vez respondidas las preguntas 1 a 3. Las preguntas 4 y 5 tienen valores por defecto y se pueden confirmar en la propuesta.

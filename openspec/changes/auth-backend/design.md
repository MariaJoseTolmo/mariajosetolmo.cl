# Diseño: Auth Backend — magic link, sesión JWT RS256 y endpoints del reclutador

> Fecha: 2026-10-21. Base: `proposal.md` (D1–D4 vinculantes) y `exploration.md` de este cambio, `docs/brief.md`, ADR-004/005/007/008/009/011 (`stack-adrs`) y el contrato del cliente en `apps/web/src/lib/api/{http,errors,types}.ts`.
> Nota de tamaño: supera el presupuesto de 800 palabras porque el orquestador pidió cubrir 17 temas concretos (esquema, Redis, cookies, guards, errores, tests, ADR). Todo está en tablas para poder revisarlo rápido.
> Las specs (`sdd-spec`) se escriben en paralelo. Si una spec contradice este diseño, se reconcilia antes de `sdd-tasks`.

## 1. Resumen

| Tema | Decisión |
|------|----------|
| Arquitectura | Igual que `health`: una porción hexagonal por capacidad (`domain` / `application` / `infrastructure` + `*.module.ts`). Porciones nuevas: `auth`, `identity`, `availability`, `cv`, `admin`, `shared` y `config`. |
| Persistencia | Híbrida (D4). Redis guarda el hash del magic link y los contadores de rate limit. Postgres guarda `users`, `refresh_tokens` y `availability`. El JWT de acceso no guarda estado. |
| Atomicidad | Una sola sentencia SQL por operación crítica (`INSERT … ON CONFLICT`, `UPDATE … RETURNING`, CTE). No hay transacciones explícitas, `SET` ni advisory locks, así que es seguro con el pooler de Neon. En Redis: `GETDEL` y `SET NX EX` + `INCR`. |
| Dependencias nuevas | `jose`, `ioredis`, `typeorm`, `pg`, `cookie-parser`, `nodemailer`, `@aws-sdk/client-sesv2`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-ssm`. Se rechazan `@nestjs/typeorm`, `@nestjs/jwt`, `@nestjs/config`, `@nestjs/throttler` y `class-validator` (§3). |
| Seguridad | Guards globales en este orden: `OriginGuard` → `JwtAuthGuard` (deniega por defecto; `@Public()` para excluir) → `RolesGuard`. La IP sale solo de `ClientIpResolver` y las cookies solo de `SessionCookieWriter`. Son los dos puntos de ajuste si fallan Q2/Q3. |
| Tests | Unitarios con fakes (`domain`/`application`, ≥ 80 %). e2e con supertest y `overrideProvider` (sin Docker). **Integración nueva** (`*.int-spec.ts`) contra Redis y Postgres reales: docker-compose en local y *service containers* en un job nuevo de CI. |
| ADR | Solo uno nuevo es obligatorio: **ADR-012, S3 privado con URL prefirmada para el CV** (§13). |

## 2. Árbol de archivos

```
apps/api/src/
├── app.module.ts                       # importa las porciones; registra los guards globales en orden
├── bootstrap/configure-app.ts          # cookie-parser, filtro de excepciones, Swagger sin /admin
├── config/
│   ├── app-config.ts                   # loadConfig(env): AppConfig (pura, falla rápido) + tipos
│   ├── secrets.port.ts                 # SecretsProvider + SECRETS_PROVIDER
│   ├── env-secrets.provider.ts         # local/test: lee env y JWT_PRIVATE_KEY_FILE
│   ├── ssm-secrets.provider.ts         # prod: GetParameters(WithDecryption) una vez por entorno
│   └── config.module.ts                # @Global: APP_CONFIG y APP_SECRETS (factory async)
├── shared/
│   ├── domain/ hash.ts (sha256Hex)  errors.ts (DomainError, InfrastructureUnavailable)
│   ├── application/ports/ clock.port.ts  random-source.port.ts  id-generator.port.ts
│   └── infrastructure/
│       ├── system-clock.ts  crypto-random.source.ts  crypto-id.generator.ts
│       ├── http/ public.decorator.ts  roles.decorator.ts  principal.decorator.ts  domain-exception.filter.ts
│       ├── persistence/ data-source.factory.ts  data-source.cli.ts  migrations/{1700…-users,-refresh-tokens,-availability}.ts
│       ├── redis/ redis-client.factory.ts
│       └── shared.module.ts            # @Global: Clock, RandomSource, IdGenerator, DATA_SOURCE, REDIS_CLIENT
├── auth/
│   ├── domain/ session-policy.ts  magic-link-token.ts  refresh-token.ts  auth-errors.ts
│   ├── application/
│   │   ├── ports/ magic-link-store.port.ts  rate-limiter.port.ts  mail-sender.port.ts
│   │   │          access-token.port.ts  refresh-token-repository.port.ts
│   │   └── request-magic-link / verify-magic-link / refresh-session / logout .use-case.ts (+ .spec.ts)
│   ├── infrastructure/
│   │   ├── http/ auth.controller.ts  jwks.controller.ts  dto/*.ts  session-cookie.writer.ts  client-ip.resolver.ts
│   │   │         guards/ origin.guard.ts  jwt-auth.guard.ts  roles.guard.ts
│   │   ├── redis/ redis-magic-link.store.ts  redis-rate-limiter.ts
│   │   ├── jose/ jose-access-token.service.ts
│   │   ├── mail/ smtp-mail.sender.ts  ses-mail.sender.ts  magic-link-email.ts (plantilla)
│   │   └── persistence/ refresh-token.schema.ts  typeorm-refresh-token.repository.ts
│   └── auth.module.ts
├── identity/
│   ├── domain/ email.ts  role.ts  user.ts  admin-policy.ts
│   ├── application/ ports/user-repository.port.ts  get-me.use-case.ts
│   ├── infrastructure/ http/{me.controller.ts, me-response.dto.ts}  persistence/{user.schema.ts, typeorm-user.repository.ts}
│   └── identity.module.ts              # exporta USER_REPOSITORY
├── availability/ domain/availability.ts  application/ports/availability-repository.port.ts
│                 infrastructure/persistence/{availability.schema.ts, typeorm-availability.repository.ts}  availability.module.ts
├── cv/ application/{ports/cv-link-signer.port.ts, get-cv-link.use-case.ts}
│       infrastructure/{http/cv.controller.ts, s3-cv-link.signer.ts, fake-cv-link.signer.ts}  cv.module.ts
└── admin/ application/list-visits.use-case.ts  infrastructure/http/admin-visits.controller.ts  admin.module.ts
apps/api/test/
├── setup-env.ts                        # env de placeholders para e2e
├── support/ test-app.ts (createTestApp + overrides)  fakes/*.ts  keys.ts (generateKeyPairSync en memoria)
├── *.e2e-spec.ts                       # health, docs, auth, me, refresh, admin, cv
├── jest-int.config.js                  # testRegex \.int-spec\.ts$
└── integration/ redis-*.int-spec.ts  typeorm-*.int-spec.ts  migrations.int-spec.ts
apps/api/scripts/dev-keys.js            # genera apps/api/.keys/ (gitignored) para desarrollo local
```

**Dirección entre porciones:** `auth` → `identity` (`USER_REPOSITORY`); `identity` → `availability` (puerto). Los decoradores (`@Public`, `@Roles`, `@CurrentPrincipal`) son metadatos sin DI en `shared/infrastructure/http`, así que `identity` no importa `auth`. No hay ciclos.

## 3. Decisiones de arquitectura

| # | Opción elegida | Alternativas | Motivo |
|---|----------------|--------------|--------|
| A1 | `DataSource` de `typeorm` creado por una factory propia (`DATA_SOURCE`) | `@nestjs/typeorm` | Compatibilidad con Nest 12 sin verificar. Además, un token propio se reemplaza en e2e con un solo `overrideProvider`. |
| A2 | `EntitySchema` en `infrastructure` y SQL parametrizado (`dataSource.query`) para las sentencias atómicas | Entidades con decoradores | El dominio queda sin decoradores de TypeORM y las operaciones críticas son una sola sentencia, sin transacción ni estado de sesión. |
| A3 | Validación en los value objects del dominio (`Email.parse`, `MagicLinkToken.parse`); los DTO solo sirven para Swagger | `ValidationPipe` + `class-validator` | Las reglas viven en el dominio y se testean sin Nest. Una dependencia menos. |
| A4 | Rate limit propio (puerto `RateLimiter`, adaptador Redis) | `@nestjs/throttler` | Hace falta una clave por email con respuesta silenciosa y la IP de `ClientIpResolver`. El throttler no cubre ninguna de las dos cosas sin forzarlo. |
| A5 | `jose` detrás de `AccessTokenIssuer`/`AccessTokenVerifier` | `@nestjs/jwt`, JWS a mano con `node:crypto` | JWKS con `exportJWK`, `kid` y `currentDate` inyectable (`Clock`). El plan B es `node:crypto` (§12). |
| A6 | `loadConfig(env)` pura + `SecretsProvider` | `@nestjs/config` | Configuración tipada, validada y testeable. Los secretos se separan de la configuración (ADR-008). |
| A7 | Guards globales con `APP_GUARD`, en orden fijo y con denegación por defecto | Guards por controlador | Una ruta nueva nace protegida. Un olvido produce un 401, nunca una fuga. |
| A8 | Refresh de vencimiento **absoluto** (7 días desde `verify`); la rotación conserva `expires_at` | Ventana deslizante | La UI promete una sesión de 7 días. Así una cookie robada no puede extender la sesión para siempre. |
| A9 | Gracia de reutilización de 10 s: si el token se usó hace ≤ 10 s, responde 401 **sin** revocar la familia | Revocar siempre | Dos pestañas que refrescan a la vez no deben cerrar la sesión válida. El riesgo es una ventana de 10 s, documentada. |
| A10 | Tests de integración reales y un job de CI `integration` con *service containers* | `pg-mem`, Testcontainers | `pg-mem` no es Postgres (no tiene `ON CONFLICT … RETURNING` fiel ni CTE). Testcontainers sería tecnología nueva. Los *service containers* usan las mismas imágenes que docker-compose. |

## 4. Puertos y casos de uso

```ts
// shared/application/ports
interface Clock { now(): Date }
interface RandomSource { bytes(length: number): Uint8Array }
interface IdGenerator { uuid(): string }

// auth/application/ports
interface MagicLinkStore {                          // Redis
  save(tokenHash: string, payload: MagicLinkPayload, ttlSeconds: number): Promise<void>;
  consume(tokenHash: string): Promise<MagicLinkPayload | null>;   // GETDEL
}
interface RateLimiter { hit(key: RateLimitKey): Promise<{ allowed: boolean; retryAfterSeconds: number }> }
interface MailSender { sendMagicLink(to: Email, link: string): Promise<void> }
interface AccessTokenIssuer { issue(claims: { sub: string; role: Role }, now: Date): Promise<string> }
interface AccessTokenVerifier { verify(jwt: string, now: Date): Promise<Principal | null> }
interface JwksProvider { jwks(): Promise<{ keys: JsonWebKey[] }> }
interface RefreshTokenRepository {
  create(row: NewRefreshToken): Promise<void>;
  rotate(oldHash: string, newHash: string, now: Date): Promise<ConsumedRefresh | null>;  // una sola sentencia: UPDATE … RETURNING + INSERT
  findByHash(tokenHash: string): Promise<RefreshTokenState | null>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeFamilyOf(tokenHash: string, now: Date): Promise<void>;
}

// identity / availability / cv
interface UserRepository {
  upsertOnLogin(u: { email: Email; role: Role; company: string | null; name: string | null }, now: Date): Promise<User>;
  findById(id: string): Promise<User | null>;
}
interface AvailabilityRepository { get(): Promise<Availability> }
interface CvLinkSigner { sign(now: Date): Promise<{ url: string; expiresAt: Date }> }
```

| Caso de uso | Entrada → salida | Puertos |
|-------------|------------------|---------|
| `RequestMagicLink` | `{email, company?, name?, ip}` → `void` (el controlador siempre responde 202) | RateLimiter, RandomSource, MagicLinkStore, MailSender, Clock |
| `VerifyMagicLink` | `{token, ip}` → `{accessJwt, refreshToken, refreshExpiresAt}` | RateLimiter, MagicLinkStore, UserRepository, RefreshTokenRepository, AccessTokenIssuer, IdGenerator, RandomSource, Clock + `adminEmail` |
| `RefreshSession` | `{refreshToken?, ip}` → igual que `verify` | RateLimiter, RefreshTokenRepository, UserRepository, AccessTokenIssuer, RandomSource, Clock |
| `Logout` | `{refreshToken?}` → `void` (nunca falla hacia afuera) | RefreshTokenRepository, Clock |
| `GetMe` | `Principal` → `Me` | UserRepository, AvailabilityRepository |
| `GetCvLink` | — → `{url, expiresAt}` | CvLinkSigner, Clock |
| `ListVisits` | — → `[]` (stub) | — |

## 5. Reglas de dominio

| Regla | Valor |
|-------|-------|
| `SessionPolicy` | `MAGIC_LINK_TTL = 900 s`; `ACCESS_TTL = 900 s`; `SESSION_TTL = 7 d` (absoluta); `REUSE_GRACE = 10 s`. Constantes del dominio, no configurables. |
| Token del magic link | 32 bytes de `RandomSource` en base64url sin relleno (43 caracteres, `^[A-Za-z0-9_-]{43}$`). Se guarda `sha256Hex(token)`. Un formato inválido da `MalformedToken` (400). |
| Refresh token | Mismo formato, opaco. En la base solo queda `sha256` (`bytea`, 32 bytes). |
| `Email` | `trim` + minúsculas, ≤ 254 caracteres, regex pragmática `local@dominio.tld`. Se rechazan los caracteres de control. |
| `company` / `name` | Opcionales. Llevan `trim`, ≤ 120 caracteres y sin caracteres de control. Una cadena vacía cuenta como ausente. Se aplican al usuario **solo al verificar** (D1). |
| `AdminPolicy.roleFor(email, adminEmail)` | `ADMIN` si coincide tras normalizar; si no, `RECRUITER`. Se recalcula en cada `verify` (D2): si cambia el email de config, el anterior pierde el rol en su próximo login. |
| Claims del JWT | `iss` = `https://mariajosetolmo.cl` (config), `aud` = `web_cv-api`, `sub` = id del usuario, `role`, `iat`, `exp` = `iat + 900`. Cabecera `alg: RS256` y `kid`. **Sin email** (dato personal): `/me` lo lee de la base. Tolerancia de reloj: 5 s. |
| Antienumeración | `RequestMagicLink` **nunca lee `users`**: todo email válido hace el mismo trabajo (límite, token, Redis, correo). No hay canal lateral sobre si la cuenta existe. |

## 6. Esquema Postgres (migraciones TypeORM con `up`/`down`)

| Tabla | Columnas | Restricciones e índices |
|-------|----------|-------------------------|
| `users` | `id uuid PK DEFAULT gen_random_uuid()`, `email text NOT NULL`, `role text NOT NULL DEFAULT 'RECRUITER'`, `company text NULL`, `name text NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `last_login_at timestamptz NULL` | `UNIQUE (email)`; `CHECK (email = lower(email))`; `CHECK (role IN ('RECRUITER','ADMIN'))`; `CHECK (char_length(company) <= 120)` y lo mismo para `name` |
| `refresh_tokens` | `id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `family_id uuid NOT NULL`, `token_hash bytea NOT NULL`, `expires_at timestamptz NOT NULL`, `used_at timestamptz NULL`, `revoked_at timestamptz NULL`, `created_at timestamptz NOT NULL DEFAULT now()` | `UNIQUE (token_hash)`; `INDEX (family_id)`; `CHECK (octet_length(token_hash) = 32)` |
| `availability` | `id smallint PK DEFAULT 1`, `modality text NOT NULL`, `start_label text NOT NULL`, `salary text NOT NULL`, `updated_at timestamptz NOT NULL DEFAULT now()` | `CHECK (id = 1)` (una sola fila) |

- **Una migración por tabla**, en el PR que la usa. El `down` hace `DROP TABLE` (en orden inverso por la FK).
- **`availability`:** el `up` inserta una fila con `[dato de ejemplo]` usando `ON CONFLICT DO NOTHING`. Los valores reales se cargan fuera del repo con un `UPDATE` manual.
- **Documentación:** `COMMENT ON TABLE` y `COMMENT ON COLUMN` en las columnas no obvias (`family_id`, `token_hash`, `used_at`).
- **Sentencias atómicas:**
  - `upsertOnLogin`: `INSERT … ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, company = COALESCE(EXCLUDED.company, users.company), name = COALESCE(EXCLUDED.name, users.name), last_login_at = $now RETURNING *`.
  - `rotate`: una sola sentencia, `WITH spent AS (UPDATE refresh_tokens SET used_at = $now WHERE token_hash = $old AND used_at IS NULL AND revoked_at IS NULL AND expires_at > $now AND NOT EXISTS (fila revocada en la misma familia) RETURNING user_id, family_id, expires_at) INSERT INTO refresh_tokens (…) SELECT … FROM spent RETURNING …`. Gasta el token y guarda el sucesor, o ninguna de las dos cosas; si la base falla el token viejo sigue sin usar y el cliente puede reintentar.
  - `revokeFamilyOf`: `UPDATE … SET revoked_at = $now WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1) AND revoked_at IS NULL`.
  - Las revocaciones (`revokeFamily`, `revokeFamilyOf`) repiten la sentencia hasta que una pasada no revoque nada (normalmente dos). Motivo: con `READ COMMITTED`, una revocación que espera el bloqueo de una rotación en curso no ve el sucesor que esa rotación inserta; la pasada siguiente, con instantánea nueva, sí.
- **Pooler de Neon:**
  - `synchronize: false` y `migrationsRun: false`. Pool `extra.max = 2`, `connectTimeoutMS = 5000`.
  - `pg` solo usa sentencias con nombre si se le pasa `name`, y TypeORM no se lo pasa: NO VERIFICADO contra Neon; se prueba en el cambio de infra.
  - Las migraciones corren desde `dist` con la CLI de `typeorm` (`data-source.cli.ts`, sin ts-node) y `MIGRATIONS_DATABASE_URL` (URL directa). Scripts: `migration:run` y `migration:revert`.
- **Limpieza** de filas vencidas: fuera de alcance. Volumen despreciable.

## 7. Redis (ioredis)

| Clave | Comando | TTL | Uso |
|-------|---------|-----|-----|
| `ml:tok:{sha256hex}` | `SET … EX 900 NX` / `GETDEL` | 900 s | Payload JSON `{email, company?, name?}`. `GETDEL` garantiza que se use una sola vez. |
| `rl:ml:ip:{h(ip)}` | `SET k 0 EX w NX` + `INCR` (un `MULTI`) | 15 min | magic-link por IP: 10 → **429** |
| `rl:ml:em:{h(email)}` | ídem | 15 min | magic-link por email: 3 → **202 silencioso** (no se envía el correo) |
| `rl:vf:ip:{h(ip)}` | ídem | 15 min | verify por IP: 20 → 429 |
| `rl:rf:ip:{h(ip)}` | ídem | 15 min | refresh por IP: 60 → 429 |

- **Claves:** `h()` = sha256. Las claves no contienen ni emails ni IPs en claro. Las IPv6 se agrupan por su prefijo `/64` antes del hash.
- **Límites:** se configuran con valores por defecto (`RATE_LIMITS`). `retryAfterSeconds` sale de `TTL` y viaja en la cabecera `Retry-After`.
- **Patrón `SET NX EX` + `INCR`:** funciona en Redis 8 y en Upstash sin `EXPIRE … NX` ni Lua.
- **Cliente:** `lazyConnect`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, `connectTimeout: 2000`. En Upstash se usa una URL `rediss://`.
- **Fallos:** cualquier error del adaptador se convierte en `InfrastructureUnavailable` → **503** (fallo cerrado).

## 8. Cookies y `SessionCookieWriter`

| Cookie | Valor | Atributos |
|--------|-------|-----------|
| `__Host-access` | JWT | `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900` |
| `__Secure-refresh` | refresh opaco | `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=<segundos hasta expires_at de la familia>` |

- **Único escritor:** `SessionCookieWriter.write(res, session)` y `.clear(res)` son los **únicos** que emiten `Set-Cookie`, siempre como dos cabeceras. Si Q2 falla (CloudFront/Lambda funden varios `Set-Cookie`), solo cambia este archivo.
- **`clear`:** emite `Max-Age=0` con el mismo `Path`.
- **Modo inseguro:** `COOKIE_SECURE=false` existe solo para HTTP local. Como los prefijos `__Host-`/`__Secure-` exigen `Secure`, en ese modo los nombres pasan a `access` y `refresh`. El escritor y el lector toman los nombres de un único `CookieNames` derivado de la config.
- **Lectura:** se usa `cookie-parser`, registrado en `configureApp`.

## 9. Guards, IP y orden de ejecución

| Orden | Guard | Aplica a | Fallo |
|-------|-------|----------|-------|
| 1 | `OriginGuard` | POST/PUT/PATCH/DELETE | Si `Origin` falta o no está en `ALLOWED_ORIGINS` (coincidencia exacta) → **403** JSON. Es el único 403 posible en `/api/auth/*`, y solo ante peticiones forjadas. |
| 2 | `JwtAuthGuard` | Todas, salvo `@Public()` | Lee `__Host-access` y llama a `AccessTokenVerifier`. Si falta o es inválido → **401**. Si es válido, deja `req.principal = {userId, role}`. |
| 3 | `RolesGuard` | Rutas con `@Roles(...)` | Rol fuera de la lista → **403** JSON (`ForbiddenException`). |

- **Registro:** los tres se registran con `APP_GUARD` en `AuthModule`, en ese orden; Nest ejecuta los guards globales en el orden de registro.
- **Rutas `@Public()`:** `health`, `jwks.json`, `magic-link`, `verify`, `refresh` y `logout`. Swagger no pasa por los guards: es middleware.

**`ClientIpResolver`** (en `infrastructure/http`, elegido con `CLIENT_IP_SOURCE`):

| Implementación | Fuente | Si falta |
|----------------|--------|----------|
| `CloudFrontViewerAddressResolver` (prod) | `CloudFront-Viewer-Address` (`ip:puerto`; se parte por el **último** `:` para soportar IPv6) | 403: la petición no pasó por CloudFront (fallo cerrado; depende de Q3) |
| `SocketAddressResolver` (local/test) | `req.socket.remoteAddress` | `unknown` |

Nunca se lee `X-Forwarded-For`, y `trust proxy` sigue apagado.

## 10. Configuración y secretos

| Fuente | Claves |
|--------|--------|
| `SecretsProvider` (env en local/test, SSM en prod, con `SECRETS_SOURCE=env\|ssm`) | `jwtPrivateKeyPem`, `jwtKeyId`, `jwtPreviousPublicKeyPem?` + `jwtPreviousKeyId?` (rotación manual, ADR-008), `databaseUrl`, `redisUrl`, `adminEmail` (D2) |
| `loadConfig(env)` (no secreto) | `ALLOWED_ORIGINS`, `COOKIE_SECURE` (por defecto `true`), `CLIENT_IP_SOURCE`, `MAIL_TRANSPORT=smtp\|ses`, `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM`, `MAGIC_LINK_BASE_URL`, `JWT_ISSUER`, `CV_SIGNER=fake\|s3`, `CV_BUCKET`, `CV_OBJECT_KEY`, `AWS_REGION`, `SSM_PREFIX`, `RATE_LIMITS` |

- **SSM:** `SsmSecretsProvider` lee los parámetros de `SSM_PREFIX` con un solo `GetParameters` (`WithDecryption`) al arrancar el entorno, sin volver a leerlos. Se testea con un `send` falso inyectado, sin librería de mocks.
- **Claves locales:** `scripts/dev-keys.js` (`generateKeyPairSync('rsa', 2048)`) escribe en `apps/api/.keys/`, que se agrega a `.gitignore`. `EnvSecretsProvider` lee `JWT_PRIVATE_KEY_FILE`.
- **Claves de test:** `test/support/keys.ts` las genera en memoria en cada suite. **Nunca hay un PEM en el repo** (gitleaks lo detectaría).
- **`.env.example`:** solo placeholders (`ADMIN_EMAIL=admin@example.test`, `MAIL_FROM=no-reply@example.test`, `REDIS_URL=redis://127.0.0.1:6379`, `DATABASE_URL`/`MIGRATIONS_DATABASE_URL` hacia el Postgres local, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`).
- **docker-compose:** no cambia los servicios, porque ya tiene Postgres, Redis y Mailpit.
- **JWKS:** `GET /api/.well-known/jwks.json` publica la clave activa y, si existe, la anterior (`kid`, `kty`, `n`, `e`, `alg`, `use: sig`), con `Cache-Control: public, max-age=300`.

## 11. Errores → HTTP (coincide con `apps/web/src/lib/api/errors.ts`)

| Situación | Estado | Lo que ve el cliente |
|-----------|--------|----------------------|
| `magic-link`: cuerpo o email inválido | 400 | La UI de "enviado" (cualquier error no de red) |
| `magic-link`: límite por email / el correo falla (se registra) | **202**, cuerpo idéntico | enviado |
| `magic-link` / `verify` / `refresh`: límite por IP | 429 + `Retry-After` | `rate-limited` |
| `verify`: formato inválido | 400 | `invalid-token` |
| `verify`: no existe, vencido o ya usado (Redis devuelve `null`) | 400 | `invalid-token` (nunca 403) |
| `refresh`: sin cookie, desconocido, vencido o revocado | 401 + limpia cookies | `unauthorized` |
| `refresh`: reutilización fuera de la gracia | 401 + revoca la familia + limpia cookies | `unauthorized` |
| `logout`, en cualquier caso (incluso con la infra caída; se registra) | 204 + limpia cookies | — |
| `/v1/*` sin access token o con uno inválido; usuario borrado en `/me` | 401 | refresh + reintento |
| RECRUITER en `/v1/admin/visits` | 403 JSON | `forbidden` / el playground muestra 403 |
| POST sin `Origin` permitido; falta `CloudFront-Viewer-Address` en prod | 403 | — |
| `/v1/profile`, `/experience`, `/skills` (D3) | 404 (sin ruta) | El playground muestra 404 |
| Redis o Postgres caídos | 503 | `server` |
| Error no previsto | 500 | `server` |

- **Filtro global:** `DomainExceptionFilter` (en `configureApp`) traduce `DomainError` → estado según esta tabla. Las `HttpException` de Nest pasan sin cambios.
- **Respuestas exitosas:** `verify`, `refresh` y `logout` responden **204**; `magic-link` responde **202** `{"status":"accepted"}`.
- **Caché:** todo `/api/auth/*` y `/api/v1/*` lleva `Cache-Control: no-store`.

## 12. Secuencias

```
Navegador          AuthController           Caso de uso                 Redis / Postgres / SES
POST /auth/magic-link {email,…} (Origin ok) ─→ RequestMagicLink
                                              ├ RateLimiter ip  ──────→ SET NX EX + INCR   (>10 → 429)
                                              ├ RateLimiter email ────→ SET NX EX + INCR   (>3 → 202 sin envío)
                                              ├ token = base64url(32B); SET ml:tok:{sha256} EX 900 NX
                                              └ MailSender ───────────→ SES / Mailpit: …/acceso/verificar/#token=T
←────────────── 202 {"status":"accepted"}  (idéntico para todo email válido)

POST /auth/verify {token:T} ────────────────→ VerifyMagicLink
                                              ├ parse(T) → 400 | RateLimiter ip → 429
                                              ├ GETDEL ml:tok:{sha256(T)} → null ⇒ 401
                                              ├ role = AdminPolicy(email); users UPSERT … RETURNING
                                              ├ familia nueva; INSERT refresh_tokens (expires = now + 7 d)
                                              └ AccessTokenIssuer (RS256, kid)
←── 204 + Set-Cookie __Host-access, __Secure-refresh (SessionCookieWriter)

GET /v1/me (cookie access) → OriginGuard(no aplica) → JwtAuthGuard(verify RS256) → RolesGuard(sin @Roles)
                            → GetMe: users.findById + availability.get → 200 {email, role, company|null, name|null, availability}

POST /auth/refresh (cookie refresh, Path=/api/auth) → RefreshSession
   ├ RateLimiter ip
   ├ findByHash (solo lectura) ⇒ usable ⇒ UserRepository.findById ⇒ rotate (una sentencia: gasta + inserta sucesor con mismo family_id y expires_at) ⇒ JWT ⇒ 204 + cookies
   └ no usable, o rotate sin fila ⇒ findByHash: usado hace ≤10 s ⇒ 401 | usado/revocado ⇒ revokeFamily ⇒ 401 + clear | inexistente/vencido ⇒ 401 + clear

POST /auth/logout → Logout: revokeFamilyOf(sha256(refresh)) (errores se registran) → 204 + clear
```

## 13. Revisión de ADR (regla 2 del brief)

| Pieza | ¿Está en el CV? | ¿Hay ADR? | Decisión |
|-------|-----------------|-----------|----------|
| `jose` | JWT (sí) | — | Sin ADR: es la librería de una tecnología del CV. La elección frente a `@nestjs/jwt` queda en A5 |
| `ioredis` | Redis (sí) | ADR-005 (proveedor) | Sin ADR |
| `typeorm` + `pg` | Sí | ADR-004 | Sin ADR |
| `cookie-parser` | Express (sí) | — | Sin ADR |
| `nodemailer` | — | — | Sin ADR: solo es el adaptador SMTP hacia Mailpit en local (herramienta de desarrollo, como Mailpit). Va en el README |
| SES (`@aws-sdk/client-sesv2`) | No | ADR-007 | Cubierto |
| SSM (`@aws-sdk/client-ssm`) | No | ADR-008 | Cubierto |
| **S3 privado + URL prefirmada para el CV** | No | ADR-001 cubre S3 solo como hosting estático | **ADR nuevo obligatorio** |

**Borrador de título:** `ADR-012: S3 privado con URL prefirmada para entregar el CV`, en `openspec/changes/stack-adrs/adrs/` y agregado al índice del `README.md` de `stack-adrs`. Contenido mínimo: problema (el CV no puede estar en el repo y debe expirar), alternativas (archivo en la base como `bytea`, enlace de un proveedor externo, URL de CloudFront firmada), por qué S3 + presign de ~5 min y relación con el CV (AWS: aprendiendo). Se escribe en el PR 4.

**`eslint.config.mjs`:** agregar `jose`, `nodemailer`, `pg` y `cookie-parser` a `frameworkLibs`. `@aws-sdk/*` ya está.

## 14. Estrategia de tests

| Capa | Qué | Cómo |
|------|-----|------|
| Unitario (`src/**/*.spec.ts`, cobertura ≥ 80 %) | Value objects, `SessionPolicy`, `AdminPolicy`, los 7 casos de uso (incluida la gracia y la revocación de familia), `loadConfig`, `ClientIpResolver`, `SessionCookieWriter`, `SsmSecretsProvider` | Fakes escritos a mano (`FakeClock`, `InMemoryMagicLinkStore`, `InMemoryRateLimiter`, `CapturingMailSender`, repositorios en memoria). Sin `jest.mock` |
| e2e (`test/*.e2e-spec.ts`, supertest) | Todos los criterios de éxito de la propuesta, la forma estricta de `Me`, el orden de los guards, las cookies (`Set-Cookie` leído a mano), `/admin` ausente en `/api/docs-json`, 404 de contenido, JWKS | `createTestApp()` hace `overrideProvider` de `DATA_SOURCE`, `REDIS_CLIENT` (stubs que no conectan), los puertos (fakes en memoria), `SECRETS_PROVIDER` (claves generadas) y `MAIL_SENDER` (captura el enlace). `health.e2e-spec.ts` y `docs.e2e-spec.ts` pasan a usar `createTestApp()` |
| Integración (`test/integration/*.int-spec.ts`, **nuevo**) | `RedisMagicLinkStore` (`GETDEL`, TTL), `RedisRateLimiter` (ventana), repositorios TypeORM (upsert, `consume` concurrente: dos `consume` en paralelo → uno gana), migraciones `up` → `down` → `up` | Redis y Postgres reales. Local: `docker compose up -d postgres redis` + `npm run test:int -w apps/api`. CI: job `integration` con *service containers* fijados por digest (las mismas imágenes de compose) |

`ci.yml` gana el job `integration` (PR 2). `quality` no cambia.

**Smoke test de `jose`** (primera tarea del PR 1):
1. Fijar la versión exacta con `npm view jose version` y revisar su campo `exports` (si es solo ESM: NO VERIFICADO).
2. Escribir un spec que genere un par RS256, firme, verifique con `currentDate` y haga `exportJWK`. Debe pasar en `npm test` (con el flag de VM modules).
3. Pasar `npm run typecheck` (`moduleResolution: bundler`) y `npm run build`.
4. Arrancar `node dist/main.js` y pedir `GET /api/.well-known/jwks.json` (prueba `require(esm)` en runtime, sin Jest).

Si algo falla: **detenerse y consultar**. El plan B propuesto es `node:crypto` (`sign`/`verify` RSA-SHA256 + `KeyObject.export({format:'jwk'})`) detrás del mismo puerto, sin dependencia nueva.

## 14.1 Compromiso aceptado: el rol del JWT en los guards

Los guards (`RolesGuard`) confían en el claim `role` del JWT de acceso, sin consultar la base. Si se degrada a un administrador (cambia `ADMIN_EMAIL`), conserva el acceso a `/api/v1/admin/*` hasta que venza su token, como máximo `ACCESS_TTL` (15 minutos), y pierde el rol en su siguiente `verify` o `refresh`. `GET /api/v1/me` sí devuelve el rol guardado en la base. Se acepta este desfase para no sumar una lectura de base a cada petición; no requiere cambios de código.

## 15. Cambios en archivos existentes

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/app.module.ts` | Importa `ConfigModule`, `SharedModule` y las porciones nuevas |
| `apps/api/src/bootstrap/configure-app.ts` | `cookie-parser`, `DomainExceptionFilter` y Swagger con `@ApiExcludeController()` en `AdminVisitsController`; `@ApiCookieAuth` sin ejemplos de valores |
| `apps/api/src/health/infrastructure/http/health.controller.ts` | `@Public()` |
| `apps/api/package.json` | Dependencias de §1 (versión exacta), scripts `test:int`, `migration:run`, `migration:revert` y `keys:dev` |
| `apps/api/test/jest-e2e.config.js` | `setupFiles: ['<rootDir>/setup-env.ts']` |
| `eslint.config.mjs`, `.env.example`, `.gitignore` (`apps/api/.keys/`), `.github/workflows/ci.yml` (job `integration`) | Según §10, §13 y §14 |

## 16. Rollout y reversión

Sin despliegue: no hay estado en AWS. El plan de 4 PRs de la propuesta se mantiene. El PR 2 suma además el job `integration`, y el PR 4 el ADR-012. Cada migración se revierte con `migration:revert`, y cada PR con `git revert` en orden inverso (4 → 1).

## 17. Preguntas abiertas

- [ ] Q2/Q3/Q1 y ADR-009 siguen sin verificar. Este diseño aísla su impacto en `SessionCookieWriter`, `ClientIpResolver` y `OriginGuard`.
- [x] Gracia de reutilización de 10 s (A9): aceptada por la usuaria (2026-10-21).
- [x] 403 por falta de `CloudFront-Viewer-Address` en prod (fallo cerrado): aceptado por la usuaria (2026-10-21). Seguimiento: un cambio de frontend debe informar al usuario qué error devuelve la API y por qué.
- [x] Riesgo aceptado: el límite por email responde `202` sin enviar, así que cualquiera que conozca un email puede agotarle el cupo (3 por ventana de 15 minutos) y suprimir sus enlaces mientras dure la ventana. Es la consecuencia de la decisión de respuesta silenciosa e idéntica (antienumeración). No hay mitigación en este cambio; la ventana es corta y el límite por IP frena el abuso sostenido.
- [x] Riesgo aceptado: si Postgres está caído en `logout`, el caso de uso responde igualmente `204` (contrato con el cliente) y limpia las cookies, pero la familia de refresh sigue viva en el servidor hasta su vencimiento (máximo 7 días desde el login). El fallo se registra con nivel `warn`, sin datos del token. Quien conserve una copia de la cookie podría seguir refrescando en ese lapso.
- [x] Nota: la ventana de gracia de reutilización (10 s) se mide con el reloj de la aplicación (`Clock`). Con varias instancias, el desfase entre relojes la desplaza ligeramente; un `used_at` en el futuro cuenta como dentro de la gracia, lo cual es seguro (no revoca de más ni de menos que la propia ventana).

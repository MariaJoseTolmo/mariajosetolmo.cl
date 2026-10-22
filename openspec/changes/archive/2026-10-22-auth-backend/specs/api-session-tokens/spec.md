# api-session-tokens

## Purpose

Capacidad nueva. Define en `apps/api` la sesión del reclutador: JWT de acceso RS256 con JWKS, cookies, refresh rotativo con detección de reutilización, logout y los guards globales (JWT, roles y `Origin`). Satisface el comportamiento de refresh y logout del adaptador `http` descrito en `web-recruiter-access`.

## ADDED Requirements

### Requirement: JWT de acceso RS256 con JWKS

El token de acceso MUST ser un JWT firmado con RS256, con `kid` en la cabecera y claims `sub` (id de usuario), `role`, `iat` y `exp` (15 minutos). `GET /api/.well-known/jwks.json` MUST ser público y MUST responder `200` con un JWKS que contenga solo claves públicas (sin `d`, `p`, `q` ni otros parámetros privados) y que permita verificar el token emitido. El JWKS MUST poder publicar más de una clave. La firma MUST ir detrás del puerto `AccessTokenIssuer`; las claves MUST venir de `SecretsProvider`.

#### Scenario: Token verificable con el JWKS

- GIVEN una sesión emitida tras verificar un magic link
- WHEN se decodifica el JWT de `__Host-access` y se verifica con las claves de `GET /api/.well-known/jwks.json`
- THEN la verificación es exitosa, `alg` = `RS256`, el `kid` coincide con una clave del JWKS y `exp - iat` = 900

#### Scenario: JWKS sin material privado

- GIVEN el endpoint JWKS
- WHEN se inspecciona cada JWK
- THEN no contiene `d`, `p`, `q`, `dp`, `dq` ni `qi`

#### Scenario: Algoritmo distinto rechazado

- GIVEN un JWT con `alg` = `none` o `HS256` y claims válidos
- WHEN se usa como cookie `__Host-access` en `GET /api/v1/me`
- THEN la respuesta es `401`

#### Scenario: Token vencido o manipulado

- GIVEN un JWT con `exp` en el pasado y otro con la firma alterada
- WHEN se usa cada uno en `GET /api/v1/me`
- THEN ambos responden `401`

### Requirement: Cookies de sesión

Al emitir sesión el sistema MUST fijar dos cookies mediante un `SessionCookieWriter`: `__Host-access` con `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict` y `Max-Age=900` (sin atributo `Domain`); y `__Secure-refresh` con `Path=/api/auth`, `HttpOnly`, `Secure`, `SameSite=Strict` y `Max-Age` igual al tiempo restante de la familia (`604800` al emitir la sesión en verify, porque la sesión vence 7 días después del login). `Secure` MUST estar activo por defecto y poder desactivarse solo por configuración de entorno (local). El valor del refresh token MUST ser opaco (32 bytes aleatorios en base64url) y MUST NOT ser un JWT.

#### Scenario: Atributos de la cookie de acceso

- GIVEN una verificación exitosa
- WHEN se leen las cabeceras `Set-Cookie`
- THEN `__Host-access` incluye `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=900` y no incluye `Domain`

#### Scenario: Atributos de la cookie de refresh

- GIVEN una verificación exitosa
- WHEN se leen las cabeceras `Set-Cookie`
- THEN `__Secure-refresh` incluye `Path=/api/auth`, `HttpOnly`, `Secure`, `SameSite=Strict` y `Max-Age=604800`

#### Scenario: Secure desactivable solo por configuración

- GIVEN la configuración con `COOKIE_SECURE=false`
- WHEN se emite una sesión
- THEN las cookies no incluyen `Secure`
- AND con la configuración por defecto sí lo incluyen

### Requirement: Refresh rotativo con familias

`POST /api/auth/refresh` MUST leer la cookie `__Secure-refresh` (sin cuerpo), validar `sha256(valor)` contra la tabla `refresh_tokens` y, si está vigente y sin usar, MUST marcarlo como usado, emitir un nuevo par de cookies (nuevo access y nuevo refresh en la misma familia) y responder `2xx`. Solo el hash del refresh MUST persistirse. La sesión total de una familia MUST NOT superar 7 días desde su creación. Si la cookie falta, es desconocida o venció, MUST responder `401`.

#### Scenario: Refresh exitoso rota el token

- GIVEN una sesión con refresh token R1
- WHEN se envía `POST /api/auth/refresh` con R1
- THEN la respuesta es `2xx`, trae un nuevo `__Host-access` y un `__Secure-refresh` R2 distinto de R1
- AND R1 queda marcado como usado

#### Scenario: Sin cookie de refresh

- GIVEN una petición sin cookie `__Secure-refresh`
- WHEN se envía `POST /api/auth/refresh`
- THEN la respuesta es `401`

#### Scenario: Refresh vencido

- GIVEN un refresh token cuya familia superó los 7 días según el `Clock` fake
- WHEN se envía `POST /api/auth/refresh`
- THEN la respuesta es `401`

#### Scenario: Solo se persiste el hash

- GIVEN una sesión emitida
- WHEN se inspecciona la fila de `refresh_tokens`
- THEN contiene `sha256(refresh)` y ninguna columna contiene el valor en claro

### Requirement: Detección de reutilización de refresh

Si se presenta un refresh token revocado, o uno ya usado hace más de 10 s, el sistema MUST revocar toda su familia, MUST responder `401` y MUST limpiar las cookies de sesión. Tras la revocación, ningún token de esa familia (incluido el más reciente) MUST poder refrescar. Si el token se usó hace 10 s o menos (gracia de reutilización, para pestañas que refrescan a la vez), el sistema MUST responder `401` y MUST NOT revocar la familia ni limpiar las cookies.

#### Scenario: Reutilización fuera de la gracia revoca la familia

- GIVEN R1 refrescado con éxito (produce R2) hace más de 10 s
- WHEN se vuelve a enviar R1 a `/api/auth/refresh`
- THEN la respuesta es `401`
- AND luego enviar R2 también responde `401`

#### Scenario: Reutilización dentro de la gracia no revoca

- GIVEN R1 refrescado con éxito (produce R2) hace 10 s o menos
- WHEN se vuelve a enviar R1 a `/api/auth/refresh`
- THEN la respuesta es `401` y no se limpian las cookies
- AND luego enviar R2 responde `2xx`

#### Scenario: Otra familia no se afecta

- GIVEN dos sesiones independientes (familias A y B) del mismo usuario
- WHEN se detecta reutilización en la familia A
- THEN la familia B sigue pudiendo refrescar con `2xx`

### Requirement: Logout idempotente

`POST /api/auth/logout` MUST responder siempre `204`, tenga o no sesión válida, cookie vencida o ninguna cookie. Si recibe un refresh token conocido MUST revocar su familia. MUST limpiar ambas cookies (`Max-Age=0` con los mismos `Path`). El JWT de acceso ya emitido MAY seguir siendo válido hasta su expiración (máximo 15 minutos).

#### Scenario: Logout con sesión

- GIVEN una sesión activa
- WHEN se envía `POST /api/auth/logout` con sus cookies
- THEN la respuesta es `204`, ambas cookies se limpian y el refresh de esa sesión ya no puede usarse (`/api/auth/refresh` → `401`)

#### Scenario: Logout sin sesión

- GIVEN una petición sin cookies
- WHEN se envía `POST /api/auth/logout`
- THEN la respuesta es `204`

#### Scenario: Logout con refresh desconocido

- GIVEN una cookie `__Secure-refresh` con un valor nunca emitido
- WHEN se envía `POST /api/auth/logout`
- THEN la respuesta es `204`

### Requirement: Autenticación y autorización por guards

Un `JwtAuthGuard` global MUST exigir un JWT válido en `__Host-access` para toda ruta salvo las marcadas como públicas. Son públicas: `GET /api/health`, `GET /api/.well-known/jwks.json` y las de `/api/auth/*`. Sin JWT válido MUST responder `401` con cuerpo JSON. Un `RolesGuard` con `@Roles(...)` MUST responder `403` con cuerpo JSON cuando el rol del JWT no está permitido. Las rutas `/api/auth/*` MUST NOT usar `401` para resultados normales de negocio, salvo `refresh` (ver arriba).

#### Scenario: Ruta protegida sin cookie

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/me`
- THEN la respuesta es `401` con `Content-Type` JSON

#### Scenario: Rutas públicas accesibles

- GIVEN una petición sin cookies
- WHEN se piden `GET /api/health` y `GET /api/.well-known/jwks.json`
- THEN ambas responden `200`

#### Scenario: Rol insuficiente

- GIVEN una sesión con rol `RECRUITER`
- WHEN accede a una ruta con `@Roles('ADMIN')`
- THEN la respuesta es `403` con cuerpo JSON

### Requirement: Guard de Origin en métodos mutantes

Un `OriginGuard` global MUST validar la cabecera `Origin` en `POST`, `PUT`, `PATCH` y `DELETE` contra una lista permitida proveniente de la configuración. Si `Origin` falta o no está en la lista MUST responder `403` con cuerpo JSON. Los métodos `GET`, `HEAD` y `OPTIONS` MUST NOT ser afectados. Este `403` aplica también a las rutas de `/api/auth/*`.

#### Scenario: POST sin Origin

- GIVEN una lista permitida con `https://app.example.test`
- WHEN se envía `POST /api/auth/logout` sin cabecera `Origin`
- THEN la respuesta es `403`

#### Scenario: POST con Origin ajeno

- GIVEN la misma lista permitida
- WHEN se envía `POST /api/auth/magic-link` con `Origin: https://evil.example.test`
- THEN la respuesta es `403` y el `MailSender` no recibe mensajes

#### Scenario: POST con Origin permitido

- GIVEN la misma lista permitida
- WHEN se envía `POST /api/auth/logout` con `Origin: https://app.example.test`
- THEN la respuesta es `204`

#### Scenario: GET sin Origin

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/me` sin cabecera `Origin`
- THEN la respuesta es `200`

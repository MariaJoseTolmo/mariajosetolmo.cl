# api-magic-link-login

## Purpose

Capacidad nueva. Define en `apps/api` la petición y verificación del magic link: respuesta antienumeración, token de un solo uso, límites de frecuencia, envío de correo y asignación de rol. Satisface el comportamiento del cliente descrito en `web-recruiter-access`. Decisiones D1 y D2 de la propuesta son vinculantes.

Origen: change `auth-backend` (archivado el 2026-10-22, ver `openspec/changes/archive/2026-10-22-auth-backend/archive-report.md`).

## Requirements

### Requirement: Petición de magic link con respuesta idéntica

`POST /api/auth/magic-link` MUST aceptar JSON `{ email, company?, name? }`. Para todo `email` con formato válido MUST responder `202` con un cuerpo idéntico byte a byte, exista o no el usuario, y MUST ejecutar el mismo trabajo (generar token, guardar su hash, invocar `MailSender`). Un `email` ausente o con formato inválido MUST responder `400`. El sistema MUST NOT crear ni modificar el usuario en esta petición; `company` y `name` solo viajan en el payload del token.

#### Scenario: Email nuevo y email registrado reciben lo mismo

- GIVEN un usuario registrado `known@example.test` y un email nunca visto `new@example.test`
- WHEN se envía `POST /api/auth/magic-link` para cada uno
- THEN ambas respuestas son `202` con el mismo cuerpo y las mismas cabeceras relevantes (sin `Set-Cookie`)
- AND el `MailSender` fake captura exactamente un mensaje por cada petición

#### Scenario: Formato de email inválido

- GIVEN un cuerpo `{ "email": "no-es-correo" }`
- WHEN se envía la petición
- THEN la respuesta es `400` y el `MailSender` no recibe ningún mensaje

#### Scenario: Petición sin efectos sobre el usuario

- GIVEN un usuario registrado con `company` = "Acme"
- WHEN se pide un magic link para su email con `company` = "Otra"
- THEN el usuario conserva `company` = "Acme"

#### Scenario: Fallo del envío no cambia la respuesta

- GIVEN un `MailSender` fake que lanza error
- WHEN se pide un magic link para un email válido
- THEN la respuesta sigue siendo `202` con el mismo cuerpo y el error queda registrado en el log

### Requirement: Token de magic link opaco, hasheado y con TTL

El token MUST generarse con 32 bytes aleatorios criptográficos codificados en base64url. El `MagicLinkStore` MUST guardar únicamente `sha256(token)` como clave, con TTL de 900 segundos, y el payload `{ email, company?, name? }`. El token en claro MUST NOT persistirse ni registrarse en logs. El enlace del correo MUST tener la forma `<base-url>/acceso/verificar/#token=<token>` (token en el fragmento, nunca en la query).

#### Scenario: Solo se guarda el hash

- GIVEN un `MagicLinkStore` fake que expone sus claves
- WHEN se pide un magic link y se captura el enlace del correo
- THEN ninguna clave ni valor del store contiene el token en claro
- AND existe una clave igual a `sha256(token)` con TTL de 900 s

#### Scenario: Forma del enlace

- GIVEN un magic link pedido con éxito
- WHEN se inspecciona el cuerpo del correo capturado
- THEN contiene `/acceso/verificar/#token=` seguido de 43 caracteres base64url
- AND no contiene `?token=`

### Requirement: Límites de frecuencia por IP y por email

El sistema MUST aplicar un límite por IP y otro por email sobre `POST /api/auth/magic-link`. Al superar el límite por IP MUST responder `429` visible. Al superar el límite por email MUST responder `202` idéntico al caso normal, sin invocar `MailSender`. Los umbrales y ventanas MUST ser configurables. La IP MUST obtenerse mediante un `ClientIpResolver` aislado (cabecera `CloudFront-Viewer-Address` en producción; dirección del socket solo en local y test); MUST NOT leerse `X-Forwarded-For`. En producción, si falta `CloudFront-Viewer-Address`, el sistema MUST responder `403` (fallo cerrado: la petición no pasó por CloudFront) y MUST NOT usar un contador compartido.

#### Scenario: Falta CloudFront-Viewer-Address en producción

- GIVEN la API configurada en modo producción
- WHEN llega `POST /api/auth/magic-link` sin la cabecera `CloudFront-Viewer-Address`
- THEN la respuesta es `403`
- AND el `MailSender` no recibió ningún mensaje

#### Scenario: Límite por IP visible

- GIVEN un límite por IP de N peticiones por ventana
- WHEN llegan N+1 peticiones desde la misma IP con emails distintos
- THEN la petición N+1 responde `429`

#### Scenario: Límite por email silencioso

- GIVEN un límite por email de M peticiones por ventana
- WHEN llegan M+1 peticiones para el mismo email desde IPs distintas
- THEN la petición M+1 responde `202` con el mismo cuerpo
- AND el `MailSender` recibió exactamente M mensajes

#### Scenario: X-Forwarded-For se ignora

- GIVEN peticiones con `X-Forwarded-For` distinto en cada una pero la misma IP de origen
- WHEN se supera el límite por IP
- THEN se responde `429` (la cabecera no evade el límite)

### Requirement: Verificación de un solo uso

`POST /api/auth/verify` MUST aceptar `{ token }`, calcular `sha256(token)` y consumirlo de forma atómica (`GETDEL`). Si el token es válido MUST: crear el usuario con rol `RECRUITER` si no existe (o reutilizarlo), aplicar `company` y `name` del payload, emitir sesión (cookies de `api-session-tokens`) y responder `2xx` (`200` o `204`). Si el token no existe, venció, ya fue usado o no tiene formato válido MUST responder `400`. MUST NOT responder `403` ni `404` por token inválido. Dos verificaciones concurrentes del mismo token MUST resultar en exactamente un éxito.

#### Scenario: Flujo feliz completo

- GIVEN un magic link pedido y su token capturado del `MailSender` fake
- WHEN se envía `POST /api/auth/verify` con ese token
- THEN la respuesta es `2xx` y fija las cookies `__Host-access` y `__Secure-refresh`
- AND existe un usuario con ese email y rol `RECRUITER`

#### Scenario: Token reutilizado

- GIVEN un token ya verificado con éxito
- WHEN se vuelve a enviar a `/api/auth/verify`
- THEN la respuesta es `400` y no se fijan cookies

#### Scenario: Token vencido

- GIVEN un token y un `Clock`/store fake avanzado más de 900 s
- WHEN se envía a `/api/auth/verify`
- THEN la respuesta es `400`

#### Scenario: Token desconocido o mal formado

- GIVEN el valor `"basura"` y un token aleatorio nunca emitido
- WHEN se envía cada uno a `/api/auth/verify`
- THEN ambos responden `400`

#### Scenario: Verificaciones concurrentes

- GIVEN un token válido
- WHEN se envían dos `POST /api/auth/verify` simultáneos con ese token
- THEN exactamente uno responde `2xx` y el otro `400`

#### Scenario: company y name se aplican solo al verificar

- GIVEN un magic link pedido con `company` = "Acme" y `name` = "Ana" para un email nuevo
- WHEN se verifica el token
- THEN el usuario queda con `company` = "Acme" y `name` = "Ana"

#### Scenario: Usuario existente conserva datos si el payload no los trae

- GIVEN un usuario con `company` = "Acme" y un magic link pedido sin `company`
- WHEN se verifica el token
- THEN el usuario conserva `company` = "Acme"

### Requirement: Asignación de rol

Todo email verificado MUST recibir el rol `RECRUITER`, salvo el email configurado como administrador (variable `ADMIN_EMAIL` en local, SSM en producción), que MUST recibir `ADMIN`. La comparación MUST ignorar mayúsculas/minúsculas y espacios alrededor. El email administrador MUST NOT aparecer en el repositorio, en `.env.example` ni en fixtures (se usa un placeholder como `admin@example.test`).

#### Scenario: Reclutador por defecto

- GIVEN `ADMIN_EMAIL` = `admin@example.test`
- WHEN `recruiter@example.test` completa la verificación
- THEN su rol es `RECRUITER`

#### Scenario: Administrador configurado

- GIVEN `ADMIN_EMAIL` = `admin@example.test`
- WHEN `Admin@Example.test` completa la verificación
- THEN su rol es `ADMIN`

#### Scenario: Rol no se eleva por payload

- GIVEN una petición de magic link con un campo extra `role: "ADMIN"` para `recruiter@example.test`
- WHEN se verifica el token
- THEN el rol es `RECRUITER`

### Requirement: Fallo cerrado ante indisponibilidad de Redis

Si el `MagicLinkStore` o el `RateLimiter` no están disponibles, `POST /api/auth/magic-link` y `POST /api/auth/verify` MUST responder `503` y MUST NOT enviar correo ni emitir sesión.

#### Scenario: Redis caído en magic-link

- GIVEN un `RateLimiter` fake que lanza error de conexión
- WHEN se pide un magic link
- THEN la respuesta es `503` y el `MailSender` no recibe mensajes

#### Scenario: Redis caído en verify

- GIVEN un `MagicLinkStore` fake que lanza error de conexión
- WHEN se envía `/api/auth/verify`
- THEN la respuesta es `503` y no se fijan cookies

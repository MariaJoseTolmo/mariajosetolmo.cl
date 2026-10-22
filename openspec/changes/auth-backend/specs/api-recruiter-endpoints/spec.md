# api-recruiter-endpoints

## Purpose

Capacidad nueva. Define en `apps/api` los endpoints de la zona reclutador que el cliente `web-recruiter-access` consume: `GET /api/v1/me`, `GET /api/v1/cv`, el stub de `/api/v1/admin/visits`, el 404 de los endpoints de contenido y la exclusión de `/admin` en Swagger. Decisión D3 de la propuesta es vinculante.

## ADDED Requirements

### Requirement: GET /api/v1/me con forma estricta

`GET /api/v1/me` MUST requerir sesión válida y responder `200` JSON con exactamente las claves `email` (string), `role` (`"RECRUITER"` o `"ADMIN"`), `company` (string o `null`), `name` (string o `null`) y `availability` (objeto con `modality`, `start` y `salary`, todos string). `company` y `name` MUST estar presentes como `null` cuando no hay valor (nunca ausentes). La respuesta MUST NOT incluir claves adicionales (por ejemplo id interno, hashes o fechas). `availability` MUST provenir del `AvailabilityRepository` (tabla `availability`); el seed del repositorio MUST usar solo valores de ejemplo.

#### Scenario: Forma completa

- GIVEN un usuario `recruiter@example.test` con `company` = "Acme" y `name` = "Ana" y sesión válida
- WHEN se envía `GET /api/v1/me`
- THEN la respuesta es `200` y su conjunto de claves es exactamente `email`, `role`, `company`, `name`, `availability`
- AND `availability` tiene exactamente `modality`, `start` y `salary` como strings

#### Scenario: Campos opcionales como null

- GIVEN un usuario sin `company` ni `name`
- WHEN se envía `GET /api/v1/me`
- THEN `company` es `null` y `name` es `null` (las claves existen)

#### Scenario: Rol ADMIN reflejado

- GIVEN la sesión de `admin@example.test` configurado como administrador
- WHEN se envía `GET /api/v1/me`
- THEN `role` es `"ADMIN"`

#### Scenario: Sin sesión

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/me`
- THEN la respuesta es `401`

#### Scenario: Sin valores personales en el seed

- GIVEN la migración/seed de `availability`
- WHEN se inspecciona su contenido
- THEN usa valores placeholder claramente marcados como ejemplo

### Requirement: GET /api/v1/cv con URL firmada

`GET /api/v1/cv` MUST requerir sesión válida y responder `200` JSON `{ url, expiresAt }`, donde `url` es una URL firmada temporal generada por el puerto `CvLinkSigner` y `expiresAt` es un instante ISO 8601 en UTC. La validez MUST ser corta (alrededor de 5 minutos, configurable). La URL MUST NOT quedar persistida ni registrada en logs. En local y test MUST usarse una implementación falsa que devuelva una URL de ejemplo.

#### Scenario: Respuesta válida

- GIVEN una sesión válida y un `CvLinkSigner` fake con validez de 300 s y reloj fijo
- WHEN se envía `GET /api/v1/cv`
- THEN la respuesta es `200` con `url` string no vacío y `expiresAt` igual a la hora del reloj fijo más 300 s en ISO 8601

#### Scenario: Sin sesión

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/cv`
- THEN la respuesta es `401`

#### Scenario: Cada petición genera un enlace nuevo

- GIVEN un `CvLinkSigner` fake que cuenta invocaciones
- WHEN se envían dos `GET /api/v1/cv` autenticados
- THEN el signer fue invocado dos veces

### Requirement: Stub de /api/v1/admin/visits

`GET /api/v1/admin/visits` MUST estar protegido con `@Roles('ADMIN')`. Para un `RECRUITER` MUST responder `403` con cuerpo JSON. Para un `ADMIN` MUST responder `200` con una lista vacía (`[]`). Sin sesión MUST responder `401`. El registro real de visitas queda fuera del alcance.

#### Scenario: Reclutador recibe 403 JSON

- GIVEN una sesión con rol `RECRUITER`
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `403` con `Content-Type` JSON y cuerpo parseable

#### Scenario: Administrador recibe lista vacía

- GIVEN una sesión con rol `ADMIN`
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `200` con cuerpo `[]`

#### Scenario: Sin sesión

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `401`

### Requirement: Endpoints de contenido fuera de alcance

`GET /api/v1/profile`, `GET /api/v1/experience` y `GET /api/v1/skills` MUST responder `404` con cuerpo JSON, también con sesión válida. MUST NOT exponer datos ni estar documentados en Swagger.

#### Scenario: 404 con sesión

- GIVEN una sesión válida
- WHEN se piden `/api/v1/profile`, `/api/v1/experience?limit=2` y `/api/v1/skills?level=advanced`
- THEN las tres responden `404` con cuerpo JSON

### Requirement: Swagger sin rutas de administración

La documentación en `/api/docs` MUST NOT incluir ninguna ruta bajo `/api/v1/admin` y MUST NOT incluir ejemplos de cookies, tokens ni secretos.

#### Scenario: Admin oculto

- GIVEN la aplicación configurada con `configureApp`
- WHEN se genera el documento OpenAPI
- THEN ninguna clave de `paths` comienza con `/api/v1/admin`

#### Scenario: Sin secretos en la documentación

- GIVEN el documento OpenAPI generado
- WHEN se busca en su JSON
- THEN no hay valores de cookies `__Host-access` ni `__Secure-refresh` ni tokens de ejemplo reales

### Requirement: Errores JSON consistentes

Toda respuesta de error de los endpoints de esta capacidad (`401`, `403`, `404`) MUST ser JSON y MUST NOT filtrar trazas, rutas internas, SQL ni detalles de claves.

#### Scenario: Error sin filtraciones

- GIVEN una petición que produce `401`, otra `403` y otra `404`
- WHEN se inspeccionan los cuerpos
- THEN son JSON y no contienen `stack`, rutas de archivo ni fragmentos SQL

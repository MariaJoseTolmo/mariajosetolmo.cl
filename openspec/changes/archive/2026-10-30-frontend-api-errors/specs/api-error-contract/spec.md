# api-error-contract

## Purpose

Capacidad nueva y transversal de `apps/api`. Fija la forma de todo cuerpo de error JSON y el catálogo de `code` estables que el cliente usa para decidir el copy. El `message` es técnico, en inglés, y no es para la usuaria. Decisión D1 de la propuesta `frontend-api-errors`. El catálogo de 10 códigos está cerrado por el diseño (A2, A5).

## Requirements

### Requirement: Forma del cuerpo de error

Toda respuesta de error de la API (4xx y 5xx con cuerpo JSON) MUST tener exactamente las claves `statusCode` (número), `error` (frase HTTP), `message` (string) y `code` (string del catálogo). Esto aplica a errores de dominio, a los guards (JWT, Roles, Origin), a `ClientIpResolver`, al 404 del router, a los errores de body-parser (JSON malformado, cuerpo demasiado grande) y a cualquier excepción no prevista. El `message` MUST NOT contener SQL, rutas internas, credenciales ni el valor enviado por el cliente (ni la ruta pedida ni fragmentos del cuerpo).

#### Scenario: Forma completa en un error de dominio

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/experience?limit=0`
- THEN la respuesta es `400` con claves exactamente `statusCode`, `error`, `message`, `code`
- AND `code` es `INVALID_INPUT`

#### Scenario: Error de guard con la misma forma

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/me`
- THEN la respuesta es `401` con `code` `UNAUTHENTICATED` y las cuatro claves

#### Scenario: Ruta inexistente

- GIVEN cualquier petición
- WHEN se envía `GET` a una ruta que no existe
- THEN la respuesta es `404` con `code` `NOT_FOUND` y las cuatro claves
- AND el `message` es fijo y no contiene la ruta pedida

#### Scenario: JSON malformado

- GIVEN una petición `POST` con `Content-Type: application/json` y cuerpo que no es JSON válido
- WHEN se envía
- THEN la respuesta es `400` JSON con las cuatro claves y `code` `INVALID_INPUT`
- AND el `message` no contiene fragmentos del cuerpo enviado

#### Scenario: Cuerpo demasiado grande

- GIVEN una petición con un cuerpo que supera el límite de tamaño
- WHEN se envía
- THEN la respuesta es `413` JSON con las cuatro claves y `code` `INVALID_INPUT`

#### Scenario: Excepción desconocida

- GIVEN una excepción no prevista durante el procesamiento
- WHEN el filtro global la traduce
- THEN la respuesta es `500` con las cuatro claves y `code` `INTERNAL_ERROR`
- AND el `message` es fijo y no expone el texto de la excepción

### Requirement: Catálogo de códigos por causa

El catálogo MUST contener exactamente estos 10 `code`: `INVALID_INPUT` (400), `INVALID_TOKEN` (400), `UNAUTHENTICATED` (401), `CDN_REQUIRED` (403), `ORIGIN_NOT_ALLOWED` (403), `ROLE_NOT_ALLOWED` (403), `NOT_FOUND` (404), `RATE_LIMITED` (429), `SERVICE_UNAVAILABLE` (503) e `INTERNAL_ERROR` (500). Cada causa MUST mapear a un único `code` estable, independiente de la redacción de `message`. Los tres 403 MUST distinguirse por `code`: `CDN_REQUIRED` (falta la señal del CDN en producción), `ORIGIN_NOT_ALLOWED` (`OriginGuard`) y `ROLE_NOT_ALLOWED` (`RolesGuard`). Un token de verificación desconocido, vencido, ya usado o mal formado MUST responder `400` con un único `code` (`INVALID_TOKEN`), sin distinguir la causa. El refresh de sesión MUST responder siempre `UNAUTHENTICATED` (401), sea cual sea la causa. Cualquier error de dominio sin entrada en el catálogo y cualquier excepción desconocida MUST responder `500` `INTERNAL_ERROR`. Para errores derivados de `HttpException`, el `message` MUST ser un texto fijo por `code`, no el de la excepción original.

#### Scenario: Los tres 403 se distinguen por code

- GIVEN producción sin `CloudFront-Viewer-Address` en una ruta `/api/auth/*`, un POST con Origin no permitido y un RECRUITER en `/api/v1/admin/visits`
- WHEN se envía cada petición
- THEN las tres responden `403` con `code` `CDN_REQUIRED`, `ORIGIN_NOT_ALLOWED` y `ROLE_NOT_ALLOWED` respectivamente

#### Scenario: Cambiar el message no cambia el code

- GIVEN un test que sustituye el `message` de un error por otro texto
- WHEN el cliente o el test evalúa la causa
- THEN el `code` sigue siendo el mismo

#### Scenario: Token desconocido, vencido, usado o mal formado

- GIVEN un token inexistente, uno vencido, uno ya consumido y uno mal formado
- WHEN se envía cada uno a la verificación
- THEN las cuatro respuestas tienen el mismo `statusCode` (`400`) y el mismo `code` (`INVALID_TOKEN`)

#### Scenario: Refresh siempre UNAUTHENTICATED

- GIVEN un refresh con cookie ausente, otro con token vencido y otro con token revocado
- WHEN se envía cada uno a `POST /api/auth/refresh`
- THEN las tres respuestas son `401` con `code` `UNAUTHENTICATED`

#### Scenario: 429 y 503

- GIVEN el límite por IP agotado y, en otro caso, Redis o Postgres caído
- WHEN se envía la petición afectada
- THEN la primera responde `429` con `RATE_LIMITED` y la cabecera `Retry-After` en segundos
- AND la segunda responde `503` con `SERVICE_UNAVAILABLE` sin detalles de conexión

#### Scenario: Magic-link no depende de que el correo exista

- GIVEN un correo registrado, uno nuevo y uno con el límite por email agotado, con el mismo estado de IP, Origin e infraestructura
- WHEN se envía `POST /api/auth/magic-link` con cada uno
- THEN los tres reciben el mismo status y el mismo cuerpo (sin `code` de error), o el mismo `code` si falla por formato, CDN, Origin, límite por IP o infraestructura
- AND ningún `code` de error de este endpoint depende de que el correo exista

### Requirement: Cobertura del contrato en e2e

Los tests e2e MUST verificar que cada error producido por la API trae un `code` perteneciente al catálogo. Un `code` fuera del catálogo MUST hacer fallar el test. La lista de `code` de la API MUST ser igual, en contenido y orden, a la lista que usa la web (test de contrato).

#### Scenario: Todo error trae un code del catálogo

- GIVEN la suite e2e recorriendo los errores 400, 401, 403, 404, 429 y 503
- WHEN se evalúa cada cuerpo
- THEN todos incluyen un `code` del catálogo

#### Scenario: Code desconocido

- GIVEN un error cuyo `code` no está en el catálogo
- WHEN corre el test de contrato
- THEN el test falla

#### Scenario: Catálogo de la API igual al de la web

- GIVEN la lista de `code` de la API y la lista de `code` de la web
- WHEN corre el test de contrato
- THEN ambas listas son iguales en contenido y orden

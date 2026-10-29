# web-api-errors

## Purpose

Capacidad nueva de `apps/web`. Define cómo el cliente traduce un error de la API en un `ApiFailure` y en copy accionable, en español neutro. Decisiones D1–D4 de la propuesta `frontend-api-errors`. Los `code` citados son los del catálogo cerrado en `api-error-contract`.

## Requirements

### Requirement: Modelo ApiFailure y traducción code/status

Todo fallo del puerto `ApiGateway` MUST resolver con un `ApiFailure { error: ApiErrorKind; status?: number; reason?: ApiErrorReason; retryAfterSeconds?: number }`, donde `ok` es `false` y el campo `error` (el tipo de fallo) conserva su nombre actual. `status` MUST estar ausente cuando no hay respuesta HTTP (fallo de red). `reason` MUST derivarse únicamente del `code` del cuerpo, y solo si ese `code` pertenece al catálogo. Un cuerpo sin `code`, con un `code` desconocido, vacío o no JSON (HTML del CDN o del WAF) MUST producir un `ApiFailure` sin `reason`, sin lanzar excepción; en ese caso `error` se deriva del status y el copy cae al de `error`. El `code` tiene prioridad sobre el status. El conjunto de `ApiErrorKind` MUST incluir `invalid-input` (400, 413 y 422 sin `code`, y `code` `INVALID_INPUT`), además de los existentes.

#### Scenario: El code manda sobre el status

- GIVEN una respuesta `403` con `code` `ROLE_NOT_ALLOWED`
- WHEN el adaptador `http` la traduce
- THEN `status` es 403, `error` es `forbidden` y `reason` es `ROLE_NOT_ALLOWED`, no CDN

#### Scenario: Sin code el fallo se deriva del status

- GIVEN una respuesta `429` JSON sin `code`
- WHEN se traduce
- THEN `error` es `rate-limited` y no hay `reason`

#### Scenario: Cuerpo no JSON

- GIVEN una respuesta `403` con cuerpo HTML
- WHEN se traduce
- THEN el resultado tiene `status` 403, `error` `forbidden` y ningún `reason`, y se muestra el copy genérico de 403 (restricción de seguridad)

#### Scenario: Code desconocido

- GIVEN una respuesta `400` con `code` `ALGO_NUEVO`, que no está en el catálogo
- WHEN se traduce
- THEN no hay `reason` y `error` es `invalid-input`

#### Scenario: Entrada inválida

- GIVEN una respuesta `400` con `code` `INVALID_INPUT`
- WHEN se traduce
- THEN `error` es `invalid-input` y `reason` es `INVALID_INPUT`

#### Scenario: Fallo de red sin status

- GIVEN un `fetch` que rechaza por falta de conexión
- WHEN el adaptador `http` lo traduce
- THEN `error` es `network` y `status` está ausente

#### Scenario: Cuerpo de error ilegible

- GIVEN una respuesta `500` cuyo cuerpo no puede leerse
- WHEN se traduce
- THEN el resultado es un fallo `server` con `status` 500 y no un fallo `network`

### Requirement: Refresh de sesión y fallos que no cierran sesión

Tras un 401 el adaptador `http` MUST intentar una única vez el refresh. Si el refresh responde 400 o 401, el resultado MUST ser `unauthorized`. Cualquier otro fallo del refresh (403, 429, 5xx, red) MUST traducirse con su propio `ApiFailure` y copy, sin convertirse en `unauthorized`.

#### Scenario: Refresh rechazado por sesión

- GIVEN `GET /api/v1/me` responde 401 y `POST /api/auth/refresh` responde 401
- WHEN se ejecuta `getMe()`
- THEN el resultado es `unauthorized`

#### Scenario: Refresh bloqueado por el CDN

- GIVEN `GET /api/v1/me` responde 401 y `POST /api/auth/refresh` responde 403 con `code` `CDN_REQUIRED`
- WHEN se ejecuta `getMe()`
- THEN el resultado es `forbidden` con `reason` `CDN_REQUIRED`, no `unauthorized`

#### Scenario: Refresh limitado

- GIVEN el refresh responde 429 con `Retry-After: 30`
- WHEN se ejecuta `getMe()`
- THEN el resultado es `rate-limited` con `retryAfterSeconds` 30

### Requirement: Retry-After opcional

Para un 429, el adaptador MUST leer `Retry-After` solo si viene en segundos, como entero entre 1 y 86400, y exponerlo como `retryAfterSeconds`. Si la cabecera falta, es `0`, negativa, está fuera de rango, es una fecha HTTP o no es un entero, `retryAfterSeconds` MUST quedar ausente. La UI MUST mostrar un tiempo estimado solo cuando existe, redondeado hacia arriba (menos de 60 s: "unos segundos"; menos de 3600 s: minutos; desde 3600 s: horas), y MUST NOT mostrar cuenta atrás ni deshabilitar el control por tiempo. Sin tiempo, la UI MUST mostrar el texto de espera genérico ("unos minutos").

#### Scenario: Retry-After válido

- GIVEN un `429` con `Retry-After: 120`
- WHEN se traduce
- THEN `retryAfterSeconds` es 120 y el texto menciona un tiempo estimado de 2 minutos

#### Scenario: Retry-After ausente o inválido

- GIVEN un `429` sin `Retry-After`, y otros con `abc`, `0`, `-5`, `86401` y una fecha HTTP
- WHEN se traducen
- THEN `retryAfterSeconds` está ausente en todos y el texto usa la espera genérica

#### Scenario: Redondeo

- GIVEN `Retry-After` de 30, 61 y 7200
- WHEN se muestra el error
- THEN los textos indican "unos segundos", 2 minutos y 2 horas respectivamente

#### Scenario: Sin cuenta atrás

- GIVEN un `429` con `Retry-After: 30` mostrado
- WHEN transcurre el tiempo con timers falsos
- THEN el texto no cambia

### Requirement: Diccionario central de copy

El copy de errores MUST vivir en un diccionario central tipado (`src/content/apiErrors.ts`), en español neutro, con una entrada por `reason` y una por `error` (tipo de fallo), sobrescribible por pantalla. La resolución MUST seguir este orden: override del `reason`, texto del `reason`, override del `error`, texto del `error`. Los textos con tiempo MUST usar el placeholder `{wait}` y el código fuente del copy MUST NOT contener cifras literales de tiempo. Ninguna pantalla MUST mostrar el `message` de la API ni los términos "CloudFront", nombres de cabeceras ni la topología. El 403 por `CDN_REQUIRED` u `ORIGIN_NOT_ALLOWED` MUST decir: "La solicitud no llegó desde el sitio oficial. Abre mariajosetolmo.cl directamente e inténtalo de nuevo." El 403 por `ROLE_NOT_ALLOWED` MUST tener copy propio, distinto del anterior. Un 403 sin `code` (HTML del CDN o del WAF) MUST usar el copy de `error` `forbidden`, distinto de los dos anteriores.

#### Scenario: Message nunca en el DOM

- GIVEN una respuesta de error cuyo `message` es "Request did not come through the CDN"
- WHEN se renderiza cualquier pantalla con ese error
- THEN el DOM no contiene ese texto ni "CloudFront"

#### Scenario: 403 por CDN u Origin

- GIVEN `code` `CDN_REQUIRED` y luego `ORIGIN_NOT_ALLOWED`
- WHEN se muestra el error
- THEN ambos muestran el texto de sitio oficial, sin nombres de cabeceras

#### Scenario: 403 por rol

- GIVEN `code` `ROLE_NOT_ALLOWED`
- WHEN se muestra el error
- THEN el copy es el de rol y no incluye el texto de sitio oficial

#### Scenario: Sobrescritura por pantalla

- GIVEN una pantalla con un override para `SERVICE_UNAVAILABLE`
- WHEN ocurre un 503 con ese `code`
- THEN se muestra el override y, para los demás `reason`, el texto del diccionario

#### Scenario: Orden de resolución

- GIVEN un override para `error` `server` y un fallo `server` con `reason` `SERVICE_UNAVAILABLE`
- WHEN se resuelve el copy
- THEN se usa el texto del `reason` y no el override del `error`

### Requirement: Reintento manual, nunca automático en login

Ante 503, error de servidor o falla de red la UI MUST ofrecer un reintento manual con el texto "Reintentar". En login, el mismo botón de envío MUST cambiar su texto a "Reintentar" cuando el fallo es `server` o `network`, sin añadir un segundo botón. El `POST` de login (`requestMagicLink`) MUST NOT reintentarse automáticamente ante ningún error.

#### Scenario: 503 con botón

- GIVEN `getMe` que resuelve con 503
- WHEN se renderiza la pantalla
- THEN existe el botón "Reintentar" y al pulsarlo se vuelve a invocar el gateway una vez

#### Scenario: Login sin reintento automático

- GIVEN un gateway cuyo `requestMagicLink` responde 503
- WHEN se envía el formulario y transcurre el tiempo con timers falsos
- THEN `requestMagicLink` fue invocado exactamente una vez

#### Scenario: Botón de envío como Reintentar

- GIVEN `requestMagicLink` que falla con 503 y, en otro caso, con error de red
- WHEN se muestra el error en el formulario
- THEN el único botón de envío dice "Reintentar" y no hay un segundo botón

### Requirement: Roles ARIA de los errores

Los errores de formulario y de acción MUST usar `role="alert"`. Los errores de carga MUST usar `role="status"`. El copy MUST ser breve. Las pantallas con error MUST pasar `jest-axe` con 0 violaciones.

#### Scenario: Roles por tipo

- GIVEN un error de envío de login y un error de carga de `getMe`
- WHEN se renderizan
- THEN el primero tiene `role="alert"` y el segundo `role="status"`

#### Scenario: Accesibilidad

- GIVEN cada pantalla en estado de error
- WHEN se ejecuta `axe`
- THEN hay 0 violaciones

### Requirement: Mock alineado con el catálogo

El adaptador mock MUST poder simular 403, 429 (con y sin `Retry-After`) y 503 usando los mismos `code` del catálogo de la API y el mismo traductor que el adaptador `http`. La inyección MUST ser de un solo uso: una clave `web-cv-mock-error` en `sessionStorage` con valor `"<CODE>"` o `"RATE_LIMITED:<segundos>"`, que se consume en la siguiente llamada al gateway. La simulación MUST NOT depender del correo enviado.

#### Scenario: Mock simula errores

- GIVEN la clave `web-cv-mock-error` con `ORIGIN_NOT_ALLOWED`, luego `RATE_LIMITED:120`, `RATE_LIMITED` y `SERVICE_UNAVAILABLE`
- WHEN se invoca el gateway mock tras cada asignación
- THEN cada fallo lleva el `reason` del `code` del catálogo y, en el caso con segundos, `retryAfterSeconds` 120

#### Scenario: Un solo uso

- GIVEN la clave `web-cv-mock-error` asignada y una llamada ya fallida
- WHEN se invoca el gateway una segunda vez
- THEN la segunda llamada no falla por la inyección y la clave ya no existe

### Requirement: Verify con un único estado de token inválido

La página de verificación MUST mapear el tipo de fallo así: `invalid-token`, `invalid-input` y `unauthorized` → un único estado "enlace no válido" (variante `invalid`), sin distinguir vencido de usado; `forbidden` → variante `blocked` con eyebrow "403 Forbidden" y el copy de su `reason`; `rate-limited` → copy de espera con `{wait}`; `network`, `server` y `unexpected` → variante `unavailable`. Un 403, 429 o 5xx MUST NOT mostrarse como "enlace no válido". MUST ofrecerse "Reintentar" en `blocked`, `rate-limited` y `unavailable` (el token no se consume antes del límite por IP ni de los guards), y "Pedir un nuevo enlace" en `invalid`. El foco MUST ir al título.

#### Scenario: 403 no es enlace inválido

- GIVEN `verifyToken` que resuelve con 403 `ORIGIN_NOT_ALLOWED`
- WHEN la usuaria confirma el ingreso
- THEN se muestra la variante `blocked` con el copy de sitio oficial, "Reintentar", y no "Este enlace no es válido"

#### Scenario: Token inválido, vencido, usado o mal formado

- GIVEN respuestas `400` `INVALID_TOKEN` para token inexistente, vencido, usado y mal formado
- WHEN se muestran
- THEN el HTML del estado es idéntico en los cuatro casos y ofrece "Pedir un nuevo enlace"

#### Scenario: 429 y 503 en verify

- GIVEN `verifyToken` con 429 y luego con 503
- WHEN se muestra el error
- THEN el 429 usa el copy de espera y el 503 usa la variante `unavailable`, y ambos ofrecen "Reintentar"

### Requirement: Zona reclutador distingue causas

Los fallos de `getMe`, `getCvLink` y `logout` MUST mostrar copy por `reason` o por `error`: 403, 429, 5xx y falta de red tienen textos distintos. Solo `unauthorized` MUST redirigir a `/acceso/`. En el playground, una respuesta 4xx o 5xx con `failure` MUST mostrar bajo el bloque de código una línea de copy, sin ocultar el status ni el cuerpo crudos.

#### Scenario: Causas distintas

- GIVEN `getMe` con 403, 429, 503 y `network` en cuatro renders
- WHEN se muestra cada error
- THEN los cuatro textos son distintos y ninguno redirige

#### Scenario: Error en CV

- GIVEN `getCvLink` que resuelve con 503
- WHEN se pulsa "Descargar PDF"
- THEN se muestra el copy de servicio no disponible y no el genérico de conexión

#### Scenario: Error en logout

- GIVEN `logout` que resuelve con 429
- WHEN se pulsa cerrar sesión
- THEN se muestra el copy de espera con `role="alert"`

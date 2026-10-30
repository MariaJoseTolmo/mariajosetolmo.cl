# Delta for web-recruiter-access

## MODIFIED Requirements

### Requirement: Estado "enviado" idéntico

El estado "sent" MUST mostrarse únicamente cuando `requestMagicLink` resuelve con 2xx, y MUST ser idéntico (mismo texto y estructura) sin importar si el correo existe o qué cuerpo 2xx devolvió la API. Ante 400, 403, 429, 503 o error de red MUST NOT mostrarse "sent": MUST mostrarse un error con copy propio por situación (ver `web-api-errors`) y el formulario MUST permitir reintentar manualmente. La UI MUST NOT revelar si el correo está registrado. Justificación de anti-enumeración: ningún error posible depende de que el correo exista (400 por formato, 403 por CDN u Origin, 429 por IP, 503 por infraestructura) y el límite por email sigue respondiendo 202 idéntico. Un test MUST impedir que un error dependa del correo.
(Previously: "sent" se mostraba siempre, incluso ante errores no accionables, salvo error de red.)

#### Scenario: Respuestas 2xx distintas, misma UI

- GIVEN un gateway que resuelve con éxito y otro que responde 202 con cuerpo distinto
- WHEN se envía el formulario en cada caso
- THEN el HTML del estado "sent" es idéntico en ambos

#### Scenario: Estado sent accesible

- GIVEN el estado "sent" renderizado
- WHEN se ejecuta `axe`
- THEN hay 0 violaciones y el mensaje se anuncia con `role="status"` o `aria-live`

#### Scenario: Errores no 2xx no muestran "enviado"

- GIVEN un gateway que falla con 400, 403, 429, 503 y `network` en cinco envíos
- WHEN se envía el formulario en cada caso
- THEN no aparece el estado "sent" y cada caso muestra un copy distinto con `role="alert"`
- AND el formulario sigue disponible para reintentar

#### Scenario: Reintentar en 503 y red

- GIVEN un gateway que falla con 503 y, en otro envío, con `network`
- WHEN se muestra el error
- THEN el único botón de envío dice "Reintentar" y no se llama de nuevo a `requestMagicLink` hasta que la usuaria lo pulse

#### Scenario: Ningún error depende del correo

- GIVEN un correo registrado y otro que no existe, con el mismo estado de IP, Origin e infraestructura
- WHEN se envía el login con cada uno
- THEN el resultado (status, `code` y UI) es idéntico en ambos

#### Scenario: 429 con tiempo

- GIVEN `requestMagicLink` con 429 y `Retry-After: 60`
- WHEN se muestra el error
- THEN el texto indica un tiempo estimado y no hay cuenta atrás

### Requirement: Guard de sesión en la zona reclutador

`/reclutador/` MUST llamar a `ApiGateway.getMe()` (`GET /api/v1/me`) al montar y MUST mostrar el estado "Verificando sesión" (con `role="status"`) hasta resolver; durante ese estado MUST NOT renderizar el contenido protegido. Ante 401, el adaptador `http` MUST intentar una única vez `POST /api/auth/refresh` y repetir `GET /api/v1/me`; si el refresh responde 400 o 401, o el reintento de `GET /api/v1/me` vuelve a dar 401, `getMe` MUST resolver con el error `unauthorized` y la página MUST redirigir a `/acceso/`. Un refresh que falla con 403, 429, 5xx o red MUST resolver con su propio fallo (no `unauthorized`) y no redirigir. Con 200 MUST renderizar la zona. Un error distinto de 401 (red, 403, 429, 5xx) MUST NOT redirigir: MUST mostrar copy propio según la situación (ver `web-api-errors`) con opción de reintentar.
(Previously: cualquier error de red o servidor mostraba un único mensaje genérico de conexión.)

#### Scenario: Estado de verificación

- GIVEN `getMe` pendiente
- WHEN se renderiza `/reclutador/`
- THEN se ve "Verificando sesión" y no existen las tarjetas

#### Scenario: Un solo refresh

- GIVEN un `fetch` fake donde `GET /api/v1/me` responde siempre 401 y `POST /api/auth/refresh` responde 200
- WHEN el adaptador `http` ejecuta `getMe()`
- THEN `fetch` recibe exactamente un `POST /api/auth/refresh` y dos `GET /api/v1/me`, y el resultado es el error `unauthorized`

#### Scenario: Refresh recupera la sesión

- GIVEN un `fetch` fake donde `GET /api/v1/me` responde 401 y, tras el refresh, 200
- WHEN se renderiza la página con el adaptador `http`
- THEN se muestra la zona reclutador y no hay redirección

#### Scenario: Refresh bloqueado no redirige

- GIVEN un `fetch` fake donde `GET /api/v1/me` responde 401 y `POST /api/auth/refresh` responde 403 con `code` `CDN_REQUIRED`
- WHEN el adaptador `http` ejecuta `getMe()`
- THEN el resultado es un fallo `forbidden` y la página muestra el copy de sitio oficial con "Reintentar", sin redirigir

#### Scenario: Sin sesión

- GIVEN un gateway cuyo `getMe` resuelve con el error `unauthorized`
- WHEN se renderiza la página
- THEN se llama al router con `/acceso/`

#### Scenario: Error de red no cierra la sesión

- GIVEN un gateway cuyo `getMe` resuelve con el error `network`
- WHEN se renderiza la página
- THEN no hay redirección y existe un botón "Reintentar"

#### Scenario: Errores 403, 429 y 5xx con copy propio

- GIVEN un gateway cuyo `getMe` resuelve con 403, 429 o 503 en tres renders
- WHEN se renderiza la página
- THEN no hay redirección, cada caso muestra un copy distinto entre sí y distinto del de red, y existe "Reintentar"

### Requirement: API Playground

La zona MUST incluir un playground con cinco endpoints: `/api/v1/profile`, `/api/v1/experience?limit=2`, `/api/v1/skills?level=advanced`, `/api/v1/me` y `/api/v1/admin/visits`. Cada botón de endpoint MUST exponer `aria-pressed` (true solo en el seleccionado). Seleccionar un endpoint MUST mostrar su respuesta en un bloque de código con el status y el cuerpo crudos. Para respuestas 4xx y 5xx MUST mostrarse además una línea explicativa tomada del diccionario de `web-api-errors`, sin reemplazar ni ocultar el cuerpo crudo. `/api/v1/admin/visits` MUST mostrar un 403 cuando el rol es RECRUITER.
(Previously: solo se mostraban status y cuerpo crudos, sin línea explicativa.)

#### Scenario: Cinco endpoints con aria-pressed

- GIVEN el playground renderizado
- WHEN se cuentan los botones de endpoint
- THEN son 5 y exactamente uno tiene `aria-pressed="true"`

#### Scenario: Cambio de selección

- GIVEN el endpoint por defecto seleccionado
- WHEN se hace clic en `/api/v1/skills?level=advanced`
- THEN ese botón pasa a `aria-pressed="true"`, el anterior a `"false"` y el bloque muestra su respuesta

#### Scenario: 403 en admin

- GIVEN un usuario con rol RECRUITER
- WHEN se selecciona `/api/v1/admin/visits`
- THEN el bloque muestra estado 403

#### Scenario: Línea explicativa en 4xx y 5xx

- GIVEN un usuario RECRUITER
- WHEN se selecciona `/api/v1/admin/visits`
- THEN, además del status 403 y el cuerpo crudo, aparece la línea de copy de rol no permitido

#### Scenario: Sin línea en 2xx

- GIVEN una respuesta 200
- WHEN se selecciona `/api/v1/profile`
- THEN no se muestra línea explicativa

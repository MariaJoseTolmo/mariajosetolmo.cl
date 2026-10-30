# Delta for api-recruiter-endpoints

## MODIFIED Requirements

### Requirement: GET /api/v1/cv con URL firmada

`GET /api/v1/cv` MUST requerir sesión válida y responder `200` JSON `{ url, expiresAt }`, donde `url` es una URL firmada temporal generada por el puerto `CvLinkSigner` y `expiresAt` es un instante ISO 8601 en UTC. La validez MUST ser corta (alrededor de 5 minutos, configurable). La URL MUST NOT quedar persistida ni registrada en logs. En local y test MUST usarse una implementación falsa que devuelva una URL de ejemplo. Al entregar el enlace, el sistema MUST registrar un evento `CV_LINK` según `api-admin-visits`; ese evento MUST guardarse sin la URL firmada (solo usuario, `kind` e instante), y un fallo del registro MUST NOT alterar la respuesta.
(Previously: la spec afirmaba que la URL no queda persistida ni registrada, sin mencionar el evento `CV_LINK`.)

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

#### Scenario: El evento CV_LINK no guarda la URL

- GIVEN una sesión válida de `recruiter@example.test` y un `CvLinkSigner` fake que devuelve `https://cv.example.test/signed?sig=abc`
- WHEN se envía `GET /api/v1/cv` y responde `200`
- THEN se almacena un evento `CV_LINK` del usuario
- AND ningún dato almacenado ni ninguna línea de log contiene `https://cv.example.test/signed?sig=abc`

## REMOVED Requirements

### Requirement: Stub de /api/v1/admin/visits

(Reason: el stub que devolvía `[]` se reemplaza por el listado real de la capacidad `api-admin-visits`, que cambia el cuerpo a `{ items, next }`. El único consumidor es el playground, que como RECRUITER recibe 403. Los casos de acceso se conservan en `api-admin-visits`, requisito "Acceso restringido a ADMIN": RECRUITER recibe `403` JSON `ROLE_NOT_ALLOWED` y sin sesión se recibe `401`. El escenario "Administrador recibe lista vacía" desaparece como contrato de `[]`; su equivalente es `{ items: [], next: null }` en `api-admin-visits`.)

## ADDED Requirements

### Requirement: Acceso a /api/v1/admin/visits delegado

`GET /api/v1/admin/visits` MUST seguir restringido al rol ADMIN: para un `RECRUITER` MUST responder `403` con cuerpo JSON y para una petición sin sesión MUST responder `401`. El contrato de la respuesta del ADMIN (forma, paginación, filtros y errores) se define en la capacidad `api-admin-visits`.

#### Scenario: Reclutador recibe 403 JSON

- GIVEN una sesión con rol `RECRUITER`
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `403` con `Content-Type` JSON y cuerpo parseable

#### Scenario: Sin sesión

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `401`

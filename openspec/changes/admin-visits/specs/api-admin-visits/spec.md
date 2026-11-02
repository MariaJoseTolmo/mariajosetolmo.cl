# Delta for api-admin-visits

Capacidad nueva. Define el registro de la actividad de reclutadores (`LOGIN` y `CV_LINK`), su privacidad y retención, y el listado paginado `GET /api/v1/admin/visits` para el rol ADMIN. Decisiones vinculantes de la propuesta: D1 (solo actividad de reclutadores) y P1 a P6 (aceptadas). Los escenarios usan solo datos sintéticos (`*.example.test`).

## ADDED Requirements

### Requirement: Registro de eventos LOGIN y CV_LINK

El sistema MUST registrar un evento de visita con `kind` `LOGIN` cuando una verificación de magic link tiene éxito y se crea la sesión. El sistema MUST registrar un evento con `kind` `CV_LINK` cuando `GET /api/v1/cv` entrega un enlace de CV. Cada evento MUST asociarse al usuario autenticado y MUST tener un instante de ocurrencia en UTC. El sistema MUST registrar cada pedido de enlace de CV, sin deduplicar. Una verificación fallida (token desconocido, vencido, usado o mal formado) MUST NOT crear ningún evento. Una petición a `GET /api/v1/cv` sin sesión (401) MUST NOT crear ningún evento. `POST /api/auth/magic-link` MUST NOT registrar eventos y su respuesta MUST seguir siendo idéntica para correos existentes, nuevos y con límite agotado.

#### Scenario: Verify exitoso crea un evento LOGIN

- GIVEN un usuario `recruiter@example.test` con un token de verificación válido y sin eventos previos
- WHEN se verifica el token con éxito
- THEN existe exactamente un evento `LOGIN` asociado a ese usuario
- AND su instante de ocurrencia es el del reloj de la aplicación

#### Scenario: Verify fallido no crea eventos

- GIVEN un token inexistente, uno vencido, uno ya consumido y uno mal formado
- WHEN se envía cada uno a la verificación
- THEN las cuatro respuestas son `400` `INVALID_TOKEN`
- AND no se creó ningún evento

#### Scenario: Entrega del CV crea un evento CV_LINK

- GIVEN una sesión válida de `recruiter@example.test`
- WHEN se envía `GET /api/v1/cv` y responde `200`
- THEN existe exactamente un evento `CV_LINK` asociado a ese usuario

#### Scenario: Cada pedido de CV se registra

- GIVEN una sesión válida de `recruiter@example.test`
- WHEN se envían tres `GET /api/v1/cv` autenticados
- THEN existen tres eventos `CV_LINK` para ese usuario

#### Scenario: CV sin sesión no registra

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/cv`
- THEN la respuesta es `401`
- AND no se creó ningún evento

#### Scenario: Magic-link no registra y no revela existencia

- GIVEN un correo registrado, uno nuevo y uno con el límite por email agotado
- WHEN se envía `POST /api/auth/magic-link` con cada uno
- THEN no se creó ningún evento
- AND las respuestas siguen siendo las que fija `api-error-contract` (mismo status y cuerpo, sin depender de que el correo exista)

### Requirement: Registro best effort

El registro de eventos MUST NOT alterar el resultado de la operación que lo origina. Si el registro falla (por ejemplo, la base de datos rechaza la escritura), el login MUST completar con la misma respuesta y las mismas cookies, y `GET /api/v1/cv` MUST responder el mismo `200 { url, expiresAt }`. El fallo MUST quedar en el log del servidor, y ese log MUST NOT contener correo, IP, user agent, token ni la URL firmada.

#### Scenario: Fallo del registro en el login

- GIVEN un token válido de `recruiter@example.test` y un registro de eventos que lanza un error
- WHEN se verifica el token
- THEN la respuesta y las cookies de sesión son las mismas que sin fallo
- AND se emitió un log de error

#### Scenario: Fallo del registro en el CV

- GIVEN una sesión válida y un registro de eventos que lanza un error
- WHEN se envía `GET /api/v1/cv`
- THEN la respuesta es `200` con `url` y `expiresAt` válidos

#### Scenario: El log de fallo no contiene datos personales

- GIVEN un registro que falla durante el login de `recruiter@example.test`
- WHEN se inspecciona lo que se escribió en el log
- THEN no contiene `recruiter@example.test`, ni IP, ni user agent, ni el token, ni una URL firmada

### Requirement: Privacidad de los datos registrados

Un evento MUST contener únicamente el usuario asociado, el `kind` y el instante de ocurrencia (más un identificador propio). El sistema MUST NOT almacenar correo, IP, user agent ni la URL firmada del CV en el evento. La respuesta de `GET /api/v1/admin/visits` MUST NOT incluir correo, IP, user agent, `user_id` ni la URL firmada. El valor de `kind` MUST pertenecer al conjunto `LOGIN`, `CV_LINK`, y un valor fuera de ese conjunto MUST ser rechazado por el almacenamiento.

#### Scenario: El evento no guarda datos de la petición

- GIVEN un verify exitoso y un `GET /api/v1/cv` con cabeceras `User-Agent` y una IP de cliente conocidas
- WHEN se inspeccionan los eventos almacenados
- THEN cada uno tiene solo identificador, usuario, `kind` e instante
- AND ninguno contiene el correo, la IP, el user agent ni la URL firmada

#### Scenario: kind fuera del conjunto se rechaza

- GIVEN un intento de almacenar un evento con `kind` distinto de `LOGIN` y `CV_LINK`
- WHEN se escribe en el almacenamiento
- THEN la escritura se rechaza

### Requirement: Retención de 180 días y borrado en cascada

Los eventos con más de 180 días de antigüedad MUST eliminarse mediante una purga por retención; los eventos con 180 días o menos MUST conservarse. La purga MUST NOT depender de una tarea programada (el mecanismo de disparo lo fija el diseño). Al borrar a un usuario, el sistema MUST borrar todos sus eventos. La purga y el borrado en cascada MUST NOT afectar eventos de otros usuarios.

#### Scenario: Purga de eventos antiguos

- GIVEN un evento de hace 181 días y otro de hace 179 días, y un reloj fijo
- WHEN se ejecuta la purga por retención
- THEN el evento de 181 días ya no existe
- AND el de 179 días se conserva

#### Scenario: Borde de 180 días

- GIVEN un evento ocurrido exactamente 180 días antes del reloj fijo
- WHEN se ejecuta la purga por retención
- THEN el evento se conserva

#### Scenario: Borrado del usuario elimina su historial

- GIVEN `recruiter@example.test` con 3 eventos y `other@example.test` con 2 eventos
- WHEN se borra al usuario `recruiter@example.test`
- THEN sus 3 eventos dejan de existir
- AND los 2 eventos de `other@example.test` se conservan

### Requirement: GET /api/v1/admin/visits con paginación por cursor

`GET /api/v1/admin/visits` MUST estar protegido para el rol ADMIN y MUST responder `200` JSON `{ items, next }`. Cada elemento de `items` MUST tener exactamente las claves `id` (string), `kind` (`"LOGIN"` o `"CV_LINK"`), `occurredAt` (ISO 8601 en UTC) y `recruiter` (objeto con exactamente `company` y `name`, cada uno string o `null`, siempre presentes). Los ítems MUST ordenarse por `occurredAt` descendente y, ante empate de instante, por `id` descendente, de forma estable y determinista. `limit` MUST ser entero en 1..50 con el mismo valor por defecto que `PageLimit` (5). El parámetro opcional `kind` MUST aceptar `LOGIN` o `CV_LINK` y filtrar los ítems; sin `kind` se devuelven ambos tipos.

`cursor` MUST ser un valor opaco, codificado en base64url, que identifica la posición compuesta (instante e `id`) del último ítem devuelto. La página siguiente MUST contener los eventos estrictamente posteriores a esa posición en el orden descrito (paginación keyset, no offset), sin omitir ni repetir eventos aunque compartan el mismo instante. `next` MUST ser la URL relativa de la página siguiente (`/api/v1/admin/visits?cursor=<opaco>&limit=<limit>`, conservando `limit` y `kind` si se envió) o `null` en la última página. Un usuario sin eventos MUST producir `{ items: [], next: null }`.

#### Scenario: Forma estricta de un ítem

- GIVEN una sesión ADMIN y un evento `LOGIN` de un reclutador con `company` "Acme" y `name` "Ana"
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `200` con claves exactamente `items` y `next`
- AND el ítem tiene exactamente `id`, `kind`, `occurredAt` y `recruiter`
- AND `recruiter` tiene exactamente `company` y `name`

#### Scenario: company y name nulos

- GIVEN un evento de un reclutador sin `company` ni `name`
- WHEN el ADMIN pide el listado
- THEN `recruiter.company` es `null` y `recruiter.name` es `null` (las claves existen)

#### Scenario: Sin correo ni identificadores internos

- GIVEN eventos de `recruiter@example.test`
- WHEN el ADMIN pide el listado y se busca en el cuerpo
- THEN el cuerpo no contiene `recruiter@example.test`, ni IP, ni user agent, ni el `user_id`

#### Scenario: Listado vacío

- GIVEN una sesión ADMIN y ningún evento
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `200` con `{ items: [], next: null }`

#### Scenario: Orden descendente

- GIVEN tres eventos con instantes distintos
- WHEN el ADMIN pide el listado con `limit=50`
- THEN los ítems vienen del más reciente al más antiguo

#### Scenario: Empate de instante desempata por id

- GIVEN dos eventos con exactamente el mismo `occurredAt`
- WHEN el ADMIN pide el listado
- THEN el orden relativo es el del `id` descendente y es el mismo en cada petición

#### Scenario: Paginación completa sin omitir ni repetir

- GIVEN 7 eventos, entre ellos 3 con el mismo `occurredAt`
- WHEN el ADMIN pide `limit=2` y sigue `next` hasta que sea `null`
- THEN la concatenación de las páginas contiene exactamente los 7 eventos, sin repetidos y en el orden definido
- AND cada página, salvo la última, tiene `next` no nulo y 2 ítems

#### Scenario: Límite por defecto

- GIVEN 8 eventos
- WHEN el ADMIN pide el listado sin `limit`
- THEN `items` tiene 5 elementos y `next` no es `null`

#### Scenario: next conserva limit y kind

- GIVEN eventos `LOGIN` y `CV_LINK` suficientes para más de una página
- WHEN el ADMIN pide `?limit=2&kind=LOGIN`
- THEN `next` apunta a `/api/v1/admin/visits` con `cursor` opaco, `limit=2` y `kind=LOGIN`
- AND al seguirlo todos los ítems son `LOGIN`

#### Scenario: Filtro por kind

- GIVEN 2 eventos `LOGIN` y 3 eventos `CV_LINK`
- WHEN el ADMIN pide `?kind=CV_LINK&limit=50`
- THEN `items` tiene 3 elementos, todos `CV_LINK`

#### Scenario: Cursor que apunta después del último evento

- GIVEN el cursor obtenido de la última página
- WHEN el ADMIN lo envía en una petición nueva
- THEN la respuesta es `200` con `{ items: [], next: null }`

### Requirement: Validación de limit, cursor y kind

`limit` fuera de 1..50, no entero, negativo, `0`, vacío o repetido; `kind` distinto de `LOGIN` y `CV_LINK` (incluida la minúscula, vacío o repetido); y `cursor` que no sea base64url válido, que no decodifique a una posición compuesta válida (basura, vacío, instante o `id` inválidos) o que esté repetido, MUST responder `400` con `{statusCode, error, message, code}` y `code` `INVALID_INPUT`. El mensaje MUST NOT repetir el valor recibido. Un cursor mal formado MUST NOT producir `500`.

#### Scenario: limit inválido

- GIVEN una sesión ADMIN
- WHEN se envía `GET /api/v1/admin/visits?limit=abc`, `limit=0`, `limit=51`, `limit=2.5`, `limit=` o `limit=1&limit=2`
- THEN todas responden `400` JSON con `code` `INVALID_INPUT`
- AND el cuerpo no contiene el valor enviado

#### Scenario: kind inválido

- GIVEN una sesión ADMIN
- WHEN se envía `GET /api/v1/admin/visits?kind=login`, `kind=OTHER` o `kind=`
- THEN todas responden `400` con `code` `INVALID_INPUT`

#### Scenario: cursor basura

- GIVEN una sesión ADMIN
- WHEN se envía `cursor=<script>`, `cursor=%%%`, `cursor=` o un base64url válido que decodifica a algo que no es una posición (por ejemplo, texto arbitrario)
- THEN todas responden `400` con `code` `INVALID_INPUT`, claves exactamente `statusCode`, `error`, `message`, `code`
- AND el cuerpo no contiene el valor enviado

#### Scenario: cursor con componentes inválidos

- GIVEN un cursor base64url bien formado cuyo instante no es una fecha válida, y otro cuyo `id` no es válido
- WHEN el ADMIN los envía
- THEN ambos responden `400` `INVALID_INPUT` y ninguno responde `500`

### Requirement: Acceso restringido a ADMIN

`GET /api/v1/admin/visits` MUST responder `401` con `code` `UNAUTHENTICATED` sin sesión y `403` con `code` `ROLE_NOT_ALLOWED` para un `RECRUITER`, ambos con cuerpo JSON, antes de leer ningún evento. Un RECRUITER MUST NOT poder ver eventos propios ni ajenos por esta ruta.

#### Scenario: RECRUITER recibe 403

- GIVEN una sesión con rol `RECRUITER` y eventos existentes
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `403` JSON con `code` `ROLE_NOT_ALLOWED`
- AND el cuerpo no contiene ningún evento

#### Scenario: Sin sesión recibe 401

- GIVEN una petición sin cookies
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `401` JSON con `code` `UNAUTHENTICATED`

### Requirement: Error 503 ante caída del almacenamiento

Si el almacenamiento de eventos no está disponible al listar, `GET /api/v1/admin/visits` MUST responder `503` con `code` `SERVICE_UNAVAILABLE` y cuerpo JSON sin detalles de conexión, SQL ni credenciales. Este endpoint MUST NOT introducir ningún `code` fuera del catálogo de `api-error-contract`.

#### Scenario: Postgres caído

- GIVEN una sesión ADMIN y el almacenamiento no disponible
- WHEN se envía `GET /api/v1/admin/visits`
- THEN la respuesta es `503` con `code` `SERVICE_UNAVAILABLE`
- AND el cuerpo no contiene detalles de conexión ni SQL

#### Scenario: Todo error del endpoint trae un code del catálogo

- GIVEN las respuestas 400, 401, 403 y 503 de este endpoint
- WHEN se evalúa cada cuerpo
- THEN todos incluyen un `code` perteneciente al catálogo de `api-error-contract`

### Requirement: Cabecera no-store y rutas ocultas

Toda respuesta de `GET /api/v1/admin/visits`, incluidos los errores, MUST incluir `Cache-Control: no-store`. La ruta MUST seguir oculta de Swagger (ninguna clave de `paths` bajo `/api/v1/admin`).

#### Scenario: no-store en éxito y error

- GIVEN respuestas 200 (ADMIN), 400, 401 y 403 de esta ruta
- WHEN se inspeccionan las cabeceras
- THEN todas incluyen `Cache-Control: no-store`

#### Scenario: Ruta oculta en Swagger

- GIVEN el documento OpenAPI generado
- WHEN se inspeccionan sus `paths`
- THEN ninguna clave comienza con `/api/v1/admin`

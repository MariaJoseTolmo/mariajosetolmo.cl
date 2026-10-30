# api-content-endpoints

## Purpose

Capacidad de contenido de `apps/api`. Define los endpoints `GET /api/v1/profile`, `GET /api/v1/experience` y `GET /api/v1/skills` que consume el playground de la zona reclutador. Los datos viven en Postgres (tablas `profile`, `experience` y `skill`) y se siembran por migración desde el contenido de `apps/web/src/content`. Las decisiones C1–C4 de la propuesta `content-endpoints` son vinculantes.

Origen: change `content-endpoints` (archivado el 2026-10-28, ver `openspec/changes/archive/2026-10-28-content-endpoints/archive-report.md`).

Modificada por el change `frontend-api-errors` (archivado el 2026-10-30, ver `openspec/changes/archive/2026-10-30-frontend-api-errors/archive-report.md`): requisito "Validación de limit y cursor".

## Requirements

### Requirement: Sesión obligatoria y no-store

Las tres rutas MUST requerir sesión válida (C1) y MUST NOT usar `@Public()`. Sin sesión MUST responder `401` JSON. Toda respuesta (`200`, `400`, `401`, `503`) MUST incluir `Cache-Control: no-store`.

#### Scenario: Sin sesión

- GIVEN una petición sin cookies
- WHEN se envía `GET` a `/api/v1/profile`, `/api/v1/experience` o `/api/v1/skills`
- THEN las tres responden `401` con cuerpo JSON

#### Scenario: Cabecera no-store

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/profile`
- THEN la respuesta es `200` y `Cache-Control` es `no-store`

### Requirement: GET /api/v1/profile con forma estricta

`GET /api/v1/profile` MUST responder `200` JSON con exactamente las claves `name` (string), `role` (string), `architecture` (string), `domains` (array de strings) y `openToWork` (boolean). La respuesta MUST NOT incluir otras claves (email, teléfono, sueldo, fechas, id interno). Los datos MUST provenir de la tabla `profile` (fila única).

#### Scenario: Forma completa

- GIVEN una sesión válida y el seed aplicado
- WHEN se envía `GET /api/v1/profile`
- THEN la respuesta es `200` y su conjunto de claves es exactamente `name`, `role`, `architecture`, `domains`, `openToWork`
- AND `openToWork` es de tipo boolean

### Requirement: GET /api/v1/experience con paginación por cursor

`GET /api/v1/experience` MUST responder `200` JSON `{ items, next }`. Cada elemento de `items` MUST tener exactamente `id`, `company`, `role`, `sector`, `period`, `highlights` (array) y `technologies` (array); `position` MUST NOT exponerse. Los ítems MUST seguir el orden de `position`. `limit` MUST ser entero en 1..50 (por defecto 5).

`cursor` MUST ser un entero no negativo no mayor que `Number.MAX_SAFE_INTEGER`. Su valor MUST ser la `position` del último ítem devuelto: la página siguiente contiene los ítems con `position` mayor que el cursor (paginación keyset, no offset). Sin `cursor` se parte desde el inicio (equivale a 0).

`next` MUST ser la URL de la página siguiente (`/api/v1/experience?cursor=<position>&limit=<limit>`, conservando `limit`) o `null` en la última página (C3).

Los ceros a la izquierda en `limit` y `cursor` MUST aceptarse y normalizarse (`007` equivale a `7`). La URL de `next` MUST usar la forma normalizada.

#### Scenario: Primera página con limit

- GIVEN una sesión válida y 5 ítems sembrados
- WHEN se envía `GET /api/v1/experience?limit=2`
- THEN la respuesta es `200` con 2 `items` en orden de `position`
- AND `next` es un string que apunta a `/api/v1/experience` con `cursor` y `limit=2`

#### Scenario: Última página

- GIVEN una sesión válida y 5 ítems sembrados
- WHEN se sigue `next` hasta agotar los ítems
- THEN la última respuesta tiene `next` igual a `null`
- AND la unión de las páginas contiene los 5 ítems sin repetidos ni omitidos

#### Scenario: Valores por defecto

- GIVEN una sesión válida y 5 ítems sembrados
- WHEN se envía `GET /api/v1/experience` sin parámetros
- THEN `items` tiene 5 elementos y `next` es `null`

#### Scenario: Límites válidos

- GIVEN una sesión válida
- WHEN se envía `limit=1` y luego `limit=50`
- THEN ambas responden `200`

#### Scenario: Cursor más allá del final

- GIVEN una sesión válida y 5 ítems sembrados
- WHEN se envía `GET /api/v1/experience?cursor=100000` o `cursor=9007199254740991` (`Number.MAX_SAFE_INTEGER`)
- THEN la respuesta es `200` con `{ items: [], next: null }`

#### Scenario: Ceros a la izquierda

- GIVEN una sesión válida y 5 ítems sembrados
- WHEN se envía `GET /api/v1/experience?limit=02&cursor=002`
- THEN la respuesta es idéntica a la de `GET /api/v1/experience?limit=2&cursor=2`

### Requirement: Validación de limit y cursor

`limit` fuera de 1..50, no entero (`abc`, `2.5`), negativo, `0`, vacío o repetido, y `cursor` no numérico, negativo o mayor que `Number.MAX_SAFE_INTEGER`, MUST responder `400` con `{statusCode, error, message, code}` y `code` igual a `INVALID_INPUT` (ver `api-error-contract`). El mensaje MUST NOT repetir el valor recibido.

#### Scenario: limit inválido

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/experience?limit=abc`, `limit=0`, `limit=51`, `limit=2.5`, `limit=` o `limit=1&limit=2`
- THEN todas responden `400` JSON con `code` `INVALID_INPUT`
- AND el cuerpo no contiene el valor enviado

#### Scenario: cursor inválido

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/experience?cursor=<script>`
- THEN la respuesta es `400` con `code` `INVALID_INPUT` y el cuerpo no contiene `<script>`

#### Scenario: cursor por encima del máximo seguro

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/experience?cursor=9007199254740993`
- THEN la respuesta es `400` `INVALID_INPUT`, con claves exactamente `statusCode`, `error`, `message`, `code`, y el cuerpo no contiene el número enviado

### Requirement: GET /api/v1/skills por nivel

`level` MUST pertenecer a `advanced`, `production`, `architecture`, `learning` (C2). Con `level` válido MUST responder `200` `{ level, skills }` con `skills` array de strings en orden estable; si el nivel no tiene habilidades, `skills` MUST ser `[]` (nunca `{ levels: [] }`). Sin `level` MUST responder `200` `{ levels: [{ level, skills }] }` con los cuatro niveles. Un `level` inválido o vacío MUST responder `400` `INVALID_INPUT` sin repetir la entrada.

#### Scenario: Nivel válido

- GIVEN una sesión válida y el seed aplicado
- WHEN se envía `GET /api/v1/skills?level=advanced`
- THEN la respuesta es `200` con claves exactamente `level` y `skills`, y `level` es `"advanced"`

#### Scenario: Nivel válido sin habilidades

- GIVEN una sesión válida y un nivel válido sin filas en la tabla `skill`
- WHEN se envía `GET /api/v1/skills?level=learning`
- THEN la respuesta es `200` con `{ level: "learning", skills: [] }`

#### Scenario: Sin level

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/skills`
- THEN la respuesta es `200` con la única clave `levels`, que contiene los cuatro niveles
- AND cada elemento tiene exactamente `level` y `skills`

#### Scenario: Nivel inválido

- GIVEN una sesión válida
- WHEN se envía `GET /api/v1/skills?level=expert`
- THEN la respuesta es `400` JSON y el cuerpo no contiene `expert`

### Requirement: Disponibilidad de Postgres

Si Postgres no está disponible, las tres rutas MUST responder `503` JSON sin filtrar detalles de conexión, SQL ni rutas internas (patrón `availability`, DataSource perezoso).

#### Scenario: Postgres caído

- GIVEN una sesión válida y un repositorio cuya base de datos falla
- WHEN se envía `GET /api/v1/profile`
- THEN la respuesta es `503` JSON sin `stack`, SQL ni credenciales

### Requirement: Swagger de contenido

Las tres rutas MUST aparecer en `/api/docs` con el tag `content` y autenticación por cookie. Las rutas bajo `/api/v1/admin` MUST seguir ausentes.

#### Scenario: Rutas documentadas

- GIVEN la aplicación configurada con `configureApp`
- WHEN se genera el documento OpenAPI
- THEN `paths` incluye `/api/v1/profile`, `/api/v1/experience` y `/api/v1/skills` con el tag `content`
- AND ninguna clave de `paths` comienza con `/api/v1/admin`

### Requirement: Contrato seed y web

El seed MUST mantener los ids estables y las empresas de `apps/web/src/content`, y los cuatro niveles y sus habilidades de `stack.ts`. Un test de contrato MUST fallar en CI si divergen. La migración MUST usar SQL plano, una sentencia por `query()`, con `down` que elimine las tablas `profile`, `experience` y `skill`.

#### Scenario: Seed alineado

- GIVEN el seed de la migración y `apps/web/src/content`
- WHEN corre el test de contrato
- THEN cada id y empresa de `experience.ts` existe en el seed y cada columna de `stack.ts` coincide con un `level`

#### Scenario: Deriva detectada

- GIVEN una empresa presente en la web y ausente del seed
- WHEN corre el test de contrato
- THEN el test falla

### Requirement: Escaneo de contenido del seed y de las respuestas

El contenido sembrado y las respuestas de las tres rutas MUST NOT contener sueldo ni montos, fechas o condiciones de disponibilidad, teléfonos, emails ni referencias a archivos de CV. Los nombres de empleadores MAY mostrarse (decisión vigente). `openToWork` MUST permanecer booleano. Un test en `apps/api` MUST escanear el seed con reglas equivalentes al content-guard de la web.

#### Scenario: Seed limpio

- GIVEN el contenido del seed
- WHEN corre el escaneo
- THEN no hay coincidencias de sueldo, teléfono, email, fecha de disponibilidad ni archivos de CV

#### Scenario: Dato prohibido

- GIVEN un seed con un teléfono o un monto de sueldo
- WHEN corre el escaneo
- THEN el test falla

#### Scenario: Empleadores permitidos

- GIVEN un seed con nombres de empresa
- WHEN corre el escaneo
- THEN el nombre de empresa no se marca como violación

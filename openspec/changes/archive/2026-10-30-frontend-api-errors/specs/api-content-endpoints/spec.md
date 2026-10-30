# Delta for api-content-endpoints

## MODIFIED Requirements

### Requirement: Validación de limit y cursor

`limit` fuera de 1..50, no entero (`abc`, `2.5`), negativo, `0`, vacío o repetido, y `cursor` no numérico, negativo o mayor que `Number.MAX_SAFE_INTEGER`, MUST responder `400` con `{statusCode, error, message, code}` y `code` igual a `INVALID_INPUT` (ver `api-error-contract`). El mensaje MUST NOT repetir el valor recibido.
(Previously: el cuerpo era `{statusCode, error, message}` y el código de dominio `INVALID_INPUT` no se exponía.)

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

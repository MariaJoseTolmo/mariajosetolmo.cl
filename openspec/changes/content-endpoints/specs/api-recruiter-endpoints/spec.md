# Delta for api-recruiter-endpoints

## MODIFIED Requirements

### Requirement: Endpoints de contenido fuera de alcance

`GET /api/v1/profile`, `GET /api/v1/experience` y `GET /api/v1/skills` MUST estar implementados y requerir sesión válida; su contrato se define en la capacidad `api-content-endpoints`. Sin sesión MUST responder `401` JSON. Estas tres rutas MUST estar documentadas en Swagger (tag `content`). Cualquier otra ruta inexistente bajo `/api/v1` MUST seguir respondiendo `404` con cuerpo JSON.
(Previously: las tres rutas respondían `404` JSON incluso con sesión, no exponían datos y no figuraban en Swagger.)

#### Scenario: Rutas de contenido con sesión

- GIVEN una sesión válida
- WHEN se piden `/api/v1/profile`, `/api/v1/experience?limit=2` y `/api/v1/skills?level=advanced`
- THEN las tres responden `200` con cuerpo JSON (ya no `404`)

#### Scenario: Rutas de contenido sin sesión

- GIVEN una petición sin cookies
- WHEN se pide cualquiera de las tres rutas
- THEN la respuesta es `401` con cuerpo JSON

#### Scenario: Ruta inexistente

- GIVEN una sesión válida
- WHEN se pide `/api/v1/unknown`
- THEN la respuesta es `404` con cuerpo JSON

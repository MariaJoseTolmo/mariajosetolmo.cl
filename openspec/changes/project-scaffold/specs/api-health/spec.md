# Especificación delta: api-health

Capacidad nueva. Define el comportamiento observable de `apps/api`: endpoint de salud, prefijo global, documentación Swagger y reglas de capas hexagonales del slice `health`.

## ADDED Requirements

### Requirement: Endpoint de salud

El sistema MUST exponer `GET /api/health` y responder `200 OK` con `Content-Type: application/json`. El cuerpo MUST tener la forma `{ "status": "ok" | "degraded" | "down", "checks": [{ "name": string, "status": "ok" | "down" }] }`. El endpoint MUST NOT requerir autenticación y MUST NOT incluir datos personales ni secretos.

#### Scenario: Salud con todas las sondas en verde
- GIVEN la aplicación creada con `configureApp(app)` y la sonda `process` registrada
- WHEN se envía `GET /api/health`
- THEN la respuesta tiene código 200
- AND el cuerpo contiene `status: "ok"`
- AND `checks` es un arreglo no vacío con elementos `{ name, status }`

#### Scenario: Una sonda falla
- GIVEN un `HEALTH_PROBES` con una sonda que reporta `down`
- WHEN se ejecuta el caso de uso `CheckHealth`
- THEN el resultado agregado tiene `status` distinto de `"ok"`
- AND el elemento correspondiente de `checks` tiene `status: "down"`

### Requirement: Prefijo global `/api`

Todas las rutas de la aplicación MUST servirse bajo el prefijo global `/api`, configurado en `configureApp` y reutilizado por `main.ts` y por los tests e2e. Las rutas fuera del prefijo MUST responder 404.

#### Scenario: Ruta sin prefijo
- GIVEN la aplicación creada con `configureApp(app)`
- WHEN se envía `GET /health`
- THEN la respuesta tiene código 404

#### Scenario: Ruta con prefijo
- GIVEN la misma aplicación
- WHEN se envía `GET /api/health`
- THEN la respuesta tiene código 200

### Requirement: Documentación Swagger bajo `/api/docs`

El sistema MUST servir la interfaz Swagger UI en `/api/docs` y la especificación OpenAPI en JSON en `/api/docs-json`. La especificación MUST describir `GET /api/health` con su esquema de respuesta (DTO) y la etiqueta del controlador.

#### Scenario: Swagger UI disponible
- GIVEN la aplicación creada con `configureApp(app)`
- WHEN se envía `GET /api/docs`
- THEN la respuesta tiene código 200
- AND el tipo de contenido es `text/html`

#### Scenario: Especificación JSON describe el endpoint
- GIVEN la misma aplicación
- WHEN se envía `GET /api/docs-json`
- THEN la respuesta tiene código 200
- AND el JSON contiene la ruta `/api/health` con método `get`

### Requirement: Límites de capas hexagonales verificados por lint

La estructura del slice MUST ser `domain/`, `application/` (con `ports/`) e `infrastructure/`. ESLint (`no-restricted-imports`) MUST fallar ante imports prohibidos:
- `domain/` MUST NOT importar `@nestjs/*`, `application/`, `infrastructure/` ni `bootstrap/`.
- `application/` MUST NOT importar `infrastructure/`; de `@nestjs/*` solo MAY importar `Injectable` e `Inject`.
- `infrastructure/` MAY importar `domain/` y `application/`.

#### Scenario: Dominio importa Nest
- GIVEN un archivo en `apps/api/src/health/domain/` con `import { Injectable } from '@nestjs/common'`
- WHEN se ejecuta `npm run lint`
- THEN el comando termina con código distinto de 0
- AND el reporte cita la regla `no-restricted-imports`

#### Scenario: Aplicación importa infraestructura
- GIVEN un archivo en `apps/api/src/health/application/` que importa desde `../infrastructure/`
- WHEN se ejecuta `npm run lint`
- THEN el comando termina con código distinto de 0

#### Scenario: Estructura válida
- GIVEN el slice `health` sin imports prohibidos
- WHEN se ejecuta `npm run lint`
- THEN el comando termina con código 0

### Requirement: Puertos inyectados con token explícito

Los puertos (interfaces) MUST inyectarse con un token explícito exportado desde `application/ports/` (por ejemplo `HEALTH_PROBES`) y `@Inject(token)`. El enlace puerto-adaptador MUST ocurrir únicamente en `health.module.ts`. El sistema MUST NOT depender de metadata de tipos de decoradores para resolver puertos.

#### Scenario: El caso de uso recibe sondas por token
- GIVEN `CheckHealth` con constructor `@Inject(HEALTH_PROBES)`
- WHEN el test unitario lo instancia con sondas falsas
- THEN el caso de uso agrega los resultados de las sondas falsas sin importar infraestructura

#### Scenario: Único punto de enlace
- GIVEN el código fuente de `apps/api/src`
- WHEN se busca el proveedor de `HEALTH_PROBES`
- THEN aparece solo en `health.module.ts`

### Requirement: Pruebas del slice escritas primero

El slice MUST tener un test unitario del caso de uso `CheckHealth` (Jest, sin Nest ni red) y un test e2e (`supertest`) del endpoint. Los tests MUST escribirse antes del código de producción (strict TDD).

#### Scenario: Unit y e2e en verde
- GIVEN el slice `health` implementado
- WHEN se ejecutan `npm test` y `npm run test:e2e`
- THEN ambos comandos terminan con código 0
- AND el e2e cubre 200 en `/api/health`, 404 en `/health` y 200 en `/api/docs`

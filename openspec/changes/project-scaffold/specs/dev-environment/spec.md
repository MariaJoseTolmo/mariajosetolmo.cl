# Especificación delta: dev-environment

Capacidad nueva. Define el workspace npm, la versión de Node, los scripts raíz, el entorno local con docker-compose, el hook de secretos y la compuerta de smoke test.

## ADDED Requirements

### Requirement: Workspace npm

El `package.json` raíz MUST declarar `"workspaces": ["apps/*"]` y `"private": true`. El directorio `spikes/` MUST quedar fuera del workspace, de ESLint (`ignores`) y de los jobs de CI.

#### Scenario: Workspaces resueltos
- GIVEN el repo con `apps/api`
- WHEN se ejecuta `npm ls --workspaces --depth=0`
- THEN la salida lista `apps/api`
- AND no lista nada de `spikes/`

#### Scenario: Spikes ignorados por lint
- GIVEN un archivo con error de lint dentro de `spikes/`
- WHEN se ejecuta `npm run lint`
- THEN el comando no reporta ese archivo

### Requirement: Versión de Node

El repo MUST incluir `.nvmrc` con Node 24 y la versión efectiva MUST ser >= 24.15.0 (Jest 30 necesita >= 24.9 para cargar paquetes ESM-only de Nest 12; el CLI de Nest 12 y npm 12 exigen >= 24.15). El campo `engines.node` MUST ser consistente con `.nvmrc`.

#### Scenario: Versión declarada
- GIVEN el archivo `.nvmrc`
- WHEN se lee su contenido
- THEN comienza con `24`
- AND `engines.node` exige `>=24.15.0 <25`

### Requirement: Scripts raíz

El `package.json` raíz MUST definir los scripts `lint`, `format:check`, `typecheck`, `test`, `test:e2e` y `build`, delegando a los workspaces (`--workspaces --if-present` o equivalente). `typecheck` MUST usar `tsc --noEmit` con `strict`.

#### Scenario: Scripts presentes
- GIVEN el `package.json` raíz
- WHEN se listan los scripts con `npm run`
- THEN aparecen `lint`, `format:check`, `typecheck`, `test`, `test:e2e` y `build`

#### Scenario: Instalación limpia y verificación
- GIVEN un checkout limpio con Node >= 24.15.0
- WHEN se ejecuta `npm ci && npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e && npm run build`
- THEN cada comando termina con código 0

### Requirement: Servicios docker-compose

`docker-compose.yml` MUST definir los servicios Postgres 18, Redis 8.10-alpine, Kafka (`apache/kafka`, KRaft, nodo único) y Mailpit. Cada servicio MUST tener `healthcheck`. Todos los puertos publicados MUST enlazarse a `127.0.0.1`. Las imágenes MUST fijar versión (o digest) y MUST NOT usar `latest`. Las credenciales MUST provenir de variables de `.env.example` con valores ficticios; el repo MUST NOT contener `.env` real y `.gitignore` MUST permitir `.env.example`.

#### Scenario: Servicios saludables
- GIVEN Docker disponible y `.env` copiado desde `.env.example`
- WHEN se ejecuta `docker compose up -d --wait`
- THEN los 4 servicios alcanzan el estado `healthy`

#### Scenario: Puertos solo en loopback
- GIVEN `docker-compose.yml`
- WHEN se ejecuta `docker compose config` y se inspeccionan los `ports`
- THEN cada mapeo comienza con `127.0.0.1:`

#### Scenario: Sin `latest` ni secretos reales
- GIVEN `docker-compose.yml` y `.env.example`
- WHEN se busca la cadena `:latest` y se ejecuta gitleaks sobre el árbol
- THEN no hay coincidencias de `latest`
- AND gitleaks no reporta hallazgos

### Requirement: Hook pre-commit de gitleaks

El repo MUST incluir `.githooks/pre-commit` que ejecute `gitleaks git --pre-commit --staged` (CLI v8.30.1; `protect` está deprecado). El script `prepare` MUST ejecutar `git config core.hooksPath .githooks`. El hook MUST bloquear el commit si hay hallazgos y MUST fallar con mensaje claro si gitleaks no está instalado.

#### Scenario: Activación por `prepare`
- GIVEN un clon recién instalado
- WHEN se ejecuta `npm ci`
- THEN `git config core.hooksPath` devuelve `.githooks`

#### Scenario: Commit con secreto bloqueado
- GIVEN un archivo staged con una clave que gitleaks detecta
- WHEN se ejecuta `git commit`
- THEN el commit es rechazado con código distinto de 0

### Requirement: Compuerta de smoke test

La primera tarea de implementación MUST ser un smoke test que demuestre que Jest 30 + ts-jest cargan Nest 12 en Node 24.x. Si el smoke test falla, la implementación MUST detenerse y consultar a la usuaria. El sistema MUST NOT cambiar a Vitest sin ADR y aprobación explícita.

#### Scenario: Smoke test exitoso
- GIVEN Node >= 24.15.0 con Jest 30, ts-jest y `@nestjs/core` 12
- WHEN un test importa `@nestjs/core` y crea un módulo mínimo con `Test.createTestingModule`
- THEN el test pasa y se continúa con el resto del plan

#### Scenario: Smoke test fallido
- GIVEN que el smoke test falla (por ejemplo error de carga ESM)
- WHEN el ejecutor lo detecta
- THEN se detiene el trabajo
- AND se consulta a la usuaria antes de cualquier cambio de herramienta

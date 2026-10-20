# Propuesta: Project Scaffold — workspace npm + `apps/api` hexagonal

## Intención

El repo no tiene código de aplicación, tests ni CI. Este cambio deja una base verificable: un monorepo npm con `apps/api` (NestJS 12, slice `health` hexagonal), entorno local con docker-compose, CI con compuertas de calidad y secretos, y strict TDD activado. Todo cambio posterior parte de aquí.

**Tecnologías fuera del CV**: ninguna con ADR obligatorio. Mailpit e imagen `apache/kafka` son solo de desarrollo y se justifican en el README. Vitest (contingencia) exigiría ADR.

## Alcance

### Dentro del alcance
- Raíz: `package.json` (`workspaces: ["apps/*"]`), `tsconfig.base.json` (TS `~6.0.x` strict), `eslint.config.mjs` (ESLint 10 flat + typescript-eslint, límites con `no-restricted-imports`), Prettier, `.nvmrc` (Node 24.x), `.editorconfig`.
- `apps/api`: NestJS 12 en CommonJS, build `tsc`, dev `nest start --watch`, `GET /api/health`, Swagger en `/api/docs`, puertos con `@Inject` y token explícito.
- Tests: Jest 30 + ts-jest (unit `CheckHealth`, e2e con supertest).
- `docker-compose.yml`: Postgres 18, Redis 8.10-alpine, Kafka KRaft (versión/digest fijado), Mailpit; puertos en `127.0.0.1`; `.env.example`.
- `.github/workflows/ci.yml` (jobs `quality` y `secrets`), `dependabot.yml`, `.githooks/pre-commit` (gitleaks CLI v8.30.1 con checksum, activado por `prepare`).
- `openspec/config.yaml` con `strict_tdd: true` + re-ejecutar `sdd-init`; README ("Por qué esta tecnología" + setup).
- Checks requeridos `quality`/`secrets` en el ruleset `protect-main` (paso manual documentado; o vía `gh api` con confirmación de la usuaria).

### Fuera del alcance
Adaptador de runtime Lambda, TypeORM/módulos de BD, productor Kafka, autenticación, `apps/web`, `infra/`/CDK de producción, `packages/shared`. `spikes/` queda excluido del workspace, del lint y del CI.

## Capacidades

### Capacidades nuevas
- `api-health`: endpoint de salud, prefijo `/api`, Swagger en `/api/docs`, reglas de capas hexagonales.
- `dev-environment`: workspace, scripts npm, docker-compose local y hook pre-commit.
- `ci-quality-gates`: workflow CI, permisos mínimos, pin por SHA, escaneo de secretos, Dependabot.

### Capacidades modificadas
Ninguna (`openspec/specs/` está vacío).

## Enfoque

Opción A de la exploración: CommonJS + Jest 30 + ts-jest sobre Node 24. **Tarea 1 = smoke test** (Nest 12 + Jest 30 en Node 24.x). Si falla: DETENERSE y consultar a la usuaria; no cambiar a Vitest sin ADR y aprobación. Tests escritos antes del código del slice.

## Plan de PRs (stacked-to-main, sin lockfile)

| PR | Contenido | Líneas |
|----|-----------|--------|
| 1 | Smoke test, workspace, `apps/api` + `health`, lint, tests | ~500 (recortar a ≤400 moviendo e2e o lint al PR 2) |
| 2 | Compose, `.env.example`, CI, Dependabot, hook | ~260 |
| 3 | `strict_tdd`, `sdd-init`, README, checks requeridos | ~80 |

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `package.json`, configs raíz, `apps/api/` | Nuevo |
| `docker-compose.yml`, `.env.example`, `.githooks/` | Nuevo |
| `.github/` | Nuevo |
| `.gitignore`, `openspec/config.yaml`, `README.md` | Modificado |

## Riesgos

| # | Riesgo | Prob. | Mitigación |
|---|--------|-------|------------|
| R1 | Jest 30 no carga Nest 12 (ESM-only) | Alta | Smoke test en tarea 1; parar y preguntar |
| R2 | TS 6.0.x es puente | Media | Dependabot bloquea TS 7 |
| R3 | esbuild sin metadata de decoradores | Media | `tsc` + `@Inject` explícito; bundle en cambio de runtime |
| R4 | Swagger fuera de `/api/*` | Resuelto | `/api/docs` (brief actualizado) |
| R5 | Ruta de datos de Postgres 18 | Baja | Verificar volumen antes de fijarlo |
| R6 | `apache/kafka` sin tags claros | Baja | Fijar versión o digest |
| R7 | Licencia Redis 8 | Baja | Anotar en README |

## Plan de reversión

Cada PR se revierte con `git revert` del merge, en orden inverso (3 → 2 → 1). Quitar los checks requeridos del ruleset antes de revertir el PR 2. `docker compose down -v` limpia el entorno local.

## Dependencias

Ninguna sobre el resultado de `infra-spike`. Requiere Node 24.x local y Docker.

## Criterios de éxito

- [ ] `npm ci && npm run lint && npm test && npm run test:e2e` en verde, local y CI.
- [ ] `GET /api/health` responde 200; `/api/docs` sirve Swagger.
- [ ] ESLint falla ante un import prohibido entre capas.
- [ ] `docker compose up` deja los 4 servicios healthy en `127.0.0.1`.
- [ ] `quality` y `secrets` son checks requeridos en `protect-main`.
- [ ] `strict_tdd: true` y `sdd-init/web_cv` actualizado.
- [ ] Cada PR ≤ 400 líneas; sin secretos ni datos personales.

# Tareas: Project Scaffold (workspace npm + `apps/api` hexagonal)

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas cambiadas estimadas | PR 1 ~380, PR 2 ~340, PR 3 ~150 (sin lockfile) |
| Riesgo de presupuesto de 400 líneas | High (PR 1 al límite) |
| PRs encadenados recomendados | Yes |
| División sugerida | PR 1 -> PR 2 -> PR 3 |
| Estrategia de entrega | ask-on-risk (ya resuelta por la usuaria) |
| Estrategia de cadena | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Unidades de trabajo

| Unidad | Objetivo | PR | Notas |
|--------|----------|----|-------|
| 1 | Workspace + TS + Prettier + slice `health` (test-first) + unit + e2e | PR 1 | Base: `main`. Sin Swagger ni ESLint |
| 2 | ESLint + límites + compose + CI + Dependabot + hook | PR 2 | Base: `main` tras merge del PR 1. Requiere `gitleaks` local |
| 3 | Swagger + README + `strict_tdd` + checks requeridos | PR 3 | Base: `main` tras merge del PR 2 |

Reglas transversales: no tocar `spikes/`; shell solo con `rg/bat/fd/sd/eza`; commits convencionales por unidad de trabajo, sin atribución de IA; el PR se abre solo con el OK de la usuaria.

## PR 1: Fundación y slice `health`

- [ ] 1.1 Smoke test (compuerta): confirmar `node -v` >= 24.15 (local 24.19.0); crear `package.json` (raíz y `apps/api`), tsconfigs y `jest.config.js` mínimos; `npm install`; crear `apps/api/src/smoke.spec.ts` temporal (inyección por tipo + `Test.createTestingModule` + `app.init()`). Ejecutar `npx jest`, `npx tsc -p apps/api/tsconfig.json --noEmit` y `npm run build -w apps/api && node apps/api/dist/main.js`. Si falla por D1: probar UNA vez el plan B (`nodenext` + override `commonjs` en ts-jest). Si sigue fallando: DETENERSE y consultar a la usuaria (Vitest exige ADR y aprobación). Si pasa: borrar `smoke.spec.ts` y registrar en apply-progress.
- [ ] 1.2 Resolver todo NO VERIFICADO de la sección 3 del diseño con `npm view <pkg> version peerDependencies` (`@nestjs/testing`, `@nestjs/swagger`, patch de `typescript` 6.0.x, peer `jest@30` de `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `@types/node` 24.x, `@eslint/js`, `eslint-config-prettier`); fijar versiones exactas (D7).
- [ ] 1.3 Crear `package.json` raíz (`private`, `workspaces: ["apps/*"]`, `engines.node >=24.15.0 <25`, scripts `format:check`, `typecheck`, `test`, `test:e2e`, `build`), `.nvmrc` (`24`), `.npmrc` (`engine-strict=true`), `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `tsconfig.base.json` (spec dev-environment: Workspace, Node, Scripts).
- [ ] 1.4 Crear `apps/api/package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.js` (cobertura solo `domain/` y `application/`, umbral 80) y `test/jest-e2e.config.js`.
- [ ] 1.5 RED: `apps/api/src/health/domain/health-report.spec.ts` para `aggregate()` (ok / degraded / down / vacío). Ver que falla.
- [ ] 1.6 GREEN: `domain/health-report.ts` con tipos y `aggregate()` (TS puro).
- [ ] 1.7 RED: `application/check-health.use-case.spec.ts` con sondas falsas y una sonda `down`/rechazada (spec: Una sonda falla; El caso de uso recibe sondas por token). Ver que falla.
- [ ] 1.8 GREEN: `application/ports/health-probe.port.ts` (`HealthProbe`, `HEALTH_PROBES`) y `application/check-health.use-case.ts` (`@Injectable`, `@Inject(HEALTH_PROBES)`, `Promise.allSettled`).
- [ ] 1.9 RED: `apps/api/test/health.e2e-spec.ts`: `GET /api/health` 200 + contrato y `Cache-Control: no-store`; `GET /health` 404; `overrideProvider(HEALTH_PROBES)` con sonda `down` -> `degraded`. Ver que falla.
- [ ] 1.10 GREEN: `infrastructure/probes/process.probe.ts`, `infrastructure/http/health.controller.ts` (`@Inject(CheckHealth)`), `health.module.ts` (único enlace de `HEALTH_PROBES`), `app.module.ts`, `bootstrap/configure-app.ts` (prefijo `api`), `main.ts`.
- [ ] 1.11 Verificar: `npm ci && npm run format:check && npm run typecheck && npm test && npm run test:e2e && npm run build` con código 0; `rg "HEALTH_PROBES" apps/api/src` muestra el proveedor solo en `health.module.ts`.
- [ ] 1.12 Cierre del PR: medir `git diff --shortstat main -- . ':!package-lock.json'` (si > 400, fusionar `health-report.spec.ts` con el spec del caso de uso); escaneo de secretos con código de salida (`gitleaks git --redact --no-banner` o equivalente, debe dar 0); revisión de contexto fresco; commits convencionales por unidad; abrir PR solo con el OK de la usuaria.

## PR 2: Lint, entorno local y CI

- [ ] 2.0 PREREQUISITO (USUARIA): ejecutar `brew install gitleaks` (el hook falla cerrado). Confirmar con `gitleaks version` = 8.30.1.
- [ ] 2.1 Resolver NO VERIFICADOS: `gitleaks git --help` (flags `--pre-commit --staged`); `docker image inspect` de `postgres:18` (`.Config.Volumes`); tags y digests de `postgres:18.x-alpine`, `redis:8.10-alpine`, `apache/kafka:4.x`, `axllent/mailpit:v1.x` y el healthcheck de Mailpit (`/mailpit readyz`); SHA de 40 caracteres de `actions/checkout` v7.0.1 y `actions/setup-node` v7.1.0 con `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`; sha256 de `gitleaks_8.30.1_linux_x64.tar.gz` desde `checksums.txt` del release.
- [ ] 2.2 `eslint.config.mjs` (ignores `spikes/**`, `dist`, `coverage`; recommended + typed; `disableTypeChecked` en JS; `eslint-config-prettier` al final) y reglas `no-restricted-imports` por capa (diseño sección 6); agregar scripts `lint` y `lint:boundaries`.
- [ ] 2.3 `scripts/check-boundaries.mjs` con `ESLint#lintText` (domain importa Nest; application importa infrastructure -> exit 1 si no aparece `no-restricted-imports`); probar a mano que falla con import prohibido y pasa con `health` válido.
- [ ] 2.4 `docker-compose.yml` (4 servicios, `127.0.0.1:` en puertos, healthchecks, imágenes con tag+digest, sin `latest`, `${POSTGRES_PASSWORD:?...}`), `.env.example` (valores ficticios) y `.gitignore` (`!.env.example`, `coverage/`).
- [ ] 2.5 Verificar: `cp .env.example .env && docker compose up -d --wait` deja los 4 servicios `healthy`; `docker compose config` muestra solo `127.0.0.1:`; `rg ":latest" docker-compose.yml` sin resultados; luego `docker compose down -v`.
- [ ] 2.6 `.githooks/pre-commit` (modo 100755, falla cerrado) y script `prepare` (`git config core.hooksPath .githooks || true`); probar commit con secreto falso bloqueado y `git config core.hooksPath` = `.githooks` tras `npm ci`.
- [ ] 2.7 `.github/workflows/ci.yml` (jobs `quality` y `secrets`, permisos `contents: read`, SHA fijados con comentario de versión, checksum fijado, sin `pull_request_target`) y `.github/dependabot.yml` (npm con ignore major de `typescript`, github-actions, docker; semanal). Validar el pin con `rg "uses:" .github/workflows/ci.yml`.
- [ ] 2.8 Verificar: `npm run lint && npm run lint:boundaries` en verde; `spikes/` no aparece en `npm ls --workspaces --depth=0`.
- [ ] 2.9 Cierre del PR: medir líneas (<= 400); escaneo de secretos con código de salida 0; revisión de contexto fresco; commits convencionales sin atribución de IA; PR solo con el OK de la usuaria; confirmar `quality` y `secrets` en verde en el PR.

## PR 3: Swagger, documentación y strict TDD

- [ ] 3.1 Resolver NO VERIFICADO: `npm view @nestjs/swagger version peerDependencies`; fijar versión exacta.
- [ ] 3.2 RED: `apps/api/test/docs.e2e-spec.ts`: `GET /api/docs` 200 `text/html`; `GET /api/docs-json` 200 con ruta `/api/health` método `get`. Ver que falla.
- [ ] 3.3 GREEN: `health-response.dto.ts` (`@ApiProperty({ enum })`, `HealthCheckDto`), decoradores `@ApiTags('health')` y `@ApiOkResponse` en `health.controller.ts`, y `SwaggerModule.setup('api/docs', ...)` en `bootstrap/configure-app.ts`. Swagger siempre activo, también en producción.
- [ ] 3.4 `README.md`: setup, scripts, sección "Por qué esta tecnología" (una línea por pieza), nota de licencia de Redis 8, Mailpit/Kafka solo desarrollo.
- [ ] 3.5 `openspec/config.yaml`: `strict_tdd: true`, `runner`, `layers`, `coverage`, `quality`, `rules.apply.tdd: true`, `test_command: "npm test && npm run test:e2e"`, `rules.verify` (`build_command`, `coverage_threshold: 80`), actualizar `context`, eliminar `strict_tdd_note` (activación en el último PR).
- [ ] 3.6 Verificar: `npm ci && npm run lint && npm run lint:boundaries && npm run format:check && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde.
- [ ] 3.7 Cierre del PR: medir líneas (<= 400); escaneo de secretos con código de salida 0; revisión de contexto fresco; commits convencionales sin atribución de IA; PR solo con el OK de la usuaria.
- [ ] 3.8 Posterior al merge, tarea del ORQUESTADOR: re-ejecutar `sdd-init` para actualizar `sdd-init/web_cv`.
- [ ] 3.9 Posterior al merge, con CONFIRMACIÓN de la usuaria y con `ci.yml` ya en `main`: agregar `quality` y `secrets` como checks requeridos al ruleset `protect-main` (id 25500582) vía `gh api` (PUT del ruleset); verificar con `gh api repos/<owner>/<repo>/rulesets/25500582`.
- [ ] 3.10 Proponer ajuste de la spec `dev-environment` (comando `gitleaks git --pre-commit --staged`, `engines >=24.15.0`) y cerrar las preguntas abiertas del diseño.

## Orden e interdependencias

Secuencial estricto: PR 1 -> PR 2 -> PR 3 (stacked-to-main). Dentro de cada PR, 1.5-1.10 y 3.2-3.3 son RED -> GREEN secuenciales. Paralelizable: 1.3 con 1.4; 2.2-2.3 con 2.4-2.6 (tras 2.1).

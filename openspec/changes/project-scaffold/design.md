# Diseño: Project Scaffold — workspace npm + `apps/api` hexagonal

Monorepo npm con `apps/api` (NestJS 12, CommonJS, `tsc`), slice `health` hexagonal, Jest 30 + ts-jest, ESLint 10 con límites de capas, docker-compose local, CI `quality`/`secrets` y strict TDD al cierre. Se entrega en 3 PRs stacked-to-main. Implementa las specs `api-health`, `dev-environment` y `ci-quality-gates`.

> Tamaño: este diseño supera el presupuesto de 800 palabras de la skill porque el orquestador pidió 12 decisiones concretas. Todo va en tablas y bocetos.

## Ruta rápida

1. **Tarea 1 = smoke test** (sección 9). Si falla: DETENERSE y consultar.
2. PR 1: workspace + TS + Prettier + slice `health` (sin Swagger) + unit + e2e.
3. PR 2: ESLint + límites + compose + CI + Dependabot + hook.
4. PR 3: Swagger + README + `strict_tdd` + checks requeridos.

## 1. Decisiones de arquitectura

| # | Tema | Opción elegida | Rechazadas | Motivo |
|---|------|----------------|------------|--------|
| D1 | Resolución de módulos | `module: commonjs` + `moduleResolution: bundler` | `node`/`node10` (deprecado en TS 6); `nodenext` | Una sola config para `tsc`, Nest CLI y ts-jest. ts-jest limita los módulos "híbridos" (`node16`/`nodenext`) a `isolatedModules`, lo que quita el chequeo de tipos. `bundler` coincide con el bundle esbuild de Lambda que viene después. **NO VERIFICADO**: que TS 6.0 acepte `bundler` junto con `commonjs`; lo confirma el smoke test. Plan B: `nodenext` en `tsconfig.json` y un override `module: commonjs` solo en ts-jest |
| D2 | Nest dentro de `application/` | Solo `Injectable` e `Inject` de `@nestjs/common` | Ningún import de Nest (cablear con `useFactory`) | Lo exige la spec `api-health`. Los decoradores no hacen nada en `new CheckHealth([...])`, así que el test unitario sigue sin Nest. La opción "cero Nest" es más pura, pero agrega fábricas en el módulo y contradice el escenario `@Inject(HEALTH_PROBES)` |
| D3 | Inyección | Todo con `@Inject(token)` explícito, también en el controlador (`@Inject(CheckHealth)`) | Inyectar por tipo del constructor | Neutraliza el riesgo R3: esbuild no emite metadata de decoradores. `emitDecoratorMetadata` sigue activo por compatibilidad con Nest |
| D4 | Configs de Jest | Dos configs: `jest.config.js` (unit, `src/**/*.spec.ts`) y `test/jest-e2e.config.js` | `projects` en un solo config | Es la convención de Nest y da scripts `test` y `test:e2e` independientes, como pide la spec |
| D5 | Recorte del PR 1 | ESLint pasa al PR 2 y Swagger al PR 3 | Mover el e2e | El e2e es la aceptación del slice. ESLint encaja con las compuertas de CI. Swagger encaja con la documentación (README) |
| D6 | Hook sin gitleaks | El hook **falla cerrado** (`exit 1` con instrucción de instalación). `prepare` **nunca falla** (`\|\| true`) | Solo avisar | Requisito de seguridad del brief y de la spec. `prepare` no debe romper `npm ci` en entornos sin `.git`. El hook llega en el PR 2: la usuaria debe ejecutar `brew install gitleaks` antes de aplicarlo |
| D7 | Política de versiones | Versiones exactas (sin `^`), las actualiza Dependabot | Rangos con caret | Builds reproducibles. Sigue el estilo del spike |
| D1b | Flag de Jest (decisión de la usuaria, smoke 1.1) | Jest 30 + ts-jest + CommonJS, con `NODE_OPTIONS=--experimental-vm-modules jest` solo en `test`, `test:cov` y `test:e2e` (no depende de que npm eleve `jest` a la raíz; `require.resolve` está bloqueado por el `exports` de Jest) | Vitest; `nodenext`; ruta fija `../../node_modules/jest/bin/jest.js` (se rompe si `jest` no se eleva) | Jest necesita `vm.SourceTextModule` para cargar `@nestjs/*` 12 (solo ESM) con `require(esm)`; el tsconfig no lo resuelve. Build, dev y runtime siguen sin flag |
| D8 | Imágenes de compose | `nombre:tag-exacto@sha256:<digest>`, ecosistema `docker-compose` en Dependabot (el ecosistema `docker` no lee `docker-compose.yml`) | Solo tag | Una imagen inmutable. Dependabot actualiza tag y digest juntos |

## 2. Árbol de archivos y PRs

| Archivo | PR | Acción |
|---------|----|--------|
| `package.json`, `package-lock.json` (fuera del presupuesto) | 1 (el 2 agrega `lint`, `lint:boundaries`, `prepare`) | Crear |
| `tsconfig.base.json`, `.nvmrc` (`24`), `.npmrc` (`engine-strict=true`), `.editorconfig`, `.prettierrc.json`, `.prettierignore` | 1 | Crear |
| `apps/api/package.json`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.js` | 1 | Crear |
| `apps/api/src/main.ts`, `app.module.ts`, `bootstrap/configure-app.ts` | 1 (el 3 agrega Swagger en `configure-app.ts`) | Crear |
| `apps/api/src/health/health.module.ts` | 1 | Crear |
| `apps/api/src/health/domain/health-report.ts` (+ `.spec.ts`) | 1 | Crear |
| `apps/api/src/health/application/ports/health-probe.port.ts` | 1 | Crear |
| `apps/api/src/health/application/check-health.use-case.ts` (+ `.spec.ts`) | 1 | Crear |
| `apps/api/src/health/infrastructure/http/health.controller.ts` | 1 (el 3 agrega decoradores de Swagger) | Crear |
| `apps/api/src/health/infrastructure/probes/process.probe.ts` | 1 | Crear |
| `apps/api/test/jest-e2e.config.js`, `test/health.e2e-spec.ts` | 1 | Crear |
| `eslint.config.mjs`, `scripts/check-boundaries.mjs` | 2 | Crear |
| `docker-compose.yml`, `.env.example`, `.githooks/pre-commit` (modo 100755) | 2 | Crear |
| `.github/workflows/ci.yml`, `.github/dependabot.yml` | 2 | Crear |
| `.gitignore` (agregar `!.env.example` y `coverage/`) | 2 | Modificar |
| `apps/api/src/health/infrastructure/http/health-response.dto.ts`, `test/docs.e2e-spec.ts` | 3 | Crear |
| `README.md`, `openspec/config.yaml` | 3 | Crear / Modificar |

**Estimación** (sin lockfile): PR 1 ≈ 380 líneas, PR 2 ≈ 340, PR 3 ≈ 150. Antes de abrir el PR 1, medir con `git diff --shortstat main -- . ':!package-lock.json'`. Si pasa de 400, fusionar `health-report.spec.ts` con el spec del caso de uso.

**Dependencias**: las herramientas compartidas van en la raíz (`typescript`, `prettier` y, desde el PR 2, `eslint` y sus plugins). Lo propio de la app va en `apps/api` (Nest, `reflect-metadata`, `rxjs` y, como devDeps, Jest, ts-jest, supertest, `@nestjs/cli`, `@nestjs/testing`, `@types/*`).

## 3. Versiones

| Paquete | Versión | Estado |
|---------|---------|--------|
| `@nestjs/common`, `core`, `platform-express` | 12.2.0 | Verificado (spike y registro) |
| `@nestjs/testing` | 12.2.0 | NO VERIFICADO (se asume en sincronía con `core`) |
| `@nestjs/cli` | 12.0.10 | Verificado |
| `@nestjs/swagger` | 12.x, con peer `@nestjs/common` 12 | NO VERIFICADO |
| `reflect-metadata` / `rxjs` | 0.2.2 / 7.8.2 | Del spike |
| `typescript` | último parche exacto de `6.0.x` (≥ 6.0.2) | Rango verificado; parche NO VERIFICADO |
| `jest` / `ts-jest` | 30.5.2 / 29.4.15 | Verificados. NO VERIFICADO: peer `jest@30` de ts-jest |
| `@types/jest`, `supertest`, `@types/supertest`, `@types/node` (24.x) | último exacto | NO VERIFICADO |
| `eslint` / `typescript-eslint` / `prettier` | 10.13.0 / 8.72.0 / 3.9.10 | Verificados |
| `@eslint/js`, `eslint-config-prettier` | último exacto compatible con ESLint 10 | NO VERIFICADO |
| gitleaks CLI | 8.30.1 | Verificado |

En el apply, resolver cada versión NO VERIFICADA con `npm view <pkg> version peerDependencies`. `engines.node` queda en `>=24.15.0 <25`: es más estricto que el `>=24.9` de la spec porque `@nestjs/cli` 12 y npm 12 exigen 24.15+.

## 4. TypeScript

```jsonc
// tsconfig.base.json
{ "compilerOptions": {
  "target": "ES2023", "lib": ["ES2023"],
  "module": "commonjs", "moduleResolution": "bundler",   // D1
  "strict": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true,
  "noImplicitReturns": true, "noFallthroughCasesInSwitch": true,
  "experimentalDecorators": true, "emitDecoratorMetadata": true,
  "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true,
  "sourceMap": true, "types": ["node"]   // TS 6 usa types: [] por defecto
} }
// apps/api/tsconfig.json  -> extends base; types ["node","jest"]; include ["src","test"]
// apps/api/tsconfig.build.json -> extends ./tsconfig.json; rootDir "src"; outDir "dist";
//   types ["node"]; include ["src"]; exclude ["**/*.spec.ts"]
```

- No se usa `isolatedModules`: con `emitDecoratorMetadata` produce TS1272 en imports de solo tipo.
- No se usa `exactOptionalPropertyTypes`: genera fricción con los tipos de Nest.
- `typecheck` = `tsc -p tsconfig.json --noEmit`. `noEmit` no va en el tsconfig, para que ts-jest pueda emitir.

## 5. Jest y e2e

- **Unit** (`jest.config.js`): `rootDir: 'src'`, `testRegex: '.*\\.spec\\.ts$'`, transform `ts-jest` con `tsconfig: '<rootDir>/../tsconfig.json'`.
  - Cobertura solo de `**/domain/**` y `**/application/**` (sin `ports/`), umbral global de 80.
- **E2E** (`test/jest-e2e.config.js`): `rootDir: '.'`, `testRegex: '\\.e2e-spec\\.ts$'`, el mismo transform.
- **Scripts de `apps/api`**:

| Script | Comando |
|--------|---------|
| `build` | `tsc -p tsconfig.build.json` |
| `start:dev` | `nest start --watch` (`nest-cli.json` con `builder: tsc` y `tsConfigPath: tsconfig.build.json`) |
| `test` | `NODE_OPTIONS=--experimental-vm-modules jest` (D1b) |
| `test:cov` | igual que `test`, más `--coverage` |
| `test:e2e` | igual que `test`, más `--config test/jest-e2e.config.js` |

```ts
// bootstrap/configure-app.ts — lo usan main.ts y el e2e
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  // PR 3: SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  return app;
}
// test/health.e2e-spec.ts
const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
app = configureApp(ref.createNestApplication()); await app.init();
// casos: GET /api/health -> 200 + contrato; GET /health -> 404;
//        overrideProvider(HEALTH_PROBES) con una sonda down -> status "degraded"
```

## 6. Capas hexagonales (ESLint, PR 2)

| Archivos | Restricción `no-restricted-imports` |
|----------|-------------------------------------|
| `apps/api/src/**/domain/**/*.ts` | `patterns`: `{ regex: '^@nestjs/' }`, `{ regex: '(^\|/)(application\|infrastructure\|bootstrap)(/\|$)' }`, `{ group: ['express', 'typeorm', 'kafkajs', 'ioredis', 'reflect-metadata', '@aws-sdk/*'] }` |
| `apps/api/src/**/application/**/*.ts` | `paths`: `{ name: '@nestjs/common', allowImportNames: ['Injectable', 'Inject'] }`; `patterns`: `{ regex: '^@nestjs/(?!common$)' }`, `{ regex: '(^\|/)(infrastructure\|bootstrap)(/\|$)' }`, más el mismo `group` de librerías |
| `infrastructure/` | Sin restricción |

- **Base**: `defineConfig` con `ignores: ['spikes/**', '**/dist/**', '**/coverage/**']`, `@eslint/js` recommended y `recommendedTypeChecked` (`projectService: true`).
- **Archivos JS**: `disableTypeChecked` en `**/*.{js,mjs}`, con `sourceType: 'commonjs'` para `*.js`.
- **Prettier**: `eslint-config-prettier` va al final.
- **`scripts/check-boundaries.mjs`**: usa `ESLint#lintText` sobre código de prueba con `filePath` dentro de `domain/` y `application/`. Si no aparece `no-restricted-imports`, sale con 1. Cubre los escenarios de la spec sin dejar archivos rotos en `src`.

## 7. Contrato de `health`

```ts
// domain/health-report.ts (TS puro)
export type CheckStatus = 'ok' | 'down';
export type HealthStatus = 'ok' | 'degraded' | 'down';
export interface CheckResult { readonly name: string; readonly status: CheckStatus }
export interface HealthReport { readonly status: HealthStatus; readonly checks: readonly CheckResult[] }
export function aggregate(checks: readonly CheckResult[]): HealthReport; // todas ok -> ok; todas down -> down; mezcla -> degraded; vacío -> ok
// application/ports/health-probe.port.ts
export interface HealthProbe { check(): Promise<CheckResult> }
export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
// application/check-health.use-case.ts
@Injectable() export class CheckHealth {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: readonly HealthProbe[]) {}
  // Promise.allSettled; una sonda rechazada -> { name, status: 'down' }
}
// health.module.ts: único enlace -> { provide: HEALTH_PROBES, useFactory: (p: ProcessProbe) => [p], inject: [ProcessProbe] }
```

| Aspecto | Decisión |
|---------|----------|
| Código HTTP | Siempre 200, según la spec. Pasar a 503 en `down` queda para cuando existan sondas de BD o Redis |
| Headers | `Cache-Control: no-store` |
| Contenido | Sin versión, commit, uptime ni hostname: evita exponer información |
| Sondas | Solo `process` (siempre `ok`). Los timeouts por sonda llegan con las sondas reales |
| DTO de Swagger (PR 3) | `HealthResponseDto implements HealthReport` con `@ApiProperty({ enum })` y `checks: HealthCheckDto[]`. `@ApiTags('health')` y `@ApiOkResponse({ type })`. Sin el plugin del CLI |

```
Cliente -> HealthController (infra/http) -> CheckHealth (application) -> HealthProbe[] (puerto)
                                                                          └─ ProcessProbe (infra/probes)
        <- 200 {status, checks} <- aggregate() (domain) <───────────────┘
```

## 8. docker-compose (PR 2)

| Servicio | Imagen | Puertos (`127.0.0.1:`) | Healthcheck | Notas |
|----------|--------|------------------------|-------------|-------|
| `postgres` | `postgres:18.<parche>-alpine@sha256:…` | 5432 | `pg_isready -U "$${POSTGRES_USER}" -d "$${POSTGRES_DB}"` | Volumen `pgdata:/var/lib/postgresql` (en 18 cambió PGDATA). **NO VERIFICADO**: confirmar con `docker image inspect --format '{{json .Config.Volumes}}'` |
| `redis` | `redis:8.10-alpine@sha256:…` | 6379 | `redis-cli ping` | Licencia anotada en el README |
| `kafka` | `apache/kafka:4.<x.y>@sha256:…` (**NO VERIFICADO** el tag) | 9092 | `/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092` | KRaft, ver abajo |
| `mailpit` | `axllent/mailpit:v1.<x.y>@sha256:…` (**NO VERIFICADO**) | 1025, 8025 | `/mailpit readyz` (**NO VERIFICADO**) | Solo para desarrollo |

- **Variables de Kafka**: `KAFKA_NODE_ID=1`, `KAFKA_PROCESS_ROLES=broker,controller`, `KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093`, `KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092`, `KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER`, `KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT`, `KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093`, `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1`, `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1`, `KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1`, `KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0`.
- **Credenciales**: `${POSTGRES_PASSWORD:?copy .env.example to .env}` falla cerrado si falta `.env`.
- **`.env.example`**: `POSTGRES_USER=webcv`, `POSTGRES_PASSWORD=local-dev-only`, `POSTGRES_DB=webcv`.

## 9. Compuerta de smoke test (tarea 1)

1. `node -v` debe ser ≥ 24.15.
2. Crear los `package.json` (raíz y `apps/api`), los tsconfig y `jest.config.js` con las versiones de la sección 3, y ejecutar `npm install`.
3. Crear un `src/smoke.spec.ts` temporal con un `@Injectable() Dep` y un `@Controller() C` que lo inyecte **por tipo**. Así se prueba la metadata en ts-jest, con `Test.createTestingModule` y `app.init()`.
4. Ejecutar:
   - `npx jest`
   - `npx tsc -p apps/api/tsconfig.json --noEmit`
   - `npm run build -w apps/api && node apps/api/dist/main.js`, con un `main.ts` mínimo, para probar `require(esm)` en Node puro.
5. **Resultado**:
   - Si todo pasa, borrar `smoke.spec.ts` (no se commitea) y registrar el resultado en apply-progress.
   - Si falla solo por D1, probar una vez el plan B de D1. Es configuración dentro de la Opción A aprobada.
   - Si sigue fallando: **DETENERSE y consultar a la usuaria**. Sin Vitest y sin cambiar herramientas.

## 10. CI, Dependabot y hook (PR 2)

```yaml
# .github/workflows/ci.yml
name: ci
on: { pull_request: { branches: [main] }, push: { branches: [main] } }
permissions: { contents: read }
concurrency: { group: "ci-${{ github.ref }}", cancel-in-progress: "${{ github.event_name == 'pull_request' }}" }
jobs:
  quality:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@<SHA40> # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/setup-node@<SHA40> # v7.1.0
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npm run lint && npm run lint:boundaries
      - run: npm run format:check
      - run: npm run typecheck
      - run: npm run test:cov
      - run: npm run test:e2e
      - run: npm run build
  secrets:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    env: { GITLEAKS_VERSION: "8.30.1", GITLEAKS_SHA256: "<sha256 de gitleaks_8.30.1_linux_x64.tar.gz>" }
    steps:
      - uses: actions/checkout@<SHA40> # v7.0.1
        with: { fetch-depth: 0, persist-credentials: false }
      - run: |
          curl -sSfL -o "$RUNNER_TEMP/gl.tgz" "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
          echo "${GITLEAKS_SHA256}  $RUNNER_TEMP/gl.tgz" | sha256sum -c -
          tar -xzf "$RUNNER_TEMP/gl.tgz" -C "$RUNNER_TEMP" gitleaks
      - run: '"$RUNNER_TEMP/gitleaks" git --redact --no-banner --exit-code 1 .'
```

- **Checksum**: el hash va **fijado en el workflow**, tomado una vez del `checksums.txt` del release. Descargar el checksum junto con el binario no prueba nada.
- **Pines**: los SHA se resuelven en el apply con `gh api repos/actions/checkout/git/ref/tags/v7.0.1`.
- **Dependabot** (`.github/dependabot.yml`, `version: 2`, todo semanal):
  - `npm` en `/`: `ignore` para `typescript` con `update-types: ["version-update:semver-major"]`. Grupos `nestjs` (`@nestjs/*`), `lint` y `jest`.
  - `github-actions` en `/`.
  - `docker` en `/`.
  - El lockfile de `spikes/` queda fuera porque no se declara.
- **Hook** (`.githooks/pre-commit`):

```sh
#!/bin/sh
set -eu
command -v gitleaks >/dev/null 2>&1 || { echo "pre-commit: gitleaks v8.30.1 is required (brew install gitleaks). Commit blocked." >&2; exit 1; }
exec gitleaks git --pre-commit --staged --redact --no-banner
```

- **`prepare`**: `git config core.hooksPath .githooks || true`.
- **Comando del hook**: la spec dice `gitleaks protect --staged`, que en la v8.30 está deprecado y fue reemplazado por `gitleaks git --pre-commit --staged`. Se usa el comando nuevo y se propone ajustar la spec. NO VERIFICADO: confirmar con `gitleaks git --help`.

## 11. Activación de strict TDD (PR 3, `openspec/config.yaml`)

- **`testing`**:
  - `strict_tdd: true`
  - `runner: { name: jest, command: "npm test" }`
  - `layers: { unit: "jest (apps/api/src/**/*.spec.ts)", integration: planned, e2e: "jest + supertest (npm run test:e2e)" }`
  - `coverage: { command: "npm run test:cov", threshold: 80 }`
  - `quality: { linter: "eslint (npm run lint)", type_checker: "tsc --strict (npm run typecheck)", formatter: "prettier (npm run format:check)" }`
  - Se borra `strict_tdd_note`.
- **`rules.apply`**: `tdd: true`, `test_command: "npm test && npm run test:e2e"`.
- **`rules.verify`**: el mismo `test_command`, `build_command: "npm run build"`, `coverage_threshold: 80`.
- **`context`**: se actualiza "no code yet".
- **Después del merge**: re-ejecutar `sdd-init`.

## 12. Reversión

| PR | Reversión |
|----|-----------|
| 3 | Retirar `quality` y `secrets` del ruleset `protect-main` y luego `git revert`. Re-ejecutar `sdd-init` |
| 2 | Revertir solo después del PR 3, o habiendo retirado ya los checks. Luego `git config --unset core.hooksPath` y `docker compose down -v` |
| 1 | `git revert`. No deja estado externo |

## Preguntas abiertas

- [x] Spec `dev-environment`: ¿aceptar `gitleaks git --pre-commit --staged` en lugar de `protect --staged`, y `engines` `>=24.15.0`? **Resuelto en el PR 3:** la spec ya refleja `gitleaks git --pre-commit --staged` (confirmado con `gitleaks git --help`, v8.30.1) y `engines` `>=24.15.0 <25`; no quedan ajustes pendientes.
- [x] ¿Swagger también en producción? Sí (decisión de la usuaria): se monta siempre en `/api/docs`; las rutas `/admin` se excluyen del documento cuando existan (cambio de auth).

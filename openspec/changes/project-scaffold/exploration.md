# Exploración: project-scaffold

Fecha: 2026-10-20. Proyecto: web_cv. Fuente de verdad: `docs/brief.md`.

## 1. Estado actual (evidencia local)

- Repo sin código de aplicación: `docs/brief.md`, `openspec/`, `Diseño/`, `spikes/web-functions/`, `.gitignore` (ya cubre `node_modules/`, `.env*`, `dist/`, `cdk.out/`, `*.zip`, `.atl/`).
- No existe `.github/`, ni `package.json` raíz, ni lockfile raíz.
- `spikes/web-functions/` es independiente: su propio `package.json` y `package-lock.json`, `@nestjs/*` 12.2.0, `aws-cdk-lib` 2.274.0, `typescript` 5.9.3, `esbuild` 0.28.2, `tsx` 4.23.15. Su `tsconfig` usa `module: commonjs`, `moduleResolution: node`, `experimentalDecorators` (sin `emitDecoratorMetadata`) y `noEmit`. Su script `dev` usa `tsx` (ver riesgo R3).
- `openspec/config.yaml` tiene `strict_tdd: false`, runner `planned: Jest`, `command: ""`, formatter `undecided`.

## 2. Hallazgos que cambian el alcance (verificados el 2026-10-20)

| Hallazgo | Evidencia |
|---|---|
| Nest 12 es ESM-only. `@nestjs/core@12.2.0` declara `"type": "module"`, engines `node >= 20`. | https://registry.npmjs.org/@nestjs/core/latest |
| Guía de migración v12: apps CommonJS siguen soportadas; Node mínimo para ejecutar v12 es 20.19+ / 22.12+; el CLI (`nest new/generate`) exige 22.22.3+ / 24.15+ / 26+. | https://docs.nestjs.com/migration-guide |
| Defaults de Nest 12: Vitest para proyectos ESM generados (Jest para CommonJS), oxlint por defecto, TypeScript 6, Rspack como bundler de monorepos. | https://docs.nestjs.com/migration-guide y https://raw.githubusercontent.com/nestjs/typescript-starter/master/package.json |
| Jest solo carga los paquetes ESM-only de Nest 12 en Node 24.9+ ("run it on that version or migrate to Vitest"). | https://docs.nestjs.com/migration-guide |
| `@nestjs/cli@12.0.10` depende de `typescript ~6.0.2`. | https://registry.npmjs.org/@nestjs/cli/latest |
| `typescript@latest` en npm es 7.0.2 (port nativo), pero `typescript-eslint@8.72.0` exige `typescript >=4.8.4 <6.1.0` y `ts-jest@29.4.15` exige `typescript >=4.3 <7`. TS 7 queda fuera del toolchain. | https://registry.npmjs.org/typescript-eslint/latest, https://registry.npmjs.org/ts-jest/latest |
| Versiones actuales: Jest 30.5.2, ESLint 10.13.0 (engines `^20.19 \|\| ^22.13 \|\| >=24`), Prettier 3.9.10, Vitest 5.0.5 (Node `^22.12 \|\| ^24 \|\| >=26`), npm 12.2.0 (Node `^22.22.2 \|\| ^24.15.0 \|\| >=26`). | registry.npmjs.org (cada paquete) |
| Node 22 y 24 figuran como LTS, Node 26 como Current (no se afirman fechas de EOL). | https://nodejs.org/en/about/previous-releases |

Consecuencia: Node 24 es la elección correcta (Jest ESM-compat, CLI de Nest, npm 12). El `typescript` del scaffold debe ser `~6.0.x`, no 7.x; coincide con la intención del pin 5.9.3 del spike (evitar riesgo TS7) pero con la versión que cubre Nest CLI 12, typescript-eslint y ts-jest.

## 3. Comparación y recomendación por ítem

### 3.1 Herramienta de monorepo

| Opción | Pros | Contras | Esfuerzo |
|---|---|---|---|
| npm workspaces | Cero herramientas extra; coherente con el CV; `npm run -w apps/api`, `--workspaces --if-present`; un lockfile | Sin grafo de tareas ni caché (orden del array `workspaces`) | Mínimo |
| pnpm workspaces | Instalaciones más rápidas, estricto con dependencias fantasma | Otro gestor fuera del CV; cambia CI y Dependabot | Bajo |
| Turborepo / Nx | Caché y grafo de tareas | Dependencia nueva que exige ADR; con 2-3 paquetes el beneficio es casi nulo | Medio |

Fuente: https://docs.npmjs.com/cli/v11/using-npm/workspaces. Turborepo, Nx y pnpm no se re-verificaron; el juicio se basa en el tamaño del repo.

**Recomendación: npm workspaces.** Sin ADR. Si el CI se vuelve lento, se evalúa Turborepo con su ADR.

### 3.2 Layout

```
/
├─ apps/
│  └─ api/            <- NestJS hexagonal (este cambio)
├─ spikes/            <- fuera de workspaces; propio lockfile; ignorado por lint/CI
├─ openspec/  docs/  Diseño/
├─ docker-compose.yml
├─ package.json       <- workspaces: ["apps/*"]
├─ tsconfig.base.json  eslint.config.mjs  .prettierrc.json  .nvmrc  .editorconfig
└─ .github/
```

- **`apps/web`: diferir al cambio de frontend.** Next.js trae sus propias decisiones (estilos, `output: 'export'`, ADR de Next.js, replicar el diseño). El glob `apps/*` ya lo admite.
- **`infra/`: diferir.** CDK ya está decidido, pero la forma de la infraestructura de producción depende del resultado del spike (Web Functions o Plan B).
- **`packages/shared`: no crear (YAGNI).** Se agrega cuando el front necesite contratos.
- **`spikes/`: se queda donde está**, excluido del workspace, de ESLint (`ignores`) y de los jobs de CI.

### 3.3 Build y transformador de tests de NestJS

Hecho clave: `esbuild` y `tsx` no emiten metadata de decoradores (`emitDecoratorMetadata`), que Nest necesita para inyectar por tipo del constructor.

| Aspecto | Opción A: CJS + Jest 30 + ts-jest | Opción B: ESM + Vitest 5 + unplugin-swc |
|---|---|---|
| Coherencia con CV | Jest está en el CV | Vitest no está en el CV: ADR requerido |
| Defaults Nest 12 | Camino soportado ("CommonJS projects use Jest"), no el default | Es el default de Nest 12 |
| Metadata de decoradores | `ts-jest` usa el compilador TS: funciona sin configuración extra | Requiere `unplugin-swc` 2.0.0 (peer `@swc/core`) con `decoratorMetadata` |
| Riesgo | Jest carga Nest 12 (ESM-only) solo en Node >= 24.9: smoke test antes de construir | Imports con `.js`, `import.meta.dirname`, `nodenext`: más cambios y más curva |
| Type-check en tests | `ts-jest` verifica tipos | Sin type-check (hace falta `tsc --noEmit` aparte) |

- **Build de producción:** `tsc -p tsconfig.build.json`. El bundle para Lambda se resuelve en el cambio de runtime (plugin SWC/decoradores o `@Inject` explícito; ver R3).
- **Dev:** `nest start --watch` (usa tsc). No usar `tsx`.
- **Transformador de Jest:** `ts-jest` 29.4.15. `@swc/jest` 0.2.39 queda como optimización futura.
- **Primer paso obligatorio de la implementación:** smoke test (Nest 12 + Jest 30 + ts-jest en Node 24.x). Si falla, contingencia: Opción B con ADR de Vitest.

**Recomendación: Opción A (CommonJS, Jest 30, ts-jest, TS ~6.0.x, Node 24).**

### 3.4 Convención hexagonal mínima (primer slice `health`)

```
apps/api/src/
├─ main.ts                          <- NestFactory.create + configureApp(app) + listen
├─ app.module.ts
├─ bootstrap/
│  └─ configure-app.ts              <- setGlobalPrefix('api'), Swagger; reutilizado por e2e
├─ shared/                          <- vacío hasta que haya 2+ consumidores
└─ health/
   ├─ health.module.ts              <- único lugar que enlaza puerto -> adaptador
   ├─ domain/
   │  └─ health-status.ts           <- tipo/valor puro (sin Nest)
   ├─ application/
   │  ├─ ports/health-probe.port.ts <- interfaz + token (HEALTH_PROBES)
   │  └─ check-health.use-case.ts   <- agrega probes; sin imports de infraestructura
   └─ infrastructure/
      ├─ http/health.controller.ts  <- GET /api/health (+ @ApiTags, DTO de respuesta)
      └─ probes/process.probe.ts    <- adaptador trivial (uptime); luego DB/Redis
apps/api/test/
└─ health.e2e-spec.ts               <- supertest contra app creada con configureApp
```

Reglas, aplicadas con `no-restricted-imports` de ESLint (sin dependencias extra):
- `domain/` no importa `@nestjs/*`, `application/` ni `infrastructure/`.
- `application/` no importa `infrastructure/`; de `@nestjs/*` solo `@Injectable`/`@Inject` (a confirmar en el diseño).
- `infrastructure/` puede importar todo lo anterior.
- Los puertos se inyectan con token explícito (`@Inject(HEALTH_PROBES)`): obligatorio para interfaces y además neutraliza el riesgo de metadata en esbuild.

### 3.5 ESLint y Prettier

- ESLint 10.13.0 flat config (`eslint.config.mjs`) con `typescript-eslint` 8.72.0 y preset `recommendedTypeChecked`. Nest 12 trae oxlint por defecto, pero el brief dice ESLint: ESLint, sin ADR.
- Prettier 3.9.10 + `eslint-config-prettier`. `formatter` en `config.yaml` pasa a `prettier`.
- Un solo `eslint.config.mjs` en la raíz con `ignores: ['spikes/**', '**/dist/**']`.
- TS 6: evitar `moduleResolution: node` (deprecado; verificar en la implementación); usar `node16`/`bundler` según acepte el smoke test.
- Opciones TS: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `emitDecoratorMetadata`, `experimentalDecorators`, `target: ES2023`.

### 3.6 docker-compose

| Servicio | Imagen | Notas |
|---|---|---|
| Postgres | `postgres:18` (18.6, soporte hasta 2030-11-14) | https://www.postgresql.org/support/versioning/ . Postgres 18 cambió la ruta de datos del contenedor (volumen en `/var/lib/postgresql`): verificar antes de fijar el volumen. Healthcheck `pg_isready` |
| Redis | `redis:8.10-alpine` (tri-licencia RSALv2/SSPLv1/AGPLv3) | https://hub.docker.com/_/redis . Alternativa Valkey (BSD); se mantiene Redis por el CV y Upstash. Licencia anotada en README. Healthcheck `redis-cli ping` |
| Kafka | `apache/kafka` en modo KRaft, nodo único `broker,controller` | https://hub.docker.com/r/apache/kafka . Fijar versión o digest; no usar `latest`. Healthcheck `kafka-topics.sh --list` |
| Mailpit | `axllent/mailpit` (UI 8025, SMTP 1025) | https://mailpit.axllent.org/docs/install/docker/ . Healthcheck a verificar en el binario |

Puertos solo en `127.0.0.1`, credenciales ficticias vía `.env.example` (agregar `!.env.example` al `.gitignore`). Sin TypeORM, sin módulos de BD, sin productor de Kafka todavía.

### 3.7 CI (GitHub Actions)

Un workflow `ci.yml` con triggers `pull_request` y `push` a `main` (nunca `pull_request_target`: https://docs.github.com/en/actions/reference/security/secure-use).

- `permissions: contents: read` a nivel de workflow.
- 2 jobs para pocos checks requeridos: `quality` (eslint, prettier --check, `tsc --noEmit`, Jest unit + e2e) y `secrets` (gitleaks).
- Caché: `actions/setup-node` con `cache: npm` y `node-version-file: .nvmrc`; `npm ci`.
- Acciones pineadas por SHA con comentario de versión: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0 (SHA exacto se resuelve al implementar).
- **Dependabot:** `npm` y `github-actions` (semanal). Dependabot actualiza acciones pineadas a SHA, pero no genera alertas de seguridad para ellas (por eso el comentario de versión). Fuente: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot .
- **gitleaks:** `gitleaks-action` solo exige licencia en organizaciones (https://github.com/gitleaks/gitleaks-action). Recomendado el binario CLI v8.30.1 descargado y verificado por checksum, para no depender de una acción de terceros.
- **Hook pre-commit (requisito del brief):** `.githooks/pre-commit` con `gitleaks protect --staged`, activado por `git config core.hooksPath .githooks` desde el script `prepare`. Sin Husky ni lefthook.
- **Checks requeridos en el ruleset `protect-main`:** agregar `quality` y `secrets` cuando el workflow exista.

### 3.8 Qué falta para activar strict TDD

1. `npm test` y `npm run test:e2e` verdes en local y en CI.
2. Tests desde el día 1: unit de `CheckHealth` y e2e de `GET /api/health`, escritos antes del código.
3. `openspec/config.yaml`: `strict_tdd: true`, comandos de test/build, `linter: eslint`, `type_checker: tsc --strict`, `formatter: prettier`, umbral de cobertura a elegir; quitar `strict_tdd_note`.
4. Re-ejecutar `sdd-init` para refrescar `sdd-init/web_cv` en Engram.

### 3.9 Estimación de revisión y PRs (presupuesto 400 líneas por PR, sin lockfile)

| PR | Contenido | Líneas aprox. |
|---|---|---|
| 1. Workspace + slice `health` | Raíz (~120), config `apps/api` (~90), `src` (~170), tests (~120) | ~500 (si se pasa de 400, mover e2e o lint al PR 2) |
| 2. Compose + CI + Dependabot + hook | compose + `.env.example` (~90), `ci.yml` (~110), dependabot (~25), hook (~15) | ~260 |
| 3. Strict TDD + docs | `config.yaml`, README | ~60-100 |

## 4. ADR requeridos

- Con la recomendación actual, ninguno obligatorio.
- Vitest (Opción B) -> ADR. Turborepo/Nx/pnpm -> ADR.
- Mailpit y `apache/kafka` son imágenes de desarrollo: se documentan en README ("Por qué esta tecnología").

## 5. Riesgos

- **R1 (alto): Jest 30 + Nest 12 ESM-only.** Solo funciona en Node >= 24.9; sin smoke test en esta exploración. Mitigación: tarea 1 de smoke test y contingencia Vitest con ADR.
- **R2 (medio): TS 6.0.x es puente.** Bloquear TS 7 en `dependabot.yml` hasta que el toolchain lo soporte.
- **R3 (medio): metadata de decoradores y esbuild.** Scaffold usa tsc y `@Inject` explícito en puertos; el cambio de runtime debe resolver el bundle.
- **R4 (medio): `/api-docs` fuera de `/api/*`.** CloudFront solo enruta `/api/*` a la API; `/api-docs` caería en el origen estático (404).
- **R5 (bajo): ruta de datos de Postgres 18** en la imagen oficial.
- **R6 (bajo): `apache/kafka` sin tags visibles**; fijar versión o digest.
- **R7 (bajo): licencia Redis 8**; anotar en README.

## 6. Preguntas abiertas (decisiones de la usuaria)

1. Jest 30 + CommonJS (recomendado) o Vitest + ESM (default de Nest 12, con ADR).
2. Swagger en `/api-docs` (brief; requiere un behavior extra en CloudFront) o `/api/docs` (bajo el prefijo único; recomendado, actualiza el brief).
3. ~~Reservar `infra/`~~: se difiere (recomendación aceptada por defecto; no requiere decisión).

## 7. Recomendación global

Cambio `project-scaffold` en 3 PRs: (1) workspace npm + `apps/api` con slice `health` hexagonal, TS ~6.0.x strict, ESLint flat + Prettier, Jest 30 + ts-jest tras un smoke test; (2) compose (Postgres 18, Redis 8.10, Kafka KRaft fijado, Mailpit), CI con acciones pineadas por SHA y permisos mínimos, gitleaks CLI, Dependabot, hook pre-commit; (3) activar `strict_tdd`, re-ejecutar `sdd-init`, README y checks requeridos en `protect-main`. Sin adaptador Lambda, sin TypeORM, sin `apps/web`.

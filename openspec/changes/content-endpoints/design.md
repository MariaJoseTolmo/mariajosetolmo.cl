# Diseño: Content Endpoints — `profile`, `experience` y `skills` con sesión

> Fecha: 2026-10-28. Base: `proposal.md` (C1–C4 vinculantes), `exploration.md`, las specs delta de este cambio y el diseño archivado de `auth-backend` (A1–A10), cuyas convenciones se siguen sin cambios.
> Nota de tamaño: supera las 800 palabras porque el orquestador pidió cubrir esquema, cursor, errores, contrato, escaneo, tests y PRs. Todo está en tablas.

## 1. Enfoque técnico

Porción hexagonal nueva `apps/api/src/content/`, calcada de `availability`: un puerto `ContentRepository` en `application/ports`, un adaptador TypeORM con SQL plano parametrizado (`ensureInitialized` + `withDatabase` → 503) y un adaptador en memoria. La validación vive en value objects del dominio que lanzan `InvalidInput` (→ 400 por `DomainExceptionFilter`). Un único `ContentController` (`@Controller('v1')`) expone las tres rutas; nace protegido por el `JwtAuthGuard` global (C1) y hereda `no-store` de `bootstrap/no-store.ts`. Sin dependencias nuevas, sin ADR.

## 2. Árbol de archivos

```
apps/api/src/content/
├── domain/
│   ├── profile.ts                 # tipo Profile
│   ├── experience-entry.ts        # tipo ExperienceEntry
│   ├── skill-level.ts (+ .spec)   # SkillLevel.parse / SKILL_LEVELS (orden fijo)
│   ├── page-limit.ts (+ .spec)    # PageLimit.parse: 1..50, por defecto 5
│   └── experience-cursor.ts (+ .spec)  # ExperienceCursor.parse: entero ≥ 0, por defecto 0
├── application/
│   ├── ports/content-repository.port.ts   # ContentRepository + CONTENT_REPOSITORY
│   ├── get-profile.use-case.ts (+ .spec)
│   ├── list-experience.use-case.ts (+ .spec)
│   └── list-skills.use-case.ts (+ .spec)
├── infrastructure/
│   ├── http/ content.controller.ts  dto/{profile,experience-page,skills}.dto.ts
│   └── persistence/ in-memory-content.repository.ts (+ .spec)  typeorm-content.repository.ts
└── content.module.ts
apps/api/src/shared/infrastructure/persistence/migrations/1792800000000-content.ts
apps/api/test/content.e2e-spec.ts
apps/api/test/support/fakes/content-fixture.ts         # datos neutros para e2e
apps/api/test/support/content-rules.ts                 # reglas de escaneo + comparador de deriva (PR 3)
apps/api/test/integration/typeorm-content.int-spec.ts
apps/api/test/integration/content-contract.int-spec.ts # PR 3
```

Modificados: `app.module.ts` (importa `ContentModule`), `migrations/index.ts`, `test/support/test-app.ts` (override de `CONTENT_REPOSITORY`), `test/admin.e2e-spec.ts`, `test/integration/migrations.int-spec.ts`, `test/postgres-down.e2e-spec.ts`.

## 3. Decisiones de arquitectura

| # | Opción elegida | Alternativas | Motivo |
|---|----------------|--------------|--------|
| E1 | Un puerto `ContentRepository` con tres métodos | Tres puertos | Una tabla por método, un adaptador, una porción cohesiva. Separarlos no aporta sustitución real. |
| E2 | Los casos de uso reciben la entrada cruda (`unknown`) y llaman a `*.parse` | Parsear en el controlador | El controlador queda delgado y la validación se prueba en unit sin Nest (A3). |
| E3 | El caso de uso devuelve `nextCursor: number \| null`; el controlador arma la URL `next` | URL en `application` | La URL es HTTP; `application` no conoce el prefijo `/api`. |
| E4 | Cursor *keyset*: `position > $cursor`, `LIMIT limit + 1` | `OFFSET`; `COUNT(*)` | Estable ante inserciones, usa el índice `UNIQUE(position)`, sabe si hay página siguiente sin una segunda consulta. Con posiciones 1..n coincide con el mockup (`cursor=2` tras `limit=2`). |
| E5 | Una sola migración para las tres tablas, seed con `INSERT … VALUES` multifila parametrizado | Una por tabla (convención de `auth-backend`) | Las tres tablas forman una sola capacidad y se revierten juntas (spec: el `down` elimina las tres). Parámetros en vez de literales: tildes y comillas sin escapar a mano. |
| E6 | Sin `achievement` en el esquema | Columna sin exponer | La spec fija las claves exactas de cada ítem; guardar un dato que nadie sirve es deuda (YAGNI). |
| E7 | Entre PR 1 y PR 2, `ContentModule` enlaza el repositorio en memoria **vacío** | Fixture con contenido real en `src` | Evita una tercera copia del contenido. Sin despliegue, el estado intermedio (`/profile` → 503, listas vacías) no es visible. |
| E8 | El test de contrato lee lo que **sirve** el adaptador TypeORM tras migrar (job `integration`) | Parsear el SQL de la migración; constante de seed compartida | Prueba el estado final que ve el cliente y sigue siendo válido cuando una migración futura haga `UPDATE`. Una constante importada por la migración la volvería mutable después de aplicada. |
| E9 | El escaneo reutiliza `apps/web/src/test/contentRules.ts` (import relativo) y suma reglas de email y archivos de CV | Copiar las expresiones | Una sola definición de "sueldo, teléfono, disponibilidad": si la web endurece una regla, la API la hereda. |

## 4. Contratos

```ts
// domain
type SkillLevel = 'advanced' | 'production' | 'architecture' | 'learning';
interface Profile { name: string; role: string; architecture: string; domains: readonly string[]; openToWork: boolean }
interface ExperienceEntry { id: string; position: number; company: string; role: string; sector: string;
  period: string; highlights: readonly string[]; technologies: readonly string[] }
interface SkillGroup { level: SkillLevel; skills: readonly string[] }

// application/ports
interface ContentRepository {
  getProfile(): Promise<Profile>;                                   // sin fila → error → 503
  listExperience(after: number, limit: number): Promise<ExperienceEntry[]>; // devuelve hasta limit + 1
  listSkills(level: SkillLevel | null): Promise<SkillGroup[]>;
}
```

| Caso de uso | Entrada → salida |
|-------------|------------------|
| `GetProfile` | — → `Profile` |
| `ListExperience` | `{limit?: unknown, cursor?: unknown}` → `{items, limit, nextCursor}`; si llegan `limit + 1` filas, recorta y `nextCursor = items.at(-1).position` |
| `ListSkills` | `{level?: unknown}` → `SkillGroup` (con nivel) o `SkillGroup[]` con los cuatro niveles en el orden de `SKILL_LEVELS`; un nivel sin filas da `skills: []` |

**Value objects** (reglas de texto exactas, mensajes fijos sin eco):

| VO | Acepta | Ausente | Rechaza (`InvalidInput`) |
|----|--------|---------|--------------------------|
| `PageLimit` | `string` que cumple `^\d+$` y está en 1..50 | 5 | `abc`, `2.5`, `-1`, `0`, `51`, `''`, arrays (`?limit=1&limit=2`) |
| `ExperienceCursor` | `^\d+$` y `≤ Number.MAX_SAFE_INTEGER` | 0 | no numérico, negativo, `''`, arrays |
| `SkillLevel` | uno de los cuatro valores | `null` (todos) | cualquier otro, `''`, arrays |

**HTTP:** `@ApiTags('content')`, `@ApiCookieAuth('access-cookie')`, `@ApiQuery` (`limit` min 1 max 50 default 5; `cursor` min 0; `level` enum, opcionales). `skills` se documenta con `oneOf` (`SkillGroupDto` | `SkillLevelsDto`) vía `@ApiExtraModels`. El controlador mapea cada `ExperienceEntry` a las siete claves de la spec (omite `position`). `next` = `/api/v1/experience?cursor=<n>&limit=<limit>` (siempre con `limit`) o `null`. `AdminVisitsController` sigue con `@ApiExcludeController()`.

## 5. Esquema y migración (`1792800000000-content.ts`)

| Tabla | Columnas | Restricciones |
|-------|----------|---------------|
| `profile` | `id smallint PK DEFAULT 1`, `name`, `role`, `architecture text NOT NULL`, `domains text[] NOT NULL`, `open_to_work boolean NOT NULL`, `updated_at timestamptz NOT NULL DEFAULT now()` | `CHECK (id = 1)` |
| `experience` | `id text PK`, `position smallint NOT NULL`, `company`, `sector`, `role`, `period_label text NOT NULL`, `highlights text[] NOT NULL`, `technologies text[] NOT NULL DEFAULT '{}'` | `UNIQUE (position)`, `CHECK (position > 0)`, `CHECK (id ~ '^[a-z0-9-]+$')` |
| `skill` | `level text`, `position smallint`, `name text NOT NULL` | `PRIMARY KEY (level, position)` (es el índice), `CHECK (level IN (…4…))`, `CHECK (position > 0)`, `UNIQUE (level, name)` |

- Una sentencia por `query()`; sin `SET`, transacciones explícitas ni advisory locks. `COMMENT ON` en tabla y columnas no obvias (`period_label`, `position`, `open_to_work`), con la nota "espejo de `apps/web/src/content`".
- Seed: `profile` desde el ejemplo de `home.ts` (sin `stack` ni `workflow`); `experience` desde `experience.ts` (ids estables, `position` 1..5 en el orden del sitio; `technologies` vacío donde la web no lo define); `skill` desde `stack.ts` con `avanzado→advanced`, `produccion→production`, `arquitectura→architecture`, `aprendiendo→learning`.
- `down`: `DROP TABLE skill`, `DROP TABLE experience`, `DROP TABLE profile`.
- SQL del adaptador: `WHERE position > $1::bigint ORDER BY position LIMIT $2::int`. El cast es obligatorio: sin él `pg` infiere `smallint` para `$1` y un cursor grande provocaría un error de rango → 503 en vez de una página vacía.

## 6. Flujo y errores

```
GET /api/v1/experience?limit=2  (cookie)
 → OriginGuard (no aplica a GET) → JwtAuthGuard (401) → ContentController
 → ListExperience: PageLimit.parse / ExperienceCursor.parse (400)
 → ContentRepository.listExperience(0, 2) → withDatabase(ensureInitialized + SELECT) (503)
 ← 200 {items:[…2], next:"/api/v1/experience?cursor=2&limit=2"} + Cache-Control: no-store
```

| Situación | Estado |
|-----------|--------|
| Sin sesión o JWT inválido | 401 |
| `limit`/`cursor`/`level` inválidos | 400 `INVALID_INPUT`, mensaje fijo |
| Postgres caído, sin inicializar o fila `profile` ausente | 503 |
| Otra ruta bajo `/api/v1` | 404 JSON (sin cambios) |

## 7. Estrategia de tests (Strict TDD)

| Capa | Qué | Cómo |
|------|-----|------|
| Unit (`src/**/*.spec.ts`, ≥ 80 %) | Los tres VO (tablas de entradas válidas e inválidas; el mensaje no contiene la entrada), los tres casos de uso (página intermedia, última, `nextCursor`, cuatro niveles en orden, nivel vacío), el repositorio en memoria | `InMemoryContentRepository` sembrable, sin `jest.mock` |
| e2e (`test/content.e2e-spec.ts`) | 401 en las tres; formas exactas (`Object.keys`); recorrido de `next` hasta `null` sin repetidos; defaults; 400 sin eco (incluido `<script>`); `no-store`; Swagger (tag `content`, sin `/admin`); escaneo de los cuerpos con las reglas de §8 | `createTestApp()` sobrescribe `CONTENT_REPOSITORY` con el fixture neutro salvo que se pase `dataSource`; `postgres-down.e2e-spec.ts` suma las tres rutas → 503 con el adaptador real. `admin.e2e-spec.ts`: se elimina el bloque 404 (D3) y la prueba de fuga usa `/api/v1/unknown` |
| Integración (`*.int-spec.ts`, job `integration`) | `TypeOrmContentRepository` (orden, keyset, `limit + 1`, cursor enorme → `[]`, arrays `text[]`, sin `profile` → `InfrastructureUnavailable`); `migrations.int-spec` (tablas, `CHECK` de nivel y posición, comentarios, `up → down → up`); contrato y escaneo (PR 3) | Postgres real (docker-compose local, *service container* en CI) |

## 8. Contrato seed ↔ web y escaneo (PR 3)

- **Lectura de la web desde `apps/api`:** import relativo `../../../web/src/content/{experience,stack}` en el int-spec. Son módulos TS de datos cuyo único import es `import type` de `./types` (sin imports en tiempo de ejecución), así que ts-jest los transpila a CJS con el `tsconfig` de la API. `home.ts` no se importa (depende de `projects.ts`).
- **Comparador puro** `findContentDrift(web, served): string[]` en `test/support/content-rules.ts`: mismos ids en el mismo orden, misma `company`, `role`, `sector`, `period`, `highlights` y `technologies` (`[]` si falta); los cuatro niveles con los mismos ítems en orden. Sus casos negativos (empresa ausente, nivel faltante) se prueban con entradas mutadas en el mismo archivo, sin base.
- **Escaneo** `contentViolations(text): string[]`: `moneyMatches`, `phoneMatches`, `availabilityMatches` de la web + email (`[^\s@]+@[^\s@]+\.[a-z]{2,}`) + referencia a archivo de CV (`\.(pdf|docx?|odt)\b`, sin distinguir mayúsculas). Se aplica a todo el texto servido por el adaptador tras migrar y al texto fuente de `1792800000000-content.ts`. Caso positivo: una empresa (`Accenture Chile`) no es violación.
- `profile` no entra en el comparador (el ejemplo de la home sigue rotulado como ejemplo, fuera de alcance); sí en el escaneo, y se exige `typeof openToWork === 'boolean'`.

## 9. PRs (stacked-to-main)

| PR | Contenido | Cierre verificable |
|----|-----------|--------------------|
| 1 | Dominio, aplicación, repo en memoria (vacío en el módulo, E7), controlador, DTOs, Swagger, `test-app.ts`, `content.e2e-spec.ts`, `admin.e2e-spec.ts` | `lint`, `typecheck`, `test`, `test:e2e`, `build` en verde |
| 2 | Migración + seed, `TypeOrmContentRepository`, cableado `DATA_SOURCE` en el módulo, `typeorm-content.int-spec`, `migrations.int-spec`, `postgres-down.e2e-spec` | + `test:int` en CI |
| 3 | `content-rules.ts`, `content-contract.int-spec.ts` y escaneo de los cuerpos e2e | Contrato y escaneo en verde; una mutación local los pone en rojo |

Reversión: `git revert` 3 → 1; antes de revertir PR 2, `migration:revert`.

## 10. Preguntas abiertas y supuestos

- [ ] NO VERIFICADO: TypeORM/`pg` con el pooler de Neon en modo transacción (ADR-004). Mitigación: solo `SELECT` de una sentencia sin estado de sesión; se verifica en el cambio de infra.
- [ ] Supuesto: `tsc -p tsconfig.json` de la API acepta los archivos de la web arrastrados por el import (mismas opciones `strict`). Primera tarea del PR 3: confirmarlo. Si falla, no se excluye el int-spec del `typecheck`: se detiene y se consulta (plan B: leer los módulos con `require` y tiparlos con interfaces locales mínimas).
- [ ] Supuesto: `pg` devuelve `text[]` como `string[]` con el parser por defecto; lo cubre `typeorm-content.int-spec`.

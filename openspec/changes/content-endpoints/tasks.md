# Tareas: Content Endpoints — `profile`, `experience` y `skills` con sesión

> 8 unidades de trabajo (U1–U8) en 3 grupos (PR1, PR2, PR3 del design §9), subdivisibles en 8 PRs. `stacked-to-main`. Strict TDD (`openspec/config.yaml`): cada tarea es RED (spec que falla, archivo nombrado primero) -> GREEN (mínimo) -> REFACTOR. Rutas relativas a `apps/api/` salvo indicación. Identificadores en inglés. Shell: `rg`/`bat`/`fd`/`sd`/`eza`. Sin secretos, ARNs, cuentas ni emails reales (`*.example.test`). Sin `cdk`/AWS. Sin dependencias nuevas, sin ADR.

## Review Workload Forecast

Las cifras ya incluyen tests y asumen la inflación de Strict TDD observada en `auth-backend` (2–6x sobre el pronóstico inicial). Son líneas `additions + deletions`, sin lockfile.

| Campo | Valor |
|-------|-------|
| Líneas cambiadas estimadas | ~2.700 en total |
| Opción a (3 PRs del design) | PR1 ~1.380 · PR2 ~810 · PR3 ~500 |
| Opción b (8 PRs, recomendada) | U1 ~260 · U2 ~420 · U3 ~400 · U4 ~300 · U5 ~330 · U6 ~480 · U7 ~280 · U8 ~220 |
| Riesgo de presupuesto de 400 líneas | High en la opción a (los 3 PRs lo superan); Medium en la opción b (U2, U3 y U6 rondan o superan 400) |
| PRs encadenados recomendados | Sí |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | stacked-to-main |

Decision needed before apply: No (resuelta)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Decisión (resuelta por la usuaria): opción (a), 3 PRs con `size:exception`, `stacked-to-main`.** PR1 = U1–U4 (apply ejecutado; ~1.100 líneas medidas, bajo el pronóstico de ~1.380), PR2 = U5–U6, PR3 = U7–U8.

**Opciones consideradas:**

- **(a) 3 PRs con `size:exception`:** PR1 = U1–U4 (~1.380), PR2 = U5–U6 (~810), PR3 = U7–U8 (~500). Menos overhead; revisión muy pesada en PR1.
- **(b) 8 PRs, uno por unidad (recomendada):** corte más fino que mantiene CI en verde en cada PR, sin romper el orden del design:
  - U1 (dominio puro) y U2 (casos de uso + repo en memoria) no tocan rutas: código sin consumidores, `lint`/`typecheck`/`test` en verde.
  - U3 conecta `profile` y `skills`; U4 suma `experience`. El bloque 404 de `admin.e2e-spec.ts` se desmonta por rutas en U3 y U4, así que ningún PR deja un test rojo.
  - U5 (migración + seed) es independiente del adaptador: el `up/down` se prueba con `migrations.int-spec`.
  - U6 reemplaza el repo en memoria vacío (E7) por el TypeORM.
  - U7 y U8 separan el comparador/escaneo puro (sin base) del int-spec con Postgres.
  - Si U2, U3 o U6 superan 400 al contar (tarea CIERRE C1), se acepta `size:exception` puntual o se mueve el `*.spec` del repo en memoria a un PR aparte; no se parte la lógica.

### Unidades de trabajo (base = `main` tras mergear la anterior)

| Unidad | Objetivo | Grupo (opción a) | Depende de |
|--------|----------|------------------|------------|
| U1 | Value objects, tipos de dominio y puerto | PR1 | — |
| U2 | Repo en memoria y casos de uso | PR1 | U1 |
| U3 | HTTP `profile` + `skills`, módulo, Swagger, fin del 404 parcial | PR1 | U2 |
| U4 | HTTP `experience` con cursor y `next`, fin del 404 | PR1 | U3 |
| U5 | Migración + seed, `migrations.int-spec` | PR2 | U4 |
| U6 | `TypeOrmContentRepository`, cableado, `postgres-down` | PR2 | U5 |
| U7 | Comparador de deriva y escaneo (puros) | PR3 | U6 |
| U8 | Test de contrato con Postgres y escaneo de cuerpos | PR3 | U7 |

Un solo hilo de escritura. U1 y U2 podrían escribirse en paralelo solo si U2 fija primero el puerto (tarea 1.4); se secuencian para respetar el hilo único. Cada PR pasa por revisión de contexto fresco antes de abrirse.

## Preguntas abiertas (NO decidir en apply; preguntar a la usuaria)

- [ ] Q-A. NO VERIFICADO: `tsc -p tsconfig.json` de la API acepta los archivos de la web que arrastra el import relativo (tarea 7.1). Si falla, STOP y preguntar; no excluir el int-spec del `typecheck` (plan B: `require` + interfaces locales mínimas).
- [ ] Q-B. NO VERIFICADO: TypeORM/`pg` con el pooler de Neon en modo transacción (ADR-004). Mitigación: solo `SELECT` de una sentencia; se verifica en el cambio de infra, no aquí.
- [ ] Q-C. Supuesto: `pg` devuelve `text[]` como `string[]` con el parser por defecto; lo cubre la tarea 6.1.

## Cierre estándar de PR («CIERRE»)

- [ ] C1. (PR1 medido: ~1.100 líneas, `size:exception` aprobado.) Contar líneas (`additions + deletions`, sin lockfile); si excede 400 y no hay `size:exception` aprobado, STOP.
- [ ] C2. `npm run lint && npm run lint:boundaries && npm run format:check && npm run typecheck && npm run test:cov && npm run test:e2e && npm run build` en verde; desde U5 también `npm run test:int -w apps/api`.
- [ ] C3. Cobertura `domain`/`application` >= 80 %; gitleaks sin hallazgos; revisión de contexto fresco.

## U1 — Dominio y puerto (PR1)

- [x] 1.1 RED `src/content/domain/page-limit.spec.ts` (tabla: `1`, `50`, ausente -> 5; rechaza `abc`, `2.5`, `-1`, `0`, `51`, `''`, array; el mensaje de `InvalidInput` no contiene la entrada) -> GREEN `page-limit.ts` (`PageLimit.parse`, `^\d+$` y 1..50).
- [x] 1.2 RED `src/content/domain/experience-cursor.spec.ts` (ausente -> 0; `0`, `3`, `MAX_SAFE_INTEGER` válidos; rechaza no numérico, negativo, `''`, array, mayor que `MAX_SAFE_INTEGER`; sin eco) -> GREEN `experience-cursor.ts`.
- [x] 1.3 RED `src/content/domain/skill-level.spec.ts` (cuatro valores válidos, ausente -> `null`, `SKILL_LEVELS` en orden fijo `advanced, production, architecture, learning`; rechaza `expert`, `''`, array; sin eco) -> GREEN `skill-level.ts`.
- [x] 1.4 Tipos `profile.ts`, `experience-entry.ts` (con `position`), `SkillGroup`, y puerto `application/ports/content-repository.port.ts` (`ContentRepository`, token `CONTENT_REPOSITORY`). Sin lógica: sin RED propio, cubierto por U2. REFACTOR. CIERRE.

## U2 — Repo en memoria y casos de uso (PR1)

- [x] 2.1 RED `src/content/infrastructure/persistence/in-memory-content.repository.spec.ts` (sembrable; `listExperience(after, limit)` devuelve hasta `limit + 1` por `position` con keyset `position > after`; `listSkills(null)` los cuatro niveles, nivel vacío -> `skills: []`; `getProfile` sin fila lanza error de infraestructura) -> GREEN `in-memory-content.repository.ts`.
- [x] 2.2 RED `src/content/application/get-profile.use-case.spec.ts` (devuelve `Profile`; propaga el error del repo) -> GREEN `get-profile.use-case.ts`.
- [x] 2.3 RED `src/content/application/list-experience.use-case.spec.ts` (entrada `unknown`; página intermedia con `nextCursor = items.at(-1).position`, última con `null`, recorte de `limit + 1`, defaults 5 y 0, 400 por `InvalidInput`) -> GREEN `list-experience.use-case.ts`.
- [x] 2.4 RED `src/content/application/list-skills.use-case.spec.ts` (con nivel -> `SkillGroup`; sin nivel -> cuatro niveles en el orden de `SKILL_LEVELS`; nivel vacío; nivel inválido) -> GREEN `list-skills.use-case.ts`. REFACTOR. CIERRE.

## U3 — HTTP `profile` y `skills` (PR1)

- [x] 3.1 Soporte de test: `test/support/fakes/content-fixture.ts` (datos neutros, 5 ítems de experiencia, cuatro niveles, `openToWork` boolean) y override de `CONTENT_REPOSITORY` en `test/support/test-app.ts` salvo que se pase `dataSource`.
- [x] 3.2 RED `test/content.e2e-spec.ts` (bloques `profile` y `skills`): 401 sin cookies, `Cache-Control: no-store` en 200/400/401, claves exactas con `Object.keys` (`profile`: 5; `skills` con nivel: `level`+`skills`; sin nivel: solo `levels`, cuatro elementos con `level`+`skills`), `level=expert` y `level=` -> 400 `INVALID_INPUT` sin eco -> GREEN `infrastructure/http/dto/{profile,skills}.dto.ts`, `content.controller.ts` (`@Controller('v1')`, rutas `profile` y `skills`), `content.module.ts` (repo en memoria vacío, E7), importar `ContentModule` en `app.module.ts`.
- [x] 3.3 RED Swagger en `content.e2e-spec.ts` (`paths` incluye `/api/v1/profile` y `/api/v1/skills` con tag `content`; ninguna clave comienza con `/api/v1/admin`) -> GREEN `@ApiTags('content')`, `@ApiCookieAuth('access-cookie')`, `@ApiQuery`, `@ApiExtraModels` + `oneOf` para `skills`.
- [x] 3.4 RED `test/admin.e2e-spec.ts`: quitar `/profile` y `/skills` del bloque 404 (queda `/experience` hasta U4) y cambiar la prueba de fuga de errores a `/api/v1/unknown` (404 JSON sin `stack`/SQL) -> GREEN sin cambios de producción. REFACTOR. CIERRE.

## U4 — HTTP `experience` (PR1)

- [x] 4.1 RED `test/content.e2e-spec.ts` (bloque `experience`): 401; sin parámetros -> 5 ítems y `next: null`; `limit=2` -> 2 ítems y `next` = `/api/v1/experience?cursor=2&limit=2`; recorrido de `next` hasta `null` sin repetidos ni omitidos (unión = 5); `limit=1` y `limit=50` -> 200; ítems con exactamente las siete claves (`id, company, role, sector, period, highlights, technologies`, sin `position`) -> GREEN ruta `experience` en `content.controller.ts` + `experience-page.dto.ts` (el controlador arma `next`; `period` desde `period_label`).
- [x] 4.2 RED 400 en `content.e2e-spec.ts`: `limit=abc|0|51|2.5|` y `limit=1&limit=2`, `cursor=-1|abc|<script>` -> 400 JSON `INVALID_INPUT`, el cuerpo no contiene el valor enviado (incluido `<script>`) -> GREEN (debería pasar con U1–U2; si no, ajustar el filtro de excepciones solo si es necesario).
- [x] 4.3 RED Swagger: `/api/v1/experience` con tag `content` y `@ApiQuery` (`limit` min 1 max 50 default 5; `cursor` min 0) -> GREEN decoradores.
- [x] 4.4 RED `test/admin.e2e-spec.ts`: eliminar por completo el bloque 404 de `/profile|/experience|/skills` -> GREEN sin cambios de producción. Confirmar que `rg "profile|experience|skills" test/admin.e2e-spec.ts` no deja referencias a 404. REFACTOR. CIERRE.

## U5 — Migración y seed (PR2)

- [x] 5.1 RED `test/integration/migrations.int-spec.ts` (actualizar): tablas `profile`, `experience`, `skill` existen tras `up`; `CHECK` de `profile.id = 1`, de nivel (cuatro valores) y de `position > 0`; `UNIQUE (position)` y `UNIQUE (level, name)`; comentarios `COMMENT ON` en `period_label`, `position`, `open_to_work`; `up -> down -> up` elimina y recrea las tres tablas -> GREEN `src/shared/infrastructure/persistence/migrations/1792800000000-content.ts` (SQL plano, una sentencia por `query()`, sin `SET`/transacciones/advisory locks) y registro en `migrations/index.ts`.
- [x] 5.2 Seed dentro de la migración: `INSERT ... VALUES` multifila parametrizado. `profile` desde el ejemplo de `apps/web/src/content/home.ts` (sin `stack` ni `workflow`); `experience` desde `experience.ts` (ids estables, `position` 1..5 en el orden del sitio, `technologies` vacío donde la web no define); `skill` desde `stack.ts` con `avanzado->advanced`, `produccion->production`, `arquitectura->architecture`, `aprendiendo->learning`. RED: ampliar `migrations.int-spec.ts` (conteos 1 / 5 / suma de habilidades de `stack.ts`; `openToWork` boolean). Sin sueldo, teléfono, email, fechas ni archivos de CV. CIERRE (incluye `npm run test:int -w apps/api`).

## U6 — Adaptador TypeORM (PR2)

- [x] 6.1 RED `test/integration/typeorm-content.int-spec.ts` (orden por `position`; keyset `position > $1::bigint` con `LIMIT $2::int` devolviendo `limit + 1`; cursor enorme -> `[]` y no 503; `text[]` llega como `string[]`; `listSkills(null)` y por nivel en orden de `position`; sin fila `profile` -> `InfrastructureUnavailable`) -> GREEN `infrastructure/persistence/typeorm-content.repository.ts` (`ensureInitialized` + `withDatabase`, SQL plano parametrizado, cast obligatorio).
- [x] 6.2 Cableado en `content.module.ts`: reemplazar el repo en memoria vacío por `TypeOrmContentRepository` con `DATA_SOURCE` (patrón `availability`). RED: ejecutar `test/content.e2e-spec.ts` con el fixture sigue verde (el override de `test-app.ts` lo conserva).
- [x] 6.3 RED `test/postgres-down.e2e-spec.ts`: las tres rutas con sesión y base caída -> 503 JSON sin `stack`, SQL ni credenciales y con `no-store` -> GREEN (cableado de 6.2). REFACTOR. CIERRE (con `test:int`).
  - Nota de revisión (S3): el e2e `postgres-down` debe cubrir las tres rutas (`profile`, `experience`, `skills`), no solo una; hoy solo `profile` tiene la prueba de 503 en `content.e2e-spec.ts`.

## U7 — Comparador y escaneo puros (PR3)

- [ ] 7.1 **Verificación previa (STOP si falla y preguntar, ver Q-A).** Añadir un import mínimo `../../../web/src/content/{experience,stack}` en un archivo temporal de `test/` y correr `npm run typecheck -w apps/api` y `npm run test:int` (ts-jest). Si `tsc` rechaza archivos de la web: no excluir del `typecheck`; detener y consultar. Si pasa, el import queda en U8.
- [ ] 7.2 RED `test/support/content-rules.spec.ts` (`findContentDrift(web, served)`: sin deriva -> `[]`; empresa ausente, id fuera de orden, nivel faltante, habilidad cambiada, `technologies` faltante tratado como `[]` -> mensajes no vacíos; entradas mutadas, sin base) -> GREEN `test/support/content-rules.ts` (`findContentDrift`).
- [ ] 7.3 RED mismo `content-rules.spec.ts` (`contentViolations(text)`: positivos de sueldo/monto, teléfono, disponibilidad, email y archivo de CV (`.pdf|.doc|.docx|.odt`, sin distinguir mayúsculas); negativo: `Accenture Chile` no es violación; `openToWork` se exige `typeof boolean`) -> GREEN `contentViolations`, reutilizando `moneyMatches`, `phoneMatches`, `availabilityMatches` de `apps/web/src/test/contentRules.ts` por import relativo (E9) más las reglas nuevas. REFACTOR. CIERRE.

## U8 — Contrato con Postgres y escaneo de cuerpos (PR3)

- [ ] 8.1 RED `test/integration/content-contract.int-spec.ts` (migrar con Postgres real; leer lo servido por `TypeOrmContentRepository`; `findContentDrift` contra `experience.ts` y `stack.ts` de la web -> `[]`; mismos ids y empresas, cuatro niveles con los mismos ítems en orden) -> GREEN (debe pasar con el seed de U5; si no, corregir el seed, no el test). Verificar a mano que mutar una empresa en el seed pone el test en rojo y revertir la mutación.
- [ ] 8.2 RED escaneo en el mismo int-spec: `contentViolations` sobre todo el texto servido (profile, experience, skills) y sobre el texto fuente de `1792800000000-content.ts`; sin coincidencias; `typeof openToWork === 'boolean'` -> GREEN. Verificar una mutación local (teléfono en el seed) en rojo y revertir.
- [ ] 8.3 RED en `test/content.e2e-spec.ts`: aplicar `contentViolations` a los cuerpos de las tres rutas con el fixture -> GREEN. REFACTOR. CIERRE (con `test:int`; el job CI `integration` ya existe).

## Trazabilidad escenario -> tarea

| Spec | Escenarios | Tareas |
|------|-----------|--------|
| api-content-endpoints | Sin sesión · Cabecera no-store | 3.2, 4.1 |
| | Forma completa de profile | 3.2, 6.1 |
| | Primera página con limit · Última página · Valores por defecto · Límites válidos | 2.3, 4.1 |
| | limit inválido · cursor inválido | 1.1, 1.2, 4.2 |
| | Nivel válido · Sin level · Nivel inválido | 1.3, 2.4, 3.2 |
| | Postgres caído | 6.1, 6.3 |
| | Rutas documentadas (Swagger, `/admin` ausente) | 3.3, 4.3 |
| | Seed alineado · Deriva detectada | 5.2, 7.1, 7.2, 8.1 |
| | Seed limpio · Dato prohibido · Empleadores permitidos | 5.2, 7.3, 8.2, 8.3 |
| | Migración SQL plano, `down` elimina las tres tablas | 5.1 |
| api-recruiter-endpoints | Rutas de contenido con sesión · sin sesión | 3.2, 3.4, 4.1, 4.4 |
| | Ruta inexistente (`/api/v1/unknown` -> 404 JSON) | 3.4 |

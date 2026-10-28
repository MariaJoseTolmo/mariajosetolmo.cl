# Verify report: content-endpoints

**Cambio**: content-endpoints · **Modo**: Strict TDD · **Store**: openspec · **Fecha**: 2026-10-28
**Base verificada**: `main` @ `9046795` (PR #41, #42, #43 mergeados), árbol limpio. Servicios docker-compose arriba (postgres 55432, redis 56379, healthy).

## Veredicto

**PASS WITH WARNINGS** — 0 CRITICAL, 5 WARNING, 5 SUGGESTION. Los 22 escenarios de las specs tienen un test que pasó en runtime; todos los comandos en verde.

## Completitud

| Métrica | Valor |
|---------|-------|
| Tareas de implementación (1.1–8.3) | 26/26 `[x]` |
| Checklist CIERRE (C1–C3) | 0/3 marcadas (evidencia en apply-progress y en este verify) |
| Preguntas abiertas | Q-A resuelta; Q-B (pooler Neon) y Q-C (`text[]`) abiertas; Q-C queda cubierta por `typeorm-content.int-spec.ts` ("returns text[] columns as string[]") |

## Ejecución

| Comando | Resultado |
|---------|-----------|
| `npm run test:cov -w apps/api` | 57 suites, **583/583**; `content/domain` y `content/application` 100 % (stmts/branch/funcs/lines) |
| `npm run test:e2e -w apps/api` | 11 suites, **164/164** (`content.e2e-spec.ts`: 37/37) |
| `DATABASE_URL=… REDIS_URL=… npm run test:int -w apps/api` | 9 suites, **104/104** |
| `npm test -w apps/web` | 87 suites, **1196/1196** |
| `npx eslint apps/api apps/web --max-warnings 0` | verde |
| `npm run lint:boundaries` | verde |
| `npm run typecheck -w apps/api` / `-w apps/web` | verde / verde |
| `npm run build -w apps/api` | verde |
| `npx prettier --check apps/api apps/web/src/test` | verde |
| `gitleaks detect` sobre los 3 commits del cambio | sin hallazgos |

## Matriz de cumplimiento

### api-content-endpoints

| Requisito | Escenario | Test | Resultado |
|-----------|-----------|------|-----------|
| Sesión y no-store | Sin sesión | `content.e2e-spec.ts` › "%s answers 401 JSON without a session" (3 rutas) | COMPLIANT |
| | Cabecera no-store | `content.e2e-spec.ts` › "%s answers %i with Cache-Control: no-store" (200/400) + 401 arriba; 503 en `postgres-down.e2e-spec.ts` › describe.each "generic no-store body" | COMPLIANT |
| Profile forma estricta | Forma completa | `content.e2e-spec.ts` › "returns exactly the five public keys"; `typeorm-content.int-spec.ts` › "returns the seeded profile with a boolean openToWork…"; `postgres-down.e2e-spec.ts` (recuperación lee `Db Name` de la tabla) | COMPLIANT |
| Experience con cursor | Primera página con limit | `content.e2e-spec.ts` › "limit=2 gives two items and a next URL keeping the limit" (`/api/v1/experience?cursor=2&limit=2`) | COMPLIANT |
| | Última página | `content.e2e-spec.ts` › "following next to the end visits every item once" (3 páginas, 5 ids sin repetir) | COMPLIANT |
| | Valores por defecto | `content.e2e-spec.ts` › "returns the five items and next null by default" | COMPLIANT |
| | Límites válidos | `content.e2e-spec.ts` › "limit=%s is valid" (1, 50) | COMPLIANT |
| Validación limit/cursor | limit inválido | `content.e2e-spec.ts` › "%s answers 400 INVALID_INPUT without echoing the input" (`abc`, `0`, `51`, `2.5`, vacío, repetido; cuerpo exacto) + `page-limit.spec.ts` | COMPLIANT |
| | cursor inválido | mismo it.each (`-1`, `abc`, `<script>`, `9007199254740993`) + `experience-cursor.spec.ts` | COMPLIANT |
| Skills por nivel | Nivel válido | `content.e2e-spec.ts` › "returns level and skills for a valid level"; `typeorm-content.int-spec.ts` › "returns a single group for a level" | COMPLIANT |
| | Sin level | `content.e2e-spec.ts` › "returns only \"levels\" with the four groups…" | COMPLIANT |
| | Nivel inválido | `content.e2e-spec.ts` › it.each(['expert', '']) 400 sin eco + `skill-level.spec.ts` | COMPLIANT |
| Postgres | Postgres caído | `postgres-down.e2e-spec.ts` › describe.each 3 rutas "answers 503 with a generic no-store body while Postgres is down" + "answers profile 503 when the profile row is missing"; `typeorm-content.int-spec.ts` › "fails closed…" | COMPLIANT |
| Swagger | Rutas documentadas | `content.e2e-spec.ts` › "documents the three routes under the content tag, none under /admin" (+ `security` `access-cookie`); `admin.e2e-spec.ts` › "does not document any /api/v1/admin path" | COMPLIANT |
| Contrato seed/web | Seed alineado | `content-contract.int-spec.ts` › "serves exactly what experience.ts and stack.ts define", "same ids and employers…", "four levels in fixed order…" | COMPLIANT |
| | Deriva detectada | `content-rules.spec.ts` (entradas mutadas: empresa ausente, orden, nivel faltante, habilidad cambiada…) | COMPLIANT |
| | Migración SQL plano, `down` elimina tablas | `migrations.int-spec.ts` › "drops and recreates the three tables with up -> down -> up" + CHECK/UNIQUE | COMPLIANT |
| Escaneo | Seed limpio | `content-contract.int-spec.ts` › "finds no salary… in the served data", "finds none in the migration source"; `content.e2e-spec.ts` › forbidden content scan | COMPLIANT |
| | Dato prohibido | `content-rules.spec.ts` (positivos: sueldo, CLP, teléfono, disponibilidad, email, pdf/doc/docx/odt) | COMPLIANT |
| | Empleadores permitidos | `content-rules.spec.ts` (`Accenture Chile`, `Banco Itaú`) + `content-contract.int-spec.ts` › "allows employer names" | COMPLIANT |

### api-recruiter-endpoints (delta)

| Escenario | Test | Resultado |
|-----------|------|-----------|
| Rutas de contenido con sesión | `content.e2e-spec.ts` (200 en `/profile`, `/experience?limit=2`, `/skills?level=advanced`) | COMPLIANT |
| Rutas de contenido sin sesión | `content.e2e-spec.ts` › 401 en las tres | COMPLIANT |
| Ruta inexistente | `admin.e2e-spec.ts` › "401, 403 and 404 are JSON without stack, paths or SQL" (`/api/v1/unknown` → 404) | COMPLIANT |

**Resumen**: 22/22 escenarios COMPLIANT.

## Supuestos de spec confirmados contra el código

| Supuesto | Evidencia | Estado |
|----------|-----------|--------|
| cursor entero ≥ 0 hasta `MAX_SAFE_INTEGER`; mayor → 400 | `src/content/domain/experience-cursor.ts:11-16`; e2e `cursor=9007199254740993` → 400 | Confirmado (cota no escrita en la spec, ver S2) |
| cursor pasado el final → `[]` y `next: null` | e2e "a cursor beyond the last position gives an empty last page"; int `listExperience(100000, 5)` y `MAX_SAFE_INTEGER` → `[]`; cast `$1::bigint` en `typeorm-content.repository.ts:42` | Confirmado |
| `level=` vacío → 400 | `skill-level.ts:17-20`; e2e it.each `''` | Confirmado |
| nivel sin filas → `skills: []` | `typeorm-content.repository.ts:99-103`, `in-memory-content.repository.ts:37-42`; int y unit "empty group for a level without skills" | Confirmado |
| `next` incluye `limit` | `content.controller.ts:77-80` | Confirmado |
| Sin `@Public()` en el slice | `rg Public src/content` sin resultados | Confirmado |
| SQL plano, una sentencia por `query()`, `down` con 3 `DROP TABLE` | `1792800000000-content.ts:135-247`; sin `SET`/`BEGIN`/advisory | Confirmado |

## Coherencia con el design

| Decisión | ¿Se sigue? | Nota |
|----------|-----------|------|
| E1 un puerto, tres métodos | Sí | `content-repository.port.ts` |
| E2 casos de uso reciben `unknown` | Sí | |
| E3 controlador arma `next` | Sí | `content.controller.ts:77-80` |
| E4 keyset `position > $1`, `LIMIT limit+1` | Sí | |
| E5 una migración, seed parametrizado | Sí | seed desde constantes tipadas del archivo (desviación documentada) |
| E6 sin `achievement` | Sí | |
| E7 repo en memoria vacío entre PR1 y PR2 | Sí (histórico) | hoy `content.module.ts` usa TypeORM |
| E8 contrato lee lo servido tras migrar | Sí | |
| E9 escaneo reutiliza `apps/web/src/test/contentRules.ts` | Sí | `test/support/content-rules.ts:1-5` |
| Árbol de archivos | Sí, con `domain/skill-group.ts` extra | documentado |

## TDD

| Check | Resultado | Detalle |
|-------|-----------|---------|
| Evidencia TDD reportada | Sí | tablas por lote en `apply-progress.md` |
| Todas las tareas con tests | Sí | 1.4 sin lógica (justificado) |
| RED confirmado (archivos existen) | Sí | todos los archivos citados existen |
| GREEN confirmado (pasan ahora) | Sí | todos pasan en este run |
| Triangulación | Adecuada | tablas de casos válidos/inválidos, recorrido de páginas, mutaciones |
| Safety net en archivos modificados | Parcial | solo `admin.e2e-spec.ts` (8/8) explícito; la tabla no trae columna Safety Net para el resto |
| Desviaciones | Ver W1, W2 | |

**Capas**: Unit — `src/content/**` 7 specs + `test/support/content-rules.spec.ts` (111 tests). e2e — `content.e2e-spec.ts` (37), `postgres-down.e2e-spec.ts`, `admin.e2e-spec.ts`. Integración — `typeorm-content.int-spec.ts`, `migrations.int-spec.ts`, `content-contract.int-spec.ts`.

**Cobertura**: `content/domain` y `content/application` 100 %. Los adaptadores (`infrastructure/**`) quedan fuera de `collectCoverageFrom`; se cubren por e2e e integración.

**Calidad de aserciones**: sin tautologías, sin `jest.mock`, sin aserciones de clases CSS. Los bucles (`content.e2e-spec.ts:90,137,238`; `content-contract.int-spec.ts:52`) van precedidos de aserciones de longitud o de mapeo. Los `toEqual([])` tienen casos positivos compañeros. 0 CRITICAL, 0 WARNING.

## Hallazgos

### CRITICAL
Ninguno.

### WARNING
- **W1 — Strict TDD parcial en PR1.** `in-memory-content.repository.spec.ts` (2.1) se escribió junto con la implementación; la ruta `experience` y los decoradores Swagger (3.3, 4.1–4.3) se implementaron en `content.controller.ts` antes de sus tests. Mitigado después con RED en runtime por mutación (quitar `limit` de `next`, exponer `position`, quitar `@ApiCookieAuth`, alterar mensajes). Los tests actuales son sólidos, pero el orden test-primero no se respetó.
- **W2 — PR3 fix B sin RED en runtime.** El test "serves a non-empty experience and skills, matching the web counts" (`content-contract.int-spec.ts:49`) pasó al primer intento; no se mostró un rojo con seed vacío.
- **W3 — Cambio cross-app sin spec.** PR3 endureció `apps/web/src/test/contentRules.ts` (+7) y `apps/web/src/content/content-guard.test.ts` (+26): teléfono móvil chileno suelto y montos junto a palabra clave de sueldo. La propuesta deja fuera los cambios en el frontend y ninguna spec de `openspec/specs` lista esas reglas. Es infraestructura de test, los 1196 tests web pasan y no hay falsos positivos nuevos, pero hay que registrarlo en el archive.
- **W4 — La spec principal queda desactualizada hasta el archive.** `openspec/specs/api-recruiter-endpoints/spec.md:5` (Purpose: "el 404 de los endpoints de contenido") y `:90-98` (requisito y escenario del 404) contradicen el comportamiento actual. El delta conserva el nombre "Endpoints de contenido fuera de alcance" aunque ahora están implementados; conviene renombrarlo al fusionar. La línea `:118` (errores `401/403/404`) no menciona `400/503`, que define `api-content-endpoints`.
- **W5 — Checklist de cierre sin marcar.** `tasks.md` C1–C3 y los criterios de éxito de `proposal.md` siguen en `[ ]`. Este verify confirma C2 (todos los comandos), C3 (cobertura 100 %, gitleaks limpio) y el `size:exception` de C1 está registrado.

### SUGGESTION
- **S1** — `src/content/application/list-skills.use-case.ts:25-26`: si el puerto devolviera `[]` para un nivel válido, la respuesta sería `{ levels: [] }` (forma incorrecta). Con los dos adaptadores actuales no ocurre (siempre emiten un grupo por nivel), pero conviene hacerlo explícito (p. ej. `{ level, skills: [] }`) o fijarlo en el contrato del puerto.
- **S2** — Pasar a la spec en el archive lo que hoy solo vive en el design: cota `MAX_SAFE_INTEGER` del cursor (mayor → 400), cursor pasado el final → `items: []` y `next: null`, nivel sin filas → `skills: []`. Además, la spec dice "offset por `position`" y la implementación es keyset (`position > cursor`); coinciden con posiciones 1..n, pero conviene alinear el texto.
- **S3** — Los negativos de `findContentDrift`/`contentViolations` en `test/support/content-rules.spec.ts:92,112,118,136,163,186` usan `.not.toEqual([])`; afirmar el mensaje o la regla esperada haría la triangulación más precisa.
- **S4** — `ExperienceCursor`/`PageLimit` aceptan ceros a la izquierda (`007`) por `^\d+$`; es inocuo, pero no está documentado.
- **S5** — Q-B (pooler de Neon en modo transacción) sigue NO VERIFICADO; mantenerlo visible para el cambio de infra.

## Siguiente paso

`sdd-archive`: fusionar el delta en `openspec/specs/api-recruiter-endpoints/spec.md` (Purpose, requisito 404, nombre del requisito), crear `openspec/specs/api-content-endpoints/spec.md` con S2 y dejar constancia de W3.

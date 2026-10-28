# Apply progress: content-endpoints

Modo: Strict TDD. Entrega: opción (a), 3 PRs con `size:exception`, `stacked-to-main`.
Lotes: PR1 = U1–U4 (tareas 1.1–4.4 completas); PR2 = U5–U6 (tareas 5.1–6.3 completas). Pendiente: U7–U8 (PR3).

## Evidencia TDD

| Tarea | Archivo de test | Capa | RED | GREEN | Triangulación | REFACTOR |
|-------|-----------------|------|-----|-------|---------------|----------|
| 1.1 | `src/content/domain/page-limit.spec.ts` | Unit | Escrito primero, falló por módulo inexistente | 43 tests (U1) en verde | tabla válidos/inválidos + sin eco | Limpio |
| 1.2 | `src/content/domain/experience-cursor.spec.ts` | Unit | idem | verde | MAX_SAFE_INTEGER, +2, 20 dígitos, arrays | Limpio |
| 1.3 | `src/content/domain/skill-level.spec.ts` | Unit | idem | verde | cuatro niveles, ausente, inválidos | Limpio |
| 1.4 | n/a (tipos y puerto) | n/a | Triangulación omitida: sin lógica | typecheck | n/a | n/a |
| 2.1 | `in-memory-content.repository.spec.ts` | Unit | Escrito junto con la implementación (ver desviaciones) | 9 tests | keyset, última página, cursor enorme, niveles vacíos | Limpio |
| 2.2–2.4 | `get-profile|list-experience|list-skills.use-case.spec.ts` | Unit | Escritos antes de los casos de uso | 71 tests `src/content` en verde | páginas intermedia/última/exacta, defaults, 400, orden de niveles | Limpio |
| 3.1–3.3 | `test/content.e2e-spec.ts` | e2e | 14 tests en rojo (404 sin controlador) | 14 en verde | claves exactas, 503 sin perfil | Limpio |
| 3.4, 4.4 | `test/admin.e2e-spec.ts` | e2e | Safety net 8/8 | 8/8 tras quitar el bloque 404 | fuga en `/api/v1/unknown` | Limpio |
| 4.1–4.3 | `test/content.e2e-spec.ts` | e2e | Ver desviaciones | 33 tests en verde | recorrido de `next`, 10 casos 400, Swagger | Limpio |

## Resultados finales

- Unit con cobertura: 56 suites, 543 tests; `content/domain` y `content/application` al 100 %.
- e2e: 11 suites, 153 tests.
- `eslint apps/api --max-warnings 0`, `lint:boundaries`, `typecheck`, `build`, `prettier --check apps/api`: verdes.

## Desviaciones

- `apps/api` no tiene script `lint`; se usó `npx eslint apps/api --max-warnings 0` desde la raíz.
- Strict TDD parcial: el spec del repo en memoria (2.1) se escribió junto con su implementación, y las rutas `experience` y Swagger (4.1–4.3, 3.3) se implementaron en el controlador de 3.2 antes de sus tests. Esos tests se validaron con una mutación local (quitar `limit` de `next`, exponer `position`) que los puso en rojo; se revirtió.
- `ListSkills` devuelve `SkillGroup | { levels }` (el controlador solo traduce a DTO).
- `SkillGroup` quedó en `domain/skill-group.ts` (el design lo listaba sin archivo propio).

## Fixes de revisión (lote de corrección, PR1)

Cambios solo en tests (`test/content.e2e-spec.ts`, specs de dominio de `src/content/domain`); sin cambios de producción.

| Fix | Cambio | RED (producción rota temporalmente) | GREEN |
|-----|--------|-------------------------------------|-------|
| 1 | Swagger: cada una de las 3 rutas debe tener `security` con `{ 'access-cookie': [] }` | Quitar `@ApiCookieAuth` del controlador: 2 tests Swagger fallan en runtime | Verde al restaurar |
| 2 | Reemplazado `toContain('SkillLevelsDto')` por aserción de `oneOf` con `$ref` a `SkillGroupDto` y `SkillLevelsDto` en la respuesta 200 de `/skills` | Quitar el `$ref` de `SkillLevelsDto`: falla el test de parámetros | Verde |
| 3 | Eco: se eliminó el filtro de valores cortos; el cuerpo 400 debe ser exactamente `{ statusCode, error, message }` con el mensaje fijo por parámetro (limit/cursor/level). Specs de dominio de `PageLimit`, `ExperienceCursor` y `SkillLevel` ahora comparan el mensaje exacto | Alterar el mensaje de `page-limit.ts`: 6 e2e y 1 unit fallan | Verde |
| 4 | Sin implementar. Nota añadida en `tasks.md` (U6, 6.3): el e2e `postgres-down` debe cubrir las tres rutas (hallazgo S3) | n/a | n/a |

## Lote PR2 (U5–U6)

Rama `feat/content-endpoints-postgres`. Integración contra los servicios docker-compose ya levantados (Postgres en 55432, Redis en 56379; no se arrancó ni se detuvo nada).

| Tarea | Archivo de test | Capa | RED | GREEN | Triangulación | REFACTOR |
|-------|-----------------|------|-----|-------|---------------|----------|
| 5.1, 5.2 | `test/integration/migrations.int-spec.ts` | Integración | 11 de 24 en rojo (aserciones en runtime: tablas ausentes) | 24/24 con `1792800000000-content.ts` registrada en `migrations/index.ts` | CHECK de `profile.id`, nivel, posición; UNIQUE de `position` y `(level, name)`; conteos 1/5/16; `openToWork` boolean; `technologies` por defecto `[]`; comentarios; `up -> down -> up` | Limpio |
| 6.1 | `test/integration/typeorm-content.int-spec.ts` | Integración | Stub vacío: 11 de 12 en rojo (aserciones) | 12/12 con `typeorm-content.repository.ts` | Orden por `position`, keyset `limit + 1`, última página, cursor 100000 y `MAX_SAFE_INTEGER` -> `[]`, `text[]` -> `string[]`, nivel vacío, sin fila `profile`, base caída, DataSource perezoso | Limpio |
| 6.2 | `test/content.e2e-spec.ts` (sin cambios) | e2e | Cubierto por 6.3 | 153 e2e previos en verde con `ContentModule` sobre `DATA_SOURCE` | El override de `test-app.ts` conserva el fixture | Limpio |
| 6.3 | `test/postgres-down.e2e-spec.ts` | e2e | 5 de 12 en rojo (503 y recuperación en experience/skills; recuperación en profile) | 12/12 tras el cableado | Las tres rutas: 503 genérico con `no-store` y sin SQL/host/stack, recuperación con datos de la base, perfil ausente -> 503 | Limpio |

Cambios de apoyo: `typeorm-availability.int-spec.ts` ahora deshace dos migraciones (content queda encima de availability), para que su prueba de no-duplicación siga ejerciendo la migración de availability.

### Resultados PR2

- Unit: 56 suites, 543 tests. e2e: 11 suites, 160 tests. Integración: 8 suites, 96 tests (Docker disponible).
- `eslint apps/api --max-warnings 0`, `typecheck`, `prettier --check apps/api`, `build`, `lint:boundaries`: verdes.
- Líneas del PR2 (`git diff --stat main`, con `-N`): 8 archivos, 769 inserciones, 5 borrados. `size:exception` aprobado.

### Desviaciones PR2

- La migración arma los `INSERT` multifila parametrizados desde constantes tipadas dentro del archivo (el seed es texto público de la web, en español, tal como el sitio).
- Mutaciones manuales de 8.x quedan para PR3. No se hicieron aquí.

### Fixes de revisión PR2

Solo tests; sin cambios en código de producción.

| Fix | Archivo | Cambio | RED (runtime) | GREEN |
|-----|---------|--------|---------------|-------|
| Orden de migraciones | `test/integration/typeorm-availability.int-spec.ts` | Revierte con `undoLastMigration` mientras `CreateAvailability` figure en la tabla `migrations`, y luego reaplica; aserta ambos estados | Con una migración vacía `Dummy9999999999999` añadida y el viejo número fijo de 2 reversiones: `Expected: false, Received: true` (1 de 12 en rojo) | Con la migración vacía y el nuevo bucle: 24/24 (availability + content) |
| Restauración de skills | `test/integration/typeorm-content.int-spec.ts` | Captura las filas `learning`, las borra y las reinserta en `finally`; ya no toca migraciones | Con la migración vacía, el enfoque anterior (`undoLastMigration` único) ya no restauraba la semilla de forma fiable; ahora no depende de migraciones | 12/12 y las pruebas posteriores ven la semilla completa |
| Aserciones de recuperación | `test/postgres-down.e2e-spec.ts` | `describe.each` con tabla y marcador por ruta: `/FROM profile\b/`+`Db Name`, `/FROM experience\b/`+`Db Company`, `/FROM skill\b/`+`Db Skill` | Apuntar experience a `/FROM skill\b/`: 1 de 12 en rojo | 12/12 |

Resultados: unit 543, e2e 160, integración 96 (todos en verde); eslint (max-warnings 0), typecheck y prettier verdes. Archivos temporales (migración vacía, backups) eliminados.

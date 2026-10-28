# Apply progress: content-endpoints

Modo: Strict TDD. Entrega: opción (a), 3 PRs con `size:exception`, `stacked-to-main`.
Lote actual: PR1 = U1–U4 (tareas 1.1–4.4 completas). Pendiente: U5–U8 (PR2, PR3).

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

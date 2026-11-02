# Apply progress: admin-visits

> Lotes: 1 = PR 1 (U1), hecho. 2 = PR 2 (U2), hecho. Quedan U3 y U4 (PRs 3 y 4) y el cierre F1–F3.

> Modo: Strict TDD. Entrega: 4 PRs, `stacked-to-main`, con `size:exception` en cualquier PR que supere 400 líneas.

## Lote 1 — PR 1 (U1: esquema, dominio base y `append`)

Tareas completadas: 1.1–1.7 (8 de 8 de U1, incluida 1.6b). Pendientes: U2, U3, U4. `size:exception`: 645 líneas medidas (`git diff --stat` con archivos nuevos; sin lockfile), por encima del pronóstico de 330–400. Las pruebas de integración y la migración explican la mayor parte.

### TDD Cycle Evidence

Para que el RED sea una aserción en ejecución (y no un error de import), se crearon primero stubs con comportamiento incorrecto de `visit-kind.ts` y `visit-retention.ts`.

| Tarea | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 1.1 | `visit-kind.spec.ts` contra un stub (`VISIT_KINDS` vacío, `parseKindFilter` devuelve `null`): fallos de aserción en ejecución (`Expected: "LOGIN"`, `Received: null`; `Expected constructor: InvalidInput`) | 17 pasan (con 1.2) con `visit-kind.ts` | Mensaje fijo sin eco, probado |
| 1.2 | `visit-retention.spec.ts` contra un stub (`RETENTION_DAYS = 0`, `retainFrom` devuelve `now`): `Expected: 180, Received: 0` y fallos de borde | Pasa con `visit-retention.ts` y `visit-event.ts` | — |
| 1.3 | Sin RED propio (solo tipos), según la tarea | Compila; los usan 1.5 y 1.6 | — |
| 1.4 | `migrations.int-spec.ts` ampliado antes de la migración: 19 fallos de aserción en ejecución (`relation "visit_events" does not exist`, listas de tablas sin `visit_events`) | 32 pasan con la migración y `index.ts` | — |
| 1.5 | `in-memory-visit.repository.spec.ts`: 3 fallos contra la implementación inicial (sin purga); el caso de las 100 filas dio `Expected length: 6, Received length: 106`. Los otros dos fallos eran un error del propio test (la purga corre en la escritura siguiente) y se corrigió el test con `seed` | 5 pasan con la purga acotada | Constante `PURGE_LIMIT`, comentario del espejo del CTE |
| 1.6 | **Desvío de orden:** se escribió el adaptador junto con su test y el RED se mostró después, retirando el cuerpo del adaptador (`SELECT` en lugar del CTE): 7 de 10 fallan en ejecución | 10 pasan contra Postgres real | Comentario del CTE en el adaptador |
| 1.6b | Mutaciones temporales, todas revertidas: `<` -> `<=` en el TypeORM (falla el borde), `LIMIT 100` -> `1000` en el TypeORM (falla la purga acotada), mismas dos en el in-memory (1 fallo cada una), `RETENTION_DAYS` 90 (4 fallos), signo de `retainFrom` invertido (3), `VISIT_KINDS` con un valor extra (1). En la migración: sin `ON DELETE CASCADE` (1 fallo), `CHECK` sin efecto (1), `down` que borra `users` (32), índice sin `DESC` (1) | Todo vuelve a verde tras revertir | — |
| 1.7 | Sin RED: no hay ruta de lectura todavía (ver desviaciones). `pg` devuelve `timestamptz` como `Date` (comprobado en `migrations.int-spec.ts`, que llama a `toISOString()`) | — | D-B registrado en el `COMMENT ON COLUMN occurred_at` |

### Correcciones tras la revisión de contexto fresco (mismo lote)

| Hallazgo | RED | GREEN / prueba de que puede fallar |
|----------|-----|-----------------------------------|
| W1: los sobrevivientes de la purga son las filas vencidas menos antiguas | El test pasaba ya (contrato cumplido); se endureció a las cinco marcas exactas. Mutación temporal `ORDER BY occurred_at DESC` en la subconsulta: falla el test de 105 filas; revertida | Verde tras revertir |
| W2: `FOR UPDATE SKIP LOCKED` en la subconsulta de purga | Test nuevo: otra transacción retiene las filas vencidas con `FOR UPDATE`; `append` debe terminar antes de 1,5 s. Sin `SKIP LOCKED`: `Expected "done", Received "blocked"` | Pasa con `SKIP LOCKED`; quitarlo de nuevo hace fallar solo ese test. Design §3 actualizado |
| S1: tope único `PURGE_BATCH` | Test `PURGE_BATCH` = 100 contra un stub en 0: `Expected: 100, Received: 0` | Exportado desde `visit-retention.ts`; lo usan el in-memory y el SQL (`$6::int`) y lo cita el puerto. Mutación: pasar 1000 en lugar de `PURGE_BATCH`: falla el test de 105 filas; revertida. El comentario de la migración ya no cita el número |
| S4 | `migrations.int-spec.ts` compara la lista exacta de tablas tras el primer `down`; `occurred_at` tipado como `Date`; desempate `id` en el `ORDER BY` de la purga | Verde |

### Resultados finales

| Chequeo | Resultado |
|---------|-----------|
| `npm run test:cov -w apps/api` | 62 suites, 645 tests; 100 % líneas / 95,55 % ramas; salida 0 |
| `npm run test:e2e -w apps/api` | 12 suites, 188 tests; salida 0 |
| `npm run test:int -w apps/api` | 10 suites, 122 tests (ver nota de Postgres); salida 0 |
| `npm run lint:boundaries` (raíz; el script no existe en `apps/api`) | sin FAIL; salida 0 |
| `npx eslint . --max-warnings 0` | salida 0 |
| `npm run typecheck` (raíz) | salida 0 |
| `npx prettier --check .` | salida 0 |
| `npm run build -w apps/api` | salida 0 |
| `gitleaks detect --no-git` sobre `apps/api/src/visits` | sin hallazgos |

Nota de Postgres: Docker no estaba disponible. Las pruebas de integración corrieron contra una instancia temporal de Postgres 18.1 (Postgres.app, mismo mayor que el 18.6 de compose) en el puerto 55433, creada en un directorio temporal y ya detenida. El job `integration` de CI las vuelve a correr contra la imagen de compose.

### Archivos

- Creados: `src/visits/domain/{visit-kind,visit-event,visit-retention}.ts` (+ specs de kind y retención), `src/visits/application/ports/{visit-recorder,visit-repository}.port.ts`, `src/visits/infrastructure/persistence/{in-memory,typeorm}-visit.repository.ts` (+ spec in-memory), `src/shared/infrastructure/persistence/migrations/1792886400000-visit-events.ts`, `test/integration/typeorm-visit.repository.int-spec.ts`.
- Modificados: `migrations/index.ts`, `test/integration/migrations.int-spec.ts` (tablas esperadas, `down` de dos pasos en el bloque de `content`, bloque nuevo de `visit_events`).

### Desviaciones y notas

- `VisitRepository` expone solo `append`; `listPage`, `VisitCursor` y el `lookup(userId)` del in-memory llegan en U3, que es donde se usan (evita código sin uso en U1). `InMemoryVisitRepository` ofrece `seed` y `all()` para los tests; U2 expondrá `visits` en `test-app` con `all()`.
- 1.7: el `new Date(row.occurred_at)` pertenece a `listPage` (U3); aquí queda documentado el supuesto D-B.
- 1.6: el RED se mostró después del adaptador, con stub temporal (ver tabla).
- `lint:boundaries` es un script de la raíz, no de `apps/api`.
- Las tareas de cierre C1–C3 (revisión de contexto fresco, `rg` final) quedan para el orquestador antes de abrir el PR.

## Lote 2 — PR 2 (U2: `RecordVisit` y registro en `auth` y `cv`)

Tareas completadas: 2.1–2.9 (9 de 9 de U2). Pendientes: U3, U4. `size:exception`: 626 líneas medidas (`git diff --stat` con archivos nuevos, sin lockfile; 613 inserciones + 13 borrados), por encima del pronóstico de 300–380; los e2e y los specs explican la mayor parte.

### TDD Cycle Evidence

| Tarea | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 2.1 | `record-visit.service.spec.ts` contra un stub con la firma correcta que no hace nada: 5 de 7 fallan en ejecución (`Expected - 11 / Received + 1` en el evento armado, log vacío) | 7 pasan con `record-visit.service.ts` | `RECORD_TIMEOUT_MS` exportado; el `append` se crea dentro del `try` y su rechazo tardío se absorbe |
| 2.2 | Mismo stub: el caso de timers falsos falla (`Expected: false, Received: true`: resolvía sin esperar ni avisar) | `Promise.race` con timer limpiado en `finally`; `getTimerCount() === 0` en éxito y en fallo | — |
| 2.3 | Cableado sin RED propio; lo cubren los e2e (ver 2.6–2.8). Mutación: quitar el override de `VISIT_REPOSITORY` en `test-app`: 2 fallos en `cv.e2e` | `visits.module.ts`, `app.module.ts`, `test-app` expone `visits` | — |
| 2.4 | RED por tipos (permitido por D-D): el spec con la firma nueva `execute({userId})` y el tercer parámetro no compila (`TS2554`) | `get-cv-link.use-case.ts`, `cv.controller.ts` (`@CurrentPrincipal()`), `cv.module.ts` | — |
| 2.5–2.8 | **Desvío de orden:** el código se escribió junto a su spec y el RED se mostró después por mutación (ver 2.9) | 664 unit y 199 e2e verdes | — |
| 2.9 | Mutaciones temporales, todas revertidas: sin `catch` (2 fallos unit, 3 e2e); `record` antes de `issue` (3 unit, 3 e2e); sin `record` en verify (3 unit, 3 e2e); sin `record` en cv (2 unit, 3 e2e); `record` antes de `sign` (2 unit; no observable en e2e); sin `clearTimeout` (2 unit); sin tope (el e2e de postgres-down con conexión colgada falla); tope 5000 (1 unit); sin override en `test-app` (2 e2e) | Verde tras revertir | — |

### Resultados finales

| Chequeo | Resultado |
|---------|-----------|
| `npm run test:cov -w apps/api` | 63 suites, 664 tests; 100 % líneas / 95,62 % ramas; salida 0 |
| `npm run test:e2e -w apps/api` | 12 suites, 199 tests; salida 0 |
| `npm run lint:boundaries` | sin FAIL; salida 0 (`auth` -> `visits/application` permitido, D-E no se activó) |
| `npx eslint . --max-warnings 0` | salida 0 |
| `npm run typecheck` (raíz) | salida 0 |
| `npx prettier --check .` | salida 0 |
| `npm run build -w apps/api` | salida 0 |
| `test:int` | no se corrió: U2 no cambia SQL ni migraciones |

### Archivos

- Creados: `src/visits/application/record-visit.service.ts` (+ spec), `src/visits/visits.module.ts`.
- Modificados: `src/app.module.ts`, `src/auth/{auth.module,application/verify-magic-link.use-case(.spec)}.ts`, `src/cv/{cv.module,application/get-cv-link.use-case(.spec),infrastructure/http/cv.controller}.ts`, `test/support/{test-app,fakes/in-memory-repositories}.ts`, `test/{auth-verify,cv,postgres-down}.e2e-spec.ts`.

### Desviaciones y notas

- 2.5–2.8: el RED se mostró por mutación después de escribir el código (no antes), ver 2.9.
- El log del fallo es `visit recording failed: <name> <code>` (p. ej. `Error 23503`, `InfrastructureUnavailable INFRASTRUCTURE_UNAVAILABLE`), tal como produce `describeFailure`.
- Con Postgres caído, `GET /cv` responde 200 y el evento se pierde; con la conexión colgada, responde 200 tras ~1000 ms y avisa `visit recording timed out` (e2e con tiempo real, ~1 s).
- `RecordVisit` se provee como clase y `VISIT_RECORDER` es un alias (`useExisting`).
- `GetCvLink.execute` recibe `{ readonly userId: string }`, no el `Principal` completo.
- Las tareas C1–C3 (revisión de contexto fresco, `gitleaks`, `rg` final) quedan para el orquestador antes de abrir el PR.

### Correcciones tras la revisión de contexto fresco (lote 2)

| Hallazgo | Cambio | Prueba |
|----------|--------|--------|
| W1 | Test con timers falsos: `append` rechaza a los 2000 ms, después del tope; con el aviso a los 1000 ms, `logger.errors` vacío y sin `unhandledRejection` | Quitar `append.catch(() => undefined)` NO hace fallar el test: `Promise.race` ya se suscribe a `append`, por lo que la línea es redundante hoy. Se conserva como defensa y el test fija el comportamiento ante un cambio futuro de la carrera |
| S1 | Techo del e2e de conexión colgada: 4000 ms (piso de 900 ms) | — |
| S3 | `VisitsModule` exporta solo `VISIT_RECORDER` | e2e verdes (los overrides siguen funcionando) |
| S4 | Comentario en los e2e de verify y CV: el `Error` con `code` es una forma sintética para la prueba de datos personales | — |

Resultados: `test:cov` 63 suites, 665 tests, 100 % líneas / 95,62 % ramas (salida 0); `test:e2e` 12 suites, 199 tests (0); `lint:boundaries` 0; `eslint` 0; `typecheck` raíz 0; `prettier --check` 0; `build` 0.

# Tareas: Admin Visits — historial real de actividad de reclutadores

> 4 unidades de trabajo (U1–U4), una por PR del design §7. `stacked-to-main`, un solo hilo de escritura, secuenciales. Strict TDD (`openspec/config.yaml`): RED (test que falla; debe ser una aserción en ejecución, no un error de compilación o de import, salvo que la tarea lo indique) -> GREEN (mínimo) -> REFACTOR. Rutas relativas a `apps/api/` salvo que se indique. Identificadores en inglés. Datos sintéticos (`*.example.test`). Sin AWS/`cdk`, sin dependencias nuevas, sin ADR, sin commits desde esta fase.

## Review Workload Forecast

Cifras del design §7 (incluyen tests e inflación de Strict TDD). Líneas `additions + deletions`, sin lockfile. Referencia: en `frontend-api-errors` el PR A midió ~2x el pronóstico; se reservó margen en U3.

| Campo | Valor |
|-------|-------|
| Líneas cambiadas estimadas | ~1.240–1.580 en total |
| PR 1 (U1) | 330–400 (en el límite) |
| PR 2 (U2) | 300–380 |
| PR 3 (U3) | 330–420 (**puede superar 400**) |
| PR 4 (U4) | 280–360 + ~30 de verificación web (sin cambios de código esperados) |
| Riesgo de presupuesto de 400 líneas | Medium (U3 supera 400 en el extremo alto; U1 roza el límite) |
| PRs encadenados recomendados | Sí (4 PRs en lugar de los 3 de la propuesta) |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | stacked-to-main |

Decision needed before apply: No (resuelta: 4 PRs con size:exception donde haga falta)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

**Decisión de la usuaria (resuelta antes de apply):** 4 PRs (U1–U4), `stacked-to-main`, con `size:exception` en cualquier PR que supere 400 líneas al contar (C1). `PageLimit` se mueve dentro de U3. No se parte la lógica del cursor.

### Unidades de trabajo (base = `main` tras mergear la anterior)

| Unidad | Objetivo | PR | Depende de |
|--------|----------|----|-----------|
| U1 | Migración, `VisitKind`, retención, `VisitEvent`, puertos y `append` (TypeORM + in-memory) | PR 1 | — |
| U2 | `RecordVisit`, `VisitsModule`, registro en `auth` y `cv`, `test-app`, e2e | PR 2 | U1 |
| U3 | `VisitCursor`, mover `PageLimit`, `listPage` (ambos adaptadores), suite de contrato | PR 3 | U1 |
| U4 | `ListVisits`, controlador, DTO, e2e admin, error-contract, no-store | PR 4 | U2, U3 |

Reversión: `git revert` en orden inverso (U4 devuelve el stub; U2 deja de registrar; el `down` borra solo `visit_events`).

## Preguntas abiertas y puntos de decisión

- [ ] D-A. Supuesto (design §8): `JwtAuthGuard` no consulta Postgres; `GET /cv` gana un round trip a Neon, acotado por el tope de 1000 ms (A3). Se prueba en 2.2 con timers falsos.
- [ ] D-B. Supuesto: `pg` devuelve `timestamptz` como `Date`; el adaptador convierte igual con `new Date(row.occurred_at)` (se verifica en 1.7 y 3.5).
- [ ] D-C. Ajuste menor a la spec (opcional): "ítems de más de 180 días no se listan aunque la purga no haya corrido" (A6) es más fuerte que la spec y compatible. Se prueba en 3.5; verify lo comprueba, sin cambio de spec.
- [ ] D-D. Si el RED de `GetCvLink.execute(principal)` (2.4) falla por compilación al cambiar la firma, es esperable: el RED se escribe primero con la firma nueva en el spec y se acepta fallo de tipo solo en esa tarea.
- [ ] D-E. Si `lint:boundaries` rechaza `auth` -> `visits/application`, STOP y preguntar (A1 lo da por permitido por precedente `auth` -> `identity`).

## Cierre estándar de PR («CIERRE»)

- [ ] C1. Contar líneas (`additions + deletions`, sin lockfile); si excede 400 y no hay `size:exception` aprobado, STOP.
- [ ] C2. En la raíz: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde. `typecheck` en la RAÍZ (todos los workspaces), no solo `-w apps/api`. Además `npm run lint:boundaries -w apps/api` y `npm run test:cov -w apps/api`. `test:int` con `DATABASE_URL` y `REDIS_URL` exportadas a los puertos de compose (`127.0.0.1:55432` / `56379` en local) en los PRs con int (U1, U3).
- [ ] C3. Cobertura >= 80 %; cada test que fija comportamiento existente se muestra capaz de fallar (mutación temporal, revertida); revisión de contexto fresco antes de abrir el PR; `gitleaks` y `rg` (correos reales, ARNs, IDs de cuenta, IP, URL firmada) por separado antes de commitear.

## U1 — Esquema, dominio base y `append` (PR 1)

- [ ] 1.1 RED `src/visits/domain/visit-kind.spec.ts` (`it.each`): `VISIT_KINDS` = `['LOGIN','CV_LINK']`; `parseKindFilter`: `undefined` -> `null`; `LOGIN`/`CV_LINK` -> kind; arreglo, vacío, `login`, `OTHER` -> `InvalidInput` sin eco -> GREEN `visit-kind.ts` (A9).
- [ ] 1.2 RED `visit-retention.spec.ts`: `RETENTION_DAYS` 180; `retainFrom(now)` = now − 180 d; eventos de 179, 180 y 181 días: solo el de 181 queda fuera (borde conservado) -> GREEN `visit-retention.ts` y `visit-event.ts` (`VisitEvent`).
- [ ] 1.3 Puertos `src/visits/application/ports/{visit-recorder,visit-repository}.port.ts` con tokens `VISIT_RECORDER`/`VISIT_REPOSITORY` y `VisitRow` (solo tipos; sin RED propio, los cubren 1.4–1.6).
- [ ] 1.4 RED `test/integration/migrations.int-spec.ts` (extender, `openIsolatedDatabase()`): tras `up` existe `visit_events` con los dos índices; `CHECK` rechaza `kind='OTHER'` (error de Postgres, aserción en ejecución); borrar el usuario borra sus eventos y no los de otro; `down` borra solo `visit_events` -> GREEN `src/shared/infrastructure/persistence/migrations/1792886400000-visit-events.ts` (SQL plano, una sentencia por `query`) + `index.ts`.
- [ ] 1.5 RED `src/visits/infrastructure/persistence/in-memory-visit.repository.spec.ts`: `append` guarda el evento con id y `occurredAt` exactos; purga los de `occurredAt < retainFrom`, máximo 100 por escritura, conserva el borde; no toca a otros -> GREEN `in-memory-visit.repository.ts` (recibe `lookup(userId)`).
- [ ] 1.6 RED `test/integration/typeorm-visit.repository.int-spec.ts`: `append` inserta; purga acotada a 100 filas (105 vencidas -> quedan 5 + el nuevo); borde de 180 d conservado; una sola sentencia (CTE); `kind` inválido rechazado -> GREEN `typeorm-visit.repository.ts` (SQL del design §3).
- [ ] 1.6b Cada test de purga/borde se muestra capaz de fallar: cambiar `<` por `<=` y `LIMIT 100` por `LIMIT 1000` en el adaptador, ver el RED y revertir.
- [ ] 1.7 REFACTOR: `new Date(row.occurred_at)` documentado (D-B); sin `visits.module` todavía. CIERRE (PR 1).

## U2 — `RecordVisit` y registro en `auth` y `cv` (PR 2)

- [ ] 2.1 RED `src/visits/application/record-visit.service.spec.ts` (fakes de puertos): arma `{id, userId, kind, occurredAt}` con `ID_GENERATOR` y `CLOCK` y llama `append(event, retainFrom(now))`; el repositorio lanza -> resuelve sin error y `logger.error` recibe solo `'visit recording failed: ' + describeFailure(e)`, sin correo ni `userId` -> GREEN `record-visit.service.ts` (A2, A4).
- [ ] 2.2 RED mismo spec con timers falsos: repositorio que no resuelve -> `record` resuelve a los 1000 ms con `warn`, y el timer se limpia si resuelve antes -> GREEN `Promise.race` (A3).
- [ ] 2.3 `src/visits/visits.module.ts` (provee y exporta `VISIT_RECORDER`/`VISIT_REPOSITORY`), registrar en `app.module.ts`; `test/support/{test-app,fakes/in-memory-repositories}.ts`: override de `VISIT_REPOSITORY` con el in-memory ligado a `users`, y exponer `visits`. RED: e2e de 2.5 falla en ejecución hasta cablear.
- [ ] 2.4 RED `src/cv/application/get-cv-link.use-case.spec.ts`: `execute({userId})` llama `record({userId, kind:'CV_LINK'})` una vez después de `signer.sign`, y nunca si `sign` lanza -> GREEN `get-cv-link.use-case.ts` + `cv.controller.ts` con `@CurrentPrincipal()` + `cv.module.ts` (importa `VisitsModule`). Ver D-D.
- [ ] 2.5 RED `src/auth/application/verify-magic-link.use-case.spec.ts`: `record({userId, kind:'LOGIN'})` una vez tras `issuer.issue`; cero veces en los cuatro fallos (inexistente, vencido, usado, mal formado) -> GREEN `verify-magic-link.use-case.ts` + `auth.module.ts`.
- [ ] 2.6 RED `test/auth-verify.e2e-spec.ts`: verify OK crea 1 `LOGIN` con el instante del reloj; los 4 fallos -> 400 `INVALID_TOKEN` y 0 eventos; `POST /api/auth/magic-link` no crea eventos para correo registrado, nuevo y con límite agotado, con respuestas idénticas; repositorio que lanza -> misma respuesta y mismas cookies y log sin `recruiter@example.test`, token ni URL -> GREEN.
- [ ] 2.7 RED `test/cv.e2e-spec.ts`: 3 `GET /cv` -> 3 `CV_LINK`; sin sesión -> 401 y 0 eventos; evento sin URL firmada (`https://cv.example.test/signed?sig=abc` ausente de datos y log); repositorio que lanza -> 200 `{url, expiresAt}` -> GREEN.
- [ ] 2.8 RED `test/postgres-down.e2e-spec.ts`: `GET /cv` con Postgres caído -> 200 (por el tope, A3) -> GREEN.
- [ ] 2.9 Mutación temporal: quitar el `catch` de `RecordVisit` y mover `record` antes de `issue`; ver RED en 2.1/2.5/2.6 y revertir. CIERRE (PR 2).

## U3 — Cursor, `PageLimit` compartido y `listPage` (PR 3)

- [ ] 3.1 `git mv` `content/domain/page-limit(.spec).ts` -> `src/shared/domain/page-limit(.spec).ts` y actualizar los 3 imports de `content` (A8); el spec movido sigue en verde (refactor puro, sin RED). Si C1 anticipa > 400, este paso puede salir en un PR previo.
- [ ] 3.2 RED `src/visits/domain/visit-cursor.spec.ts` (`it.each`): round-trip; empate de instante; basura, `%%%`, vacío, base64 no canónico, uuid en mayúsculas, `epochMs` enorme o negativo, no entero, arreglo, largo > 96 -> `parse` devuelve `null`; el mensaje de `InvalidInput` no eco -> GREEN `visit-cursor.ts` (A7).
- [ ] 3.3 RED suite compartida `test/support/visit-repository.contract.ts` ejecutada desde `in-memory-visit.repository.spec.ts`: orden `occurredAt DESC, id DESC`; paginación de 7 eventos con 3 empatados, `limit=2`, sin omitir ni repetir; `limit+1` filas; filtro `kinds`; excluye `< retainFrom` aunque no se purgue (D-C); omite eventos sin usuario -> GREEN `listPage` in-memory.
- [ ] 3.4 RED `test/integration/typeorm-visit.repository.int-spec.ts` corre la misma suite contra Postgres, más `company`/`name` nulos y la cascada -> GREEN `listPage` TypeORM (SQL del design §3, centinela `infinity`/`ffff...`).
- [ ] 3.5 RED en la suite: `occurredAt` conserva precisión de milisegundo en el viaje cursor -> SQL -> cursor (D-B).
- [ ] 3.6 Mutación temporal: quitar `id DESC` del `ORDER BY` y cambiar `<` por `<=` en el keyset; ver RED en 3.3/3.4 y revertir. CIERRE (PR 3; `test:int` exportando `DATABASE_URL`/`REDIS_URL`).

## U4 — `ListVisits`, controlador y e2e (PR 4)

- [ ] 4.1 RED `src/admin/application/list-visits.use-case.spec.ts` (fake de `VisitRepository`): default 5; pide `limit+1`; `nextCursor` del último ítem devuelto; `kind` -> `kinds`; `retainFrom` con el reloj; cursor/limit/kind inválidos -> `InvalidInput`; vacío -> `{items: [], nextCursor: null}` -> GREEN `list-visits.use-case.ts` (inyecta `VISIT_REPOSITORY`, `CLOCK`; `admin.module.ts` importa `VisitsModule`).
- [ ] 4.2 RED `test/admin.e2e-spec.ts`: 200 con claves exactas `items`/`next`, ítem `id,kind,occurredAt,recruiter{company,name}`; `null` presentes; vacío; orden; empate; default 5 con 8 eventos; `next` conserva `limit` y `kind` (A12); paginación de 7 hasta `next=null`; filtro `kind`; cursor tras el último -> vacío; cuerpo sin correo, IP, UA ni `user_id` -> GREEN `admin-visits.controller.ts` (DTO como interfaces, `@ApiExcludeController()`).
- [ ] 4.3 RED mismo archivo: `limit=abc|0|51|2.5||` y `limit=1&limit=2`, `kind=login|OTHER|` y `kind=A&kind=B`, `cursor=<script>|%%%||texto|instante inválido|id inválido|repetido` -> 400 `INVALID_INPUT` con cuatro claves exactas, sin eco y ninguno 500 -> GREEN.
- [ ] 4.4 RED: RECRUITER -> 403 `ROLE_NOT_ALLOWED` sin eventos en el cuerpo y repositorio no consultado; sin sesión -> 401 `UNAUTHENTICATED` -> GREEN.
- [ ] 4.5 RED `test/error-contract.e2e-spec.ts` (celdas de admin/visits 400/401/403) y `test/postgres-down.e2e-spec.ts` (ADMIN -> 503 `SERVICE_UNAVAILABLE` sin SQL ni conexión); todos con `code` en `API_ERROR_CODES` -> GREEN.
- [ ] 4.6 RED `src/bootstrap/no-store.spec.ts`/e2e: `Cache-Control: no-store` en 200, 400, 401, 403 de la ruta; e2e Swagger sin `paths` bajo `/api/v1/admin` -> GREEN.
- [ ] 4.7 Playground web coherente (`apps/web`): sin cambio de código esperado. Verificar que el mock de `/api/v1/admin/visits` sigue dando 403 `ROLE_NOT_ALLOWED` para RECRUITER (`src/lib/api/mock/fixtures.ts`, `mock/index.test.ts`, `playground-endpoints.test.ts`, `features/recruiter/playground/ApiPlayground.test.tsx`, `http.test.ts`, `lib/api/types.ts`); correr `npm test -w apps/web` y ver verde. Mutación temporal: cambiar el mock a 200 y ver fallar el test del 403, revertir. Si algún test fija `[]` como cuerpo del ADMIN, ajustarlo con RED y registrar en el PR.
- [ ] 4.8 Mutación temporal: quitar `RolesGuard` de la ruta y ver RED en 4.4, revertir. REFACTOR. CIERRE (PR 4).

## Cierre del cambio (después de la última unidad)

- [ ] F1. Revisión de contexto fresco de cada PR antes de abrirlo y del diff completo cruzado con las 2 specs delta y el design; hallazgos corregidos con TDD.
- [ ] F2. `gitleaks detect` sin hallazgos y `rg` por separado (correos reales, ARNs, IDs de cuenta, IP, URLs firmadas) en `openspec/changes/admin-visits` y en el código nuevo, antes de cada commit.
- [ ] F3. Raíz: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build`; `test:int` con `DATABASE_URL`/`REDIS_URL` exportadas; cobertura >= 80 %; `sdd-verify` con todos los escenarios de la trazabilidad en verde y `size:exception` (si hubo) registrados.

## Trazabilidad escenario -> tarea

| Spec | Escenarios | Tareas |
|------|-----------|--------|
| api-admin-visits (registro) | Verify crea LOGIN · Verify fallido · CV crea CV_LINK · Cada pedido · CV sin sesión · Magic-link no registra | 2.4, 2.5, 2.6, 2.7 |
| | Best effort (login, CV, log sin datos) | 2.1, 2.2, 2.6, 2.7, 2.8 |
| | Privacidad (evento sin datos, kind fuera del conjunto) | 1.4, 1.6, 2.6, 2.7 |
| | Retención (purga, borde, cascada) | 1.2, 1.4, 1.5, 1.6 |
| | Listado (forma, nulos, sin correo, vacío, orden, empate, paginación, default, next, filtro, cursor final) | 3.2–3.5, 4.1, 4.2 |
| | Validación (limit, kind, cursor basura, componentes) | 1.1, 3.2, 4.3 |
| | Acceso ADMIN (403, 401) | 4.4, 4.8 |
| | 503 y code en catálogo | 4.5 |
| | no-store y Swagger | 4.6 |
| api-recruiter-endpoints | Evento CV_LINK sin URL · Reclutador 403 JSON · Sin sesión | 2.7, 4.4, 4.7 |

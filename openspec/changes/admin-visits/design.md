# Diseño: Admin Visits — historial real de actividad de reclutadores

> Fecha: 2026-10-30. Base: `proposal.md` (D1 vinculante; P1–P6 aceptadas sin comentarios), `exploration.md` y las specs delta `api-admin-visits` y `api-recruiter-endpoints`. Sigue las convenciones de `content-endpoints` (keyset, `PageLimit`) y de `frontend-api-errors` (catálogo de `code`).
> Nota de tamaño: supera las 800 palabras porque el orquestador pidió cerrar puerto, esquema, cursor, purga, best effort, DTO, tests y PRs. Todo va en tablas.

## 1. Enfoque técnico

Un slice nuevo, `src/visits/`, es dueño del concepto "evento de visita": dominio, puertos, adaptadores y un servicio de aplicación `RecordVisit`. `auth` y `cv` dependen solo del puerto `VisitRecorder` (capa `application`). `admin` conserva el controlador y `ListVisits`, que lee con el puerto `VisitRepository`. Ningún slice importa la infraestructura de otro.

```
VerifyMagicLink ─┐                     ┌─ TypeOrmVisitRepository ── visit_events ⋈ users
GetCvLink ───────┼─→ VisitRecorder ──→ RecordVisit ─→ VisitRepository ─┤
                 │   (nunca lanza)     (catch + log)                    └─ InMemoryVisitRepository
AdminVisitsController → ListVisits ────────────────→ VisitRepository.listPage
```

## 2. Decisiones de arquitectura

| # | Opción elegida | Alternativas | Motivo |
|---|----------------|--------------|--------|
| A1 | Slice `visits` con `application/ports/visit-recorder.port.ts` (`VISIT_RECORDER`) y `visit-repository.port.ts` (`VISIT_REPOSITORY`). `VisitsModule` los provee y exporta. `AuthModule`, `CvModule` y `AdminModule` lo importan. | Puerto en `shared/application/ports`; puerto dentro de `admin` | `eslint.config.mjs` solo prohíbe que `application` importe `infrastructure` o `bootstrap`. Importar `application` de otro slice ya tiene precedente (`auth` → `identity`). `shared` aloja puertos técnicos (reloj, ids, logger), no conceptos de negocio. Si el puerto viviera en `admin`, `auth` dependería del back-office, y la dependencia quedaría invertida. |
| A2 | `RecordVisit implements VisitRecorder`: `record({userId, kind})` arma el evento con `ID_GENERATOR` y `CLOCK`, llama a `repo.append(event, retainFrom)` y atrapa todo. Nunca rechaza. | Inyectar el repositorio directo en `auth` y `cv`; evento de dominio con un bus | La política best effort (P4) vive en un solo lugar y se prueba una vez. Un bus sería infraestructura nueva para dos emisores. |
| A3 | Se espera el registro (`await`) **después** del éxito: en `VerifyMagicLink`, después de `issuer.issue`; en `GetCvLink`, después de `signer.sign`. Con tope de **1000 ms** (`Promise.race` con un timer que se limpia). Si se agota, `warn` y se sigue. | Fire-and-forget; esperar sin tope | En Lambda, el trabajo pendiente se congela al responder: fire-and-forget pierde eventos y deja promesas sueltas. `GET /cv` hoy no toca Postgres: sin tope, una base caída sumaría hasta 5 s (`CONNECT_TIMEOUT_MS`). Un verify fallido lanza antes y nunca llega al registro. |
| A4 | El log usa `logger.error('visit recording failed: ' + describeFailure(e))` y nada más: sin `userId`, correo, IP, URL ni `cause`. | Loguear el usuario | `describeFailure` ya existe para esto. Un usuario borrado con JWT vigente produce una violación de FK, que cae en este mismo camino. |
| A5 | Tabla `visit_events` (§3), PK `uuid` generada por la aplicación, `occurred_at` **sin default** y siempre del `Clock`. | `bigint identity`; `DEFAULT now()` | Sigue la convención `uuid` de `users` y `refresh_tokens`. El in-memory y Postgres guardan el mismo id. Sin default, todas las marcas tienen precisión de milisegundo, igual que el cursor. Con `now()` (microsegundos), el viaje por ISO perdería precisión y la paginación podría saltar o repetir eventos. |
| A6 | Purga **en cada escritura**, en la misma sentencia (CTE `DELETE` + `INSERT`, un round trip, atómica) y acotada a 100 filas. Corte: `retainFrom = now − 180 d`; se borra `occurred_at < retainFrom`, de modo que el borde exacto de 180 días se conserva. El listado además filtra `occurred_at >= retainFrom`. | Purga al listar (DELETE en un GET); EventBridge/cron; tarea probabilística | No requiere infraestructura nueva y es amigable con Neon: un solo round trip, y casi siempre borra 0 filas por índice. El filtro de lectura garantiza "nunca se muestra lo vencido" aunque no haya escrituras por meses. El tope evita borrados largos tras un periodo inactivo. |
| A7 | `VisitCursor` en `visits/domain`: base64url de `"<epochMs>.<uuid>"`. `parse` es estricto: alfabeto `[A-Za-z0-9_-]`, largo ≤ 96, re-codificación canónica, `epochMs` entero seguro ≥ 0 y uuid en minúsculas. Cualquier fallo → `InvalidInput('cursor is invalid')`, sin eco del valor. | JSON en base64; cursor firmado (HMAC) | Una cadena plana valida con una regex y no requiere `JSON.parse`. La firma no aporta nada: el cursor no da acceso a nada que el ADMIN no vea. Validar el uuid **antes** de SQL evita que `$::uuid` falle con un 503 en lugar de 400. |
| A8 | `PageLimit` se mueve a `shared/domain/page-limit.ts` (`git mv` y tres imports en `content`). El valor por defecto es 5, el mismo que fija la spec. | Importar `content/domain` desde `admin`; un parámetro de default | Es un value object genérico y no pertenece a `content`. La spec ya fijó 5, así que no hace falta ningún parámetro. |
| A9 | `VisitKind`: `VISIT_KINDS = ['LOGIN','CV_LINK'] as const`; `parseKindFilter(raw)`: `undefined` → `null` (ambos); string exacto del conjunto → kind; arreglo, vacío, minúscula u otro → `InvalidInput`. | Validación con DTO y `class-validator` | Sigue el patrón `SkillLevel`/`PageLimit`. Los parámetros repetidos (`?kind=A&kind=B`) llegan como arreglo y se rechazan solos. |
| A10 | El listado hace `JOIN users` al leer, para traer `company` y `name` vigentes. | Copiar `company` y `name` en el evento | Evita duplicar datos personales. El borrado en cascada (P2) deja limpio el historial. Mostrar el nombre actual es aceptable para el ADMIN. |
| A11 | El controlador sigue con `@ApiExcludeController()`. Los DTO son interfaces sin `@ApiProperty`. Se conserva `no-store` vía `bootstrap/no-store` (prefijo `/api/v1`). | Documentar en Swagger | La spec exige que no haya rutas `/api/v1/admin` en `paths`, y ya hay un e2e que lo verifica. |
| A12 | `next` = `/api/v1/admin/visits?cursor=<c>&limit=<n>` + `&kind=<K>` si vino `kind`. | URL absoluta | Es el mismo formato que `/api/v1/experience`. base64url no necesita escape. |

## 3. Esquema (migración `1792886400000-visit-events.ts`)

Es SQL plano, con una sentencia por `queryRunner.query`, sin `SET` ni `CONCURRENTLY`. La tabla es nueva y está vacía.

```sql
CREATE TABLE visit_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL,
  CONSTRAINT visit_events_kind_valid CHECK (kind IN ('LOGIN', 'CV_LINK'))
);
CREATE INDEX visit_events_occurred_at_id_idx ON visit_events (occurred_at DESC, id DESC); -- keyset + purga
CREATE INDEX visit_events_user_id_idx ON visit_events (user_id);                       -- cascada
COMMENT ON TABLE / COLUMN ...  -- sin IP, UA ni correo; retención 180 d; precisión ms
-- down: DROP TABLE visit_events
```

**SQL del adaptador** (estático, sin ramas):

```sql
-- append(event, retainFrom)
WITH purged AS (
  DELETE FROM visit_events WHERE id IN (
    SELECT id FROM visit_events WHERE occurred_at < $5 ORDER BY occurred_at LIMIT 100))
INSERT INTO visit_events (id, user_id, kind, occurred_at) VALUES ($1::uuid, $2::uuid, $3, $4)

-- listPage({ retainFrom, kinds, before, limit }): la primera página usa el centinela
-- before = ('infinity', 'ffffffff-ffff-ffff-ffff-ffffffffffff')
SELECT e.id, e.kind, e.occurred_at, u.company, u.name
FROM visit_events e JOIN users u ON u.id = e.user_id
WHERE e.occurred_at >= $1 AND e.kind = ANY($2::text[])
  AND (e.occurred_at, e.id) < ($3::timestamptz, $4::uuid)
ORDER BY e.occurred_at DESC, e.id DESC
LIMIT $5::int   -- limit + 1
```

## 4. Contratos

```ts
// visits/domain
export type VisitKind = (typeof VISIT_KINDS)[number];
export interface VisitEvent { id: string; userId: string; kind: VisitKind; occurredAt: Date }
export const RETENTION_DAYS = 180; export function retainFrom(now: Date): Date;
export class VisitCursor { static parse(raw: unknown): VisitCursor | null; static from(e): VisitCursor; encode(): string }
// visits/application/ports
export interface VisitRecorder { record(input: { userId: string; kind: VisitKind }): Promise<void> } // nunca rechaza
export interface VisitRepository {
  append(event: VisitEvent, retainFrom: Date): Promise<void>;
  listPage(q: { retainFrom: Date; kinds: readonly VisitKind[];
    before: { occurredAt: Date; id: string } | null; limit: number }): Promise<VisitRow[]>; // limit+1
}
export interface VisitRow { id; kind; occurredAt: Date; company: string | null; name: string | null }
// admin/application/list-visits.use-case.ts
execute({ limit?, cursor?, kind? }: unknown-typed): Promise<{ items: VisitRow[]; limit; kind: VisitKind | null; nextCursor: string | null }>
// HTTP: { items: { id, kind, occurredAt: ISO, recruiter: { company, name } }[], next: string | null }
```

`GetCvLink.execute(principal: { userId })`: `CvController` pasa `@CurrentPrincipal()`, como `MeController`. `InMemoryVisitRepository` recibe un `lookup(userId) → {company,name} | null`. `listPage` omite los eventos sin usuario, lo que simula la cascada. `createTestApp` lo cablea con `users` y expone `visits`.

## 5. Archivos

| Archivo | Acción |
|---------|--------|
| `apps/api/src/visits/domain/{visit-kind,visit-event,visit-retention,visit-cursor}.ts` (+ specs) | Crear |
| `apps/api/src/visits/application/ports/{visit-recorder,visit-repository}.port.ts` | Crear |
| `apps/api/src/visits/application/record-visit.service.ts` (+ spec) | Crear (A2–A4) |
| `apps/api/src/visits/infrastructure/persistence/{typeorm,in-memory}-visit.repository.ts` (+ spec in-memory) | Crear |
| `apps/api/src/visits/visits.module.ts`, `app.module.ts` | Crear / registrar |
| `apps/api/src/shared/infrastructure/persistence/migrations/{1792886400000-visit-events,index}.ts` | Crear / agregar |
| `apps/api/src/shared/domain/page-limit.ts` (+ spec), `content/**` | Mover (A8) |
| `apps/api/src/auth/{auth.module,application/verify-magic-link.use-case}.ts` (+ spec) | Inyectar `VISIT_RECORDER` |
| `apps/api/src/cv/{cv.module,application/get-cv-link.use-case,infrastructure/http/cv.controller}.ts` (+ spec) | Recibir principal y registrar |
| `apps/api/src/admin/{admin.module,application/list-visits.use-case,infrastructure/http/admin-visits.controller}.ts` (+ spec) | Listado real |
| `apps/api/test/support/{test-app,fakes/in-memory-repositories}.ts` | Override de `VISIT_REPOSITORY` |
| `apps/api/test/{admin,cv,auth-verify,error-contract,postgres-down}.e2e-spec.ts` | Casos nuevos |
| `apps/api/test/integration/{typeorm-visit.repository,migrations}.int-spec.ts` | Crear / extender |

## 6. Tests (Strict TDD)

| Capa | Qué | Cómo |
|------|-----|------|
| Unit dominio | Cursor: round-trip, empate, basura, `%%%`, vacío, base64 no canónico, uuid en mayúsculas, `epochMs` enorme, arreglo. Retención: 179, 180 y 181 días. `parseKindFilter`. | `it.each` |
| Unit aplicación | `RecordVisit`: evento correcto (reloj, id); el repositorio lanza → resuelve sin error y el log no contiene correo ni id; timeout con timers falsos. `VerifyMagicLink`: llama a `record` una vez tras el éxito y nunca ante los cuatro fallos. `GetCvLink` igual. `ListVisits`: limit+1, `nextCursor`, `kind`, `retainFrom`. | Fakes de puertos |
| Contrato del repositorio | Orden, empates, paginación de 7 eventos con 3 empatados, filtro, purga acotada, cascada | Una suite compartida que corre sobre in-memory (unit) y sobre TypeORM (int, Postgres de compose, esquema aislado) |
| Int | `CHECK` rechaza `kind` inválido; cascada al borrar el usuario; `down` borra solo `visit_events` | `openIsolatedDatabase()` |
| e2e | Admin: 200 con forma exacta, vacío, default 5, `next` con `kind`, 400 (limit, kind, cursor; sin eco), 401, 403, `no-store`, Swagger oculto. Verify y CV: crean el evento; un repositorio que lanza no cambia la respuesta ni las cookies; el log no contiene la URL firmada. `postgres-down`: admin → 503; CV → 200. | `createTestApp()` |

## 7. PRs (stacked-to-main)

| PR | Contenido | Líneas estimadas |
|----|-----------|------------------|
| 1 | Migración, `VisitKind`, retención, `VisitEvent`, puertos, `append` (TypeORM + in-memory), int de esquema y purga | 330–400 |
| 2 | `RecordVisit`, `VisitsModule`, cableado en `auth` y `cv` (principal), `test-app`, e2e de verify, CV y postgres-down | 300–380 |
| 3 | `VisitCursor`, mover `PageLimit`, `listPage` (ambos adaptadores) y la suite de contrato | 330–420 |
| 4 | `ListVisits`, controlador, DTO, e2e de admin, error-contract y no-store | 280–360 |

La propuesta estimaba tres PR. Este diseño propone cuatro para no pasar de 400 líneas; lo decide `sdd-tasks`. **Reversión:** `git revert` en orden inverso. Revertir el PR 4 devuelve el stub, y revertir el PR 2 deja de registrar eventos. El `down` borra solo `visit_events`.

## 8. Preguntas abiertas y supuestos

- [ ] Supuesto: `JwtAuthGuard` no consulta Postgres, así que `GET /cv` gana un round trip a Neon (posible arranque en frío). A3 lo acota a 1 s. Un evento que se pierde por timeout es aceptable con P4.
- [ ] Supuesto: `pg` devuelve `timestamptz` como `Date`. El adaptador lo convierte igual con `new Date(row.occurred_at)`.
- [ ] Ajuste menor a la spec, si se quiere: "ítems de más de 180 días no se listan aunque la purga no haya corrido" (A6) es más fuerte que lo que exige hoy la spec y es compatible con ella.

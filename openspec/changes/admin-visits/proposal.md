# Propuesta: Admin Visits — historial real de actividad de reclutadores

## Intención

`GET /api/v1/admin/visits` es un stub que devuelve `[]` (`ListVisits.execute(): never[]`). El administrador no puede saber qué empresa entró ni cuándo pidió el CV. Hoy no hay una fuente reutilizable: `users.last_login_at` guarda solo el último login, `refresh_tokens` no es una bitácora y `GetCvLink` no registra nada (ver `exploration.md` §2).

## Alcance

### Decisión de la usuaria (vinculante, 2026-10-30)

| # | Decisión |
|---|----------|
| D1 | Opción A: se registra solo la actividad de reclutadores en Postgres. `LOGIN` tras un verify exitoso y `CV_LINK` al entregar el enlace del CV. Las páginas vistas públicas anónimas (opciones B, C y D) quedan fuera y podrían ser un cambio posterior. |

### Decisiones por defecto (a confirmar en la revisión)

| # | Decisión |
|---|----------|
| P1 | El ADMIN ve por evento `recruiter.company` y `recruiter.name` (ambos pueden ser `null`). Nunca ve el correo, la IP ni el user agent. |
| P2 | Retención de 180 días con purga de las filas más antiguas, sin tarea programada (el diseño fija el mecanismo). El historial se borra con el usuario (`ON DELETE CASCADE`). |
| P3 | Se registra cada pedido de enlace de CV, sin deduplicar. El volumen es bajo. Deduplicar por usuario y día queda como ajuste posterior. |
| P4 | El registro es *best effort*. Si falla, el login y la entrega del CV no fallan. El error va al log sin datos personales. |
| P5 | La respuesta es `{ items, next }` con un cursor keyset compuesto (`occurredAt` + `id`) opaco en base64url. Se reutiliza `PageLimit` y hay un filtro opcional `kind`. Errores: 400 `INVALID_INPUT`, 401, 403 `ROLE_NOT_ALLOWED` y 503, sin `code` nuevos. Se mantiene `no-store`. |
| P6 | Se acepta el cambio incompatible de `[]` a `{ items, next }`. El único consumidor es el playground, que como RECRUITER recibe 403. |

### Dentro del alcance
- Tabla nueva `visit_events` (`id`, `user_id` FK, `kind` con `CHECK`, `occurred_at`) creada con una migración en SQL plano.
- Dominio `VisitKind` y cursor compuesto. Un puerto de registro con adaptadores TypeORM y en memoria.
- `VerifyMagicLink` y `GetCvLink` registran el evento a través de un puerto de aplicación. Ninguno de los dos importa la infraestructura de `admin`.
- `ListVisits` real: orden `occurred_at DESC, id DESC`, `PageLimit`, `kind`, DTO y e2e.
- Purga por retención.

### Fuera del alcance
- Una pantalla de administración en la web, las páginas vistas anónimas y los logs de CloudFront o analítica de terceros.
- IP, user agent, geolocalización y huella del navegador.
- `/admin/visits/summary`, exportación, gráficos y notificaciones.
- Cambios en el flujo `magic-link` (sigue respondiendo 202 idéntico).

## Capacidades

### Capacidades nuevas
- `api-admin-visits`: qué eventos se registran y cuándo, la política *best effort*, los datos que se excluyen, la retención y la cascada, más el listado paginado, el filtro `kind`, sus errores y `no-store`. Reúne el registro (que cruza `auth` y `cv`) y su lectura en un solo contrato. Por eso no reparte los requisitos entre `api-magic-link-login` y `api-recruiter-endpoints`.

### Capacidades modificadas
- `api-recruiter-endpoints`: se elimina el requisito "Stub de /api/v1/admin/visits" y se reemplaza por una referencia a `api-admin-visits`. Se conservan el 403 para RECRUITER y el 401 sin sesión. "GET /api/v1/cv" aclara que el evento `CV_LINK` se guarda sin la URL firmada.
- Ninguna en `api-error-contract`: el escenario del 403 `ROLE_NOT_ALLOWED` sigue siendo válido. Tampoco en `web-recruiter-access`, porque el mock mantiene el 403.

## Enfoque

Se sigue la recomendación de la exploración (§5). El puerto de registro vive en una capa de aplicación compartida (el diseño decide si va en `shared` o en un slice propio) y se inyecta en `auth` y `cv`, de modo que se respeten las reglas `no-restricted-imports`. La escritura va envuelta en un try/catch con un log sin datos personales. El cursor reutiliza la mecánica de `content` de pedir una fila de más, con una clase de cursor nueva. No entra tecnología nueva, así que no requiere ADR.

## Plan de PRs (stacked-to-main, strict TDD)

Las cifras ya incluyen los tests.

| PR | Contenido | Líneas |
|----|-----------|--------|
| 1 | Migración, dominio (`VisitKind`, cursor), puerto y adaptadores, purga y tests unitarios | ~350–450 |
| 2 | Registro *best effort* en `VerifyMagicLink` y `GetCvLink`, el cableado de módulos y los tests | ~250–400 |
| 3 | `ListVisits`, el controlador, el DTO, el e2e (200, 400, 401, 403 y 503) y las specs | ~350–500 |

Los PR 1 y 3 pueden superar las 400 líneas. La decisión se toma en `sdd-tasks`.

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `apps/api/src/admin/**` (`list-visits.use-case.ts`, el controlador, el módulo) | Modificado |
| `apps/api/src/auth/application/verify-magic-link.use-case.ts` y `src/cv/application/get-cv-link.use-case.ts` | Modificado |
| `apps/api/src/shared/infrastructure/persistence/migrations/` | Nuevo |
| `apps/api/test/admin.e2e-spec.ts`, `error-contract.e2e-spec.ts` y `no-store.spec.ts` | Modificado |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Un fallo del registro rompe el login o el CV | Media | Test de que el puerto que falla no cambia la respuesta |
| Un cursor mal formado da 500 en lugar de 400 | Media | Validación en el dominio y e2e con basura y base64 inválido |
| `auth` o `cv` importan la infraestructura de `admin` | Media | Puerto de aplicación más `npm run lint` |
| Datos personales en los logs o los fixtures | Baja | Datos sintéticos y test de que el log no contiene el correo |
| La tabla crece sin límite | Baja | Purga a los 180 días |
| Se cuela el correo en la respuesta | Baja | DTO con claves exactas |

## Plan de reversión

`git revert` de cada merge en orden inverso (3 → 1). Revertir el PR 3 devuelve el stub. Revertir el PR 2 deja de registrar eventos. La migración del PR 1 tiene un `down` que borra `visit_events`, y no toca otras tablas. No hay estado en AWS ni costo nuevo.

## Dependencias

- `frontend-api-errors` archivado (catálogo de `code`).

## Criterios de éxito

- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde.
- [ ] Un verify exitoso y un `GET /api/v1/cv` crean un evento cada uno. Un verify fallido no crea ninguno.
- [ ] Al ADMIN le llegan `{ items, next }` paginado y filtrable por `kind`, sin correo, IP ni user agent. RECRUITER recibe 403 y sin sesión, 401.
- [ ] Un fallo del registro no cambia la respuesta del login ni la del CV.
- [ ] Los eventos de más de 180 días se purgan, y al borrar al usuario se borra su historial.
- [ ] Cobertura ≥ 80 %.

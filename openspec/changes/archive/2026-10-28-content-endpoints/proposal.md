# Propuesta: Content Endpoints — `profile`, `experience` y `skills` con sesión

## Intención

El playground de la zona reclutador ya llama a `/api/v1/profile`, `/experience?limit=2` y `/skills?level=advanced`, pero hoy responden 404 (decisión D3 de `auth-backend`). Este cambio los implementa en NestJS hexagonal con datos en Postgres y la forma de los mockups aprobados (ver `exploration.md` §4).

## Alcance

### Dentro del alcance
- `GET /api/v1/profile` → 200 `{name, role, architecture, domains[], openToWork}`.
- `GET /api/v1/experience?limit&cursor` → 200 `{items[], next}`.
- `GET /api/v1/skills[?level]` → 200 por nivel o todos los niveles.
- Slice `apps/api/src/content/` (dominio, aplicación, puerto, adaptadores, módulo).
- Migración con SQL plano: tablas `profile` (fila única), `experience`, `skill` y seed.
- Test de contrato seed ↔ `apps/web/src/content` y escaneo de contenido del seed en la API.
- Swagger: las tres rutas documentadas (`content`, cookie auth).

### Decisiones (vinculantes, 2026-10-22)

| # | Decisión |
|---|----------|
| C1 | Con sesión: guard JWT por defecto, sin `@Public()`. Sin sesión → 401. Se mantiene `Cache-Control: no-store`. |
| C2 | `level` ∈ `advanced`, `production`, `architecture`, `learning` (1:1 con las columnas del sitio). Con `level` → `{level, skills[]}`; sin `level` → `{levels:[{level, skills}]}`; inválido → 400. |
| C3 | `limit` 1..50 (por defecto 5) y `cursor` numérico. `next` = URL de la página siguiente o `null` en la última. `limit`/`cursor` inválidos → 400 sin repetir la entrada. |
| C4 | Postgres con seed por migración (patrón `availability`: DataSource perezoso, Postgres caído → 503). |

### Fuera del alcance
- Datos reales en `/api/v1/admin/visits`.
- Cambios en el frontend: el ejemplo de la home sigue rotulado como ejemplo (alineación opcional en un cambio posterior).
- Acceso público y caché.

## Capacidades

### Capacidades nuevas
- `api-content-endpoints`: contrato de las tres rutas, validación (C2, C3), 401 sin sesión, 503 sin Postgres, `no-store`, Swagger, test de contrato y escaneo de contenido del seed.

### Capacidades modificadas
- `api-recruiter-endpoints`: se reemplaza el requisito "Endpoints de contenido fuera de alcance" (404 y ausencia en Swagger). "Swagger sin rutas de administración" se mantiene: `/admin` sigue oculto.

## Enfoque

Recomendación de la exploración (§7) con C1–C4. Validación en value objects (`Limit`, `Cursor`, `SkillLevel`) que lanzan `INVALID_INPUT` → 400 vía `DomainExceptionFilter`. Puerto `ContentRepository` con adaptador en memoria (unit/e2e) y adaptador TypeORM con SQL plano: una sentencia por `query()`, sin `SET` ni advisory locks. Sin tecnología nueva: no requiere ADR.

## Plan de PRs (stacked-to-main, con tests)

Strict TDD multiplicó 2–6x los pronósticos de `auth-backend`; estas cifras ya incluyen tests.

| PR | Contenido | Líneas |
|----|-----------|--------|
| 1 | Dominio, aplicación, repo en memoria, controladores, DTOs, Swagger; e2e actualizado (fin del 404) | ~550–700 |
| 2 | Migración + seed, repo TypeORM, 503, integración, cableado del módulo | ~450–600 |
| 3 | Test de contrato seed ↔ web y escaneo de contenido del seed | ~200–300 |

PR 1 y 2 superan las 400 líneas: decidir en `sdd-tasks` (`size:exception` o más cortes).

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `apps/api/src/content/` | Nuevo |
| `apps/api/src/app.module.ts`, `migrations/index.ts` | Modificado |
| `apps/api/test/admin.e2e-spec.ts`, `test/content.e2e-spec.ts` | Modificado / Nuevo |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Deriva entre web, seed y ejemplo de la home | Alta | ids estables; test de contrato en CI |
| Arranque en frío de Neon | Media | 503 explícito; medir en el cambio de infra |
| TypeORM con pooler en modo transacción (NO VERIFICADO, ADR-004) | Media | SQL plano; integración contra Postgres real |
| Content-guard no cubre `apps/api` | Media | Escaneo del seed: sin sueldo/montos, teléfono, fechas de disponibilidad ni archivos de CV |
| `openToWork` derive en fecha o condición | Baja | Booleano en la spec; cubierto por el escaneo |

## Plan de reversión

`git revert` de cada merge en orden inverso (3 → 1). Revertir PR 2 exige antes `migration:revert` (el `down` hace `DROP`). Sin despliegue: no hay estado en AWS. Sin PR 1 las rutas vuelven a 404.

## Dependencias

- `auth-backend` archivado (guard JWT, `no-store`, `DomainExceptionFilter`, patrón `availability`).

## Criterios de éxito

- [x] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde. *Cumplido (verify-report, Ejecución): `npm run test:cov -w apps/api` 583/583, `test:e2e` 164/164, typecheck, build y eslint en verde. Nota: `apps/api` no tiene script `lint`; se usó `npx eslint apps/api apps/web --max-warnings 0`.*
- [x] e2e: con sesión, las tres rutas responden 200 con la forma de C2/C3; sin sesión, 401. *Cumplido: `content.e2e-spec.ts` (verify-report, matriz de cumplimiento).*
- [x] e2e: `limit`/`cursor`/`level` inválidos → 400 sin repetir la entrada; `next` es `null` en la última página. *Cumplido: `content.e2e-spec.ts` (it.each de 400 sin eco y recorrido de `next`).*
- [x] Postgres caído → 503; las tres rutas aparecen en `/api/docs` y `/admin` no. *Cumplido: `postgres-down.e2e-spec.ts` y `content.e2e-spec.ts` (Swagger).*
- [x] El test de contrato y el escaneo de contenido pasan en CI. *Evidencia: el job `integration` pasó en verde en los PR #43 y #44.*
- [x] Cobertura de `domain`/`application` ≥ 80 %; sin datos personales en el seed. *Cumplido: cobertura 100 % en `content/domain` y `content/application`; escaneo del seed sin teléfono, email, sueldo, disponibilidad ni archivos de CV; gitleaks sin hallazgos.*

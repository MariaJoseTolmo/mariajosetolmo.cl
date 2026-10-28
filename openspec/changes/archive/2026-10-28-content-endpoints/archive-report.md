# Informe de archivo: content-endpoints

**Proyecto**: web_cv · **Cambio**: `content-endpoints` · **Fecha de archivo**: 2026-10-28
**Modo de persistencia**: openspec (con traza en Engram)
**Ubicación tras el archivo**: `openspec/changes/archive/2026-10-28-content-endpoints/`
**Estado**: archivado. Specs principales actualizadas (una creada, una modificada) y carpeta del cambio movida al archivo.

## 1. Resumen

El cambio `content-endpoints` implementa en `apps/api` (NestJS, hexagonal) las tres rutas de contenido que el playground de la zona reclutador ya llamaba: `GET /api/v1/profile`, `GET /api/v1/experience` (paginación por cursor) y `GET /api/v1/skills` (por nivel). Las rutas exigen sesión (C1), responden `no-store`, validan `limit`, `cursor` y `level` con 400 sin eco, responden 503 si Postgres no está disponible y se documentan en Swagger con el tag `content`. Los datos viven en Postgres, sembrados por migración desde `apps/web/src/content`.

Se implementó en seis PRs (#25, #33, #41, #42, #43 y #44), todos mergeados. Se verificó con Strict TDD. El veredicto fue **PASS WITH WARNINGS** (0 CRITICAL, 5 WARNING, 5 SUGGESTION) con 22/22 escenarios de las specs cubiertos por un test que pasa en runtime. Tras el PR #44 quedan cerrados S1, S3 y W5, y en esta fase se cierran W4 y S2 al promover las specs. S4 queda documentada en la spec. Queda abierto S5 (pooler de Neon, sin verificar), que pasa a un cambio de infraestructura.

## 2. Implementación (PRs)

Los números de PR #25, #33 y #41 se toman del brief de archivo. El reflog local registra las ramas y los commits, pero no los números de PR.

| PR | Rama | Contenido |
|----|------|-----------|
| #25 | `docs/content-endpoints-proposal` | Exploración y propuesta (`exploration.md`, `proposal.md`). Decisiones C1–C4. |
| #33 | `docs/content-endpoints-spec-design` | Specs delta (`api-content-endpoints`, modificación de `api-recruiter-endpoints`) y `design.md` (E1–E9). |
| #41 | `feat/content-endpoints-api` | PR1 (U1–U4). Value objects `PageLimit`, `ExperienceCursor`, `SkillLevel`; casos de uso; puerto `ContentRepository` con adaptador en memoria; controlador, DTOs y Swagger; `content.e2e-spec.ts`; fin del 404 en `admin.e2e-spec.ts`. Repositorio en memoria vacío en el módulo (E7). Incluye fixes de revisión (Swagger `security`, `oneOf` de `skills`, mensajes fijos sin eco). `size:exception`. |
| #42 | `feat/content-endpoints-postgres` | PR2 (U5–U6). Migración `1792800000000-content.ts` (SQL plano, una sentencia por `query()`, seed parametrizado), `TypeOrmContentRepository` con `ensureInitialized` y `withDatabase` (503), cableado por `DATA_SOURCE`, `postgres-down.e2e-spec.ts` para las tres rutas. Incluye fixes de revisión de tests (orden de migraciones, restauración de habilidades, aserciones de recuperación por ruta). `size:exception`. |
| #43 | `test/content-endpoints-contract` | PR3 (U7–U8). `test/support/content-rules.ts` (`findContentDrift`, `contentViolations`), `content-contract.int-spec.ts` (seed vs web, escaneo de datos servidos y de la fuente de la migración), escaneo de los cuerpos e2e. Cambio cross-app en `apps/web/src/test/contentRules.ts` (ver sección 5). `size:exception`. |
| #44 | `fix/content-endpoints-verify-findings` | Cierre de hallazgos del verify: S1 (`ListSkills` nunca devuelve `{ levels: [] }` para un nivel válido), S3 (negativos de `content-rules.spec.ts` con mensaje o regla exacta), W5 (checklist CIERRE de `tasks.md`). |

## 3. Specs promovidas a `openspec/specs/`

| Capacidad | Acción | Requisitos | Escenarios | Destino |
|-----------|--------|-----------:|-----------:|---------|
| `api-content-endpoints` | Creada (capacidad nueva) | 9 | 23 | `openspec/specs/api-content-endpoints/spec.md` |
| `api-recruiter-endpoints` | Modificada (delta MODIFIED) | 6 (sin cambio) | 15 → 17 | `openspec/specs/api-recruiter-endpoints/spec.md` |

**Detalle de `api-content-endpoints`.** El delta tenía 9 requisitos y 19 escenarios. La spec principal conserva los 9 requisitos y añade 4 escenarios para cubrir lo que hoy solo estaba en el design o en el verify (S2 y S4):
- `Cursor más allá del final` → `{ items: [], next: null }`.
- `Ceros a la izquierda` → `limit` y `cursor` se normalizan (`007` equivale a `7`).
- `cursor por encima del máximo seguro` → 400 si el valor supera `Number.MAX_SAFE_INTEGER`.
- `Nivel válido sin habilidades` → `{ level, skills: [] }`.

Además, el requisito de paginación pasa a describir `cursor` como la `position` del último ítem devuelto, con página siguiente en `position` mayor (keyset, no offset). Antes decía "offset por `position`". La implementación (`position > $1::bigint`) y los tests coinciden con keyset.

**Detalle de `api-recruiter-endpoints`.**
- El requisito `Endpoints de contenido fuera de alcance` pasa a llamarse `Endpoints de contenido con sesión`. Su escenario de 404 con sesión (1 escenario) se reemplaza por tres: con sesión → 200, sin sesión → 401, ruta inexistente → 404. Se eliminan las líneas `(Previously: ...)` del delta.
- El párrafo `## Purpose` deja de describir el 404 de contenido y apunta a `api-content-endpoints`.
- En `Errores JSON consistentes` se añade una frase: las rutas de contenido siguen la misma regla con sus propios códigos (`400`, `401`, `503`). Es una aclaración de alcance, no un cambio de comportamiento; no altera el texto de los `401/403/404` existentes.
- `Swagger sin rutas de administración` no se modifica.

**Merge destructivo (`rules.archive`).** La operación no es destructiva: no se elimina ningún requisito y solo se reemplaza el que el delta modifica. No hizo falta pedir confirmación.

**Deltas de historial.** Los archivos `openspec/changes/archive/2026-10-28-content-endpoints/specs/*` no se modifican: son el registro de auditoría.

## 4. Verificación

Fuente: `verify-report.md` (en esta carpeta). Veredicto: **PASS WITH WARNINGS**, 0 CRITICAL. Modo Strict TDD. Base verificada: `main` @ `9046795` (PR #41, #42 y #43 mergeados). El verify se ejecutó antes de PR #44.

**Gates ejecutados (verify):**
- `npm run test:cov -w apps/api`: 57 suites, 583/583. `content/domain` y `content/application` al 100 %.
- `npm run test:e2e -w apps/api`: 11 suites, 164/164 (`content.e2e-spec.ts`: 37/37).
- `DATABASE_URL=… REDIS_URL=… npm run test:int -w apps/api`: 9 suites, 104/104, contra Postgres y Redis reales.
- `npm test -w apps/web`: 87 suites, 1196/1196.
- eslint (`apps/api apps/web`, `--max-warnings 0`), `lint:boundaries`, typecheck de API y web, build de API, prettier y `gitleaks detect` sobre los commits del cambio: en verde o sin hallazgos.

**Matriz de cumplimiento:** 22/22 escenarios COMPLIANT (19 de `api-content-endpoints` y 3 del delta de `api-recruiter-endpoints`).

### Hallazgos y resolución

| Hallazgo | Descripción | Resolución |
|----------|-------------|------------|
| W1 | Strict TDD parcial en PR1: el repositorio en memoria, la ruta `experience` y los decoradores Swagger se escribieron antes que sus tests. | Aceptado como histórico. Mitigado con mutaciones en runtime (quitar `limit` de `next`, exponer `position`, quitar `@ApiCookieAuth`, alterar mensajes). Los tests actuales son sólidos. |
| W2 | PR3, fix B: `content-contract.int-spec.ts` (conteos no vacíos) pasó en el primer intento, sin RED en runtime. | Aceptado. Su protección es frente a un seed vacío, verificada con `experience.items.length > 0` y conteos por columna. |
| W3 | Cambio cross-app: PR3 endureció las reglas de `apps/web/src/test/contentRules.ts` y `content-guard.test.ts`, y ninguna spec lista esas reglas. | Registrado en la sección 5 de este informe. Sin delta de spec: es infraestructura de test. |
| W4 | `openspec/specs/api-recruiter-endpoints/spec.md` tenía el 404 de contenido en Purpose, en el requisito y en su escenario. | **Cerrado en esta fase** (sección 3). |
| W5 | Checklist CIERRE de `tasks.md` (C1–C3) sin marcar. | **Cerrado en PR #44**. |
| S1 | `ListSkills` devolvía `{ levels: [] }` si el puerto daba `[]` para un nivel válido. | **Cerrado en PR #44**: `groups[0] ?? { level, skills: [] }`. Caso unit con puerto que devuelve `[]`. |
| S2 | La spec no recogía la cota de `cursor`, el final de paginación ni el nivel sin filas. Además decía "offset". | **Cerrado en esta fase**: 4 escenarios añadidos y redacción keyset. |
| S3 | Negativos de `content-rules.spec.ts` con `.not.toEqual([])`. | **Cerrado en PR #44**: se comparan mensaje exacto y regla esperada. |
| S4 | `PageLimit` y `ExperienceCursor` aceptan ceros a la izquierda (`^\d+$`). | **Documentado** en la spec. Sin test e2e: el comportamiento se confirma en código (`page-limit.ts`, `experience-cursor.ts`). |
| S5 | Q-B: TypeORM/`pg` con el pooler de Neon en modo transacción (ADR-004), no verificado. | **Abierto**. Pasa a la lista de seguimiento (sección 9). |

## 5. Cambio cross-app (W3): reglas del content-guard de la web

PR #43 endureció `apps/web/src/test/contentRules.ts` (+7 líneas) y `apps/web/src/content/content-guard.test.ts` (+26 líneas). Dos reglas nuevas:
- **Teléfono móvil chileno suelto** (escrito sin separadores, con o sin `+56`). La regla usa lookarounds para excluir ids largos, timestamps y versiones.
- **Dinero con palabra clave de sueldo**: `sueldo`, `salario`, `renta`, `pretensi*` o `remuneraci*` seguida, a no más de tres palabras, de una cifra de 4 o más dígitos.

Ninguna spec de `openspec/specs/` lista esas reglas (búsqueda sin resultados), por lo que no se creó delta. Es infraestructura de test: los 1196 tests web pasan y el escaneo no produce falsos positivos en el repositorio.

**Riesgo conocido.** Por diseño de la regla, un año que siga a la palabra clave también coincide (`renta 2026` se marca). Hoy no hay ningún caso real, pero un texto futuro con un año junto a "renta" fallará el content-guard. Ver sección 9.

## 6. Lecciones aprendidas

### Tamaño de los PRs: pronóstico frente a medición

El pronóstico de `tasks.md` ya incluía el factor de inflación de Strict TDD observado en `auth-backend` (2–6x sobre la estimación inicial). Las cifras medidas quedan dentro de ±10 % del pronóstico.

| PR | Pronóstico (`tasks.md`) | Medido | Nota |
|----|------------------------:|-------:|------|
| #41 (PR1) | ~1.380 | ~1.250 | `tasks.md` C1 registró ~1.100 en la medición del lote, antes de los fixes de revisión. Se usa la cifra del brief. |
| #42 (PR2) | ~810 | ~830 | `apply-progress.md` registró 769 inserciones y 5 borrados en su medición del lote. |
| #43 (PR3) | ~500 | ~520 | Medición del brief. |

Los tres PRs superaron las 400 líneas y se mergearon con `size:exception`. La decisión de la usuaria fue la opción (a), 3 PRs, frente a la opción (b), 8 PRs, que era la recomendada.

### Tests débiles que encontró la revisión

- **PR1**: el orden test-primero no se respetó en el repositorio en memoria, en la ruta `experience` y en Swagger. Los tests se validaron después con mutaciones en runtime. Lección: escribir el RED de la ruta antes del controlador, aunque el código ya exista en la rama.
- **PR2**: `typeorm-availability.int-spec.ts` dependía del número fijo de migraciones revertidas. Se reescribió para revertir mientras la migración figure en la tabla `migrations`. Los tests de `typeorm-content.int-spec.ts` que tocaban la semilla de `learning` se volvieron independientes de las migraciones. `postgres-down.e2e-spec.ts` pasó a `describe.each` con marcadores por ruta, porque una aserción común no detectaba una ruta mal cableada.
- **PR3**: la regla de dinero de la web (`/\$\s?\d/`) marcaba los placeholders `$1`, `$2` de la migración como falsos positivos. Se añadió `stripSqlPlaceholders`. Los negativos del comparador usaban `.not.toEqual([])`; ahora comparan el mensaje o la regla.

### Otras lecciones

- Las mutaciones manuales (`Amecs` → `Amecz`, teléfono en el seed, email en el seed, `cv.pdf` en el fixture) demostraron que el contrato y el escaneo sí fallan cuando deben. Es la forma más barata de comprobar que un test de contrato no pasa en vacío.
- Una migración con `INSERT` multifila parametrizado evita escapar tildes y comillas a mano. Con esta forma, el escaneo de la fuente de la migración necesita sustituir `$n` por `?` antes de aplicar las reglas.

## 7. Trazabilidad (Engram, proyecto `mariajosetolmo.cl`)

| Artefacto | Topic key | Observación |
|-----------|-----------|-------------|
| Exploration | `sdd/content-endpoints/explore` | #717 (según la cabecera de `exploration.md`; no consultada en esta fase) |
| Proposal | `sdd/content-endpoints/proposal` | No encontrado en Engram en esta fase. Fuente: `openspec/changes/archive/2026-10-28-content-endpoints/proposal.md` |
| Spec (delta) | `sdd/content-endpoints/spec` | #747 |
| Design | `sdd/content-endpoints/design` | #748 |
| Tasks | `sdd/content-endpoints/tasks` | #749 |
| Apply progress | `sdd/content-endpoints/apply-progress` | #750 |
| Verify report | `sdd/content-endpoints/verify-report` | #751 |
| Archive report | `sdd/content-endpoints/archive-report` | Esta observación (espejo de este informe) |

Los archivos de `openspec/` son la fuente completa. Las observaciones de Engram son espejos.

## 8. Archivos tocados en esta fase

- Creado: `openspec/specs/api-content-endpoints/spec.md` (9 requisitos, 23 escenarios).
- Modificado: `openspec/specs/api-recruiter-endpoints/spec.md` (requisito renombrado y reemplazado, Purpose, aclaración de errores).
- Modificado: `openspec/changes/content-endpoints/proposal.md` (criterios de éxito marcados con evidencia del verify; uno queda pendiente).
- Creado: `openspec/changes/archive/2026-10-28-content-endpoints/archive-report.md` (este informe, escrito en `openspec/changes/content-endpoints/` y movido por el orquestador).
- Sin cambios: los deltas de `openspec/changes/archive/2026-10-28-content-endpoints/specs/`, `tasks.md`, `design.md`, `apply-progress.md` y `verify-report.md`.

## 9. Pendientes y seguimiento

**Del cambio (fuera de alcance, tal como indica la propuesta):**
- **S5 / Q-B (infra).** Verificar TypeORM y `pg` con el pooler de Neon en modo transacción (ADR-004). Mitigación actual: SQL plano, una sentencia por `query()`, solo `SELECT`. Se verifica en el cambio de infraestructura, con las rutas ya desplegables.
- **CI (criterio de la propuesta).** Confirmado: el job `integration` pasó en verde en los PR #43 y #44.
- **Frontend: mostrar el error de la API.** Petición de la usuaria: que el playground y la zona reclutador muestren al usuario el código y el motivo del error de la API (400, 401, 403, 503). Cambio de frontend propio.
- **Regla de sueldo y años.** Afinar la regla de dinero de la web para no marcar un año que siga a "renta" (`renta 2026`). Solo si aparece en contenido real.
- **Real data en `/api/v1/admin/visits`.** Requiere modelo de visitas, decisión de privacidad y política de retención. Cambio propio.
- **Ejemplo de la home.** `apps/web/src/content/home.ts` sigue rotulado como ejemplo. Alinearlo con la forma real es opcional, en un cambio posterior.
- **Test e2e de ceros a la izquierda (S4).** El comportamiento está documentado y confirmado en código, pero no tiene test e2e.

**Heredados de `auth-backend` (sin cambios en esta fase):** F1 (limpieza de `refresh_tokens`), F2 (`refresh_families`), F3 (chequeo de `availability` con valores de ejemplo), S3 (`integration` como check requerido en `protect-main`, decisión de la usuaria), SES fuera de sandbox y ADR-012 en estado "Propuesta". El informe de `auth-backend` (sección 8) indica que `/profile`, `/experience` y `/skills` siguen en 404. Ese texto es histórico y no se modifica: el estado vigente está en las specs principales.

## 10. Riesgos del archivo

- Ningún artefacto se perdió ni se sobrescribió. La spec nueva es el delta más los escenarios de la sección 3.
- La carpeta del cambio se mueve con `git mv` desde `openspec/changes/content-endpoints/` a `openspec/changes/archive/2026-10-28-content-endpoints/`. Las rutas de este informe ya apuntan a la ubicación final.
- El criterio "pasan en CI" de la propuesta quedó marcado tras confirmar el job `integration` en los PR #43 y #44.

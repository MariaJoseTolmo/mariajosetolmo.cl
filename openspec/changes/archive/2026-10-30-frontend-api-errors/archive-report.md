# Informe de archivo: frontend-api-errors

**Proyecto**: web_cv · **Cambio**: `frontend-api-errors` · **Fecha de archivo**: 2026-10-30
**Modo de persistencia**: openspec (con traza en Engram, proyecto `mariajosetolmo.cl`)
**Ubicación tras el archivo**: `openspec/changes/archive/2026-10-30-frontend-api-errors/`
**Veredicto de verify**: PASS WITH WARNINGS · 0 CRITICAL · 68/68 escenarios COMPLIANT
**Estado**: specs principales actualizadas (dos creadas, dos modificadas). Este informe se escribió en `openspec/changes/frontend-api-errors/` y debe moverse con la carpeta del cambio (ver sección 7).

## 1. Resumen

El cambio `frontend-api-errors` sustituye los mensajes genéricos de error por errores accionables. La API emite un `code` estable del catálogo de 10 códigos en todo cuerpo de error (`api-error-contract`). La web traduce ese `code` (con el status como respaldo) a un `ApiFailure` y muestra copy distinto por causa en login, verify, zona reclutador, CV, logout y playground (`web-api-errors`). Las specs de `web-recruiter-access` y `api-content-endpoints` se actualizan para reflejar el nuevo comportamiento.

Se implementó en cuatro PRs con `size:exception` (decisión c, `stacked-to-main`): #48 (A, API), #49 (B, base web), #50 (C, login) y #51 (D, zona reclutador), todos mergeados sobre `main` @ `582d418`. Se verificó con Strict TDD. El verify dio PASS WITH WARNINGS: 0 CRITICAL, 5 WARNING (W1 y W2 aceptados por la usuaria), 4 SUGGESTION, y 68/68 escenarios cubiertos por tests que pasan en ejecución.

## 2. Implementación (PRs)

| PR | Unidades | Contenido | Líneas (`additions + deletions`) |
|----|----------|-----------|----------------------------------|
| #48 | A = U0a + U0b | API: errores de dominio, catálogo `API_ERROR_CODES`, `ApiExceptionFilter` (`@Catch()`), guards y resolvedor sin `HttpException`, `error-contract.e2e-spec.ts`, anti-enumeración, ajustes de e2e. `size:exception`. | ~1.320 |
| #49 | B = U1a + U1b | Web: `error-codes`, `ApiFailure`, `toApiFailure`, adaptador `http` (refresh, `Retry-After`), `apiErrorMessage`, diccionario `apiErrors.ts`, mock one-shot. | Documentado como cubierto en el verify |
| #50 | C = U2 | Web: login completo (estado de error, un solo botón "Reintentar", sin reintento automático, anti-enumeración web). | ~373 |
| #51 | D = U3a + U3b | Web: verify (`blocked`, `invalid`, `unavailable`), zona reclutador (`getMe`), CV, logout y línea del playground. | ~920 |

Total bajo `apps/`: 77 archivos, +3.472 / -458. La decisión de la usuaria fue la opción (c), 4 PRs con `size:exception`. La opción (a), 7 PRs, era la recomendada por revisión, y la usuaria no la eligió.

## 3. Specs promovidas a `openspec/specs/`

| Capacidad | Acción | Requisitos | Escenarios | Destino |
|-----------|--------|-----------:|-----------:|---------|
| `api-error-contract` | Creada (capacidad nueva) | 3 | 15 | `openspec/specs/api-error-contract/spec.md` |
| `web-api-errors` | Creada (capacidad nueva) | 9 | 32 | `openspec/specs/web-api-errors/spec.md` |
| `web-recruiter-access` | Modificada (3 requisitos MODIFIED) | 10 (sin cambio) | 31 → 39 | `openspec/specs/web-recruiter-access/spec.md` |
| `api-content-endpoints` | Modificada (1 requisito MODIFIED) | 9 (sin cambio) | 23 (sin cambio) | `openspec/specs/api-content-endpoints/spec.md` |

**Detalle de `api-error-contract` y `web-api-errors`.** Son specs completas, sin marcadores ADDED ni MODIFIED. Se copian desde el delta y se añade la línea `Origen:` en Purpose, igual que en las demás specs. No hay `(Previously: ...)` en estos deltas.

**Detalle de `web-recruiter-access`.** Se reemplazan tres requisitos por nombre. El nombre del tercero en la spec principal es "Guard de sesión en la zona reclutador" (la petición mencionaba "Guard de sesión"; el nombre exacto es el del delta y el de la principal).
- `Estado "enviado" idéntico`: 2 → 6 escenarios. Se añaden "Errores no 2xx no muestran 'enviado'", "Reintentar en 503 y red", "Ningún error depende del correo" y "429 con tiempo". Solo se "enviado" con 2xx.
- `Guard de sesión en la zona reclutador`: 5 → 7 escenarios. Se añaden "Refresh bloqueado no redirige" y "Errores 403, 429 y 5xx con copy propio". Solo `unauthorized` redirige. Un refresh 403, 429, 5xx o de red no redirige.
- `API Playground`: 3 → 5 escenarios. Se añaden "Línea explicativa en 4xx y 5xx" y "Sin línea en 2xx". Describe la línea de copy bajo el bloque de código, sin ocultar status ni cuerpo.
- Se añade la línea de trazabilidad en Purpose.

**Detalle de `api-content-endpoints`.** El requisito "Validación de limit y cursor" pasa a exigir `code` `INVALID_INPUT` en el cuerpo `{statusCode, error, message, code}`, con referencia a `api-error-contract`. Los tres escenarios se mantienen y ganan la aserción de `code`. El conteo de escenarios no cambia. Se añade la línea de trazabilidad en Purpose.

**Merge destructivo (`rules.archive`).** La operación no es destructiva. No se elimina ningún requisito: solo se reemplazan los que el delta modifica. Ningún requisito de `web-recruiter-access` ni de `api-content-endpoints` fuera de los listados quedó alterado. No hizo falta pedir confirmación.

**Deltas de historial.** Los deltas en `openspec/changes/frontend-api-errors/specs/` se mantienen como registro de auditoría dentro de la carpeta archivada.

## 4. Verificación

Fuente: `verify-report.md` (en esta carpeta). Base verificada: `main` @ `582d418` (PRs #48, #49, #50 y #51 mergeados).

**Gates ejecutados (verify):**
- `npm run test:cov -w apps/api`: 59 suites, 623 tests, exit 0. Cobertura 100 % líneas, 95,41 % ramas, 100 % funciones.
- `npm run test:e2e -w apps/api`: 12 suites, 188 tests, exit 0.
- `npm run test:int -w apps/api` con Postgres y Redis de compose: 9 suites, 104 tests, exit 0 (ver S2).
- `npm run lint:boundaries`: exit 0.
- `npm run test:cov -w apps/web`: 90 suites, 1395 tests, exit 0.
- `npm run typecheck`, `npx eslint . --max-warnings 0`, `npx prettier --check .`, `npm run build -w apps/web`: exit 0.
- `gitleaks detect` (HEAD~10..HEAD, los 4 PRs) y `rg` de ARNs, IDs de cuenta y emails reales: sin hallazgos.

**Matriz de cumplimiento:** 68/68 COMPLIANT.

| Spec | Escenarios |
|------|-----------:|
| `api-error-contract` | 15/15 |
| `api-content-endpoints` | 3/3 (los escenarios del delta) |
| `web-api-errors` | 32/32 |
| `web-recruiter-access` | 18/18 (los escenarios de los requisitos modificados) |

## 5. Warnings y suggestions

**Aceptados por la usuaria (PR A):**
- **W1**: `httpStatusOf` usa duck typing sobre `statusCode`. Un error de terceros con `statusCode` 4xx se clasificaría como 4xx y no como 500. Queda clasificado; no se reabre.
- **W2**: los 4xx de dominio exponen `error.message`. Esos textos son propios y no repiten la entrada. Queda clasificado; no se reabre.

**Warnings de proceso TDD (no bloquean el archivo):**
- **W3**: varias tareas no tuvieron RED de aserción en ejecución. Hubo RED de compilación en 1.2, 1.3, 1.5 y 1.7. Sin RED de producto, porque el contrato ya se cumplía, en 1.8, 2.1, 2.3, 2.4, 2.5, 2.6, 3.5, 4.2, 5.5, 6.3 y 7.4. Se compensó con mutaciones manuales (`apply-progress.md`).
- **W4**: las tablas de evidencia TDD de `apply-progress.md` no tienen columnas TRIANGULATE ni SAFETY NET, así que el safety net no se puede auditar con el protocolo.

**Suggestions:**
- **S1**: el test de contrato quedó en `apps/web/src/lib/api/error-codes.test.ts` (importa la API por ruta relativa) en lugar de `apps/api/test`. Lo permite la tarea 3.1. Queda documentado aquí; el design no se modifica.
- **S2**: `npm run test:int -w apps/api` con valores por defecto (`127.0.0.1:5432`) apunta a otro Postgres local y fallan 87 tests (`role "webcv" does not exist`). Con `DATABASE_URL` y `REDIS_URL` hacia 55432 y 56379 pasan los 104. **Seguimiento**: documentar las variables o derivarlas de `POSTGRES_HOST_PORT`.
- **S3**: `RecruiterZone.tsx` tiene 91,66 % de funciones. Las líneas están al 100 %. Informativo.
- **S4**: el test de 400 de anti-enumeración compara dos direcciones mal formadas. Es correcto. No requiere acción.

**Cerrado en el archivo:** W5 (casillas de `tasks.md` sin marcar). Se marcan D-B, C1–C3 y F1–F3 con su evidencia.

## 6. Trazabilidad (Engram, proyecto `mariajosetolmo.cl`)

| Artefacto | Topic key | Observación |
|-----------|-----------|-------------|
| Proposal | `sdd/frontend-api-errors/proposal` | #755 |
| Spec (deltas) | `sdd/frontend-api-errors/spec` | #756 |
| Design | `sdd/frontend-api-errors/design` | #757 |
| Tasks | `sdd/frontend-api-errors/tasks` | #758 (los checks de este archivo son posteriores a esa observación) |
| Apply progress | `sdd/frontend-api-errors/apply-progress` | #759 |
| Verify report | `sdd/frontend-api-errors/verify-report` | #762 |
| Archive report | `sdd/frontend-api-errors/archive-report` | Esta observación (espejo de este informe) |

Los archivos de `openspec/` son la fuente completa. Las observaciones de Engram son espejos. La exploración (`exploration.md`) no se consultó en esta fase.

## 7. Archivos tocados en esta fase

- **Creado**: `openspec/specs/api-error-contract/spec.md` (3 requisitos, 15 escenarios).
- **Creado**: `openspec/specs/web-api-errors/spec.md` (9 requisitos, 32 escenarios).
- **Modificado**: `openspec/specs/web-recruiter-access/spec.md` (3 requisitos reemplazados por nombre, Purpose con trazabilidad; 31 → 39 escenarios).
- **Modificado**: `openspec/specs/api-content-endpoints/spec.md` (1 requisito reemplazado, Purpose con trazabilidad; 23 escenarios).
- **Modificado**: `openspec/changes/frontend-api-errors/tasks.md` (casillas D-B, C1–C3 y F1–F3 marcadas con evidencia).
- **Creado**: `openspec/changes/frontend-api-errors/archive-report.md` (este informe).
- **Pendiente (mover)**: `openspec/changes/frontend-api-errors/` → `openspec/changes/archive/2026-10-30-frontend-api-errors/`. Ver sección 8.
- **Sin cambios**: los deltas de `specs/`, `proposal.md`, `design.md`, `exploration.md`, `apply-progress.md` y `verify-report.md`.

## 8. Pendientes y riesgos del archivo

**Movimiento de la carpeta (pendiente).** El agente de archivo no dispone de shell en esta sesión, así que no puede ejecutar `git mv`. El comando para cerrar el archivo es:

```
git mv openspec/changes/frontend-api-errors openspec/changes/archive/2026-10-30-frontend-api-errors
```

Hasta que se ejecute, el cambio sigue en `openspec/changes/` activo, y la comprobación "el directorio de cambios activos ya no contiene este cambio" no se cumple. Las rutas de este informe ya apuntan a la ubicación final, como en `content-endpoints`.

**Otros riesgos:**
- Ningún artefacto se perdió ni se sobrescribió. La spec nueva es el delta más los escenarios de la sección 3.
- Los checks de `tasks.md` reflejan la evidencia de `verify-report.md`. C2 no declara CI verde: la evidencia es la ejecución local de la tabla "Ejecución".
- F1 se cumplió por PR, no con una única revisión del diff completo. Es una decisión de la usuaria, documentada en `tasks.md`.
- Los textos de copy de `apiErrors.ts` están en español neutro. El `message` de la API es técnico y nunca llega al DOM.

**Seguimiento:**
- **S2** (ver sección 5): documentar las variables de entorno de `test:int`.
- **W3 y W4** (ver sección 5): notas de proceso TDD para la retrospectiva. No requieren cambio de código.

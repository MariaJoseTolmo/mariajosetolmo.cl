# Informe de archivo: frontend-site

**Proyecto**: web_cv · **Cambio**: `frontend-site` · **Fecha de archivo**: 2026-10-21
**Modo de persistencia**: openspec (con traza en Engram)
**Estado**: archivado. Specs principales creadas. Movimiento de carpeta pendiente de ejecución (ver sección 5).

## 1. Resumen

El cambio `frontend-site` crea `apps/web`: sitio público estático (Inicio, Experiencia, 404), acceso de reclutadores (login con magic link, verificación, zona reclutador, puerto `ApiGateway` con adaptadores `http` y `mock`) y el contrato de entrega para infra (S3 + CloudFront). Se implementó en los PRs #10 a #16, todos mergeados. Se verificó con Strict TDD y el veredicto final es **PASS WITH WARNINGS** (0 CRITICAL).

No hubo requisitos MODIFIED ni REMOVED: las tres capacidades son nuevas y `openspec/specs/` estaba vacío, así que no hubo merges destructivos.

## 2. Implementación (PRs)

| PR | Contenido |
|----|------|
| #10 (PR A) | Fundaciones: smoke test, `apps/web`, tokens, layout, atoms, header, footer |
| #11 (PR B) | Inicio |
| #12 (PR C) | Experiencia |
| #13 (PR D) | `ApiGateway` + mock, `/acceso/`, `/acceso/verificar/` |
| #14 (PR E) | Zona reclutador: guard, cliente `http` con refresh, tarjetas, playground |
| #15 (PR F) | Metadata, sitemap, robots, 404, guardas de contenido, contrato de entrega, README |
| #16 | Cierre del escenario parcial pendiente (según la usuaria) |

Notas: la verificación confirma que PRs A–F corresponden a #10–#15 (`verify-report.md`, sección de evidencia TDD). El contenido por PR sigue el plan de PRs del proposal, con los ajustes de re-slicing de tasks (12 unidades). El PR #16 lo reporta la usuaria; no se revisó en GitHub desde esta sesión. Antes de citar el reparto exacto de PR a unidad, comprobarlo en `apply-progress.md`.

## 3. Specs promovidas a `openspec/specs/`

| Capacidad | Requisitos | Escenarios | Acción | Destino |
|-----------|-----------:|-----------:|--------|---------|
| `web-public-pages` | 12 | 26 | Creada (capacidad nueva) | `openspec/specs/web-public-pages/spec.md` |
| `web-recruiter-access` | 10 | 31 | Creada (capacidad nueva) | `openspec/specs/web-recruiter-access/spec.md` |
| `web-delivery-contract` | 5 | 14 | Creada (capacidad nueva) | `openspec/specs/web-delivery-contract/spec.md` |

Total: 27 requisitos y 71 escenarios.

Normalización aplicada (solo encabezados, sin cambiar texto de requisitos ni escenarios):
- El encabezado `# Especificación delta: <capacidad>` pasó a `# <capacidad>`.
- Se agregó la sección `## Purpose` con el párrafo "Capacidad nueva…" original y una línea de origen que enlaza este informe.
- `## ADDED Requirements` pasó a `## Requirements`.
- Todos los `### Requirement:` y `#### Scenario:` se conservan literalmente, en español y con las palabras clave RFC 2119.

## 4. Verificación

Fuente: `openspec/changes/frontend-site/verify-report.md`, sección "Re-verificación (2026-10-21)", rev 2 en Engram.

- Veredicto: **PASS WITH WARNINGS**. 0 CRITICAL, 3 WARNING, 5 SUGGESTION.
- Gates: lint, boundaries, format, typecheck, test (web 87 suites / 1175 tests), test:cov (Branch 99.18), test:e2e, build con `check-out` OK, secretos limpios (scan-secrets y gitleaks).
- Escenarios en la re-verificación: 70/71 PASS, 1 PARTIAL, 0 FAIL. Por requisito: 25 PASS, 2 PARTIAL.
- El CRITICAL de la verificación original (evidencia TDD) quedó resuelto con `apply-progress.md`.

## 5. Movimiento de la carpeta (pendiente, no ejecutado por este agente)

Este agente no dispone de comando de movimiento ni de borrado. Solo puede crear archivos. No se copió contenido para no duplicar artefactos. El orquestador debe ejecutar:

```
mv openspec/changes/frontend-site/proposal.md openspec/changes/frontend-site/exploration.md openspec/changes/frontend-site/design.md openspec/changes/frontend-site/tasks.md openspec/changes/frontend-site/apply-progress.md openspec/changes/frontend-site/verify-report.md openspec/changes/frontend-site/specs openspec/changes/archive/2026-10-21-frontend-site/
rmdir openspec/changes/frontend-site
```

Después de eso, verificar que `openspec/changes/frontend-site/` ya no existe y que el destino contiene: `proposal.md`, `exploration.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `specs/` (3 deltas) y este `archive-report.md`.

Las specs de `openspec/specs/` ya son la fuente de verdad. Las copias delta que quedan en `specs/` hasta el movimiento son redundantes y no se deben editar.

## 6. Trazabilidad (Engram, proyecto web_cv)

| Artefacto | Topic key | Observación |
|-----------|-----------|-------------|
| Proposal | `sdd/frontend-site/proposal` | #677 |
| Spec (delta) | `sdd/frontend-site/spec` | #679 (rev 3) |
| Design | `sdd/frontend-site/design` | #682 (rev 3) |
| Tasks | `sdd/frontend-site/tasks` | #683 (rev 2) |
| Apply progress | `sdd/frontend-site/apply-progress` | #687 (rev 14, apunta a `apply-progress.md`) |
| Verify report | `sdd/frontend-site/verify-report` | #691 (rev 2, re-verificación) |

Los archivos en openspec son la fuente completa. Las observaciones de Engram son resúmenes espejo.

## 7. Advertencias abiertas (heredadas de la re-verificación)

**WARNING**
- ~~**N1**~~ (cerrado en PR #16): `SentView.test.tsx` afirma que "Reiniciar demo" no aparece en `sent` y `VerifyView.test.tsx` que "Simular: abrir el enlace" no aparece en `done`.
- **N2**: la evidencia TDD se reconstruyó por PR y no por tarea. No tiene columnas TRIANGULATE / SAFETY NET / REFACTOR, y RED no se puede contrastar con el historial (los commits juntan test y código). Para próximos cambios, guardar la tabla en cada lote de apply.
- **W9** (mitigado): `toHaveClass` en `Button.test.tsx` y `LinkButton.test.tsx`, con comentario que lo justifica.

**SUGGESTION**
- **S2**: fijar con un test el alto táctil de 44 px del botón y los enlaces del menú móvil. Sigue sin test.
- **S8**: considerar `app/**` en `collectCoverageFrom`. `app/**` y `src/content/**` quedan fuera por diseño.
- **S-N3** (Hero test cast): `Hero.test.tsx` reasigna `home.hero.ctas` con `as unknown as`. Conviene tipar `ctas` como tupla o pasar los CTA por props.
- **S-N4** (availability patterns overlap): los patrones de `availabilityMatches` se solapan. Quitar `disponib…` solo rompe 1 test. Cada patrón necesita su propio positivo exclusivo.
- **size:exception**: la etiqueta no existe en el repo. Solo figura en los cuerpos de los PRs. Crearla antes de futuros PRs grandes.

Escenarios PARTIAL citados en la re-verificación: "Menú móvil (cláusula 44 px)" y "Controles del mock (Visibles en mock)". El PR #16 cerró el escenario parcial restante según la usuaria. No se ha reverificado el archivo de verificación original, y no se modificó `verify-report.md`.

## 8. Dependencias para los próximos cambios

**Cambio de auth backend** (los endpoints reales que hoy el cliente mockea):
- `magic-link` debe aceptar `email` obligatorio y `company?` y `name?` opcionales. El cliente omite los opcionales vacíos.
- El enlace del correo debe ser `https://mariajosetolmo.cl/acceso/verificar/#token=<token>`. El token va en el fragmento, no en la query string. La página ignora `?token=`.
- Formato del token: base64url, según indicó la usuaria. Este dato no aparece en los artefactos leídos (proposal, spec, design, tasks), así que confirmarlo en el cambio de auth.
- Verificación del token: el cliente llama a `verifyToken(token)` solo tras confirmación explícita.
- `GET /api/v1/me` debe devolver `email`, `role`, `company` (o null), `name` (o null) y `availability` (con `modality`, `start` y `salary` según el tipo `Me` de design). La tarjeta "Disponibilidad" lo muestra sin petición extra.
- `POST /api/auth/refresh`: el adaptador `http` lo llama una sola vez tras un 401 y reintenta `GET /api/v1/me`. Si vuelve a fallar, el resultado es `unauthorized`.
- Contratos de `logout` (el cliente navega a `/`) y de URL firmada del CV (`getCvLink`, llamado al pulsar "Descargar PDF"). Su forma exacta sigue pendiente.
- Errores que el cliente distingue: `unauthorized`, `forbidden`, `invalid-token`, `rate-limited`, `network`, `server`, `unexpected`.

**Cambio de infra** (S3 + CloudFront, según el contrato de `web-delivery-contract` y `apps/web/docs/delivery-contract.md`):
- CloudFront Function de reescritura en viewer-request, solo en el behavior por defecto. Nunca en `/api/*`.
- OAC con `s3:ListBucket` para que S3 responda 404 y no 403.
- Custom error response: solo 404 mapea a `/404.html` con código 404. El 403 nunca se mapea, para que el 403 real de `/api/v1/admin/visits` llegue al playground. Los 404 de `/api/*` también se reemplazarían por HTML: infra decide entre aceptarlo o usar Lambda@Edge origin-response solo en el behavior por defecto.
- Caché: `_next/static/*` inmutable; HTML con TTL corto o revalidación.
- Cabeceras: Response headers policy con `Content-Security-Policy` y `Referrer-Policy: no-referrer`. El `Referrer-Policy` queda como defensa en profundidad.
- Origen: bucket S3 privado con OAC y `/api/*` hacia otro origen. Si se usa el Plan B de S3, la cabecera `x-amz-content-sha256` debe quedar aislada en `src/lib/api/http`.

**Decisiones ya tomadas** (no reabrir sin motivo):
- Token en fragmento `#token=` (decisión de la usuaria, 2026-10-21).
- Next.js con export estático: ADR-001 en `openspec/changes/stack-adrs/adrs/ADR-001-nextjs-static-export.md`. No se modificó.

## 9. Riesgos del archivo

- Ningún artefacto se perdió ni se sobrescribió con contenido distinto. Las specs nuevas son copias de los deltas con encabezados normalizados.
- Riesgo operativo: hasta que el orquestador ejecute el movimiento de la sección 5, `openspec/changes/frontend-site/` y `openspec/changes/archive/2026-10-21-frontend-site/` coexisten con el archivo de informe.
- No se tocaron otros cambios (`infra-spike`, `project-scaffold`, `stack-adrs`, `stack-decisions`).
- No se ejecutó ningún comando de git.

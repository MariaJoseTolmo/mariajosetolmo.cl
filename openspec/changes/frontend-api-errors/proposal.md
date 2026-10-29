# Propuesta: Frontend API Errors — errores accionables con `code` estable

## Intención

Hoy el login muestra "enviado" ante 400/403/429/503 aunque el correo no salió, verify muestra un 403 como "enlace no válido" y la zona reclutador reduce todo a "Revisa tu conexión". La usuaria no sabe qué falló ni qué hacer. La API no expone una causa estable: los tres 403 solo se distinguen por un `message` técnico en inglés (ver `exploration.md` §1).

## Alcance

### Decisiones (vinculantes, 2026-10-29)

| # | Decisión |
|---|----------|
| D1 | Todo cuerpo de error de la API incluye un `code` estable (`CDN_REQUIRED`, `ORIGIN_NOT_ALLOWED`, `ROLE_NOT_ALLOWED`, `UNAUTHENTICATED`, `INVALID_INPUT`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `NOT_FOUND`; la lista final la cierra el diseño). El `message` sigue siendo técnico y nunca se muestra. Se entrega en el PR 0. |
| D2 | El login muestra 400/403/429/503. El estado "enviado" aparece solo con 2xx. |
| D3 | El 403 por CDN u Origin da un motivo concreto sin topología: "La solicitud no llegó desde el sitio oficial. Abre mariajosetolmo.cl directamente e inténtalo de nuevo." Nunca menciona CloudFront ni cabeceras. El 403 por rol tiene su propio copy. |
| D4 | El playground mantiene status y cuerpo crudos, más una línea explicativa del mismo diccionario para 4xx/5xx. |

### Dentro del alcance
- API: `code` en `DomainExceptionFilter` y en los guards (JWT, Roles, Origin), `ClientIpResolver` y 404. Tests unitarios y e2e.
- Web: modelo `ApiError { kind, status, reason?, retryAfterSeconds? }`. `http.ts` lee `code` y `Retry-After`. Un cuerpo que no es JSON (HTML del CDN o del WAF) queda sin `reason`. El mock simula 403, 429 y 503.
- Diccionario central tipado de copy (`src/content/apiErrors.ts`, español neutro), sobrescribible por pantalla.
- 429: tiempo estimado tomado de `Retry-After`. Si falta o es inválido, el texto va sin tiempo y no hay cuenta atrás.
- 503: botón "Reintentar" manual. El POST de login nunca se reintenta solo.
- Login, verify, zona reclutador (`getMe`, CV, logout) y playground.
- Accesibilidad: `role="alert"` en errores de formulario y de acción, `role="status"` en errores de carga.

### Fuera del alcance
- Un id de petición visible, una cuenta atrás, i18n y telemetría en el cliente.

## Capacidades

### Capacidades nuevas
- `api-error-contract`: forma `{statusCode, error, message, code}`, catálogo de `code` y la regla de que `message` no es para la usuaria. Va como capacidad nueva porque es transversal: el filtro global y los guards cruzan todos los slices, y repartirla en cuatro specs duplicaría el contrato.
- `web-api-errors`: modelo `ApiError`, mapeo `code`/status → `reason`, `Retry-After`, el fallback cuando el cuerpo no es JSON, el diccionario de copy, los roles ARIA, la prohibición de mostrar `message` y la de reintentar el login en forma automática.

### Capacidades modificadas
- `web-recruiter-access`:
  - "Estado 'enviado' idéntico" pasa a mostrar "enviado" solo con 2xx. Se conserva la anti-enumeración porque ningún error posible depende de que el correo exista, y el límite por email sigue respondiendo 202 idéntico. Se exige un test que impida errores que dependan del email.
  - "Guard de sesión": los errores distintos de 401 llevan copy por situación y conservan "Reintentar".
  - "API Playground": se agrega la línea explicativa (D4).
- `api-content-endpoints`: "Validación de limit y cursor" fija hoy la forma exacta `{statusCode, error, message}`. Pasa a incluir `code: "INVALID_INPUT"`.

## Enfoque

Se sigue la recomendación de la exploración (§5) con D1–D4. `errorFromStatus` deja de ser el único punto de traducción: lo reemplaza un traductor puro que combina `code` y status, con `code` como prioridad y el status como respaldo. Ese status de respaldo permite convivir con una API previa al PR 0 y con el HTML del CDN. No entra tecnología nueva, así que no requiere ADR.

## Plan de PRs (stacked-to-main, strict TDD)

Las cifras ya incluyen los tests.

| PR | Contenido | Líneas |
|----|-----------|--------|
| 0 | API: `code` en el filtro y los guards. Specs `api-error-contract` y `api-content-endpoints`. | ~300–450 |
| 1 | Web: `ApiError`, `http.ts`, `Retry-After`, el fallback sin JSON, el mock y el diccionario | ~350–500 |
| 2 | Login, más el test de anti-enumeración y la spec MODIFIED | ~350–550 |
| 3 | Verify, zona reclutador, CV, logout y la línea del playground | ~450–700 |

Los PR 1, 2 y 3 pueden superar las 400 líneas. El PR 3 es candidato a partirse (3a verify y zona, 3b playground). La decisión se toma en `sdd-tasks`.

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `apps/api/src/**/domain-exception.filter.ts`, los guards y `ClientIpResolver` | Modificado |
| `apps/api/test/*.e2e-spec.ts` | Modificado |
| `apps/web/src/lib/api/` (`types.ts`, `errors.ts`, `http.ts`, `mock/*`) | Modificado |
| `apps/web/src/content/apiErrors.ts` | Nuevo |
| `apps/web/src/features/login/*`, `features/recruiter/*` y `content/{login,verify,recruiter}.ts` | Modificado |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Un error nuevo que dependa del email (enumeración) | Media | Test de que existir o no existir da la misma respuesta. El límite por email sigue en 202. |
| Un `code` de verify que distinga un token vencido de uno usado | Media | Un único `code` para todo token inválido |
| El `message` o la topología del CDN llegan a la UI | Media | Test de que el DOM no contiene `message` ni "CloudFront" |
| 403 del CDN o del WAF que no es JSON | Media | Fallback sin `reason` |
| Mock desalineado con la API | Media | El mock usa el mismo catálogo de `code` |
| `role="alert"` demasiado largo | Baja | Copy breve y `jest-axe` |

## Plan de reversión

`git revert` de cada merge en orden inverso (3 → 0). El web es compatible con una API sin `code` gracias al respaldo por status, así que revertir el PR 0 solo quita `reason`. No hay migraciones ni estado en AWS.

## Dependencias

- `content-endpoints` archivado (forma actual de los errores 400 y 503).

## Criterios de éxito

- [ ] `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde.
- [ ] e2e: cada error de la API trae un `code` del catálogo.
- [ ] El login muestra un copy distinto para 400/403/429/503 y "enviado" solo con 2xx. El test de anti-enumeración pasa.
- [ ] Un 403 en verify ya no se muestra como "enlace no válido". La zona distingue 403, 429 y 5xx de la falta de red.
- [ ] Ninguna pantalla muestra `message` ni "CloudFront". `jest-axe` reporta 0 violaciones.
- [ ] Cobertura ≥ 80 %.

# Exploración: frontend-api-errors

**Proyecto**: mariajosetolmo.cl · **Cambio**: `frontend-api-errors` · **Fecha**: 2026-10-28
**Espejo en Engram**: `sdd/frontend-api-errors/explore` (#754)

## 1. Estado actual

### API (`apps/api`)

**Cuerpo de error:**
- `DomainExceptionFilter` responde `{statusCode, error, message}`. Los guards de Nest (`UnauthorizedException`, `ForbiddenException`) devuelven la misma forma.
- No existe un campo `code` estable. El `DomainError.code` (`INVALID_INPUT`, `FORBIDDEN`, `RATE_LIMITED`, `INFRASTRUCTURE_UNAVAILABLE`, `UNAUTHENTICATED`) se usa solo para elegir el status y se descarta.
- El `error` es la frase HTTP ("Forbidden"), así que no sirve para distinguir causas.

**Mensajes (`message`):**
- Están en inglés y son técnicos, pero seguros: no filtran SQL ni rutas.
- Ejemplos: `Request did not come through the CDN`, `Origin not allowed`, `Forbidden resource`, `Authentication required`, `Too many requests`, `Service temporarily unavailable`, `limit must be an integer between 1 and 50`, `email is invalid`.
- No están pensados para mostrarse al usuario.

**Los tres 403 solo se distinguen por el `message`:**

| Causa | `message` | Ruta |
|---|---|---|
| Falta `CloudFront-Viewer-Address` en prod (`ClientIpResolver`) | `Request did not come through the CDN` | Rutas `/api/auth/*` con límite por IP |
| `OriginGuard` | `Origin not allowed` | Todo POST/PUT/PATCH/DELETE |
| `RolesGuard` | `Forbidden resource` (mensaje por defecto de Nest) | `/api/v1/admin/visits` con rol RECRUITER |

**Otros códigos:**
- **429** trae la cabecera `Retry-After` en segundos. Lo devuelven magic-link, verify y refresh por IP.
- **503** sale cuando Redis o Postgres fallan (`InfrastructureUnavailable`).
- **400** corresponde a `INVALID_INPUT` en email, `limit`, `cursor` y `level`. En verify, un token inválido o vencido también responde 400.

### Web (`apps/web`)

**Capa de errores:**
- `ApiErrorKind` puede ser `unauthorized`, `forbidden`, `invalid-token`, `rate-limited`, `network`, `server` o `unexpected`.
- `errorFromStatus` es el único punto de traducción y mira solo el status. En contexto `verify`, 400/401/410 se traducen a `invalid-token`.
- `ResponseLike` solo expone `status`, `ok`, `statusText` y `text()`, sin cabeceras, así que `Retry-After` no se lee.
- El cuerpo de error nunca se parsea, salvo en el playground.

**Qué hace hoy cada pantalla con el error:**

| Pantalla | Comportamiento ante errores |
|---|---|
| Login (`LoginContainer`) | Solo `network` se muestra. Cualquier otro fallo, incluidos 400, 403, 429 y 503, dispara `SUCCEEDED` y muestra "enviado", aunque el correo no salió. |
| Verify | Tiene copy para `invalid`, `rate-limited` y `unavailable`. Un 403 cae en `unexpected` y se muestra como "Este enlace no es válido", lo que engaña al usuario. |
| Zona reclutador (`getMe`) | Solo `unauthorized` redirige. Cualquier otro error, incluso 403, 429 o 5xx, muestra "Revisa tu conexión e inténtalo de nuevo". |
| CV / logout | Un único mensaje genérico. |
| Playground | Muestra status y cuerpo crudos. |

**Contenido, accesibilidad y tests:**
- El copy del sitio está en español neutro, en `src/content/*.ts`.
- Los errores usan `role="alert"` o `role="status"`.
- Se testea con Jest 30, Testing Library y `jest-axe`.
- `fetch-guard.test.ts` impide usar `fetch(` fuera de `src/lib/api/http`.

## 2. Hallazgo clave: anti-enumeración

**Qué exige hoy la spec:** el requisito "Estado 'enviado' idéntico" de `web-recruiter-access` obliga a mostrar siempre "enviado" salvo ante un error de red. El objetivo es no revelar si un correo existe.

**Ningún error posible depende del correo.** Los que puede devolver `POST /api/auth/magic-link` son:
- 400 por formato;
- 403 por CDN u Origin;
- 429 por límite por IP;
- 503 por infraestructura.

**Lo secreto sigue protegido.** El límite por email responde 202 idéntico, y la existencia del correo no cambia la respuesta. Ambos siguen siendo indistinguibles aunque se muestren los demás errores.

**Conclusión:** se pueden mostrar los errores no 2xx sin romper la anti-enumeración. El requisito pasa a MODIFIED. El comportamiento actual es un defecto de UX, no una garantía de seguridad.

## 3. Áreas afectadas

**API (solo con el fork 4.1-B):**
- `domain-exception.filter.ts` y los guards que lanzan `ForbiddenException` y `UnauthorizedException`, para agregar `code`.
- Las specs de API, con un requisito nuevo sobre el contrato de error.

**Web:**
- `src/lib/api/`:
  - `types.ts`: modelo `ApiError { kind, status, reason?, retryAfterSeconds? }`;
  - `errors.ts`;
  - `http.ts`: leer cabeceras y cuerpo de error;
  - `mock/*`: simular 403, 429 y 503.
- `features/login/*` y `content/login.ts`.
- `features/login/verifyReducer.ts` y `content/verify.ts`.
- `features/recruiter/*` (zona, CV, logout) y `content/recruiter.ts`.
- `features/recruiter/playground/ResponseViewer.tsx`.
- Specs: `web-recruiter-access` (MODIFIED) y una capacidad nueva `web-api-errors`.

## 4. Alternativas

### 4.1 Cómo distinguir las causas

| Opción | Ventajas | Desventajas | Esfuerzo |
|---|---|---|---|
| A. Status HTTP más un `reason` de 403 inferido del `message` | Sin cambios en la API | Acopla el frontend a strings en inglés. Si cambia la redacción, el mapeo se rompe sin que falle ningún test. | Bajo |
| **B. `code` estable en la API (`CDN_REQUIRED`, `ORIGIN_NOT_ALLOWED`, `ROLE_NOT_ALLOWED`, `RATE_LIMITED`, …)** | Contrato explícito y testeable en ambos lados. El copy vive solo en el frontend. | Cambio de API (filtro, guards, specs y e2e) en un PR previo | Medio |
| C. Mostrar el `message` de la API tal cual | Cero mapeo | Inglés técnico, expone topología y no explica la causa | Bajo |

### 4.2 Alcance de los mensajes

| Opción | Descripción |
|---|---|
| **A. Copy por situación (recomendado)** | Un mensaje por categoría y pantalla: formato (400), bloqueo por seguridad (403), espera (429) y servicio no disponible (503). |
| B. Copy genérico único | Barato, pero no responde "cuál error y por qué". |

### 4.3 Identificador de petición

**Recomendación:** no incluirlo en este cambio. La API no lo expone hoy y aporta a soporte, no a la comprensión del usuario.

### 4.4 Reintento ante 429 y 503

**Recomendación:**
- Un texto con tiempo estimado tomado de `Retry-After`, sin cuenta atrás.
- Ante 503, un botón "Reintentar" manual.
- Nunca reintentar automáticamente un POST de login, para no duplicar el envío del correo.

### 4.5 Playground

**Recomendación:** mantener status y cuerpo crudos, porque son parte de la demostración. Opcionalmente, agregar una línea explicativa bajo los 4xx y 5xx.

### 4.6 Dónde vive el copy

Un diccionario central tipado, por ejemplo `src/content/apiErrors.ts`, que cada pantalla pueda sobrescribir.

## 5. Recomendación

1. **PR 0 en la API:** agregar un `code` estable (fork 4.1-B).
2. **Modelo de error:** `ApiError` en `lib/api`, que mantiene `kind` y agrega `reason` y `retryAfterSeconds`.
3. **Copy:** un mensaje por situación, en un diccionario central en español neutro.
4. **Login:** mostrar 400, 403, 429 y 503, y dejar el estado "enviado" solo para 2xx. El requisito pasa a MODIFIED, con la justificación de anti-enumeración.
5. **429 y 503:** un texto con el tiempo estimado ante 429 y un "Reintentar" manual ante 503.
6. **Playground:** sigue mostrando la respuesta cruda, con una línea explicativa opcional.
7. **Accesibilidad:**
   - `role="alert"` para errores de formulario y de acción;
   - `role="status"` para errores de carga;
   - foco solo cuando cambia la página.

## 6. Corte en PRs (stacked-to-main)

| PR | Contenido | Líneas aprox. |
|---|---|---|
| 0 (API, opcional) | `code` estable en el filtro y los guards. Specs de API MODIFIED. | 250–400 |
| 1 | Modelo `ApiError`, cabeceras y cuerpo en `http.ts`, `Retry-After`, mock | 300–500 |
| 2 | Login con errores accionables y spec MODIFIED | 350–600 |
| 3 | Verify, zona reclutador (`getMe`, CV, logout) y la línea del playground | 400–700 |

El total estimado es de 1.050 a 1.800 líneas, más el PR 0. Hay que decidir el corte antes de aplicar.

## 7. Riesgos

- **Acoplamiento a strings en inglés** si no se agrega `code`.
- **Fuga de información** si se muestra el `message` crudo, porque describe la topología del CDN.
- **Anti-enumeración:** ningún error nuevo puede depender del correo. Debe quedar un test que lo impida.
- **403 del CDN o del WAF que no sea JSON:** el mapeo necesita un fallback sin `reason`.
- **`Retry-After` ausente o inválido:** tratarlo como opcional.
- **Doble envío del correo** si se reintenta el login en forma automática.
- **Mock desalineado** con las respuestas reales.
- **Accesibilidad:** mensajes largos con `role="alert"` interrumpen al lector de pantalla.

## 8. Fuera del alcance

- Un id de petición visible.
- Una cuenta atrás con el botón deshabilitado.
- i18n.
- Telemetría de errores del lado cliente.

## 9. Preguntas abiertas

1. ¿Se agrega un `code` estable al cuerpo de error en la API (PR 0) o se infiere el 403 del `message`?
2. ¿Se muestran en el login los errores 400, 403, 429 y 503? Implica modificar "Estado enviado idéntico".
3. ¿El 403 por CDN u Origin debe decir el motivo concreto o alcanza con un bloqueo genérico por seguridad?
4. ¿El playground queda totalmente crudo o lleva una línea explicativa?

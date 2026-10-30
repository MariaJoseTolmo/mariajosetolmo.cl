# Diseño: Frontend API Errors — `code` estable y errores accionables

> Fecha: 2026-10-29. Base: `proposal.md` (D1–D4 vinculantes), `exploration.md` y las specs delta de este cambio. Sigue las convenciones de `auth-backend` y `content-endpoints`.
> Nota de tamaño: supera las 800 palabras porque el orquestador pidió cerrar catálogo, filtro, modelo web, copy, a11y, tests y PRs. Todo va en tablas.

## 1. Enfoque técnico

**API.** Un único filtro global `ApiExceptionFilter` con `@Catch()` reemplaza a `DomainExceptionFilter`. Traduce tres orígenes al mismo cuerpo `{statusCode, error, message, code}`:

1. `DomainError`, con una tabla exhaustiva por código de dominio.
2. `HttpException` de Nest (router 404, body-parser), con una tabla por status.
3. Cualquier otra excepción → 500 `INTERNAL_ERROR`.

Los guards dejan de lanzar `HttpException` y lanzan `DomainError`. Así hay un solo punto de traducción.

**Web.** Un traductor puro, `toApiFailure`, recibe `{status, body, retryAfter}` y decide:

- `reason`: sale del `code`, solo si pertenece al catálogo.
- `kind`: sale del `reason`; si no hay `reason`, del status, igual que hoy.
- `retryAfterSeconds`: sale de `Retry-After`.

`http.ts` y el mock usan el mismo traductor. El copy vive en `src/content/apiErrors.ts` y lo resuelve `apiErrorMessage(failure, overrides?)`. Sin dependencias nuevas y sin ADR.

## 2. Catálogo final de `code` (D1)

| `code` | Status | Origen | Fija el `code` |
|--------|--------|--------|----------------|
| `INVALID_INPUT` | 400 | `InvalidInput` (email, `limit`, `cursor`, `level`, perfil); JSON malformado y 413 de body-parser | tabla de dominio / tabla por status |
| `INVALID_TOKEN` | 400 | `MalformedToken` e `InvalidMagicLink` (desconocido, vencido, usado o mal formado) | dominio: ambas pasan a extender `InvalidToken` |
| `UNAUTHENTICATED` | 401 | `JwtAuthGuard`, `RolesGuard` sin principal, `GetMe` con usuario borrado, `refresh` (todas las causas) | `Unauthenticated` |
| `CDN_REQUIRED` | 403 | `CloudFrontViewerAddressResolver` | `CdnRequired` (reemplaza a `Forbidden`) |
| `ORIGIN_NOT_ALLOWED` | 403 | `OriginGuard` | `OriginNotAllowed` |
| `ROLE_NOT_ALLOWED` | 403 | `RolesGuard` | `RoleNotAllowed` |
| `NOT_FOUND` | 404 | Router de Nest (ruta o método inexistente) | tabla por status; `message` fijo `Not found`, que ya no repite la ruta |
| `RATE_LIMITED` | 429 | `RateLimited` (por IP en magic-link, verify y refresh), con `Retry-After` en segundos | dominio |
| `SERVICE_UNAVAILABLE` | 503 | `InfrastructureUnavailable` (Redis, Postgres, S3) | dominio (`INFRASTRUCTURE_UNAVAILABLE` → público) |
| `INTERNAL_ERROR` | 500 | Excepción desconocida o código de dominio sin entrada | respaldo |

**Anti-enumeración.** `POST /api/auth/magic-link` solo puede responder:

- `INVALID_INPUT`, por formato;
- `CDN_REQUIRED` u `ORIGIN_NOT_ALLOWED`;
- `RATE_LIMITED`, solo por IP;
- `SERVICE_UNAVAILABLE` o `INTERNAL_ERROR`.

Ninguno depende de que el correo exista: `RequestMagicLink` ni siquiera conoce el repositorio de usuarios. El límite por email sigue en 202 idéntico.

`INVALID_TOKEN` es un único código para cuatro causas, así que no distingue vencido de usado. `refresh` responde siempre `UNAUTHENTICATED`.

> **Ajuste de spec requerido:** `api-error-contract` dice hoy que un token inválido responde con `INVALID_INPUT`. El diseño lo cierra en `INVALID_TOKEN` (ver A2).

## 3. Decisiones de arquitectura

| # | Opción elegida | Alternativas | Motivo |
|---|----------------|--------------|--------|
| A1 | Un filtro `@Catch()` (`api-exception.filter.ts`) con tres ramas | Dos filtros (de dominio y `HttpException`) | El orden entre filtros globales de Nest es poco evidente. Uno solo da un contrato y un test unitario. |
| A2 | Agregar `INVALID_TOKEN` | Usar `INVALID_INPUT` en verify | La causa queda explícita en el contrato y el cliente no necesita contexto. Sigue siendo un único código para todas las causas de token. |
| A3 | `code` de dominio tipado como unión `DomainErrorCode`, más una tabla `Record<DomainErrorCode, {status, code}>` | Exponer `DomainError.code` tal cual | La tabla obliga en compilación a cubrir cada clase nueva. El código público es un contrato y puede divergir del de dominio (`INFRASTRUCTURE_UNAVAILABLE` → `SERVICE_UNAVAILABLE`). |
| A4 | Los guards lanzan `DomainError` (`Unauthenticated`, `OriginNotAllowed`, `RoleNotAllowed`) | `HttpException` con `{code}` en el cuerpo | Un solo punto de traducción. Precedente: `ClientIpResolver` ya lanza un `DomainError` desde infraestructura. |
| A5 | `HttpException` → `code` por status: 400/413/415 → `INVALID_INPUT`, 401 → `UNAUTHENTICATED`, 404 → `NOT_FOUND`, 429 → `RATE_LIMITED`, 503 → `SERVICE_UNAVAILABLE`, otro 4xx → `INVALID_INPUT`, otro 5xx → 500 `INTERNAL_ERROR`. `message` fijo por `code` y `error` desde `STATUS_CODES` de `node:http`. | Repetir el `message` de Nest | `Cannot GET /api/x` repite la ruta, y body-parser repite fragmentos de la entrada. Un test estático prohíbe `new \w+Exception(` en `apps/api/src`, así que no hay 403 genéricos. |
| A6 | Web: `ApiFailure { error: ApiErrorKind; status?; reason?; retryAfterSeconds? }`, con `ApiResult<T> = {ok:true,data} \| ({ok:false} & ApiFailure)` | Renombrar `error` a `kind`, o anidar `error: ApiError` | Compatible con todo `result.error === 'unauthorized'`. El PR 1 no toca pantallas. `status` es opcional porque un fallo de red no tiene status. **Ajuste de spec:** `web-api-errors` nombra el campo `kind`; aquí se llama `error`. |
| A7 | `reason` solo desde `code` del catálogo; sin `code` (JSON sin `code`, HTML, cuerpo vacío) no hay `reason` y el copy cae a `kind` | Inventar `reason` desde el status | Hay un único dato confiable. El "respaldo por status" de la spec lo cubre `kind`, y el resultado visible es el mismo. |
| A8 | `Retry-After` solo en segundos (`^\d+$`, 1..86400); una fecha HTTP, `0`, un negativo o basura → `undefined` | Parsear también la fecha HTTP | La API nunca envía fechas. El CDN y el WAF no envían la cabecera por defecto. Evita depender del reloj del cliente. |
| A9 | Lista de `code` duplicada en `apps/web/src/lib/api/error-codes.ts`, un módulo sin imports, más un test de contrato en `apps/api/test` que la importa en forma relativa y exige igualdad con la de la API | Paquete compartido; dejar el test en la web | Sigue el precedente E9 (la API importa `web/src`). La web no puede importar la API. Un paquete compartido sería infraestructura nueva. |
| A10 | Mock: clave one-shot `web-cv-mock-error` en `sessionStorage` (`"<CODE>"` o `"RATE_LIMITED:120"`), consumida en la siguiente llamada; el fallo se construye con `toApiFailure` | Correos mágicos; error aleatorio | Determinista y sin timers. El mismo traductor que el adaptador `http` garantiza la alineación. No depende del email (anti-enumeración incluso en demo). |
| A11 | Refresh: 400/401 → `unauthorized`; otros fallos → `toApiFailure` | Todo lo demás → `unauthorized` | Un 403 `CDN_REQUIRED` en refresh hoy redirige al login, que también fallaría. Ahora muestra el copy del sitio oficial. |
| A12 | Login 503 o red: el mismo botón de envío cambia su texto a "Reintentar". Nunca hay reintento automático. | Un segundo botón | Un único control evita dos acciones iguales y cumple "Reintentar manual". |

## 4. Contratos

```ts
// apps/api/src/shared/infrastructure/http/api-error-code.ts  (y su espejo en apps/web/src/lib/api/error-codes.ts)
export const API_ERROR_CODES = ['INVALID_INPUT','INVALID_TOKEN','UNAUTHENTICATED','CDN_REQUIRED',
  'ORIGIN_NOT_ALLOWED','ROLE_NOT_ALLOWED','NOT_FOUND','RATE_LIMITED','SERVICE_UNAVAILABLE','INTERNAL_ERROR'] as const;

// apps/web/src/lib/api/errors.ts
export function toApiFailure(r: { status: number; body: unknown; retryAfter: string | null },
  context?: ErrorContext): ApiFailure;      // nunca lanza
export function parseRetryAfter(raw: string | null): number | undefined;
// http.ts
export interface ResponseLike { status; ok; statusText; text(); headers: { get(name: string): string | null } }
// types.ts: RawResponse gana `failure?: ApiFailure` (solo status >= 400 y != 401)
```

**Cómo se calcula `kind`:**

| Entrada | `kind` |
|---------|--------|
| `reason` `INVALID_INPUT` | `invalid-input` (`kind` nuevo) |
| `reason` `INVALID_TOKEN` | `invalid-token` |
| `reason` `UNAUTHENTICATED` | `unauthorized` |
| `reason` `CDN_REQUIRED`, `ORIGIN_NOT_ALLOWED` o `ROLE_NOT_ALLOWED` | `forbidden` |
| `reason` `RATE_LIMITED` | `rate-limited` |
| `reason` `SERVICE_UNAVAILABLE` o `INTERNAL_ERROR` | `server` |
| `reason` `NOT_FOUND` | `unexpected` |
| Sin `reason` | `errorFromStatus` actual, más 400/413/422 → `invalid-input` en el contexto por defecto |

`http.ts` lee el cuerpo de error con `readBody`. Si `text()` falla en una respuesta de error, el cuerpo vale `null` y no se convierte en `network`. El cuerpo 2xx de magic-link sigue sin leerse.

## 5. Copy (`src/content/apiErrors.ts`, español neutro)

```ts
interface ApiErrorsContent {
  reasons: Record<ApiErrorReason, string>;
  kinds: Record<ApiErrorKind, string>;
  waitUnknown: string;
  wait: { seconds: string; minute: string; minutes: string; hours: string };
}
// apiErrorMessage(f, overrides?: Partial<Record<ApiErrorReason | ApiErrorKind, string>>)
// orden: overrides[reason] → reasons[reason] → overrides[kind] → kinds[kind]; reemplaza {wait}
```

`src/lib/apiErrorMessage.ts` es puro y contiene `formatWait`. Reglas de redondeo:

| Segundos | Texto |
|----------|-------|
| < 60 | "unos segundos" |
| < 3600 | `ceil(s/60)`: "un minuto" o "{count} minutos" |
| ≥ 3600 | "{count} horas" |

Sin `retryAfterSeconds` se usa `waitUnknown`.

**Guarda de contenido.** El source no lleva cifras literales: `{wait}` y `{count}` son placeholders, y "~2 min" no aparece en el source. No se usan "renta", "/status" ni fechas.

| Clave | Texto por defecto |
|-------|-------------------|
| `CDN_REQUIRED`, `ORIGIN_NOT_ALLOWED` | La solicitud no llegó desde el sitio oficial. Abre mariajosetolmo.cl directamente e inténtalo de nuevo. |
| `ROLE_NOT_ALLOWED` | Tu rol no tiene permiso para ver este recurso. |
| `INVALID_INPUT` | Revisa los datos e inténtalo de nuevo. |
| `INVALID_TOKEN` | Este enlace no es válido o ya venció. Pide uno nuevo. |
| `UNAUTHENTICATED` | Tu sesión terminó. Vuelve a ingresar. |
| `NOT_FOUND` | No encontramos ese recurso. |
| `RATE_LIMITED` | Hiciste demasiados intentos. Espera {wait} y vuelve a intentarlo. |
| `waitUnknown` | Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo. |
| `SERVICE_UNAVAILABLE` | El servicio no está disponible en este momento. Inténtalo de nuevo en unos minutos. |
| `INTERNAL_ERROR` / `kinds.server` | Algo falló de nuestro lado. Inténtalo de nuevo. |
| `kinds.forbidden` (sin `code`: HTML del CDN o del WAF) | No pudimos procesar la solicitud por una restricción de seguridad. Abre mariajosetolmo.cl directamente e inténtalo de nuevo. |
| `kinds.network` | No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo. |
| `kinds.unexpected` | Recibimos una respuesta inesperada. Inténtalo de nuevo. |

**Overrides por pantalla:**

| Pantalla | Override |
|----------|----------|
| Login | `INVALID_INPUT`: "Revisa los datos. El correo debe tener el formato nombre@empresa.com." |
| Login | `server`/`INTERNAL_ERROR`: "Algo falló de nuestro lado y el enlace no se envió. Inténtalo de nuevo." |
| Login | `network`: el `networkError` actual |
| CV | `unexpected`: el `failed` actual |
| Playground | `ROLE_NOT_ALLOWED`: "Respuesta esperada: este endpoint es solo para el rol ADMIN." |

## 6. Comportamiento por pantalla y a11y

| Pantalla | Cambio | Rol y foco |
|----------|--------|------------|
| Login | `LoginState.error` pasa a `{status:'error'; failure: ApiFailure}`. `FAILED` lleva `failure`. "Enviado" solo con `result.ok`. `LoginForm` recibe `errorMessage?: string` en vez de `networkError` y `retryLabel` cuando `kind` es `server` o `network`. | `role="alert"`; el foco no se mueve |
| Verify | `ErrorVariant` gana `blocked` (403) y `retryAfterSeconds` viaja en la vista. Mapeo: `invalid-token`, `invalid-input` y `unauthorized` → `invalid`; `forbidden` → `blocked` (eyebrow "403 Forbidden", texto D3); `rate-limited` → texto con {wait}; `network`, `server` y `unexpected` → `unavailable`. El texto de `server` sale del diccionario. "Reintentar" en `blocked`, `rate-limited` y `unavailable`, porque el token no se consume antes del límite ni del resolvedor de IP. "Pedir un nuevo enlace" en `invalid`. | El foco va al título, como hoy |
| Zona (`getMe`) | `SessionState.error` lleva `failure`. El texto sale de `apiErrorMessage`. Se conservan el título y "Reintentar". | El foco va al título; el texto lleva `role="status"` |
| CV / logout | `CvStatus` y `logoutFailed` pasan a guardar `ApiFailure \| null`. `CvCard` recibe `error: string \| null`. | `role="alert"` |
| Playground | Si `response.failure` existe, una `<p>` bajo `CodeWindow` con `apiErrorMessage`. El status y el cuerpo crudos se mantienen. | Sin rol: el status ya se anuncia |

## 7. Flujo

```
fetch → ResponseLike(status, headers, text)
  ok  → datos
  !ok → readBody (JSON | texto | null) → toApiFailure({status, body, retryAfter}, ctx)
          → ApiResult {ok:false, error, status, reason?, retryAfterSeconds?}
              → contenedor → apiErrorMessage(failure, overrides) → <p role=alert|status>
mock: sessionStorage 'web-cv-mock-error' → toApiFailure(...) (mismo camino)
```

## 8. Archivos

| Archivo | Acción |
|---------|--------|
| `apps/api/src/shared/domain/errors.ts` | `DomainErrorCode`. Nuevas: `InvalidToken`, `CdnRequired`, `OriginNotAllowed`, `RoleNotAllowed`. Se elimina `Forbidden`. |
| `apps/api/src/shared/infrastructure/http/api-error-code.ts` | Crear (catálogo) |
| `apps/api/src/shared/infrastructure/http/{domain-exception → api-exception}.filter.ts` (+ spec) | Renombrar y reescribir |
| `apps/api/src/bootstrap/configure-app.ts` | Registrar el filtro nuevo |
| `apps/api/src/auth/domain/auth-errors.ts` | Extienden `InvalidToken` |
| `apps/api/src/auth/infrastructure/http/{client-ip.resolver,guards/*}.ts` (+ specs) | Lanzan los errores nuevos |
| `apps/api/test/error-contract.e2e-spec.ts` | Crear. Matriz 400/401/403×3/404/429/503: cuatro claves exactas, `code` del catálogo, `message` sin eco. En el PR 1 suma la igualdad con la lista web. |
| `apps/api/test/{content,auth-*,refresh,admin,me,postgres-down}.e2e-spec.ts` | Agregar `code` donde hoy se fija la forma con `toEqual` |
| `apps/web/src/lib/api/{error-codes,types,errors,http}.ts` (+ tests) | Modelo, traductor, `headers` |
| `apps/web/src/lib/api/mock/{index,fixtures}.ts` (+ test) | A10. `MOCK_FORBIDDEN_BODY` con la forma real y `ROLE_NOT_ALLOWED`. |
| `apps/web/src/content/{apiErrors,types,login,verify,recruiter}.ts` | Copy |
| `apps/web/src/lib/apiErrorMessage.ts` (+ test) | Crear |
| `apps/web/src/features/login/*` y `features/recruiter/**` | §6 |

`fetch-guard` no cambia: solo `http.ts` llama a `fetch`, y `headers` es parte de `ResponseLike`. Los fakes de `http.test.ts` suman `headers` en sus tres helpers.

## 9. Tests (Strict TDD)

| Capa | Qué | Cómo |
|------|-----|------|
| Unit API | Las ramas del filtro (cada `DomainErrorCode`, `HttpException` por status, desconocida → 500 con log); `Retry-After` solo en `RateLimited`; `message` fijo en 404 y en JSON malformado; los guards y el resolvedor lanzan la clase correcta; el test estático de `new \w+Exception(` | `ArgumentsHost` fake, sin Nest |
| e2e API | `error-contract.e2e-spec.ts`: matriz completa y JSON malformado, con un caso negativo de código inventado contra el validador. Anti-enumeración: el test "identical answer" se extiende a correo registrado, nuevo y límite por email (mismo status, cuerpo y ausencia de `code`). Las tres causas de verify dan el mismo `{statusCode, code}`. | `createTestApp()` |
| Contrato | Lista API = lista web, mismo orden | Import relativo (A9), PR 1 |
| Unit web | `toApiFailure`: `code` gana al status; HTML 403 sin `reason`; JSON sin `code`; código desconocido sin `reason`; contexto verify. `parseRetryAfter`: `120`, `abc`, fecha, `0`, ausente. `apiErrorMessage`: orden de override, `{wait}`, redondeos. Mock: cada clave one-shot. | Tablas `it.each` |
| Componentes | Login: cinco fallos dan cinco textos con `role="alert"` y sin "enviado"; dos correos con el mismo fallo dan el mismo DOM; `requestMagicLink` se llama una sola vez con timers falsos; el label "Reintentar". Verify, zona, CV, logout y playground según §6. En todos: el DOM no contiene el `message` ni "CloudFront", y `jest-axe` reporta 0. | Gateway fake inyectado |

## 10. PRs (stacked-to-main)

| PR | Contenido | Líneas estimadas |
|----|-----------|------------------|
| 0a | Errores de dominio, catálogo API, filtro, guards, resolvedor, unit y ajustes de e2e existentes | 350–420 |
| 0b | `error-contract.e2e-spec.ts`, extensión de anti-enumeración y specs de API | 220–300 |
| 1a | `error-codes`, `types`, traductor, `http.ts` (con `RawResponse.failure` y refresh A11) y test de contrato | 380–460 |
| 1b | Diccionario, `apiErrorMessage`, mock A10 | 300–380 |
| 2 | Login completo | 350–450 |
| 3a | Verify y zona (`getMe`) | 380–450 |
| 3b | CV, logout y línea del playground | 250–330 |

1a, 2 y 3a rozan las 400 líneas. Lo decide `sdd-tasks`.

**Reversión:** `git revert` en orden inverso. El web tolera una API sin `code` gracias a A7.

## 11. Preguntas abiertas y supuestos

- [ ] NO VERIFICADO: si los errores de body-parser (JSON malformado, 413) llegan al filtro global de Nest. Primera tarea del PR 0a: un e2e que exija JSON con `INVALID_INPUT`. Si falla, plan B: un middleware de error de Express en `configureApp` que escriba el mismo contrato.
- [ ] Ajustar las specs: `api-error-contract` (token → `INVALID_TOKEN`, catálogo de 10 códigos incluido `INTERNAL_ERROR`) y `web-api-errors` (el campo `kind` se llama `error`; `status` es opcional en fallos de red; sin `code` no hay `reason` y el copy cae a `kind`).
- [ ] Supuesto: `MalformedToken` se lanza antes del límite por IP (comportamiento actual). Un token mal formado no consume el cupo, pero responde el mismo `INVALID_TOKEN`, sin filtrar estado.

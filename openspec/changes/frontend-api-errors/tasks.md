# Tareas: Frontend API Errors — `code` estable y errores accionables

> 7 unidades de trabajo (U0a, U0b, U1a, U1b, U2, U3a, U3b) que siguen los PRs del design §10. `stacked-to-main`. Strict TDD (`openspec/config.yaml`): cada tarea es RED (test que falla, archivo nombrado primero; el RED debe ser un fallo de aserción en ejecución, no un error de compilación o de import, salvo que la tarea lo indique) -> GREEN (mínimo) -> REFACTOR. Rutas relativas al paquete indicado (`apps/api/` o `apps/web/`). Identificadores en inglés; copy de la web en español neutro. Shell: `rg`/`bat`/`fd`/`sd`/`eza`. Sin secretos, ARNs, cuentas ni emails reales (`*.example.test`). Sin `cdk`/AWS, sin dependencias nuevas, sin ADR, sin commits desde esta fase.

## Review Workload Forecast

Las cifras incluyen tests y la inflación de Strict TDD. Referencia medida en `content-endpoints`: los pronósticos con inflación ya incluida quedaron dentro de ~10 % del real (1.380 -> 1.250, 810 -> 830, 500 -> 520). Son líneas `additions + deletions`, sin lockfile.

| Campo | Valor |
|-------|-------|
| Líneas cambiadas estimadas | ~2.800 en total |
| Opción a (7 PRs del design) | 0a ~400 · 0b ~270 · 1a ~440 · 1b ~360 · 2 ~430 · 3a ~440 · 3b ~310 |
| Opción b (3 PRs, compacta) | A = API (0a+0b) ~670 · B = base web (1a+1b) ~800 · C = pantallas (2+3a+3b) ~1.180 |
| Riesgo de presupuesto de 400 líneas | Medium en la opción a (0a, 1a, 2 y 3a rondan o superan 400); High en la opción b (los 3 PRs lo superan) |
| PRs encadenados recomendados | Sí |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Decisión de la usuaria (resuelta antes de apply):** opción (c), 4 PRs con `size:exception`, `stacked-to-main`: **A** = API (U0a+U0b), **B** = base web (U1a+U1b), **C** = login (U2), **D** = zona reclutador (U3a+U3b). Delivery strategy resuelta: `ask-on-risk` -> 4 PRs con `size:exception`.

**Medido en PR A (apply):** 32 archivos, +1.072 / -248 = ~1.320 líneas `additions + deletions` bajo `apps/` (~990 en tests/specs). El pronóstico de ~670 quedó corto: la inflación de Strict TDD en el filtro (38 casos), la matriz e2e y la anti-enumeración pesó más. Requiere `size:exception` (ya aprobado en la decisión (c)).

**Opciones (decide la usuaria antes de apply):**

- **(a) 7 PRs, un PR por unidad (recomendada por revisión):** revisión liviana por PR, CI verde en cada uno, rollback fino. Más overhead de apertura y merge. Si 0a, 1a, 2 o 3a superan 400 al contar (CIERRE C1), `size:exception` puntual; no se parte la lógica.
- **(b) 3 PRs con `size:exception`:** A = U0a+U0b (~670), B = U1a+U1b (~800), C = U2+U3a+U3b (~1.180). Menos overhead (preferencia previa de la usuaria en `content-endpoints`); revisión pesada en C. Cada corte sigue siendo CI verde porque respeta el orden de las dependencias.
- Variante intermedia (4 PRs): A (~670), B (~800), login U2 (~430) y zona U3a+U3b (~750).

### Unidades de trabajo (base = `main` tras mergear la anterior)

| Unidad | Objetivo | Depende de |
|--------|----------|------------|
| U0a | Errores de dominio, catálogo, `ApiExceptionFilter`, guards y resolvedor | — |
| U0b | `error-contract.e2e-spec.ts`, anti-enumeración y ajustes de e2e | U0a |
| U1a | `error-codes`, `ApiFailure`, `toApiFailure`, `http.ts`, refresh, contrato API/web | U0b (el test de contrato importa la lista de la API) |
| U1b | Diccionario, `apiErrorMessage`, mock one-shot | U1a |
| U2 | Login completo | U1b |
| U3a | Verify y zona (`getMe`) | U1b |
| U3b | CV, logout y línea del playground | U3a |

Un solo hilo de escritura. Compatibilidad entre PRs: los PRs web (U1a en adelante) funcionan contra la API antes y después de U0 (el `code` manda; sin `code` se cae al status, A7). Los tests web cubren ambos casos con fakes. Cada PR pasa por revisión de contexto fresco antes de abrirse.

## Preguntas abiertas y puntos de decisión

- [x] D-A. RESUELTO en apply (PR A): sí llegan al filtro global con `@Catch()`. No hace falta plan B. Matiz: body-parser lanza un `Error` plano con `statusCode`/`status` (forma http-errors), no un `HttpException`; el filtro traduce ambos por status. Si no, aplicar plan B (middleware de error de Express en `configureApp`, tarea 1.2). Solo detener y preguntar si el plan B también falla.
- [ ] D-B. Ajustes de spec ya resueltos por el design (sin acción de apply, verify los comprueba): `INVALID_TOKEN` en `api-error-contract`; campo `error` (no `kind`) y `status` opcional en `web-api-errors`; sin `code` no hay `reason`.
- [x] D-C. VERIFICADO en la tarea 2.4: `MalformedToken` se lanza antes del límite por IP; un token mal formado no gasta el cupo y responde el mismo `INVALID_TOKEN`.
- [x] D-D. Supuesto de CI: añadir `kind` `invalid-input` (U1a) no rompe `Record<ApiErrorKind, …>` existentes; si hay mapas exhaustivos en la web, se completan en el mismo PR para no dejar `typecheck` en rojo (tarea 5.5). RESUELTO en PR B: no había mapas exhaustivos en pantallas; `typecheck` queda en verde sin tocarlas.

## Cierre estándar de PR («CIERRE»)

- [ ] C1. Contar líneas (`additions + deletions`, sin lockfile); si excede 400 y no hay `size:exception` aprobado, STOP. Evidencia: verify-report registra el `size:exception`.
- [ ] C2. En la raíz: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build` en verde. En PRs de API además `npm run lint:boundaries -w apps/api` y `npm run test:cov -w apps/api`; en PRs web, `npm run format:check`. Evidencia: verify-report. CI (quality, secrets, integration) verde.
- [ ] C3. Cobertura >= 80 %; gitleaks sin hallazgos; revisión de contexto fresco antes de abrir el PR; nada de `message` ni "CloudFront" en la UI.

## U0a — Dominio, catálogo, filtro y guards (API, PR 0a)

- [x] 1.1 **Punto de decisión D-A.** RED `test/error-contract.e2e-spec.ts` (crear con solo estos casos): `POST` con `Content-Type: application/json` y cuerpo `{"email":` -> `400` JSON con claves exactas `statusCode`, `error`, `message`, `code`, `code` `INVALID_INPUT`, `message` sin fragmentos del cuerpo; cuerpo mayor que el límite -> `413` JSON, mismo `code`. Ejecutar contra el filtro actual y registrar el resultado (¿llega JSON con `code`?). Hoy el `code` aún no existe, así que el RED es una aserción runtime sobre `code`. Anotar en el PR qué rama se tomó.
- [x] 1.2 RED/GREEN `src/shared/infrastructure/http/api-error-code.ts`: spec `api-error-code.spec.ts` (`API_ERROR_CODES` exactamente los 10 códigos del design §4, en ese orden; tipo `ApiErrorCode`) -> GREEN catálogo. Si D-A falló, plan B: spec del middleware de error de Express registrado en `src/bootstrap/configure-app.ts` que escribe el mismo cuerpo (400/413 -> `INVALID_INPUT`, `message` fijo); el test 1.1 pasa a verde con él. Si el plan B tampoco funciona, STOP y preguntar.
- [x] 1.3 RED `src/shared/domain/errors.spec.ts`: `DomainErrorCode` incluye las clases nuevas; `InvalidToken`, `CdnRequired`, `OriginNotAllowed`, `RoleNotAllowed` existen con `code` propio; `Forbidden` ya no se exporta -> GREEN `src/shared/domain/errors.ts` (unión `DomainErrorCode`, A3).
- [x] 1.4 RED `src/auth/domain/auth-errors.spec.ts`: `MalformedToken` e `InvalidMagicLink` son `instanceof InvalidToken` y comparten `code` -> GREEN `src/auth/domain/auth-errors.ts`.
- [x] 1.5 RED `src/shared/infrastructure/http/api-exception.filter.spec.ts` (`ArgumentsHost` fake, sin Nest; tabla `it.each`): cada `DomainErrorCode` -> `{status, code}` del design §2 (`INFRASTRUCTURE_UNAVAILABLE` -> 503 `SERVICE_UNAVAILABLE`); `HttpException` por status (400/413/415/otro 4xx -> `INVALID_INPUT`, 401, 404 con `message` fijo `Not found` sin la ruta, 429, 503, otro 5xx -> 500 `INTERNAL_ERROR`); excepción desconocida -> 500 `INTERNAL_ERROR` con log y `message` fijo; código de dominio sin entrada -> 500; `Retry-After` solo en `RateLimited`, en segundos; cuatro claves exactas; `error` desde `STATUS_CODES` -> GREEN renombrar `domain-exception.filter.ts` a `api-exception.filter.ts` y reescribir (`@Catch()`, tres ramas, `Record<DomainErrorCode, …>` exhaustivo).
- [x] 1.6 Registrar `ApiExceptionFilter` en `src/bootstrap/configure-app.ts` (y `test/support/test-app.ts` si lo instancia). RED: `test/error-contract.e2e-spec.ts` agrega 404 de ruta inexistente con `code` `NOT_FOUND` y `message` sin la ruta -> GREEN.
- [x] 1.7 RED guards (specs existentes en `src/auth/infrastructure/http/guards/*.spec.ts` y `client-ip.resolver.spec.ts`): `JwtAuthGuard` y `RolesGuard` sin principal lanzan `Unauthenticated`; `RolesGuard` con rol insuficiente lanza `RoleNotAllowed`; `OriginGuard` lanza `OriginNotAllowed`; `CloudFrontViewerAddressResolver` lanza `CdnRequired` -> GREEN cambiar los guards y el resolvedor; eliminar los `HttpException` de `src/`.
- [x] 1.8 RED `src/shared/infrastructure/http/no-http-exception.spec.ts` (test estático): `rg`-equivalente sobre `apps/api/src` que prohíbe `new \w+Exception(` -> GREEN (debe pasar tras 1.7; si falla, hay un 403 genérico pendiente).
- [x] 1.9 Ajustar e2e existentes que fijan la forma con `toEqual` (`test/{content,auth-*,refresh,admin,me,postgres-down}.e2e-spec.ts`): añadir `code` donde corresponde. RED: correr la suite y ver las fallas de forma -> GREEN solo con ajustes de test. `GetMe` con usuario borrado y `refresh` (todas las causas) -> `UNAUTHENTICATED` (verificar en los e2e). REFACTOR. CIERRE.

## U0b — Contrato en e2e y anti-enumeración (API, PR 0b)

- [x] 2.1 RED `test/error-contract.e2e-spec.ts` (matriz): 400 (`limit=0` en `/api/v1/experience`), 401 (`/api/v1/me` sin cookies), 403 x3 (`CDN_REQUIRED` en producción sin `CloudFront-Viewer-Address` en `/api/auth/*`; `ORIGIN_NOT_ALLOWED` con Origin no permitido; `ROLE_NOT_ALLOWED` RECRUITER en `/api/v1/admin/visits`), 404, 429 (límite por IP agotado, con `Retry-After` entero) y 503 (`postgres-down`): cuatro claves exactas con `Object.keys`, `code` en `API_ERROR_CODES`, `message` sin eco de lo enviado. La mayoría debería pasar tras U0a; el RED real es cualquier celda sin `code` (si todo pasa, registrar que el contrato ya estaba cumplido) -> GREEN ajustes mínimos.
- [x] 2.2 RED mismo archivo: caso negativo con `code` inventado contra el validador (`assertCatalogCode('ALGO_NUEVO')` falla; helper en `test/support/`) -> GREEN helper.
- [x] 2.3 RED mismo archivo: `message` fijo e independiente del `code` (un test que sustituye el `message` y verifica que el `code` es el mismo) y excepción desconocida -> 500 `INTERNAL_ERROR` sin texto de la excepción -> GREEN.
- [x] 2.4 RED token inválido: token inexistente, vencido, ya consumido y mal formado -> mismo `statusCode` 400 y mismo `code` `INVALID_TOKEN`; refresh con cookie ausente, token vencido y revocado -> 401 `UNAUTHENTICATED` en las tres. Verificar D-C (el mal formado no consume el cupo por IP y responde igual). -> GREEN.
- [x] 2.5 RED anti-enumeración: extender el test "identical answer" de magic-link (`test/auth-magic-link.e2e-spec.ts` o el que exista) a correo registrado, nuevo y con límite por email agotado: mismo status, mismo cuerpo y sin `code` de error; los errores posibles (formato, CDN, Origin, IP, infraestructura) idénticos entre correos -> GREEN.
- [x] 2.6 RED `test/content.e2e-spec.ts`: `limit=0|abc|51|2.5|`, `limit=1&limit=2`, `cursor=-1|abc|<script>|9007199254740993` -> 400 con claves exactas y `code` `INVALID_INPUT`, cuerpo sin el valor enviado (delta `api-content-endpoints`) -> GREEN. REFACTOR. CIERRE.

## U1a — Modelo, traductor y adaptador `http` (web, PR 1a)

- [x] 3.1 RED `src/lib/api/error-codes.test.ts`: `API_ERROR_CODES` igual al de la API en contenido y orden, importando por ruta relativa `../../../api/src/shared/infrastructure/http/api-error-code` (A9, precedente E9); el test vive en `apps/api/test/error-code-contract.spec.ts` si `typecheck`/ts-jest de la web rechaza el import (la web no puede importar la API) -> GREEN `src/lib/api/error-codes.ts` (módulo sin imports, `ApiErrorReason`). Verificar a mano que cambiar un código en un lado pone el test en rojo y revertir. Si `tsc` rechaza el import cruzado, STOP y preguntar; no excluir del `typecheck`.
- [x] 3.2 RED `src/lib/api/errors.test.ts` (`it.each`): `parseRetryAfter` (`120` -> 120; `abc`, fecha HTTP, `0`, `-5`, `86401`, ausente -> `undefined`); `toApiFailure` (403 + `ROLE_NOT_ALLOWED` -> `forbidden` con `reason` de rol; 429 sin `code` -> `rate-limited` sin `reason`; 403 HTML -> `forbidden` sin `reason`; 400 + `ALGO_NUEVO` -> `invalid-input` sin `reason`; 400 + `INVALID_INPUT`; 400/413/422 sin `code` -> `invalid-input`; cuerpo `null`/vacío/no objeto; nunca lanza; tabla `kind` del design §4; contexto verify) -> GREEN `src/lib/api/errors.ts` y `types.ts` (`ApiFailure`, `ApiResult<T>`, `invalid-input` en `ApiErrorKind`).
- [x] 3.3 RED `src/lib/api/http.test.ts` (fakes con `headers.get`, los tres helpers de fake suman `headers`): `ResponseLike` con `headers`; 403 `ORIGIN_NOT_ALLOWED`, 429 con `Retry-After: 120`, 503 con `code`, 500 con `text()` que lanza -> `server` con `status` 500 (no `network`), `fetch` que rechaza -> `network` sin `status`; la API previa a U0 (sin `code`) cae al status; el cuerpo 2xx de magic-link no se lee -> GREEN `src/lib/api/http.ts` (`readBody`, `RawResponse.failure?` solo para status >= 400 y != 401).
- [x] 3.4 RED mismo `http.test.ts` (refresh A11): `GET /me` 401 + refresh 401 -> `unauthorized`; refresh 400 -> `unauthorized`; refresh 403 `CDN_REQUIRED` -> `forbidden` con `reason`; refresh 429 con `Retry-After: 30` -> `rate-limited` con 30; refresh 200 y `GET /me` 401 otra vez -> `unauthorized` con exactamente un `POST /api/auth/refresh` y dos `GET /api/v1/me` -> GREEN.
- [x] 3.5 Completar mapas exhaustivos afectados por el `kind` nuevo (D-D) para mantener `typecheck` y `lint` en verde, sin tocar pantallas: `rg "ApiErrorKind|errorFromStatus|result\.error" apps/web/src`. REFACTOR. CIERRE.

## U1b — Diccionario, `apiErrorMessage` y mock (web, PR 1b)

- [x] 4.1 RED `src/lib/apiErrorMessage.test.ts`: orden `overrides[reason]` -> `reasons[reason]` -> `overrides[kind]` -> `kinds[kind]`; sustitución de `{wait}`; `retryAfterSeconds` 30 -> "unos segundos", 61 -> 2 minutos, 7200 -> 2 horas, 60 -> "un minuto"; ausente -> `waitUnknown`; sin `reason` el copy cae a `kind` -> GREEN `src/lib/apiErrorMessage.ts` (`formatWait`, puro) y `src/content/apiErrors.ts` + tipos en `src/content/types.ts`.
- [x] 4.2 RED guarda de contenido: ampliar `src/test/content-guard.test.ts` (o su equivalente) para que `apiErrors.ts` no tenga cifras literales de tiempo, "renta", "/status", fechas ni "CloudFront"; el texto 403 por CDN/Origin es exactamente el de D3; `ROLE_NOT_ALLOWED` distinto de él; `kinds.forbidden` distinto de ambos -> GREEN copy del design §5.
- [x] 4.3 RED `src/lib/api/mock/index.test.ts`: clave `web-cv-mock-error` con `ORIGIN_NOT_ALLOWED`, `RATE_LIMITED:120` (`retryAfterSeconds` 120), `RATE_LIMITED` y `SERVICE_UNAVAILABLE` -> cada fallo con su `reason` vía `toApiFailure`; un solo uso (segunda llamada no falla y la clave ya no existe); no depende del email; valor inválido se ignora -> GREEN `mock/index.ts`, `mock/fixtures.ts` (`MOCK_FORBIDDEN_BODY` con la forma real y `ROLE_NOT_ALLOWED`).
- [x] 4.4 RED: el mock del playground devuelve `failure` con `ROLE_NOT_ALLOWED` en `/api/v1/admin/visits` para RECRUITER -> GREEN fixtures. REFACTOR. CIERRE.

## U2 — Login completo (web, PR 2)

- [x] 5.1 RED `src/features/login/*.test.tsx` (gateway fake inyectado): `LoginState.error` = `{status:'error'; failure}`; "enviado" solo con `result.ok`; 400, 403, 429, 503 y `network` en cinco envíos -> sin estado "sent", cinco textos distintos, cada uno con `role="alert"`, el foco no se mueve; dos correos con el mismo fallo dan el mismo DOM -> GREEN reducer `FAILED` con `failure`, contenedor con `apiErrorMessage` y overrides de login (design §5).
- [x] 5.2 RED `LoginForm`: recibe `errorMessage?: string` (reemplaza a `networkError`); para `server` y `network` el único botón de envío dice "Reintentar" y no hay segundo botón; en los demás errores el botón conserva su texto -> GREEN `retryLabel` en `content/login.ts` + `LoginForm`.
- [x] 5.3 RED con timers falsos: `requestMagicLink` con 503 se invoca exactamente una vez tras avanzar el tiempo; 429 con `Retry-After: 60` muestra tiempo estimado y el texto no cambia al avanzar el reloj -> GREEN (sin lógica de reintento).
- [x] 5.4 RED anti-enumeración web: gateway con el mismo estado y dos correos (registrado y desconocido) -> mismo `failure` y mismo HTML; el estado "sent" idéntico para dos cuerpos 2xx distintos; `jest-axe` 0 violaciones; el DOM no contiene el `message` de la API ni "CloudFront" -> GREEN.
- [x] 5.5 Actualizar la spec modificada `web-recruiter-access` (solo verify la compara). REFACTOR. CIERRE.

## U3a — Verify y zona `getMe` (web, PR 3a)

- [ ] 6.1 RED `src/features/login/verify*.test.tsx` (ubicación según `rg "ErrorVariant" apps/web/src`): `verifyToken` 403 `ORIGIN_NOT_ALLOWED` -> variante `blocked` con eyebrow "403 Forbidden", texto de sitio oficial y "Reintentar", sin "Este enlace no es válido"; `INVALID_TOKEN` para inexistente, vencido, usado y mal formado -> HTML idéntico en los cuatro y "Pedir un nuevo enlace"; `invalid-input` y `unauthorized` -> `invalid`; 429 con `{wait}` y "Reintentar"; 503, `network`, `server`, `unexpected` -> `unavailable` con "Reintentar"; el foco va al título -> GREEN `ErrorVariant` con `blocked` y `retryAfterSeconds`, mapeo del design §6 y `content/verify.ts`.
- [ ] 6.2 RED `src/features/recruiter/**` (guard de sesión): `getMe` con 403, 429, 503 y `network` en cuatro renders -> cuatro textos distintos, sin redirección y con "Reintentar" (una sola nueva llamada al pulsarlo); `unauthorized` redirige a `/acceso/`; refresh bloqueado (`forbidden` + `CDN_REQUIRED`) muestra copy de sitio oficial sin redirigir; el texto lleva `role="status"` y el foco va al título; "Verificando sesión" sin tarjetas -> GREEN `SessionState.error` con `failure` y `apiErrorMessage`.
- [ ] 6.3 RED `jest-axe` 0 violaciones en verify y zona en error; el DOM no contiene el `message` ni "CloudFront" -> GREEN. REFACTOR. CIERRE.

## U3b — CV, logout y playground (web, PR 3b)

- [ ] 7.1 RED `CvCard`/contenedor: `getCvLink` 503 al pulsar "Descargar PDF" -> copy de servicio no disponible (no el genérico de conexión); `unexpected` usa el override `failed` actual; `CvCard` recibe `error: string | null` con `role="alert"`; `CvStatus` guarda `ApiFailure | null` -> GREEN.
- [ ] 7.2 RED `logoutFailed` guarda `ApiFailure | null`: `logout` 429 -> copy de espera con `{wait}` y `role="alert"` -> GREEN.
- [ ] 7.3 RED playground: `/api/v1/admin/visits` como RECRUITER -> status 403 y cuerpo crudo visibles, más una `<p>` bajo `CodeWindow` con "Respuesta esperada: este endpoint es solo para el rol ADMIN."; `/api/v1/profile` 200 -> sin línea; 5xx -> línea del diccionario; cinco botones con `aria-pressed` y exactamente uno `true` -> GREEN `response.failure` + `apiErrorMessage` con override `ROLE_NOT_ALLOWED`.
- [ ] 7.4 RED `jest-axe` 0 violaciones; el DOM no contiene `message` ni "CloudFront" -> GREEN. REFACTOR. CIERRE.

## Cierre del cambio (después de la última unidad)

- [ ] F1. Revisión de contexto fresco de todo el diff (incluye cruce con las 4 specs y los ajustes D-B).
- [ ] F2. `gitleaks` sin hallazgos; `rg` de ARNs, IDs de cuenta y emails reales en `openspec/changes/frontend-api-errors` y en el código nuevo.
- [ ] F3. `sdd-verify`: todos los escenarios de la trazabilidad en verde; `size:exception` registrados.

## Trazabilidad escenario -> tarea

| Spec | Escenarios | Tareas |
|------|-----------|--------|
| api-error-contract | Forma completa · Error de guard · Ruta inexistente | 1.5, 1.6, 1.7, 2.1 |
| | JSON malformado · Cuerpo demasiado grande | 1.1, 1.2, 2.1 |
| | Excepción desconocida | 1.5, 2.3 |
| | Los tres 403 se distinguen · 429 y 503 | 1.5, 1.7, 2.1 |
| | Cambiar el message no cambia el code | 2.3 |
| | Token desconocido/vencido/usado/mal formado · Refresh UNAUTHENTICATED | 1.3, 1.4, 2.4 |
| | Magic-link no depende del correo | 2.5 |
| | Todo error trae un code · Code desconocido | 2.1, 2.2 |
| | Catálogo API = web | 1.2, 3.1 |
| api-content-endpoints | limit inválido · cursor inválido · cursor sobre el máximo | 2.6 |
| web-api-errors | Modelo y traducción (code manda, sin code, no JSON, desconocido, entrada inválida, red, cuerpo ilegible) | 3.2, 3.3 |
| | Refresh (rechazado, bloqueado, limitado) | 3.4 |
| | Retry-After (válido, inválido, redondeo, sin cuenta atrás) | 3.2, 4.1, 5.3 |
| | Diccionario (message fuera del DOM, 403 CDN/Origin, rol, override, orden) | 4.1, 4.2, 5.4, 6.3, 7.4 |
| | Reintento manual (503 con botón, login sin reintento, botón Reintentar) | 5.2, 5.3, 6.2 |
| | Roles ARIA y accesibilidad | 5.1, 6.2, 6.3, 7.4 |
| | Mock (simula errores, un solo uso) | 4.3 |
| | Verify (403, token inválido, 429 y 503) | 6.1 |
| | Zona (causas distintas, CV, logout) | 6.2, 7.1, 7.2 |
| web-recruiter-access | Estado enviado, errores no 2xx, Reintentar, ningún error depende del correo, 429 con tiempo | 5.1–5.4 |
| | Guard de sesión (verificando, un refresh, recupera, bloqueado, sin sesión, red, 403/429/5xx) | 3.4, 6.2 |
| | Playground (aria-pressed, línea 4xx/5xx, sin línea 2xx) | 7.3 |

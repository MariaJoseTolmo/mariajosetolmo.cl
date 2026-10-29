# Apply progress: frontend-api-errors

> Lotes: 1 = PR A (U0a+U0b), hecho. 2 = PR B (U1a+U1b), hecho. Pendientes: PR C (U2) y PR D (U3a+U3b).

> Modo: Strict TDD. Entrega: 4 PRs con `size:exception`, `stacked-to-main` (A = U0a+U0b, B = U1a+U1b, C = U2, D = U3a+U3b).

## Lote 1 — PR A (API: U0a + U0b)

Tareas completadas: 1.1–1.9 y 2.1–2.6 (15 de 15 del PR A). Pendientes: U1a en adelante (PRs B, C, D). `size:exception`: ~1.320 líneas medidas (ver Review Workload Forecast).

### Punto de decisión D-A

Resultado: los errores de body-parser SÍ llegan al filtro global cuando es `@Catch()`. Plan B no necesario. Matiz: llegan como `Error` plano con `statusCode`/`status` (forma http-errors), no como `HttpException`; `httpStatusOf` en el filtro cubre ambos. D-C verificado: `MalformedToken` se lanza antes del límite por IP.

### TDD Cycle Evidence

| Tarea | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 1.1 | `error-contract.e2e-spec.ts` (400 JSON malformado, 413) contra el filtro viejo: 2 fallos de aserción en ejecución (cuerpo sin `code`; el 413 sin `code` ni `error`) | Pasa al registrar el filtro nuevo (1.5/1.6) | Prettier |
| 1.2 | `api-error-code.spec.ts`: error de compilación (módulo nuevo, inevitable para una constante) | 3 pasan con `api-error-code.ts` | — |
| 1.3 | `errors.spec.ts`: TS2305 por clases nuevas (RED de compilación; el caso "Forbidden ya no se exporta" es de ejecución pero no llegó a correr) | 11 pasan | `DomainErrorCode` como unión |
| 1.4 | `auth-errors.spec.ts`: 1 fallo de aserción (`Expected constructor: InvalidToken`) | 2 pasan | Specs de `verify-magic-link` y `magic-link-token` migradas a `InvalidToken` |
| 1.5 | `api-exception.filter.spec.ts`: TS2724 (renombre, RED de compilación) | 38 pasan | Tabla `SPECIAL_STATUS` en lugar de `switch` (regla `no-unsafe-enum-comparison`) |
| 1.6 | 404 de ruta inexistente en el e2e; RED real: se retiró temporalmente `useGlobalFilters` y fallaron los 3 casos del archivo; restaurado | 3 pasan | — |
| 1.7 | Specs de guards y resolvedor cambiadas a las clases nuevas junto con el código (el RED fue de compilación: `Forbidden` ya no existía; no se corrió el fallo de ejecución por separado) | 621 unitarias pasan | Imports reubicados |
| 1.8 | `no-http-exception.spec.ts`: contrato ya cumplido tras 1.7, no hay RED. Se añade un caso que prueba que el patrón detecta `throw new ForbiddenException()` | 2 pasan | — |
| 1.9 | Suite e2e: 23 fallos de forma (falta `code`) | 167 pasan solo con ajustes de test (+ aserciones de `code` en me, admin, auth-verify, auth-magic-link) | — |
| 2.1 | Contrato ya cumplido tras U0a: la matriz pasa completa. Único fallo inicial: el límite por IP (202 en vez de 429) por falta de `rateLimits` en la configuración del test (error del test, no del producto) | 11 pasan | — |
| 2.2 | RED: el helper `test/support/error-contract.ts` no existía (compilación) | Pasa: `ALGO_NUEVO` y `undefined` fallan; los 10 códigos pasan | — |
| 2.3 | Contrato ya cumplido: no hay RED. `message` distinto no cambia `code` (filtro real) y excepción desconocida -> 500 fijo sin `ECONNREFUSED` | pasan | Primer intento (mutar el cuerpo en el test) reemplazado por uno que ejercita el filtro |
| 2.4 | Contrato ya cumplido en `verify` y `refresh` (sin RED de producto). Primer intento falló por comparar el texto entero: `MalformedToken` y `InvalidMagicLink` tienen `message` distinto; la spec exige solo status y `code` iguales. Se compara el texto solo entre desconocido/vencido/usado | pasan (verify 22, refresh 33) | — |
| 2.5 | Contrato ya cumplido (`RequestMagicLink` no conoce el repositorio de usuarios): sin RED de producto | 5 casos nuevos pasan (202 idéntico x4, 403 x2, 429, 503, 400) | — |
| 2.6 | Cubierto por los ajustes de 1.9 (cuerpo exacto con `toEqual`); se añaden las claves exactas y la ausencia de `<script>` y del número | pasan | — |

### Resultados finales

| Chequeo | Resultado |
|---------|-----------|
| Unitarias (`npm test -w apps/api`, con cobertura) | 59 suites, 623 tests; cobertura 100 % líneas / 95,41 % ramas |
| e2e | 12 suites, 188 tests |
| Integración (compose) | 9 suites, 104 tests |
| `npx eslint apps/api --max-warnings 0` | limpio |
| `npm run typecheck -w apps/api` | limpio |
| `npx prettier --check apps/api` | limpio |
| `npm run build -w apps/api` | limpio |
| `npm run lint:boundaries` (raíz) | sin FAIL |

### Archivos

- Creados: `src/shared/infrastructure/http/{api-error-code,api-exception.filter,no-http-exception}.ts|spec`, `test/error-contract.e2e-spec.ts`, `test/support/error-contract.ts`.
- Renombrados/reescritos: `domain-exception.filter(.spec).ts` -> `api-exception.filter(.spec).ts`.
- Modificados: `shared/domain/errors(.spec).ts`, `auth/domain/auth-errors(.spec).ts`, guards y `client-ip.resolver` (+ specs), `bootstrap/configure-app.ts`, specs de `verify-magic-link` y `magic-link-token`, e2e de admin, auth-magic-link, auth-verify, content, cv, me, postgres-down, refresh.

### Desviaciones y notas

- Los mensajes de dominio 4xx se conservan (son texto propio sin eco); el `message` fijo por `code` aplica a `HttpException`/body-parser y a los 5xx. Coincide con el design A5.
- `DomainError.code` pasa a unión `DomainErrorCode`; la spec del filtro usa un cast para simular un código sin entrada.
- Los 4 códigos de dominio nuevos fijan su `message` en el constructor.
- Tamaño: ~1.320 líneas (el pronóstico decía ~670). Cubierto por `size:exception`.

## Lote 2 — PR B (web: U1a + U1b)

Tareas completadas: 3.1–3.5 y 4.1–4.4 (9 de 9 del PR B). Pendientes: U2, U3a, U3b (PRs C y D). D-D resuelto.

### TDD Cycle Evidence

El runner de la web (`next/jest`, SWC) no tipa: un import inexistente falla en ejecución, no en compilación.

| Tarea | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 3.1 | `error-codes.test.ts` con un `error-codes.ts` vacío (`[]`): fallo de aserción `toEqual` contra la lista de la API | 1 pasa. Mutación a mano (`NOT_FOUND` -> `NOT_FOUNDX`): rojo; revertido: verde. `tsc` acepta el import cruzado `../../../../api/src/...` | — |
| 3.2 | `errors.test.ts`: 37 fallos (`parseRetryAfter`/`toApiFailure` no existen: TypeError en ejecución) | 53 pasan (`errors.ts`, `types.ts`: `ApiFailure`, `invalid-input`, `RawResponse.failure?`) | `errorFromStatus` gana 400/413/422 -> `invalid-input` solo en contexto por defecto |
| 3.3 | `http.test.ts`: 9 fallos de aserción (sin `reason`, sin `retryAfterSeconds`, 500 ilegible daba `network`, sin `failure` en playground) | 55 pasan (`readErrorBody`, `failureOf`, `ResponseLike.headers`) | Tres fakes con `headers`; `RecruiterZone.test.tsx` suma `headers` al fake (solo para `typecheck`) |
| 3.4 | Mismos 9 fallos: refresh 403/429 seguían siendo `unauthorized`/sin `status` | Pasan (A11: 400/401 -> `unauthorized`; resto por `toApiFailure`) | Expectativas previas de refresh 429/502 actualizadas con `status` (cambio de contrato deliberado) |
| 3.5 | Sin RED: `rg` no halló mapas `Record<ApiErrorKind, …>` en pantallas; `tsc` limpio sin tocarlas | — | — |
| 4.1 | `apiErrorMessage.test.ts` contra stubs (cadena vacía): 16 fallos de aserción | 21 pasan | Constantes de copy compartidas en `apiErrors.ts` |
| 4.2 | Sin RED: el copy de 4.1 ya cumplía la guarda. Mutación a mano (cifra "30" en el source): rojo; revertida | 10 pasan (`apiErrors.test.ts`) | — |
| 4.3 | `mock/index.test.ts`: 9 fallos de aserción (sin inyección, cuerpo 403 viejo) | 22 pasan | `RATE_LIMITED:0` se ignora usando `parseRetryAfter`; wrapper `withInjection` sin métodos sin bindear (regla `unbound-method`) |
| 4.4 | Cubierto por el test de 4.3 (admin/visits con cuerpo real, `ROLE_NOT_ALLOWED` y `failure`): falló antes de actualizar fixtures | Pasa | — |

### Resultados finales (apps/web)

| Chequeo | Resultado |
|---------|-----------|
| Unitarias con cobertura (`npm run test:cov -w apps/web`) | 90 suites, 1303 tests; cobertura 99,87 % sentencias / 99,29 % ramas / 99,47 % funciones / 100 % líneas |
| `npx eslint . --max-warnings 0` (raíz) | limpio |
| `npm run typecheck -w apps/web` | limpio |
| `npx prettier --check .` | limpio |
| `npm run build -w apps/web` (incl. `check-out`) | OK |
| `npm test -w apps/api` | 59 suites, 623 tests |

### Archivos

- Creados: `src/lib/api/error-codes(.test).ts`, `src/lib/apiErrorMessage(.test).ts`, `src/content/apiErrors(.test).ts`.
- Modificados: `src/lib/api/{types,errors,http}.ts` (+ tests), `src/lib/api/mock/{index,fixtures}.ts`, `mock/index.test.ts`, `src/content/types.ts`, `src/features/recruiter/RecruiterZone.test.tsx` (fake con `headers`).

### Desviaciones y notas

- `wait` del diccionario suma `hour` ("una hora"): con solo `hours` saldría "1 horas" a las 3600 s.
- Un texto con `{wait}` y sin `retryAfterSeconds` devuelve `waitUnknown` completo (incluye overrides con `{wait}`), porque `waitUnknown` es una oración entera.
- `retryAfterSeconds` solo se expone en 429.
- La inyección del mock se consume siempre al leerla; un valor inválido se descarta sin fallar.
- El mock de `verifyToken` con token inválido conserva `failure('invalid-token')` sin `reason` (no se tocó para no alterar las pantallas).
- Playground mock: `admin/visits` sigue como dato (200 del gateway, status 403) y ahora lleva `failure`.
- `ApiResult` pasó a `{ok:false} & ApiFailure`; no hizo falta tocar pantallas.
- Tamaño: ver reporte del lote (tests dominan); cubierto por `size:exception`.

### Lote 2 — correcciones de revisión (W1, W2, S1, S2)

| Id | RED | GREEN |
|----|-----|-------|
| W1 | `mock/index.test.ts`: 3 fallos de aserción (la inyección en `call()` devolvía `{ok:false,…}` en vez de `{ok:true,data:{status,statusText,body,failure}}`; faltaban 503 como dato, `retryAfterSeconds` 120 y `UNAUTHENTICATED` como `failure('unauthorized', 401)`) | `playgroundResult` + `injectedBody` (cuerpo de cuatro claves, mismo `toApiFailure`); `call` tiene su propio wrapper; el test "applies to every gateway method" ya no incluye `call` |
| W2 | Mutación a mano: quitar la fila `NOT_FOUND` de la tabla (`CODE_CASES`) hace fallar "covers every catalog code exactly once" (1 fallo); revertida | Test compara el conjunto de la tabla con `new Set(API_ERROR_CODES)` y exige que no haya duplicados |
| S1 | Sin RED: la clave ya se consumía siempre; el test ahora lo fija con `getItem(KEY)` nulo | — |
| S2 | `apiErrorMessage.test.ts`: 1 fallo (un 503 con override `{wait}` sin tiempo devolvía el copy de límite de intentos) | `waitNeutral` ("unos minutos") en `content/apiErrors.ts` y `types.ts`; `waitUnknown` solo si `error === 'rate-limited'` |

Resultados tras las correcciones: web 90 suites, 1308 tests; cobertura 99,87 % sentencias / 99,3 % ramas / 99,48 % funciones / 100 % líneas; `eslint . --max-warnings 0` exit 0; `tsc --noEmit` exit 0; prettier limpio; build OK (`check-out: out OK`).

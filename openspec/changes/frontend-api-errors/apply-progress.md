# Apply progress: frontend-api-errors

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

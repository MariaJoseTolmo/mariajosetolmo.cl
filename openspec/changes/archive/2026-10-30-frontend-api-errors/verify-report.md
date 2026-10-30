# Verify report: frontend-api-errors

**Cambio**: `frontend-api-errors` · **Base**: `main` @ `582d418` (PRs #48 A, #49 B, #50 C, #51 D mergeados)
**Modo**: Strict TDD · **Artifact store**: openspec (+ engram `sdd/frontend-api-errors/verify-report`)
**Fecha**: 2026-10-30

## Veredicto

**PASS WITH WARNINGS**: 0 CRITICAL, 5 WARNING (2 aceptados por la usuaria), 4 SUGGESTION. Los 68 escenarios están cubiertos por tests que pasan en ejecución. Todas las suites y chequeos de calidad terminan con exit 0.

## Completitud

| Métrica | Valor |
|---------|-------|
| Tareas de implementación (1.1–7.4) | 36/36 `[x]` |
| Puntos de decisión | D-A, D-C, D-D `[x]`; D-B `[ ]` (sin acción de apply; este verify comprueba que se cumple, ver abajo) |
| Cierre por PR (C1–C3) | plantilla `[ ]`; la evidencia está en apply-progress y en este reporte |
| Cierre del cambio (F1–F3) | `[ ]`; F2 y F3 los ejecuta este verify; F1 sin evidencia |

**D-B comprobado**: `api-error-contract` usa `INVALID_TOKEN` y un catálogo de 10 códigos con `INTERNAL_ERROR`. `web-api-errors` usa el campo `error` (no `kind`) y `status` opcional, y define que sin `code` no hay `reason`. Los tres ajustes están en las specs delta.

**`size:exception` (C1)**: decisión (c), 4 PRs, `stacked-to-main`. Medido: PR A ~1.320 líneas, PR C ~373, PR D ~920. El PR B está documentado como cubierto. El total bajo `apps/` es de 77 archivos, +3.472 / -458.

## Ejecución

| Comando | Resultado |
|---------|-----------|
| `npm run test:cov -w apps/api` | 59 suites, 623 tests, exit 0. Cobertura: 100 % líneas, 95,41 % ramas, 100 % funciones |
| `npm run test:e2e -w apps/api` | 12 suites, 188 tests, exit 0 |
| `npm run test:int -w apps/api` (compose 55432/56379 activo) | 9 suites, 104 tests, exit 0, con `DATABASE_URL=postgres://webcv:…@127.0.0.1:55432/webcv` y `REDIS_URL=redis://127.0.0.1:56379` (ver S2) |
| `npm run lint:boundaries` | exit 0 |
| `npm run test:cov -w apps/web` | 90 suites, 1395 tests, exit 0. Cobertura: 99,87 % sentencias, 99,34 % ramas, 99,48 % funciones, 100 % líneas |
| `npm run typecheck` (raíz) | exit 0 |
| `npx eslint . --max-warnings 0` | exit 0 (exit code propio de ESLint) |
| `npx prettier --check .` | exit 0 |
| `npm run build -w apps/web` | exit 0 (`check-out: out OK`) |
| `gitleaks detect` (HEAD~10..HEAD, los 4 PRs) | sin hallazgos |
| `rg` de ARNs, IDs de cuenta y emails reales (change + código nuevo) | sin hallazgos (solo `*.example.test` y `nombre@empresa.com`) |

## Matriz de cumplimiento de specs

Las rutas de la API son relativas a `apps/api/`; las de la web, a `apps/web/src/`.

### api-error-contract (15/15)

| Escenario | Test | Resultado |
|-----------|------|-----------|
| Forma completa en error de dominio | `test/error-contract.e2e-spec.ts:105` (limit=0) | COMPLIANT |
| Error de guard con la misma forma | `test/error-contract.e2e-spec.ts:113` | COMPLIANT |
| Ruta inexistente | `test/error-contract.e2e-spec.ts:58`, `:145` | COMPLIANT |
| JSON malformado | `test/error-contract.e2e-spec.ts:33` | COMPLIANT |
| Cuerpo demasiado grande (413) | `test/error-contract.e2e-spec.ts:44` | COMPLIANT |
| Excepción desconocida | `test/error-contract.e2e-spec.ts:223` + `api-exception.filter.spec.ts` | COMPLIANT |
| Los tres 403 se distinguen por code | `test/error-contract.e2e-spec.ts:118`, `:127`, `:137` | COMPLIANT |
| Cambiar el message no cambia el code | `test/error-contract.e2e-spec.ts:202` | COMPLIANT |
| Token desconocido/vencido/usado/mal formado | `test/auth-verify.e2e-spec.ts:234`, `:299` (D-C) | COMPLIANT |
| Refresh siempre UNAUTHENTICATED | `test/refresh.e2e-spec.ts:192` | COMPLIANT |
| 429 y 503 | `test/error-contract.e2e-spec.ts:150`, `:173`; `test/postgres-down.e2e-spec.ts` | COMPLIANT |
| Magic-link no depende del correo | `test/auth-magic-link.e2e-spec.ts:79`, `:102`, `:128`, `:148`, `:161` | COMPLIANT |
| Todo error trae un code del catálogo | `test/error-contract.e2e-spec.ts:72` (matriz) | COMPLIANT |
| Code desconocido | `test/error-contract.e2e-spec.ts:187` | COMPLIANT |
| Catálogo API igual al de la web | `apps/web/src/lib/api/error-codes.test.ts:5` | COMPLIANT |

**Anti-enumeración (API)**: lo prueba `apps/api/test/auth-magic-link.e2e-spec.ts`, bloque `no answer depends on whether the email exists` (`:55`):
- `:79`: un correo registrado, uno nuevo y ambos con el límite por email agotado reciben el mismo 202, con bytes idénticos (`new Set(shape).size === 1`) y sin `code`.
- `:102`: con Origin ajeno (`ORIGIN_NOT_ALLOWED`) y sin viewer address (`CDN_REQUIRED`), el 403 es idéntico para el correo registrado y el desconocido.
- `:128`: el 429 por IP es idéntico, `Retry-After` incluido.
- `:148`: el 503 es idéntico.
- `:161`: el 400 por formato también.

En la web, lo cubre `features/login/LoginContainer.test.tsx:533`: mismo `failure` y mismo DOM para los dos correos.

### api-content-endpoints (3/3)

| Escenario | Test | Resultado |
|-----------|------|-----------|
| limit inválido | `test/content.e2e-spec.ts:185-216` (`it.each`) | COMPLIANT |
| cursor inválido (`<script>`) | idem (`cursor=%3Cscript%3E`) | COMPLIANT |
| cursor por encima del máximo seguro | idem (claves exactas + sin eco) | COMPLIANT |

### web-api-errors (32/32)

| Requisito | Escenario | Test | Resultado |
|-----------|-----------|------|-----------|
| Modelo | El code manda sobre el status | `lib/api/errors.test.ts:91`; `lib/api/http.test.ts:515` | COMPLIANT |
| Modelo | Sin code: se deriva del status | `lib/api/errors.test.ts:113`; `lib/api/http.test.ts:570` | COMPLIANT |
| Modelo | Cuerpo no JSON | `lib/api/errors.test.ts:120`; `content/apiErrors.test.ts:48` | COMPLIANT |
| Modelo | Code desconocido | `lib/api/errors.test.ts:127` | COMPLIANT |
| Modelo | Entrada inválida | `lib/api/errors.test.ts:99`, `:134` | COMPLIANT |
| Modelo | Fallo de red sin status | `lib/api/http.test.ts:563` | COMPLIANT |
| Modelo | Cuerpo de error ilegible | `lib/api/http.test.ts:551` | COMPLIANT |
| Refresh | Rechazado por sesión | `lib/api/http.test.ts:186`, `:622` | COMPLIANT |
| Refresh | Bloqueado por el CDN | `lib/api/http.test.ts:629` | COMPLIANT |
| Refresh | Limitado | `lib/api/http.test.ts:640` | COMPLIANT |
| Retry-After | Válido | `lib/api/errors.test.ts:49`; `lib/apiErrorMessage.test.ts:68` | COMPLIANT |
| Retry-After | Ausente o inválido | `lib/api/errors.test.ts:49` (tabla); `lib/apiErrorMessage.test.ts:87` | COMPLIANT |
| Retry-After | Redondeo 30/61/7200 | `lib/apiErrorMessage.test.ts:7` | COMPLIANT |
| Retry-After | Sin cuenta atrás | `features/login/LoginContainer.test.tsx:517` (timers falsos) | COMPLIANT |
| Diccionario | Message nunca en el DOM | `LoginContainer.test.tsx:557`; `RecruiterZone.test.tsx:294`, `:694`; `ApiPlayground.test.tsx:296`; fakes de verify con `message` "CloudFront" | COMPLIANT |
| Diccionario | 403 por CDN u Origin | `content/apiErrors.test.ts:38`; `VerifyContainer.test.tsx:416` | COMPLIANT |
| Diccionario | 403 por rol | `content/apiErrors.test.ts:43`; `VerifyView.test.tsx:155` | COMPLIANT |
| Diccionario | Sobrescritura por pantalla | `lib/apiErrorMessage.test.ts:34` (override `SERVICE_UNAVAILABLE`) | COMPLIANT |
| Diccionario | Orden de resolución | `lib/apiErrorMessage.test.ts:43` | COMPLIANT |
| Reintento | 503 con botón | `RecruiterZone.test.tsx:261` | COMPLIANT |
| Reintento | Login sin reintento automático | `LoginContainer.test.tsx:506` | COMPLIANT |
| Reintento | Botón de envío como Reintentar | `LoginForm.test.tsx:261`; `LoginContainer.test.tsx:357` | COMPLIANT |
| ARIA | Roles por tipo | `LoginContainer.test.tsx:335` (alert); `RecruiterZone.test.tsx:245` (status) | COMPLIANT |
| ARIA | Accesibilidad (axe 0) | `LoginContainer.test.tsx:493`; `VerifyContainer.test.tsx:371`; `RecruiterZone.test.tsx:294`, `:662`, `:694`; `ApiPlayground.test.tsx:290`, `:296` | COMPLIANT |
| Mock | Simula errores | `lib/api/mock/index.test.ts:130`, `:191` | COMPLIANT |
| Mock | Un solo uso | `lib/api/mock/index.test.ts:211` | COMPLIANT |
| Verify | 403 no es enlace inválido | `VerifyContainer.test.tsx:416`; `VerifyView.test.tsx:92` | COMPLIANT |
| Verify | Token inválido en sus cuatro causas | `VerifyContainer.test.tsx:453` | COMPLIANT |
| Verify | 429 y 503 en verify | `VerifyContainer.test.tsx:493`, `:522` | COMPLIANT |
| Zona | Causas distintas | `RecruiterZone.test.tsx:230` | COMPLIANT |
| Zona | Error en CV | `RecruiterZone.test.tsx:458` | COMPLIANT |
| Zona | Error en logout | `RecruiterZone.test.tsx:607` | COMPLIANT |

### web-recruiter-access (18/18)

| Requisito | Escenario | Test | Resultado |
|-----------|-----------|------|-----------|
| Enviado | Respuestas 2xx distintas, misma UI | `LoginContainer.test.tsx:136-158` | COMPLIANT |
| Enviado | Estado sent accesible | `LoginContainer.test.tsx:194`, `:279`; `SentView.test.tsx:71` | COMPLIANT |
| Enviado | Errores no 2xx no muestran "enviado" | `LoginContainer.test.tsx:335` | COMPLIANT |
| Enviado | Reintentar en 503 y red | `LoginContainer.test.tsx:357`, `:457`; `LoginForm.test.tsx:261` | COMPLIANT |
| Enviado | Ningún error depende del correo | `LoginContainer.test.tsx:533` + API `auth-magic-link.e2e-spec.ts:55` | COMPLIANT |
| Enviado | 429 con tiempo | `LoginContainer.test.tsx:388`, `:517` | COMPLIANT |
| Guard | Estado de verificación | `RecruiterZone.test.tsx:98` | COMPLIANT |
| Guard | Un solo refresh | `lib/api/http.test.ts:651`, `:186` | COMPLIANT |
| Guard | Refresh recupera la sesión | `RecruiterZone.test.tsx:718` (adaptador `http` real) | COMPLIANT |
| Guard | Refresh bloqueado no redirige | `lib/api/http.test.ts:629` + `RecruiterZone.test.tsx:277` | COMPLIANT |
| Guard | Sin sesión | `RecruiterZone.test.tsx:172` | COMPLIANT |
| Guard | Error de red no cierra la sesión | `RecruiterZone.test.tsx:182` | COMPLIANT |
| Guard | 403, 429 y 5xx con copy propio | `RecruiterZone.test.tsx:230` | COMPLIANT |
| Playground | Cinco endpoints con aria-pressed | `ApiPlayground.test.tsx:72` | COMPLIANT |
| Playground | Cambio de selección | `ApiPlayground.test.tsx:97` | COMPLIANT |
| Playground | 403 en admin | `ApiPlayground.test.tsx:116` | COMPLIANT |
| Playground | Línea explicativa en 4xx/5xx | `ApiPlayground.test.tsx:116-136`, `:140`; `ResponseViewer.test.tsx:56`, `:116` | COMPLIANT |
| Playground | Sin línea en 2xx | `ApiPlayground.test.tsx:133`; `ResponseViewer.test.tsx:136` | COMPLIANT |

**Total: 68/68 COMPLIANT, 0 PARTIAL, 0 MISSING.**

## Coherencia con el diseño

| Decisión | ¿Se sigue? | Nota |
|----------|------------|------|
| A1: un filtro `@Catch()` con tres ramas | Sí | `apps/api/src/shared/infrastructure/http/api-exception.filter.ts:98` |
| A2: `INVALID_TOKEN` | Sí | |
| A3: unión `DomainErrorCode` + `Record` exhaustivo | Sí | `api-exception.filter.ts:29` |
| A4: los guards lanzan `DomainError` | Sí | test estático `no-http-exception.spec.ts` |
| A5: `HttpException` por status, `message` fijo | Sí, con matiz | body-parser llega como `Error` con `statusCode` (W1). Los 4xx de dominio conservan su `message` (W2) |
| A6: `ApiFailure` con campo `error` | Sí | |
| A7: `reason` solo desde `code` | Sí | |
| A8: `Retry-After` solo en segundos | Sí | |
| A9: test de contrato en `apps/api/test` | Desviación permitida | Vive en `apps/web/src/lib/api/error-codes.test.ts`; la tarea 3.1 lo permite (S1) |
| A10: mock one-shot | Sí | |
| A11: refresh 400/401 -> `unauthorized` | Sí | |
| A12: un solo botón "Reintentar" | Sí | |

## TDD Compliance

| Check | Resultado | Detalle |
|-------|-----------|---------|
| Evidencia TDD reportada | Sí | Tablas en los 4 lotes de `apply-progress.md` |
| Todas las tareas con tests | Sí | 36/36 (3.5 y 5.5 sin código de producto) |
| RED confirmado (los tests existen) | Sí | Todos los archivos citados existen y corren |
| GREEN confirmado (pasan hoy) | Sí | 623 + 188 + 104 tests de API y 1395 de web, en verde |
| RED como fallo de aserción en ejecución | Parcial | Ver W3 |
| Triangulación / Safety net | No reportado | Faltan las columnas en la tabla (W4); la triangulación se ve en las tablas `it.each` |

### Distribución por capa

| Capa | Archivos principales | Herramienta |
|------|----------------------|-------------|
| Unit API | `api-exception.filter.spec.ts`, `api-error-code.spec.ts`, `errors.spec.ts`, `auth-errors.spec.ts`, specs de guards y resolvedor, `no-http-exception.spec.ts` | Jest |
| E2E HTTP API | `error-contract`, `auth-magic-link`, `auth-verify`, `refresh`, `content`, `me`, `admin`, `cv`, `postgres-down` | Jest + supertest |
| Integración API | 9 suites contra Postgres y Redis reales | Jest + compose |
| Unit web | `errors`, `http`, `error-codes`, `apiErrorMessage`, `apiErrors`, `mock/index`, reducers | Jest (SWC) |
| Componentes web | Login, Verify, RecruiterZone, CvCard, playground | Testing Library + jest-axe |

### Cobertura de los archivos cambiados

Web: `errors.ts`, `http.ts`, `error-codes.ts`, `apiErrorMessage.ts`, `mock/index.ts`, `LoginContainer`, `LoginForm`, `loginReducer`, `loginOverrides`, `VerifyContainer`, `VerifyView`, `verifyReducer`, `CvCard`, `useRecruiterSession`, `recruiterOverrides` y `ResponseViewer` llegan al 100 % en todas las métricas. `RecruiterZone.tsx` tiene 100 % de líneas y 91,66 % de funciones (S3).
API: 100 % de líneas en el total del paquete.

### Calidad de las aserciones

No hay tautologías, ni aserciones sin llamada a producción, ni ghost loops en los tests del cambio. El `for` de `auth-magic-link.e2e-spec.ts:97` recorre un arreglo cuyo largo 4 se afirma antes. Varios RED se demostraron por mutación (S1 de lote 4, 4.2, 6.1, 7.3, W2 de lote 2).

## Issues

### CRITICAL
Ninguno.

### WARNING
- **W1 (aceptado por la usuaria, PR A)**: `apps/api/src/shared/infrastructure/http/api-exception.filter.ts:85-92`. `httpStatusOf` usa duck typing sobre `statusCode`, así que un error de una librería de terceros con `statusCode` 4xx se traduciría como 4xx (`INVALID_INPUT`/`NOT_FOUND`…) y no como 500. Queda clasificado; no se reabre.
- **W2 (aceptado por la usuaria, PR A)**: `api-exception.filter.ts:139-143`. Los 4xx de dominio exponen `error.message`. Esos textos son propios y no repiten la entrada (lo prueban `content.e2e-spec.ts:201` y la matriz del contrato). Queda clasificado; no se reabre.
- **W3**: varias tareas no tuvieron un RED de aserción en ejecución, como exige `tasks.md:3`:
  - RED de compilación: 1.2, 1.3, 1.5 y 1.7.
  - Sin RED de producto, porque el contrato ya se cumplía: 1.8, 2.1, 2.3, 2.4, 2.5, 2.6, 3.5, 4.2, 5.5, 6.3 y 7.4.
  
  Varias se compensaron con mutaciones manuales. Evidencia: `apply-progress.md:169-182`, `:224-226`, `:280`, `:328`, `:333`.
- **W4**: las tablas de evidencia TDD (`apply-progress.md:166`, `:218`, `:274`, `:322`) no tienen las columnas TRIANGULATE ni SAFETY NET, así que el safety net de los archivos modificados no se puede auditar con el protocolo.
- **W5**: hay casillas de `tasks.md` sin marcar aunque hay evidencia: D-B (`:51`, verificado aquí), C1–C3 (`:57-59`), F1–F3 (`:120-122`). F2 (gitleaks/rg) y F3 (este verify) se ejecutaron aquí. F1, la revisión de contexto fresco de todo el diff, no tiene evidencia en los artefactos.

### SUGGESTION
- **S1**: registrar en el design (A9) que el test de contrato quedó en `apps/web/src/lib/api/error-codes.test.ts`, que importa la API por ruta relativa.
- **S2**: `npm run test:int -w apps/api` con los valores por defecto (`127.0.0.1:5432`) apunta a otro Postgres local y fallan 87 tests (`role "webcv" does not exist`). Con `DATABASE_URL`/`REDIS_URL` hacia 55432/56379 pasan los 104. Conviene documentarlo o derivarlo de `POSTGRES_HOST_PORT`.
- **S3**: `apps/web/src/features/recruiter/RecruiterZone.tsx`: 91,66 % de funciones. Es informativo; las líneas están al 100 %.
- **S4**: el test de 400 de anti-enumeración (`auth-magic-link.e2e-spec.ts:161`) compara dos direcciones mal formadas. Es correcto porque una dirección inválida no puede estar registrada. No requiere acción.

## Próximo paso

`sdd-archive`. Antes de archivar, conviene que la usuaria marque D-B, C1–C3 y F2–F3 en `tasks.md` y decida si F1 hace falta.

# Exploración: admin-visits

**Proyecto**: mariajosetolmo.cl · **Cambio**: `admin-visits` · **Fecha**: 2026-10-30
**Espejo en Engram**: `sdd/admin-visits/explore` (#766)

## 1. Estado actual

### API (`apps/api`)

**Qué devuelve hoy `GET /api/v1/admin/visits`:**

- `AdminVisitsController` (`src/admin/infrastructure/http/admin-visits.controller.ts`) está marcado `@Roles('ADMIN')`, oculto de Swagger con `@ApiExcludeController()` y delega en `ListVisits`.
- `ListVisits` (`src/admin/application/list-visits.use-case.ts`) es un stub síncrono: `execute(): never[]` devuelve `[]`. Su comentario dice que registrar visitas reales quedó fuera del alcance.
- `AdminModule` solo declara el controlador y ese proveedor. No hay puerto, adaptador, entidad ni migración.
- La spec `api-recruiter-endpoints`, requisito "Stub de /api/v1/admin/visits", exige: RECRUITER recibe 403 JSON, ADMIN recibe 200 con `[]`, sin sesión recibe 401. Dice textualmente que "el registro real de visitas queda fuera del alcance".
- `api-error-contract` ya fija que el 403 de RECRUITER en esta ruta responde `code: ROLE_NOT_ALLOWED`.
- Tests que tocan la ruta: `apps/api/test/admin.e2e-spec.ts`, `list-visits.use-case.spec.ts`, `error-contract.e2e-spec.ts`, `no-store.spec.ts`.

**Convenciones reutilizables:**

- **Paginación** (slice `content`): `PageLimit` (entero 1..50, por defecto 5), `ExperienceCursor` (keyset numérico, `InvalidInput` si es inválido) y la respuesta `{ items, next }`, donde `next` es la URL relativa de la página siguiente o `null`. El repositorio devuelve una fila extra para saber si hay más.
- **Errores**: `ApiExceptionFilter` con `code` estable (`API_ERROR_CODES`: `INVALID_INPUT`, `UNAUTHENTICATED`, `ROLE_NOT_ALLOWED`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, …). Hay un espejo en la web con test de contrato.
- **Persistencia**: TypeORM con DataSource lazy y migraciones en SQL plano, una sentencia por llamada, compatibles con pooler (`users`, `refresh_tokens`, `availability`, `content`). Cada adaptador implementa un puerto y existe una variante en memoria para tests.
- **Rate limit**: puerto `RateLimiter.hit(key)` con adaptador Redis de ventana fija. La clave guarda un hash, nunca la IP ni el correo.

### Web (`apps/web`)

- No existe pantalla de visitas. `/api/v1/admin/visits` aparece solo como uno de los cinco endpoints del playground (`playground-endpoints.ts`, `types.ts`).
- En el mock (`lib/api/mock/index.ts`) responde 403 como dato, porque el usuario del playground es RECRUITER. La spec `web-recruiter-access` ("403 en admin", "Línea explicativa en 4xx y 5xx") depende de ese 403.
- No hay ninguna telemetría ni analítica en el sitio. Una búsqueda de `analytics`, `beacon`, `telemetry` y `tracking` en specs y docs no encontró nada.
- CSP vigente (`apps/web/docs/delivery-contract.md`): `default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; ...` y `Referrer-Policy: no-referrer`. Un beacon al mismo dominio (`/api/*`) no requiere cambiar la CSP. Cualquier analítica de terceros, sí.

## 2. Qué significa "visita" aquí

| Tipo                                    | Origen hoy                                                                                             | ¿Hay dato?                                                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visita pública (página vista)           | Sitio estático en S3/CloudFront, sin llamada a la API                                                  | No. Solo existirían logs de CloudFront si se activan.                                                                                                                                                                                             |
| Sesión de reclutador (login)            | `VerifyMagicLink` crea `users.last_login_at` y una fila en `refresh_tokens` con `family_id` nuevo      | Parcial. `last_login_at` guarda solo el último login por usuario. `refresh_tokens` conserva un `family_id` por login, pero la rotación genera más filas con el mismo `family_id`, y se puede perder la historia si se limpian o se borran en cascada con el usuario. No está pensado como bitácora. |
| Acción de reclutador (enlace de CV)     | `GetCvLink`                                                                                            | No. Está documentado que "nothing is cached, stored or logged".                                                                                                                                                                                   |
| Actividad de lectura (`/me`, contenido) | Casos de uso de lectura                                                                                | No se registra.                                                                                                                                                                                                                                   |
| Redis                                   | Solo claves `rl:*` con hash y TTL de ventana                                                           | No sirven como historial.                                                                                                                                                                                                                         |

**Conclusión:** hoy no hay una fuente de visitas reutilizable. Tanto las sesiones como las acciones del CV requieren un registro nuevo. Para el administrador, lo relevante es saber qué reclutador (empresa) entró y cuándo descargó el CV, que es dato ya identificado y consentido por el magic link. Las visitas públicas anónimas son un problema distinto, de mayor riesgo de privacidad y de abuso.

## 3. Áreas afectadas

**API:**

- `src/admin/`: nuevo puerto `VisitRepository` (o `ActivityRepository`), adaptadores TypeORM y en memoria, `ListVisits` real con `PageLimit` y cursor keyset, DTO de respuesta, módulo.
- `src/auth/application/verify-magic-link.use-case.ts` y `src/cv/application/get-cv-link.use-case.ts`: emitir un evento o llamar a un puerto de registro. Hay que cuidar las fronteras de ESLint entre slices (auth y cv no deben importar la infraestructura de admin).
- `src/shared/infrastructure/persistence/migrations/` + `index.ts`: tabla nueva y su política de retención.
- Si se elige el beacon: un controlador público nuevo con `@Public()`, rate limit y CSP/CloudFront para la ruta.
- Specs: `api-recruiter-endpoints` (MODIFIED, se elimina el stub), `api-error-contract` (códigos nuevos solo si aparecen) y una capacidad nueva `api-admin-visits`.

**Web:**

- Ninguna obligatoria. El playground sigue mostrando 403 como dato para RECRUITER. Una pantalla de administración es opcional y quedaría fuera de este cambio.
- Si se elige el beacon: un hook en el export estático, la regla `fetch-guard` (solo se permite `fetch(` bajo `src/lib/api/http`), y la spec `web-delivery-contract`.

## 4. Alternativas

### 4.1 Fuente de datos

| Opción                                                                                    | Ventajas                                                                                                                                                                                                       | Desventajas                                                                                                                                                                                                                                                                                                | Esfuerzo                   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **A. Eventos de reclutador en Postgres (login + CV), desde los casos de uso existentes** | Datos ya identificados y consentidos. Sin rastreo anónimo, sin cookies nuevas, sin cambio de CSP. Una escritura por login o por CV, volumen mínimo (cabe holgado en el plan gratuito de Neon). Hexagonal y testeable. | No cuenta visitantes públicos. Si el CV se pide muchas veces, hay que decidir si se registra cada pedido. Escritura adicional en el camino de verify y de CV.                                                                                                                                             | Medio                      |
| B. Beacon sin cookies desde la web estática (`POST /api/v1/…/pageview`), contador agregado por día y ruta | Mide tráfico público. Sin IP ni user agent guardados. Mismo dominio, sin cambio de CSP.                                                                                                                        | Endpoint público: abuso, inflación por bots, rate limit por IP hasheada con sal rotativa. Cold start de Lambda en cada página vista. Escritura a Neon en cada hit si no se agrega con Redis (`INCR` diario y volcado periódico). Tráfico `POST` pasa por `OriginGuard`. Desmejora el modelo "sitio 100 % estático". Necesita consentimiento o aviso de privacidad. | Alto                       |
| C. Logs estándar de CloudFront / métricas de CloudWatch leídos por la API                 | Cero código en el cliente. Cubre todo el tráfico, incluido el estático.                                                                                                                                         | Los logs contienen IP completa (dato personal) y user agent. Hay que enviarlos a S3, consultarlos con Athena (costo y latencia) o procesarlos con otra Lambda. La API necesitaría permisos de lectura nuevos. Mala fit para una respuesta paginada de la API. Retención y borrado por configuración aparte. | Alto                       |
| D. Analítica de terceros (Plausible, Umami, Cloudflare/Vercel Web Analytics, GA)          | Sin código de backend.                                                                                                                                                                                         | Cuesta (Plausible desde ~USD 9/mes) o implica autoalojar. Requiere abrir la CSP (`script-src`/`connect-src`), rompe `connect-src 'self'` y el principio de "sin terceros". El administrador tendría que consultar el panel externo, no `/admin/visits`. No cumple el requisito de que el endpoint devuelva datos reales. | Bajo en código, alto en política |

### 4.2 Qué registrar en A y qué no

| Dato                                          | Decisión sugerida                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `user_id` (FK a `users`, `ON DELETE CASCADE`) | Sí. Permite borrar el historial al borrar al usuario (derecho de supresión).                                           |
| `kind`: `LOGIN` y `CV_LINK`                   | Sí. `CHECK` en la base, enum en el dominio.                                                                            |
| `occurred_at` (`timestamptz`)                 | Sí.                                                                                                                    |
| IP, user agent, correo                        | No. El correo ya está en `users`. La respuesta a ADMIN muestra empresa y nombre, no correo (ver pregunta 2).           |
| Retención                                     | Borrado por antigüedad (p. ej. 90 o 180 días), mediante una purga en cada escritura o una tarea programada. Hay que decidirlo (pregunta 3). |

### 4.3 Forma de la respuesta y paginación

Consistente con `content` y con el contrato de error vigente:

```
GET /api/v1/admin/visits?limit=20&cursor=<opaco>&kind=LOGIN
200 {
  "items": [
    { "id": "…", "kind": "LOGIN" | "CV_LINK", "occurredAt": "ISO-8601 UTC",
      "recruiter": { "company": "…" | null, "name": "…" | null } }
  ],
  "next": "/api/v1/admin/visits?cursor=…&limit=20" | null
}
```

- **Orden y keyset:** `occurred_at DESC, id DESC`. El cursor debe ser compuesto (`occurredAt` + `id`), porque dos eventos pueden compartir marca de tiempo. A diferencia de `ExperienceCursor`, que es un entero, esto exige un cursor opaco codificado en base64url, validado con `InvalidInput` ante basura. No se puede reutilizar tal cual la clase de `content`, pero sí la mecánica de "pedir una fila de más".
- **`limit`:** reutilizar `PageLimit` (1..50). Por defecto 5 es bajo para un listado de administración, así que conviene decidir si el default cambia solo aquí (parámetro) o se mantiene.
- **Cambio de contrato:** hoy el cuerpo es un arreglo `[]`. Pasar a `{ items, next }` es un cambio incompatible, pero el único consumidor es el playground, y el stub no tiene cuerpo real. Hay que modificar la spec del stub.
- **Errores:** 400 `INVALID_INPUT` (limit, cursor o `kind` inválidos), 401 `UNAUTHENTICATED`, 403 `ROLE_NOT_ALLOWED`, 503 `SERVICE_UNAVAILABLE` si cae Postgres. Sin códigos nuevos.
- **Caché:** debe seguir con `Cache-Control: no-store` (ya cubierto por `bootstrap/no-store`).
- **Opcional más adelante:** `GET /api/v1/admin/visits/summary` con conteos por día. Queda fuera del primer corte.

### 4.4 Costo, cold starts y abuso

- **Opción A:** una inserción por login o por pedido de CV. Con tráfico de reclutadores (decenas al mes) el costo en Neon y Lambda es despreciable, muy por debajo de USD 20. La inserción debe ser no bloqueante para el éxito del login: si falla el registro, el login no debe fallar. Hay que decidir y testear esa política (best effort con log de error).
- **Opción B:** cada página vista dispara una Lambda; con rate limit por IP hasheada y contadores en Redis el costo sigue acotado, pero los bots inflan el dato y no se pueden distinguir sin fingerprinting, que está descartado por privacidad.
- **Opción C:** Athena cobra por dato escaneado y los logs de CloudFront en S3 acumulan almacenamiento. Es la opción con más costo oculto.

### 4.5 Privacidad (Ley 19.628 y expectativas tipo GDPR)

- A trata datos de personas ya identificadas que se autenticaron con magic link. Basta con un aviso de privacidad en el login y una retención acotada. El historial se borra con el usuario (`ON DELETE CASCADE`).
- B y C implican tratar IP o equivalentes de personas anónimas. Si se hace B, la IP no se guarda y solo se usa un hash con sal rotativa diaria para el rate limit, nunca persistido.
- El repositorio es público: ningún dato real en fixtures, specs ni migraciones. Los tests usan datos sintéticos.

### 4.6 Anti-enumeración

- El registro no debe revelar si un correo existe. Solo se registra un evento tras un `verify` exitoso, es decir, cuando ya hay sesión. El flujo de `magic-link` y su respuesta 202 idéntica no cambian.
- `GET /admin/visits` no debe mostrar correos de otros usuarios sin necesidad.

## 5. Recomendación

1. **Cambio principal: opción A.** Registrar `LOGIN` y `CV_LINK` en una tabla `visit_events` (nombre a decidir) desde `VerifyMagicLink` y `GetCvLink`, a través de un puerto de aplicación, con adaptadores TypeORM y en memoria.
2. **Listado:** `{ items, next }` con cursor keyset compuesto opaco, `PageLimit` reutilizado y filtro opcional `kind`.
3. **Privacidad por defecto:** sin IP, sin user agent, sin correo en la respuesta; retención acotada y borrado en cascada con el usuario.
4. **Resiliencia:** un fallo al registrar el evento no rompe el login ni la entrega del CV.
5. **Visitas públicas (opción B):** diferir a un cambio posterior, con su propia decisión de privacidad. Descartar C y D para este cambio.
6. **Spec:** `api-recruiter-endpoints` pasa el requisito del stub a MODIFIED/REMOVED y nace `api-admin-visits`.

## 6. Corte en PRs (stacked-to-main, ~400 líneas)

| PR             | Contenido                                                                                                                                    | Líneas aprox. |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1              | Migración `visit_events`, dominio (`VisitKind`, cursor compuesto), puerto `VisitRepository`, adaptadores TypeORM y en memoria, specs unitarias | 350–450       |
| 2              | Registro de `LOGIN` y `CV_LINK` desde `VerifyMagicLink` y `GetCvLink` (best effort), cableado de módulos, tests de casos de uso               | 250–400       |
| 3              | `ListVisits` real, controlador, DTO, paginación, `kind`, e2e (200 ADMIN, 401, 403, 400, 503), spec MODIFIED y nueva `api-admin-visits`, mock/playground si cambia la forma | 350–500       |
| 4 (opcional)   | Purga por retención y resumen diario                                                                                                         | 200–300       |

Total estimado: 950–1.300 líneas, repartidas en tres o cuatro PRs. Si se agrega la opción B, sería un cambio aparte.

## 7. Riesgos

- **Cambio incompatible de contrato** (`[]` → `{ items, next }`): el único consumidor es el playground, pero la spec y el mock deben actualizarse a la vez.
- **Cursor compuesto:** `ExperienceCursor` es un entero y no sirve; un cursor mal validado puede dar 500 en lugar de 400.
- **Acoplamiento entre slices:** `auth` y `cv` no deben importar infraestructura de `admin`. Hace falta un puerto compartido o un evento de dominio, respetando las fronteras de ESLint.
- **Latencia y fallos en rutas críticas:** una escritura extra en `verify` y en el CV; no debe bloquear ni hacer fallar la respuesta.
- **Crecimiento de la tabla** si no hay retención; Neon gratuito tiene límite de almacenamiento.
- **Dato personal en repositorio público:** fixtures y logs sin datos reales.
- **Derecho de supresión:** si el historial no se borra con el usuario, queda un hueco de cumplimiento.
- **Si luego se agrega el beacon:** inflación por bots, abuso del endpoint público y cold starts.
- **Rutas con `no-store`:** hay que mantener la cabecera en el nuevo cuerpo.

## 8. Fuera del alcance

- Pantalla de administración en la web.
- Páginas vistas anónimas (opciones B, C y D).
- Geolocalización, user agent, huella digital del navegador.
- Exportación de datos y gráficos.
- Notificaciones al administrador.
- Eliminación de usuarios por solicitud (se asume que `ON DELETE CASCADE` ya lo habilita).

## 9. Preguntas abiertas

1. ¿Qué significa "visita" para este cambio: solo actividad de reclutadores (login y enlace de CV, opción A) o también páginas vistas públicas anónimas (opción B, cambio aparte)?
2. ¿Qué datos ve el ADMIN por evento: empresa y nombre (recomendado), el correo completo, o solo un identificador de usuario?
3. ¿Qué retención se aplica al historial: 90 días, 180 días, o sin límite hasta que se borre el usuario?
4. ¿Se registra cada pedido de enlace de CV o solo el primero por sesión/día, para que un reclutador que reintenta no infle el listado?

# Exploración: content-endpoints

**Proyecto**: web_cv · **Cambio**: `content-endpoints` · **Fecha**: 2026-10-22
**Espejo en Engram**: `sdd/content-endpoints/explore` (#717)

## 1. Estado actual

### API (`apps/api`)

**Slices y rutas:**
- Hay slices hexagonales `health`, `auth`, `identity`, `availability`, `admin`, `cv`, `shared`, `config` y `bootstrap`. No existe un módulo de contenido.
- Las tres rutas de contenido responden 404 porque no existen (decisión D3 de `auth-backend`).
- La spec vigente `openspec/specs/api-recruiter-endpoints/spec.md`, en el requisito "Endpoints de contenido fuera de alcance", exige un 404 en JSON y que las rutas no estén documentadas en Swagger. Ese requisito pasa a MODIFIED.
- `apps/api/test/admin.e2e-spec.ts` verifica el 404 y hay que actualizarlo.

**Autenticación:**
- El guard JWT global niega todo por defecto.
- `@Public()` es la excepción y hoy solo la usan `health` y JWKS.
- Un controlador nuevo queda protegido sin escribir nada.

**Caché:** `bootstrap/no-store.ts` pone `Cache-Control: no-store` en todo `/api/auth` y `/api/v1`.

**Errores:**
- `DomainExceptionFilter` traduce `INVALID_INPUT` a 400 con la forma `{statusCode, error, message}`.
- La validación vive en value objects del dominio. No se usa `class-validator` (decisión A3 del design de `auth-backend`).

**Patrón más cercano, `availability`:**
- Un puerto en `application/ports`.
- Un repositorio TypeORM con SQL plano, `ensureInitialized` (DataSource perezoso) y `withDatabase` (traduce los fallos a 503).
- Una migración con SQL plano, un seed con valores de ejemplo y `COMMENT ON`.
- Las migraciones se registran a mano en `migrations/index.ts`.

**Límites y documentación:**
- `domain` y `application` no pueden importar Nest (salvo `Injectable` e `Inject`) ni typeorm.
- `/admin` se oculta de Swagger con `@ApiExcludeController()`.

**Monorepo:** `workspaces: ["apps/*"]`, sin `packages/`.

### Web (`apps/web`)

**Playground:**
- Llama exactamente a 5 rutas GET de una lista permitida: `/api/v1/profile`, `/api/v1/experience?limit=2`, `/api/v1/skills?level=advanced`, `/api/v1/me` y `/api/v1/admin/visits`.
- Muestra cualquier código y el cuerpo tal cual, sin tiparlo.
- Corre dentro de la zona reclutador, es decir, con sesión.

**Contenido estático:**
- `src/content/experience.ts`: 5 ítems.
- `src/content/stack.ts`: 4 columnas (avanzado, producción, arquitectura, aprendiendo), sin un campo de nivel.
- `home.ts`: un JSON de ejemplo de `/api/v1/profile`.

**Contrato de los mockups aprobados** (`Diseño/html/Zona reclutador-html/Reclutador.dc.html`):

| Ruta | Forma |
|---|---|
| `profile` | `{name, role, architecture, domains[], openToWork}` |
| `experience` | `{items:[{company, role, highlights[]}], next: '/api/v1/experience?cursor=2'}` |
| `skills` | `{level:'advanced', skills:['JavaScript','Node.js','NestJS','PostgreSQL']}` |

**Content-guard:**
- Escanea solo `apps/web`. No cubre `apps/api` ni las migraciones.
- Las reglas del brief (sin sueldo, sin disponibilidad, sin teléfono; los empleadores se muestran por decisión) deben respetarse en los seeds. Conviene un test equivalente en la API.

## 2. Áreas afectadas

- **`apps/api/src/content/**` (nuevo):**
  - dominio: `Profile`, `ExperienceEntry`, `SkillLevel`, `Limit`;
  - aplicación: los casos de uso y el puerto `ContentRepository`;
  - infraestructura: el repositorio TypeORM, los controladores y los DTOs de Swagger;
  - `content.module.ts`.
- **`apps/api/src/app.module.ts`:** importa `ContentModule`.
- **Migraciones:** una nueva, con su registro en `index.ts`.
- **Tests:** `apps/api/test/admin.e2e-spec.ts` (o un e2e nuevo `content.e2e-spec.ts`) y tests de integración.
- **Spec:** `openspec/specs/api-recruiter-endpoints/spec.md` con el requisito de contenido como MODIFIED, y una capacidad nueva `api-content-endpoints`.
- **Web, opcional:** `apps/web/src/content/home.ts` para alinear el ejemplo con la forma real.

## 3. Alternativas

### 3.1 ¿Públicos o con sesión?

| Opción | Ventajas | Desventajas |
|---|---|---|
| **A. Con sesión (recomendado)** | Sin código de guard nuevo. Coherente con el playground de la zona reclutador. El contenido ya es público en el HTML, así que no hay nada secreto. Menos superficie de abuso sobre Neon Free. | Un visitante sin sesión no puede probar los endpoints |
| B. Públicos con `@Public()` | Se pueden probar en Swagger sin login. Permite caché pública. | Abre lecturas a Postgres sin autenticar, exige un rate limit nuevo, choca con `no-store` en `/api/v1` |

### 3.2 Origen de los datos

| Opción | Ventajas | Desventajas |
|---|---|---|
| **A. Tablas Postgres con seed por migración (recomendado)** | Muestra hexagonal real y Postgres. `limit` y `level` se resuelven en SQL. Se edita con UPDATE sin redeploy. | Duplica el contenido de la web, con riesgo de que diverja. SQL de seed largo. |
| B. Paquete compartido `packages/content` | Una sola fuente, sin deriva | Workspace nuevo, cambios de build en las dos apps, ESM/CJS entre Next y Nest. Desproporcionado para cinco filas. |
| C. Constantes en la API | Mínimo código, sin base de datos | Tercera copia del contenido. No muestra manejo de datos. |

Para mitigar la deriva en la opción A:
- ids estables;
- un comentario "espejo de `apps/web/src/content`" en la migración;
- un test de contrato que compruebe que el seed contiene los ids y las empresas del sitio.

### 3.3 Valores de `level`

El sitio no tiene un campo de nivel; el mockup usa `level=advanced`, que coincide con la columna "Avanzado". La propuesta es mapear 1:1 las columnas del sitio: `advanced`, `production`, `architecture` y `learning`.

Queda por decidir qué pasa si falta el parámetro: devolver todos los niveles o responder 400.

### 3.4 Paginación de `experience`

| Opción | Descripción |
|---|---|
| A | Solo `limit`, con `next: null` |
| **B (recomendado)** | `limit` más un `cursor` numérico (offset por `position`), con `next`, como en el mockup |

## 4. Contrato propuesto

**`GET /api/v1/profile`** → 200 `{name, role, architecture, domains[], openToWork}`.
- Sin email, teléfono, sueldo ni fechas.
- Los datos vienen de la tabla `profile`, de fila única.

**`GET /api/v1/experience?limit=<1..50, por defecto 5>[&cursor=<int>]`** → 200 `{items:[{id, company, role, sector, period, highlights[], technologies[]}], next: string|null}`.
- El orden es estable por `position`.
- Un `limit` inválido (`abc`, `2.5`, `-1`, `0`, vacío) devuelve 400 `INVALID_INPUT`.

**`GET /api/v1/skills?level=<advanced|production|architecture|learning>`** → 200 `{level, skills: string[]}`.
- Un enum inválido devuelve 400.

**Validación:** vive en value objects (`Limit.parse`, `SkillLevel.parse`). El 400 nunca repite el valor de entrada.

**Swagger:** las tres rutas quedan documentadas con `@ApiTags('content')` y `@ApiCookieAuth`. `/admin` sigue oculto.

**Caché:** se mantiene `no-store`.

## 5. Esquema (SQL plano, mismo patrón que `availability`)

| Tabla | Columnas |
|---|---|
| `profile` | `id` smallint PK con `CHECK (id=1)`, `name`, `role`, `architecture`, `domains text[]`, `open_to_work boolean` |
| `experience` | `id` text PK, `position` smallint UNIQUE, `company`, `sector`, `role`, `period_label`, `highlights text[]`, `achievement`, `technologies text[]` |
| `skill` | `id`, `level` con un CHECK sobre el enum, `name`, `position`, índice `(level, position)` |

- Una sentencia por `query()`, sin `SET` ni advisory locks. El `down` usa `DROP`.
- El seed toma el contenido público de `experience.ts` y `stack.ts`.

## 6. Fuera del alcance

`/api/v1/admin/visits` con datos reales: requiere un modelo de visitas, decisiones de privacidad y una política de retención. Merece un cambio propio.

## 7. Recomendación

**Decisiones:**
- Endpoints con sesión.
- Tablas Postgres con seed.
- `no-store`.
- Validación en value objects.
- La forma de los mockups.
- Cursor numérico simple.

**Lo que no se toca:** `/admin/visits`. El ejemplo de la home sigue rotulado como ejemplo.

## 8. Tamaño y corte en PRs (stacked-to-main)

| PR | Contenido | Líneas aprox. |
|---|---|---|
| 1 | Dominio, aplicación, puerto, repositorio en memoria, controladores, DTOs, Swagger y la modificación de la spec, con tests unitarios y e2e | 200–250 |
| 2 | Migración con seed, repositorio TypeORM, tests de integración y el cableado del módulo | 150–200 |

El total estimado es de 350 a 450 líneas, aunque los cambios anteriores muestran que Strict TDD multiplica este pronóstico.

## 9. Riesgos

- **Deriva de contenido:** puede haber hasta tres copias (la web, el seed y el ejemplo de la home). Se mitiga con ids estables y un test de contrato.
- **Arranque en frío de Neon:** puede sumar cientos de ms a la primera llamada.
- **TypeORM con el pooler en modo transacción:** NO VERIFICADO (ADR-004). Se mitiga con SQL plano y tests contra Postgres real.
- **Content-guard:** no cubre `apps/api`. Hace falta un test en la API que escanee el seed con reglas equivalentes.
- **Requisito vigente:** el de "404 / sin Swagger" y su e2e quedan inválidos; hay que cambiarlos en el mismo PR para no romper el CI.
- **`openToWork`:** no debe convertirse en una fecha ni en una condición de disponibilidad.

## 10. Preguntas abiertas

1. ¿Con sesión o públicos?
2. ¿Qué valores acepta `level`, y qué pasa si falta?
3. ¿`cursor` y `next` en `experience`, o solo `limit`?
4. ¿Tablas Postgres o constantes en la API?

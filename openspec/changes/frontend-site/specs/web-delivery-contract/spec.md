# Especificación delta: web-delivery-contract

Capacidad NUEVA. Define la forma del artefacto estático (`apps/web/out/`) y el contrato documentado que el cambio de infra debe aplicar en S3 + CloudFront. No incluye infraestructura; solo el contrato y su verificación.

## ADDED Requirements

### Requirement: Configuración de export estático

`apps/web/next.config` MUST declarar `output: 'export'`, `trailingSlash: true` e `images: { unoptimized: true }`. MUST NOT declarar `rewrites`, `redirects` ni `headers` (no funcionan en export).

#### Scenario: Config correcta

- GIVEN el archivo `next.config` cargado por un test
- WHEN se leen sus propiedades
- THEN `output === 'export'`, `trailingSlash === true` e `images.unoptimized === true`

#### Scenario: Sin características de servidor

- GIVEN la misma config
- WHEN se buscan `rewrites`, `redirects` y `headers`
- THEN ninguna está definida

### Requirement: Estructura de out/ verificada por script

El repositorio MUST incluir el script `apps/web/scripts/check-out.js` (CommonJS, para que Jest lo pruebe sin `--experimental-vm-modules`), expuesto como `npm run check:out -w apps/web`. El script `build` de `apps/web` MUST encadenarlo después de `next build`, de modo que el CI lo ejecute sin cambios en `ci.yml`. El script MUST fallar con código distinto de 0 si falta alguno de: `out/index.html`, `out/experiencia/index.html`, `out/acceso/index.html`, `out/acceso/verificar/index.html`, `out/reclutador/index.html`, `out/404.html`, `out/robots.txt`, `out/sitemap.xml` o el directorio `out/_next/static/`. También MUST fallar si encuentra en `out/` `fonts.googleapis.com`, `fonts.gstatic.com`, los marcadores del mock (ver `web-recruiter-access`) o archivos `.pdf`/`.docx`. El script MUST exportar una función testeable (`findViolations(outDir)`) además del modo CLI.

#### Scenario: Build completo pasa

- GIVEN un `out/` recién generado con `NEXT_PUBLIC_API_MODE=http`
- WHEN se ejecuta `npm run check:out -w apps/web`
- THEN el código de salida es 0

#### Scenario: Falta una ruta

- GIVEN un `out/` al que se eliminó `acceso/verificar/index.html`
- WHEN se ejecuta el script
- THEN el código de salida es distinto de 0 y el mensaje nombra el archivo faltante

### Requirement: Documento de contrato para infra

MUST existir en el repo el documento `apps/web/docs/delivery-contract.md`, enlazado desde `apps/web/README.md`, con estas secciones y contenido:

| Sección | Contenido obligatorio |
|---------|-----------------------|
| Reescritura de rutas | CloudFront Function en viewer-request, solo en el behavior por defecto (nunca `/api/*`): si el URI termina en `/`, agregar `index.html`; si no contiene `.`, agregar `/index.html` |
| Página de error | El OAC MUST tener `s3:ListBucket` sobre el bucket, para que S3 responda 404 (no 403) ante una clave inexistente. Solo la respuesta 404 se mapea a `/404.html` con código HTTP 404. La respuesta 403 MUST NOT mapearse: las custom error responses aplican a toda la distribución, `/api/*` incluido, y el 403 real de `/api/v1/admin/visits` MUST llegar intacto al playground. El documento MUST advertir que los 404 de `/api/*` también se reemplazarían por HTML y que infra decide entre aceptarlo o usar Lambda@Edge origin-response solo en el behavior por defecto |
| Caché | `_next/static/*` inmutable (`max-age` largo, `immutable`); HTML con TTL corto o revalidación |
| Cabeceras | Response headers policy con `Content-Security-Policy` y `Referrer-Policy: no-referrer` (no hay `headers()` en export) |
| Origen | Bucket S3 privado con OAC; `/api/*` enruta a otro origen |

El documento MUST NOT contener secretos, IDs de cuenta ni datos personales.

#### Scenario: El documento existe y está enlazado

- GIVEN el repo en su estado final
- WHEN un test lee `apps/web/docs/delivery-contract.md` y `apps/web/README.md`
- THEN el archivo existe y el README lo enlaza

#### Scenario: Cubre los cinco puntos

- GIVEN el documento
- WHEN un test busca las cadenas `index.html`, `/404.html`, `s3:ListBucket`, `immutable`, `Content-Security-Policy` y `Referrer-Policy: no-referrer`
- THEN todas están presentes

#### Scenario: El 403 no se mapea

- GIVEN la sección "Página de error" del documento
- WHEN un test busca una instrucción que mapee 403 a `/404.html`
- THEN no existe, y la sección indica explícitamente que el 403 no se mapea

#### Scenario: Sin datos sensibles

- GIVEN el documento
- WHEN se buscan patrones de ID de cuenta AWS (12 dígitos) y de llaves
- THEN no hay coincidencias

### Requirement: El contrato coincide con el build

Un test MUST verificar que lo documentado es consistente con `out/`: cada ruta listada en el contrato tiene su `index.html` en `out/`; los assets bajo `_next/static/` llevan hash en el nombre (aptos para caché inmutable); y `404.html` existe en la raíz. Si el documento menciona una ruta que el build no genera, o el build genera una ruta no documentada, el test MUST fallar.

#### Scenario: Rutas documentadas == rutas generadas

- GIVEN la lista de rutas del documento y los `index.html` de `out/`
- WHEN el test compara ambos conjuntos
- THEN son iguales

#### Scenario: Assets con hash

- GIVEN los archivos `.js` y `.css` de `out/_next/static/`
- WHEN el test revisa sus nombres
- THEN cada uno contiene un hash de contenido

#### Scenario: Ruta no documentada

- GIVEN una nueva página `apps/web/app/nueva/page.tsx` sin actualizar el documento
- WHEN corren build y el test
- THEN el test falla señalando `/nueva/`

### Requirement: Metadatos de descubrimiento

El build MUST emitir `out/sitemap.xml` y `out/robots.txt`. El sitemap MUST listar exactamente las rutas públicas (`/`, `/experiencia/`, `/acceso/`) y MUST NOT incluir `/reclutador/` ni `/acceso/verificar/`. `robots.txt` MUST referenciar el sitemap y MUST NOT bloquear con `Disallow` las rutas con `noindex` (un crawler bloqueado no puede leer el `noindex`). Las páginas `/reclutador/` y `/acceso/verificar/` MUST llevar `noindex`.

#### Scenario: Sitemap sin rutas privadas

- GIVEN `out/sitemap.xml`
- WHEN se leen las URLs
- THEN aparecen exactamente `/`, `/experiencia/` y `/acceso/`, y no aparecen `/reclutador/` ni `/acceso/verificar/`

#### Scenario: robots.txt no oculta el noindex

- GIVEN `out/robots.txt`
- WHEN se leen sus reglas
- THEN referencia `sitemap.xml` y no contiene `Disallow` para `/reclutador/` ni `/acceso/verificar/`

#### Scenario: noindex en rutas privadas

- GIVEN `out/reclutador/index.html` y `out/acceso/verificar/index.html`
- WHEN se busca `<meta name="robots" content="noindex`
- THEN ambas lo contienen

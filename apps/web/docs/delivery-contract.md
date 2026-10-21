# Contrato de entrega del sitio web

Este documento lo produce y versiona `apps/web`. Es lo que el cambio de infraestructura (S3 + CloudFront) debe aplicar para servir el sitio. No contiene infraestructura: solo el contrato y su verificación. `npm run check:out -w apps/web` (y por lo tanto `npm run build -w apps/web`) falla si `out/` deja de cumplirlo.

## Artefacto

El entregable es `apps/web/out/`, generado por `next build` con `output: 'export'` y `trailingSlash: true`:

- Un `index.html` por ruta (ver la sección siguiente) y `404.html` en la raíz.
- `_next/static/*`: JavaScript y CSS con hash de contenido en el nombre, aptos para caché inmutable.
- `robots.txt` y `sitemap.xml`.
- Nada de PDF ni Word: el CV se entrega con una URL firmada desde la API.

## Rutas generadas

- `/`
- `/experiencia/`
- `/acceso/`
- `/acceso/verificar/`
- `/reclutador/`

Un test compara esta lista con las carpetas de `apps/web/app`; `check:out` la compara con los `index.html` de `out/`. Si se agrega una página sin actualizar la lista, ambos fallan señalando la ruta.

## Origen

- Comportamiento por defecto: bucket S3 privado servido con OAC (Origin Access Control). Sin acceso público al bucket.
- `/api/*`: origen de la API, con la política de caché `CachingDisabled` y la de origen `AllViewerExceptHostHeader`. Sin la Function de reescritura. El sitio llama a la API con rutas relativas (mismo origen), por eso no hay CORS.

## Reescritura de rutas

El export genera `ruta/index.html`, pero CloudFront con un origen S3 REST solo resuelve el _default root object_ en la raíz. Hace falta una CloudFront Function en `viewer-request` (runtime `cloudfront-js-2.0`), asociada **solo** al comportamiento por defecto, nunca a `/api/*`. Si el URI termina en `/` se agrega `index.html`; si no contiene `.`, se agrega `/index.html`:

```js
async function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }
  return request;
}
```

Un test ejecuta este código con las rutas del sitio y con los assets (`/_next/static/...`, `/robots.txt`, `/404.html`), que no deben cambiar.

## Página de error

- Dar al OAC el permiso `s3:ListBucket` sobre el bucket. Sin él, S3 responde 403 (no 404) ante una clave inexistente.
- Configurar una custom error response que mapee solo el 404 a `/404.html`, conservando el código HTTP 404.
- El 403 nunca se mapea. Las custom error responses aplican a toda la distribución, `/api/*` incluido: mapear el 403 convertiría en una página HTML el 403 real de `/api/v1/admin/visits`, que el playground de la zona reclutador debe mostrar tal cual.
- Por la misma razón, los 404 de `/api/*` también llegarían como HTML. Infra decide entre aceptarlo o usar Lambda@Edge en `origin-response` solo en el comportamiento por defecto.

## Caché

| Ruta              | Política                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `_next/static/*`  | `Cache-Control: public, max-age=31536000, immutable` (los nombres llevan hash)             |
| HTML y `.txt` RSC | `Cache-Control: max-age=0, must-revalidate`, más invalidación de CloudFront en cada deploy |
| `/api/*`          | `CachingDisabled`                                                                          |

La query string queda fuera de la clave de caché del comportamiento por defecto.

## Cabeceras

`headers()` de Next no funciona en un export estático. Las cabeceras van en una response headers policy de CloudFront para el comportamiento por defecto:

| Cabecera                    | Valor                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| `Referrer-Policy`           | `no-referrer` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`                                                                                                                                                                                |
| `X-Content-Type-Options`    | `nosniff` |
| `X-Frame-Options`           | `DENY`                                                                                                                                                                                                               |
| `Permissions-Policy`        | Restrictiva: `camera=(), microphone=(), geolocation=()`                                                                                                                                                              |

Por qué la CSP es así:

- `'unsafe-inline'` en `script-src`: el export estático inyecta scripts en línea (`self.__next_f.push(...)`, con el payload de los Server Components). Sin servidor no se pueden usar nonces, y SRI es experimental en Next.
- `style-src 'self'` sin `'unsafe-inline'`: el build enlaza hojas de estilo y no usa atributos `style`. Verificado en Chrome headless contra un export en modo mock con `style-src 'self'` y `script-src 'self' 'unsafe-inline'`: sin violaciones de CSP (2026-10-21). Aun así, aplicar la política primero en modo `Content-Security-Policy-Report-Only` y, si algo falla, relajar solo esa directiva.
- `connect-src 'self'` y `font-src 'self'`: la API está en el mismo dominio bajo `/api/*` y las fuentes se alojan en el sitio (no hay pedidos a Google en producción).
- Mejora futura: reemplazar `'unsafe-inline'` por hashes de los scripts en línea. Es factible (unos 8 scripts distintos), pero la política de la response headers policy cambiaría en cada deploy, porque el payload de `self.__next_f.push(...)` varía con el contenido.
- `frame-ancestors 'none'`: nadie puede incrustar el sitio. `X-Frame-Options: DENY` cubre navegadores antiguos.
- `Referrer-Policy: no-referrer`: defensa en profundidad para el enlace de acceso (ver "Token del enlace").

## Descubrimiento

- `sitemap.xml` lista solo `/`, `/experiencia/` y `/acceso/`, con URLs absolutas de `https://mariajosetolmo.cl`.
- `/reclutador/` y `/acceso/verificar/` llevan `<meta name="robots" content="noindex, nofollow">` y no están en el sitemap.
- `robots.txt` permite todo y referencia el sitemap. No bloquea esas rutas con `Disallow`: si el rastreador no puede entrar, no lee el `noindex`.

## Token del enlace

El enlace del correo es `https://mariajosetolmo.cl/acceso/verificar/#token=<token>`. El fragmento nunca llega a CloudFront: no aparece en sus logs ni en `Referer`. La página lo lee en el cliente, lo guarda en memoria y vacía la URL con `history.replaceState`. El token debe ser base64url, de un solo uso y de vida corta.

## Verificación

`check:out` falla con código distinto de 0, nombrando cada archivo, si en `out/`:

- falta alguno de los `index.html` de las rutas, `404.html`, `robots.txt`, `sitemap.xml` o `_next/static/`;
- aparece `fonts.googleapis.com` o `fonts.gstatic.com`;
- aparece un resto del adaptador de pruebas (`__WEB_CV_MOCK__`, "Simular: abrir el enlace", "Reiniciar demo"), señal de un build hecho con `NEXT_PUBLIC_API_MODE=mock`;
- hay archivos `.pdf`, `.doc`, `.docx` u `.odt`;
- una ruta privada no tiene `noindex`, o el sitemap o `robots.txt` no cumplen lo anterior;
- un asset de `_next/static/` no lleva hash;
- las rutas generadas difieren de las de este documento.

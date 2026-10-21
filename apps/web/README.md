# apps/web

Sitio estático (Next.js, `output: 'export'`) de mariajosetolmo.cl. Este README cubre lo necesario para trabajar en local; las decisiones están en `openspec/changes/frontend-site/`.

## Por qué esta tecnología

- **Next.js con export estático**: el resultado es una carpeta de archivos (`out/`) que se sirve desde S3 + CloudFront, sin servidor de Node en producción. Las páginas públicas se prerenderizan y no dependen de la API.
- **React 19 con Server Components**: solo el menú móvil, el login, la verificación, la zona reclutador y el playground son componentes de cliente (lo garantiza un test).
- **CSS Modules + tokens**: cero dependencias de estilos; los colores viven solo en `src/styles/tokens.css` y un test valida el contraste.
- **Jest + Testing Library + axe**: strict TDD, accesibilidad probada en cada página.

## Puertos

| Servicio                | Puerto | Comando                         |
| ----------------------- | ------ | ------------------------------- |
| API (NestJS)            | 3000   | `npm run start:dev -w apps/api` |
| Desarrollo web (mock)   | 3001   | `npm run dev -w apps/web`       |
| Vista previa del export | 3002   | `npm run preview -w apps/web`   |

## Desarrollo

```bash
npm run dev -w apps/web
# http://127.0.0.1:3001/
```

El script fija `NEXT_PUBLIC_API_MODE=mock`, así que no hace falta la API ni ningún secreto. El puerto 3000 queda libre para la API.

## Modos de API

`NEXT_PUBLIC_API_MODE` se decide en build y solo admite dos valores:

| Modo   | Uso                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| `mock` | Desarrollo (`npm run dev`). Datos de ejemplo, sin red. Muestra «Simular: abrir el enlace» y «Reiniciar demo».         |
| `http` | Valor por defecto y el único válido para producción. Llama a `/api/*` en el mismo dominio y no incluye nada del mock. |

Un build con `mock` falla a propósito en `check:out`: el mock no puede llegar a producción.

## Build, check:out y vista previa

```bash
npm run build -w apps/web      # next build + prune-out.js + check:out; genera apps/web/out/
npm run check:out -w apps/web  # solo la verificación de out/
npm run preview -w apps/web    # http://127.0.0.1:3002/
```

`build` encadena `prune-out.js` (quita el `404/` duplicado) y `check:out` (`scripts/check-out.js`), así que el job `quality` del CI lo ejecuta sin cambios en `ci.yml`. Verifica que existan todas las rutas, `404.html`, `robots.txt`, `sitemap.xml` y `_next/static/`, con al menos una fuente `.woff2`; que no haya Google Fonts, restos del mock ni PDF/Word; y que las rutas privadas lleven `noindex`.

`preview` es un servidor Node mínimo (`scripts/serve-out.js`, sin dependencias) que sirve `out/` como lo haría CloudFront: `index.html` por directorio, redirección a la barra final y `404.html` para rutas inexistentes. Se puede cambiar el puerto con `PORT=3010 npm run preview -w apps/web`.

## Contrato de entrega

Lo que S3 + CloudFront deben aplicar (reescritura de rutas, página de error, caché y cabeceras) está en [docs/delivery-contract.md](docs/delivery-contract.md). Un test lo mantiene al día con las rutas de la app.

## Pruebas y calidad

```bash
npm test -w apps/web
npm run test:cov -w apps/web
npm run typecheck -w apps/web
```

## Notas

- `next build` descarga IBM Plex desde Google Fonts en tiempo de build (el resultado se sirve desde el mismo dominio, sin pedidos a Google en producción). El primer build necesita red.

# apps/web

Sitio estático (Next.js, `output: 'export'`) de mariajosetolmo.cl. Este README cubre lo mínimo para trabajar en local; las decisiones están en `openspec/changes/frontend-site/`.

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

## Vista previa del export estático

```bash
npm run build -w apps/web      # genera apps/web/out/
npm run preview -w apps/web    # http://127.0.0.1:3002/
```

`preview` es un servidor Node mínimo (`scripts/serve-out.js`, sin dependencias) que sirve `out/` como lo haría CloudFront: `index.html` por directorio, redirección a la barra final y `404.html` para rutas inexistentes. Se puede cambiar el puerto con `PORT=3010 npm run preview -w apps/web`.

## Pruebas y calidad

```bash
npm test -w apps/web
npm run test:cov -w apps/web
npm run typecheck -w apps/web
```

## Notas

- `next build` descarga IBM Plex desde Google Fonts en tiempo de build (el resultado se sirve desde el mismo dominio, sin pedidos a Google en producción). El primer build necesita red.

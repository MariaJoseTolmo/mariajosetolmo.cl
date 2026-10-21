# ADR-001: Next.js con exportación estática (SSG puro) en S3 + CloudFront

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva (no figura en el CV) |

## Decisión

El frontend se construye con Next.js (App Router) y `output: 'export'`, con `trailingSlash: true`. El resultado (`apps/web/out/`) se publica en un bucket S3 privado (OAC) detrás de CloudFront. Una CloudFront Function en viewer-request reescribe las subrutas a `index.html`. No se usa ISR ni SSR. La zona reclutador se renderiza en el cliente y obtiene sus datos desde `/api`.

## Contexto y problema

El contenido público casi no cambia. Se busca carga inmediata, costo casi nulo y nada de servidor que operar para el frontend. ISR y SSR requieren un servidor y están fuera del alcance del brief.

Con un origen S3 REST y OAC, el *default root object* solo aplica a la raíz: `/ruta/` no devuelve `index.html`. De ahí la CloudFront Function.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Next.js `output: 'export'`** | HTML estático, sin servidor; React + TypeScript; ecosistema amplio | Sin rewrites, headers, Route Handlers con `Request`, Server Actions ni optimización de imágenes por defecto |
| Next.js con ISR/SSR | Contenido dinámico en servidor | Requiere cómputo para el frontend; fuera de alcance |
| HTML/CSS sin framework | Cero dependencias | Sin componentes ni tests de UI con la misma calidad |

## Consecuencias

- **Positivas:** costo de hosting casi cero; el CI reconstruye cuando cambia el contenido; el frontend no tiene superficie de servidor.
- **Negativas:** `next dev` no puede hacer proxy de `/api` (modo mock hasta el cambio de auth); las cabeceras de seguridad (CSP, `Referrer-Policy`) van en una response headers policy de CloudFront.
- **Riesgos:** las subrutas dependen de la CloudFront Function (solo en el behavior por defecto, nunca en `/api/*`); CSP con nonce no es posible en estático.

## Relación con mi experiencia

Next.js no está en mi CV: soy desarrolladora backend. Aporto TypeScript y Jest (en producción). La decisión mantiene el frontend simple y estático para concentrar la complejidad en la API NestJS, que es mi especialidad.

## Fuentes

- https://nextjs.org/docs/app/guides/static-exports
- https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html
- https://nextjs.org/docs/app/guides/content-security-policy

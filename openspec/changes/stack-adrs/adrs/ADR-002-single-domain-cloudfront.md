# ADR-002: Un solo dominio en CloudFront con `/api/*` hacia el origen de la API

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva (CloudFront); AWS en aprendizaje |

## Decisión

`mariajosetolmo.cl` es una única distribución de CloudFront con dos behaviors:

- Por defecto → bucket S3 del sitio estático (ADR-001).
- `/api/*` → origen de la API, protegido con OAC (ADR-009), con cache deshabilitada y una origin request policy personalizada que reenvía `CloudFront-Viewer-Address` y `Origin` y excluye `Host`.

## Contexto y problema

La autenticación usa cookies HttpOnly, Secure y `SameSite=Strict`. Si el frontend y la API vivieran en dominios distintos, las cookies serían cross-site y haría falta CORS con credenciales, más superficie de error y de ataque.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Un dominio, `/api/*` como behavior** | Same-origin: cookies `SameSite=Strict` funcionan; sin CORS | La API depende de la configuración de CloudFront |
| Subdominio `api.` | Separación clara | Requiere CORS con credenciales y cookies con dominio compartido |
| Dominio del proveedor (`*.on.aws`, `execute-api`) | Sin configuración extra | Cross-site; además el origen quedaría expuesto |

## Consecuencias

- **Positivas:** `fetch` same-origin envía las cookies sin configuración; validación del header `Origin` en métodos mutantes; Swagger en `/api/docs` sin behavior extra.
- **Negativas:** `Host` no se puede reenviar a orígenes Lambda; la app recibe el dominio del endpoint, no el de la distribución.
- **Riesgos:** si `CloudFront-Viewer-Address` no llega, el rate limit pierde la IP real. `X-Forwarded-For` no sirve (incluye la dirección de CloudFront). Se verifica en el infra-spike (Q3). La política administrada `AllViewerExceptHostHeader` reenvía todo excepto `Host` y, según la documentación, "headers adicionales de CloudFront" (protocolo, versión HTTP, TLS, tipo de dispositivo y ubicación), pero **no lista `CloudFront-Viewer-Address` de forma explícita** (sí lo lista `AllViewerAndCloudFrontHeaders-2022-06`, que reenvía `Host`). Por eso se mantiene la política personalizada.

## Relación con mi experiencia

He trabajado con JWT y OAuth en producción, donde el manejo de cookies y CORS es parte del día a día. CloudFront es nuevo para mí (AWS: aprendiendo, aplicado en este proyecto).

## Fuentes

- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-cloudfront-headers.html
- https://docs.aws.amazon.com/lambda/latest/dg/web-functions-http.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html (verificado 2026-10-20)

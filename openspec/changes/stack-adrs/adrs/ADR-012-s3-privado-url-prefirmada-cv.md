# ADR-012: S3 privado con URL prefirmada para entregar el CV

| Campo | Valor |
|---|---|
| Estado | Propuesta (el bucket y el rol IAM aún no existen; la infraestructura va en un cambio posterior) |
| Fecha | 2026-10-22 |
| Relación con el CV | Nueva |

## Decisión

El PDF del CV vive en un bucket S3 privado, fuera del repositorio. `GET /api/v1/cv` exige sesión y responde `{ url, expiresAt }` con una URL prefirmada de lectura (GET) que dura unos 5 minutos (300 s por defecto, configurable con `CV_LINK_TTL_SECONDS`). Cada petición genera una URL nueva y la URL no se guarda ni se registra en logs. La generación pasa por el puerto `CvLinkSigner`: en producción lo implementa S3 (`S3CvLinkSigner`) y en local y en test una implementación falsa devuelve una URL de ejemplo.

## Contexto y problema

El repositorio es público y el CV contiene datos personales: no puede estar en el código ni en el historial. Solo debe verlo quien inició sesión como reclutador, y el enlace debe vencer para que no circule indefinidamente.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **S3 privado + URL prefirmada** | Sin servidor intermedio: el navegador descarga directo de S3; el vencimiento va dentro de la firma; el rol de la función solo necesita `s3:GetObject` sobre un objeto; sin claves nuevas que administrar | El enlace funciona para cualquiera que lo tenga hasta que venza; la URL expone el nombre del bucket y la firma en el historial del navegador |
| Archivo en Postgres (`bytea`) | Un solo almacén | La API tendría que transmitir el archivo; ocupa cuota de la base (Neon); sin vencimiento propio |
| Enlace de un proveedor externo (Drive, Dropbox) | Sin infraestructura | Enlace permanente o revocación manual; depende de otra cuenta; no hay control de sesión |
| URL firmada de CloudFront | Mismo dominio y caché en el borde (ADR-002) | Requiere un par de claves y un grupo de claves confiables que se administran y rotan; más piezas para un solo archivo |

## Consecuencias

- **Positivas:** el CV queda fuera del repo; la ventana de exposición es de minutos; el código no maneja credenciales: el SDK las toma del rol de ejecución; las pruebas firman sin red con credenciales falsas.
- **Negativas:** el archivo se sube a mano, fuera del repo; la descarga ocurre en el dominio de S3, no en el del sitio.
- **Riesgos:** una URL prefirmada con credenciales temporales vence cuando vencen esas credenciales, aunque el tiempo pedido sea mayor (verificado en la documentación de S3). Como `expiresAt` se calcula como `ahora + TTL`, si las credenciales del rol vencen antes, la URL deja de funcionar antes de ese `expiresAt`. Es poco probable porque el SDK renueva las credenciales antes de que venzan; confirmarlo con un rol real en el cambio de infraestructura. El bucket debe tener Block Public Access activo y cifrado; eso lo define el cambio de infraestructura, no este. Quien reciba la URL antes de que venza puede descargar el archivo sin sesión. Los costos de S3 para un objeto y pocas descargas se esperan marginales (NO VERIFICADO).

## Relación con mi experiencia

Entregar archivos con URLs prefirmadas es nuevo para mí en este proyecto (AWS: aprendiendo, aplicado en este proyecto). La autenticación con JWT y cookies sí la he usado en producción (ver ADR-002); aquí S3 solo almacena el archivo y la sesión sigue decidiendo quién puede pedir el enlace.

## Fuentes

- https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html (URLs prefirmadas: acceso temporal y permisos de quien firma)
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html (vencimiento con la sesión del rol aunque se pida un tiempo mayor; hasta 7 días con credenciales de usuario IAM y SigV4)
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html (Block Public Access)
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html (URLs firmadas de CloudFront y grupos de claves)
- `openspec/changes/auth-backend/design.md` secciones 5 y 13 (puerto `CvLinkSigner` y revisión de ADR)

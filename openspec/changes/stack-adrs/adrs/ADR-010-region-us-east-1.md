# ADR-010: Región us-east-1

| Campo | Valor |
|---|---|
| Estado | **Propuesta (latencia desde Chile por medir en el spike)** |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva; AWS en aprendizaje |

## Decisión propuesta

Todos los recursos regionales viven en us-east-1: Lambda, SES, Neon (`aws-us-east-1`) y, si es posible, Upstash. La confirmación depende de la pregunta Q6 del infra-spike (latencia Chile → `/api`).

## Contexto y problema

Los usuarios principales están en Chile y la región más cercana es sa-east-1. Pero las Web Functions (ADR-009) no existen allí. Además, la región de Neon es inmutable: elegir mal obliga a recrear la base.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **us-east-1** | Web Functions disponibles; SES y Neon disponibles; ACM de CloudFront ya vive aquí | Más lejos de Chile (latencia sin medir) |
| sa-east-1 | Menor latencia esperada desde Chile; SES, Neon y Supabase disponibles | Sin Web Functions: fuerza el Plan B de ADR-009 |
| Otra región con Web Functions (us-east-2, us-west-2) | Disponibles | Ninguna ventaja clara sobre us-east-1 para Chile |

## Criterio de confirmación (Q6)

- p50 en caliente ≤ 300 ms → se acepta us-east-1.
- Entre 300 y 400 ms → decide la usuaria y se registra el fundamento.
- > 400 ms → reconsiderar sa-east-1 (y con ello el Plan B).

## Consecuencias

- **Positivas:** una sola región simplifica IAM, logs y costos.
- **Negativas:** cada llamada a `/api` cruza el continente; el contenido estático no se ve afectado porque lo sirve CloudFront desde el edge.
- **Riesgos:** regiones de Upstash y latencia desde Chile: NO VERIFICADAS. Diferencias de precio de SES entre regiones: NO VERIFICADAS. El proyecto de Neon se crea solo después de confirmar este ADR.

## Relación con mi experiencia

No he elegido regiones de AWS antes (aprendiendo, aplicado en este proyecto). La decisión sigue el mismo criterio que uso en backend: medir antes de optimizar.

## Fuentes

- https://aws.amazon.com/blogs/aws/announcing-aws-lambda-web-functions-for-fast-consistent-web-app-performance-anywhere/ (regiones de Web Functions)
- https://docs.aws.amazon.com/general/latest/gr/ses.html
- https://neon.com/docs/introduction/regions
- https://supabase.com/docs/guides/platform/regions

# stack-adrs: decisiones de arquitectura del stack

Registro de las tecnologías que **no** figuran en mi CV (regla 2 de `docs/brief.md`). Cada ADR explica el problema, las alternativas, por qué se eligió la opción y cómo se relaciona con mi experiencia. AWS se presenta siempre como "aprendiendo, aplicado en este proyecto".

## Índice

| ID | Título | Estado | Relación con el CV |
|---|---|---|---|
| [ADR-001](adrs/ADR-001-nextjs-static-export.md) | Next.js con exportación estática en S3 + CloudFront | Aceptada | Nueva |
| [ADR-002](adrs/ADR-002-single-domain-cloudfront.md) | Un solo dominio en CloudFront con `/api/*` | Aceptada | Nueva (cookies/JWT en producción) |
| [ADR-003](adrs/ADR-003-aws-cdk-typescript.md) | AWS CDK en TypeScript como IaC | Aceptada | Nueva (TypeScript en producción) |
| [ADR-004](adrs/ADR-004-neon-postgres.md) | PostgreSQL serverless en Neon | Aceptada | PostgreSQL avanzado; proveedor nuevo |
| [ADR-005](adrs/ADR-005-upstash-redis.md) | Redis gestionado con Upstash | Aceptada | Redis en producción; proveedor nuevo |
| [ADR-006](adrs/ADR-006-sqs-event-publisher.md) | SQS en producción detrás de `EventPublisher` | Aceptada | Kafka en producción; SQS nuevo |
| [ADR-007](adrs/ADR-007-ses-magic-link.md) | Amazon SES para el magic link | Aceptada | Nueva |
| [ADR-008](adrs/ADR-008-ssm-parameter-store.md) | SSM Parameter Store para secretos | Aceptada | Nueva |
| [ADR-009](adrs/ADR-009-lambda-web-functions-oac.md) | Lambda Web Functions + CloudFront OAC | Propuesta (condicionada al infra-spike) | Nueva |
| [ADR-010](adrs/ADR-010-region-us-east-1.md) | Región us-east-1 | Propuesta (latencia desde Chile por medir) | Nueva |
| [ADR-011](adrs/ADR-011-jest-experimental-vm-modules.md) | Jest con `--experimental-vm-modules` para Nest 12 | Aceptada | Jest en producción; flag nuevo |
| [ADR-012](adrs/ADR-012-s3-privado-url-prefirmada-cv.md) | S3 privado con URL prefirmada para entregar el CV | Propuesta (infraestructura pendiente) | Nueva |

## Pendientes antes de cerrar

- **ADR-009 y ADR-010** esperan `openspec/changes/infra-spike/results.md` (Q1-Q8). Si el spike activa el Plan B, se reescribe ADR-009 y se revisa ADR-003 (constructs) y ADR-010 (región).
- **ADR-004** depende de ADR-010: el proyecto de Neon se crea solo tras confirmar la región.
- Los datos marcados **NO VERIFICADO** en cada ADR se confirman con documentación oficial antes de pasar a "Aceptada definitiva".

## Relación con el README ("Por qué esta tecnología")

El README del repo resume cada pieza nueva en una línea (regla 3 del brief). Cada línea enlaza a su ADR:

| Línea del README | ADR |
|---|---|
| Next.js con exportación estática; S3 + CloudFront | ADR-001, ADR-002 |
| AWS CDK | ADR-003 |
| Neon (proveedor de PostgreSQL) | ADR-004 |
| Upstash (proveedor de Redis) | ADR-005 |
| SQS (y Kafka KRaft solo en local) | ADR-006 |
| SES (y Mailpit solo en local) | ADR-007 |
| SSM Parameter Store | ADR-008 |
| AWS Lambda | ADR-009, ADR-010 |
| Jest con `--experimental-vm-modules` | ADR-011 |
| S3 privado con URL prefirmada (CV) | ADR-012 |

Mailpit, `apache/kafka` en KRaft, Redis 8 en local y gitleaks son herramientas de desarrollo: se documentan solo en el README, sin ADR propio. Hoy el README agrupa "Next.js, S3 + CloudFront, Lambda, SES, SQS y SSM" como planeadas; cuando estos ADR se acepten, esa línea se reemplaza por una línea por pieza con su enlace.

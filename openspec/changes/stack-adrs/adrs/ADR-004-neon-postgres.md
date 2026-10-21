# ADR-004: PostgreSQL serverless en Neon

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | PostgreSQL y TypeORM en el CV; el proveedor Neon es nuevo |

## Decisión

La base de producción es PostgreSQL en Neon (plan Free). La app se conecta por la URL con pooler (PgBouncer, modo transaction) con un pool pequeño y sin estado de sesión. Las migraciones de TypeORM usan la URL directa.

El proyecto de Neon se crea **solo después del infra-spike**, porque la región queda fija al crearlo y depende de ADR-010.

## Contexto y problema

Lambda abre muchas conexiones cortas y escala a cero. Se necesita Postgres real, con pooler compatible con Lambda, costo cero o casi cero y sin pausas que dejen el sitio caído.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Neon Free** | 100 CU-horas/mes y 1 GB por proyecto; suspende tras 5 min y despierta en cientos de ms; prepared statements a nivel de protocolo (PgBouncer 1.22+); conexión directa por IPv4 | Región inmutable; sin SQL `PREPARE`, `SET`, `LISTEN` ni advisory locks en el pooler |
| Supabase Free | 500 MB, 2 proyectos; Supavisor en modo transaction | **Se pausa tras 1 semana de inactividad** (despausa manual); sin prepared statements en modo transaction; conexión directa solo IPv6 sin add-on |
| Amazon RDS | Gestionado por AWS | Costo fijo mensual y VPC (fuera de alcance); precio de `db.t4g.micro` en us-east-1 NO VERIFICADO (la página oficial no lo muestra en texto). El plan gratuito de RDS cubre `db.t3.micro`/`db.t4g.micro`, pero es temporal: hasta 6 meses con créditos de hasta USD 200 (cuentas anteriores al 2025-07-15: 12 meses) |

## Consecuencias

- **Positivas:** Postgres estándar; la base se duerme sin intervención y despierta sola.
- **Negativas:** primera consulta tras inactividad algo más lenta.
- **Riesgos:** La documentación de Neon para TypeORM recomienda la URL con pooler en runtime serverless y la URL directa para migraciones (coincide con la decisión), pero no certifica el comportamiento de TypeORM bajo transaction mode; sigue NO VERIFICADO en la práctica y se prueba antes de construir el módulo de datos. Elegir mal la región obliga a recrear el proyecto.

## Relación con mi experiencia

PostgreSQL es parte de mi stack avanzado y uso TypeORM en producción. Solo el proveedor serverless es nuevo; el modelo de datos y las migraciones siguen mis prácticas habituales.

## Fuentes

- https://neon.com/pricing
- https://neon.com/docs/introduction/plans (Free: 100 CU-horas/proyecto/mes, 1 GB/proyecto, autosuspensión a los 5 min, verificado 2026-10-20)
- https://neon.com/docs/guides/typeorm
- https://aws.amazon.com/rds/free/
- https://neon.com/docs/connect/connection-pooling
- https://neon.com/docs/introduction/scale-to-zero
- https://neon.com/docs/introduction/regions
- https://supabase.com/pricing
- https://supabase.com/docs/guides/database/connecting-to-postgres

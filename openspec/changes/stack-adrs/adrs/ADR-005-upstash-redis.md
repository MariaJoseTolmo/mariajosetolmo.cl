# ADR-005: Redis gestionado con Upstash

| Campo | Valor |
|---|---|
| Estado | Aceptada (revisada el 2026-10-21: el motivo principal es el costo, no la VPC) |
| Fecha | 2026-10-20 |
| Relación con el CV | Redis en producción; el proveedor Upstash es nuevo |

## Decisión

En producción, Redis es Upstash. En local, Redis corre en Docker (`redis:8.10-alpine`). La app accede a Redis a través de un puerto propio, así el proveedor es un detalle del adaptador.

Usos: tokens del magic link con TTL (guardados solo como hash) y rate limit.

Motivo principal: **costo**. ElastiCache Serverless también admite un endpoint público sin VPC, así que evitar la VPC ya no distingue a Upstash. Lo que decide es que el tráfico de un portafolio cabe en el plan gratuito de Upstash, mientras que ElastiCache Serverless cobra un mínimo de ~USD 6/mes aunque no se use, casi un tercio del presupuesto de USD 20/mes.

## Contexto y problema

Cada instancia de Lambda tiene su propia memoria: el rate limit en memoria no sirve. Se necesita un almacén compartido con TTL. El brief deja fuera de alcance meter recursos dentro de una VPC.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Upstash** | Redis gestionado accesible sin VPC; sin servidor que operar; plan gratuito de 500K comandos/mes y 250 MB; pago por uso USD 0.20 por 100K comandos; `us-east-1` disponible | Proveedor externo a AWS; latencia Lambda-Upstash sin medir |
| Amazon ElastiCache | Nativo de AWS; Serverless con mínimo de ~USD 6/mes (Valkey, 100 MB × USD 0.084/GB-hora × 730 h, cálculo propio) | Los clústeres por nodo y las cachés con endpoint VPC viven en una VPC: Lambda necesitaría VPC y NAT Gateway (USD 0.045/hora ≈ USD 33/mes por AZ, más USD 0.045/GB) o VPC endpoints. Serverless admite endpoint público sin VPC, lo que debilita este contra; costo fijo frente al plan gratuito de Upstash |
| Rate limit en memoria / en Postgres | Sin dependencia extra | En memoria es incorrecto con varias instancias; en Postgres agrega carga y no tiene TTL nativo |

## Consecuencias

- **Positivas:** sin VPC ni NAT Gateway; mismo cliente y mismos comandos que en local.
- **Negativas:** una dependencia más fuera de AWS.
- **Riesgos:** latencia entre Lambda y Upstash sin medir; la licencia de Redis 8 (RSALv2/SSPLv1/AGPLv3) aplica a la imagen local, no al servicio gestionado. Reevaluar ElastiCache Serverless con endpoint público antes de cerrar el ADR.

## Relación con mi experiencia

Uso Redis en producción (caché y TTL). Este ADR existe solo por el proveedor: el patrón de uso es el que ya conozco.

## Fuentes

- https://hub.docker.com/_/redis (licencia de la imagen local)
- https://upstash.com/pricing/redis (plan gratuito y pago por uso; verificado 2026-10-20)
- https://upstash.com/docs/redis/features/globaldatabase (regiones, incluye us-east-1)
- https://aws.amazon.com/vpc/pricing/ y https://aws.amazon.com/network-firewall/pricing/ (NAT Gateway USD 0.045/hora y USD 0.045/GB en us-east-1)
- https://aws.amazon.com/elasticache/pricing/ (Serverless: mínimo 100 MB en Valkey)
- https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/VPCs.html (VPC y endpoint público de Serverless)
- https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html (Lambda en VPC pierde acceso a internet sin configuración adicional)
- Latencia Lambda-Upstash: NO VERIFICADO (se mide en el infra-spike)

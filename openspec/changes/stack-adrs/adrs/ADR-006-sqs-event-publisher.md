# ADR-006: Amazon SQS en producción detrás del puerto `EventPublisher`

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Kafka en producción; SQS es nuevo |

## Decisión

El dominio publica eventos a través del puerto `EventPublisher`. Hay dos adaptadores:

- **Local:** Kafka (`apache/kafka`, KRaft, nodo único) en docker-compose.
- **Producción:** Amazon SQS.

El caso de uso no sabe qué adaptador recibe; el enlace vive en el módulo de infraestructura.

## Contexto y problema

El proyecto necesita publicar eventos de dominio (los casos concretos se definen en cambios posteriores) sin acoplar el dominio a un broker. Kafka gestionado tiene un costo fijo desproporcionado para un portafolio.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **SQS en producción, Kafka en local** | Pago por uso; sin servidor que operar; el puerto se mantiene | Dos adaptadores que probar; semánticas distintas (cola vs log) |
| Amazon MSK | Kafka real en producción | MSK Serverless: USD 0.75/clúster-hora × 730 h ≈ USD 548/mes más USD 0.0015/partición-hora (10 particiones ≈ USD 11): ~USD 558/mes coincide con ese escenario (cálculo propio). Provisionado con `kafka.m5.large`: USD 0.21/h por broker, mínimo 2 brokers ≈ USD 307/mes más almacenamiento (USD 0.10/GB-mes). `kafka.t3.small` existe (AWS indica clústeres por menos de USD 2.50/día en 2020), pero su precio actual no se verificó. Exige VPC; fuera de alcance |
| Kafka autogestionado | Control total | Servidor y VPC que operar; fuera de alcance |

## Consecuencias

- **Positivas:** la arquitectura hexagonal se demuestra en un caso real: mismo puerto, distinto adaptador.
- **Negativas:** el adaptador Kafka no corre en producción; SQS no ofrece replay como un log de Kafka.
- **Riesgos:** diferencias de semántica (orden, entrega al menos una vez) deben quedar cubiertas por tests de contrato del puerto. Los textos de la web dicen "Kafka en local / SQS en producción", nunca "Kafka en producción".

## Relación con mi experiencia

Uso Kafka en producción y diseño con arquitectura hexagonal y microservicios. SQS es nuevo (AWS: aprendiendo, aplicado en este proyecto). La decisión muestra el criterio de costo y el desacople por puertos, no un cambio de preferencia.

## Fuentes

- https://aws.amazon.com/msk/pricing/ (Serverless y `kafka.m5.large`; ~USD 558/mes recalculado el 2026-10-20 como Serverless con ~10 particiones; no es el mínimo posible en provisionado)
- https://docs.aws.amazon.com/msk/latest/developerguide/msk-create-cluster.html (2 o 3 subredes en AZ distintas, requiere VPC)
- https://aws.amazon.com/about-aws/whats-new/2020/04/create-amazon-msk-clusters-with-t3-brokers/
- https://aws.amazon.com/sqs/pricing/ (capa gratuita: 1 millón de solicitudes al mes, verificado 2026-10-20)
- https://aws.amazon.com/about-aws/whats-new/2016/11/amazon-sqs-introduces-fifo-queues-with-exactly-once-processing-and-lower-prices-for-standard-queues/ (USD 0.40 por millón, tarifa base de 2016) y https://aws.amazon.com/about-aws/whats-new/2021/01/amazon-sqs-announces-tiered-pricing/ (precios escalonados desde 2021)
- Tarifa vigente por millón de solicitudes estándar: NO VERIFICADO (la tabla de la página oficial no se pudo leer); asumir ~USD 0.40 como tope

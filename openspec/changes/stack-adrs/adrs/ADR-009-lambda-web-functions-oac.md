# ADR-009: Lambda Web Functions + CloudFront OAC para proteger el origen de `/api`

| Campo | Valor |
|---|---|
| Estado | **Propuesta (condicionada al infra-spike)** |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva; AWS en aprendizaje |

> La decisión final espera `openspec/changes/infra-spike/results.md`, hoy en estado ESQUELETO (Q1-Q8 sin medir).

## Decisión propuesta

NestJS corre como servidor HTTP normal en una Lambda Web Function (Node 24, arm64) que escucha en `AWS_LAMBDA_HTTP_ENDPOINT`, sin adaptador. El endpoint usa `IamAuth`; CloudFront firma con OAC (`always-amz-auth`, `sigv4`). Una resource policy concede `lambda:InvokeWebFunctionEndpoint` solo a `cloudfront.amazonaws.com`, acotada por `aws:SourceArn`. Sin API Gateway.

## Contexto y problema

Nadie debe poder llamar a la API saltándose CloudFront (rate limit, cabeceras, cookies). Las Web Functions se anunciaron el 2026-10-12: tienen días de antigüedad y existen en solo 5 regiones (sin sa-east-1).

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **c) Web Function + OAC** | SigV4; POST firmado como `UNSIGNED-PAYLOAD`; sin adaptador; código idéntico al local | Madurez baja; sin capa gratuita; factura memoria inactiva; sin L2 en CDK |
| b) Function URL + OAC (**Plan B**) | Madura; cualquier región; `FunctionUrlOrigin.withOriginAccessControl` | El navegador debe enviar `x-amz-content-sha256` en POST/PUT; requiere Lambda Web Adapter |
| a) API Gateway + header secreto | Madura; cualquier región | Secreto compartido (más débil); ~USD 1.00/M solicitudes; requiere adaptador |

**Plan B:** `NodejsFunction` + Lambda Web Adapter (layer `arn:aws:lambda:us-east-1:753240598075:layer:LambdaAdapterLayerArm64:30` según el README de `main`; la última release del repositorio es v1.1.0, publicada el 2026-09-18; confirmar la versión de la layer al implementar) + Function URL `AWS_IAM` + OAC, con un wrapper `crypto.subtle` de ~10 líneas en el cliente.

## Go/no-go (infra-spike)

- Q1, Q2, Q3, Q4 o Q8 en FAIL → Plan B.
- Q6 p50 > 400 ms → reconsiderar sa-east-1 (fuerza Plan B).
- Q5 > 3 s → reducir el bundle; Plan B solo si es notablemente más rápido.
- Q7 > 30 min → recalcular costo; Plan B si supera USD 5/mes.
- Todo PASS → GO.

## Consecuencias

- **Positivas:** el dominio no sabe que corre en Lambda; formularios POST normales.
- **Negativas:** el bundle debe conservar metadata de decoradores (tsc/SWC, o `@Inject` explícito).
- **Riesgos:** servicio nuevo; peor caso ~2 × USD 19/mes, acotado con `MaxEnvironments: 2`, `RateLimit: 100` y alertas de Budgets. Set-Cookie y binarios: NO VERIFICADO hasta Q2.

## Relación con mi experiencia

Despliego NestJS y Express en producción con Docker. Lambda y CloudFront son nuevos (aprendiendo, aplicado en este proyecto); el spike existe para no decidir a ciegas.

## Fuentes

- https://aws.amazon.com/blogs/aws/announcing-aws-lambda-web-functions-for-fast-consistent-web-app-performance-anywhere/
- https://docs.aws.amazon.com/lambda/latest/dg/web-functions-runtimes.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda-web.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html
- https://docs.aws.amazon.com/lambda/latest/dg/web-functions-endpoint-access-control.html
- https://aws.amazon.com/lambda/pricing/
- https://aws.amazon.com/api-gateway/pricing/
- https://github.com/awslabs/aws-lambda-web-adapter (README: patrón de ARN y versión 30; verificado 2026-10-20)
- https://github.com/awslabs/aws-lambda-web-adapter/releases (v1.1.0)
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html (`AllViewerExceptHostHeader` está pensada también para orígenes Lambda Web Function)

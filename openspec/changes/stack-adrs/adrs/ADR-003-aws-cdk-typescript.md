# ADR-003: AWS CDK en TypeScript como infraestructura como código

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva (CDK); TypeScript en producción |

## Decisión

Toda la infraestructura se define con AWS CDK (TypeScript) sobre CloudFormation. Se usan constructs L2 donde existen (`Distribution`, `S3BucketOrigin.withOriginAccessControl`, `OriginRequestPolicy`) y L1 donde no (`CfnWebFunction`, `CfnWebFunctionRevision`, `CfnWebFunctionEndpoint`, `CfnOriginAccessControl`, desde `aws-cdk-lib` >= 2.274.0).

## Contexto y problema

Se necesita un entorno reproducible y versionado: sitio estático en S3 + CloudFront, `/api/*` hacia la API y una origin request policy personalizada. El mecanismo de protección del origen (ADR-009) es muy reciente y no todas las herramientas lo soportan.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **AWS CDK** | Mantenido por AWS; cualquier recurso de CloudFormation vía L1; `OriginRequestPolicy` nativa | Curva más pronunciada; L1 sin abstracciones para Web Functions |
| SST v3 | `StaticSite` y `Router` listos; curva menor | Soporte de Web Function + OAC NO VERIFICADO; origin request policy personalizada no expuesta de forma evidente (NO VERIFICADO); mantenimiento cuestionado por terceros |
| Terraform | Multi-nube, muy usado | Otro lenguaje (HCL); soporte de Web Functions NO VERIFICADO |

## Consecuencias

- **Positivas:** mismo lenguaje que la API; el infra-spike usa la misma herramienta que producción.
- **Negativas:** los L1 obligan a conocer las propiedades de CloudFormation; no hay L2 para Web Functions.
- **Riesgos:** la disponibilidad de los tipos `AWS::Lambda::WebFunction*` y `AWS::Lambda::ResourcePolicy` en el registro de la cuenta se confirma recién con `cdk synth`/`deploy` (infra-spike, Q8). Respaldo: `AwsCustomResource` y luego un script de CLI.
- Que CDK tenga más valor en el mercado laboral que SST es una afirmación NO VERIFICADA.

## Relación con mi experiencia

Uso TypeScript en producción y CI/CD con GitHub Actions. CDK es nuevo: AWS está en mi CV como "aprendiendo", y este proyecto es donde lo aplico.

## Fuentes

- https://sst.dev/docs/
- https://sst.dev/docs/component/aws/static-site/
- https://sst.dev/docs/component/aws/router/
- https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.FunctionUrlOrigin.html
- https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-webfunction.html
- `openspec/changes/infra-spike/design.md` (constructs L1 verificados en documentación)

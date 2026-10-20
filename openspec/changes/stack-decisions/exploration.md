# Exploración: stack-decisions

Fecha: 2026-10-20. Fuente de verdad: `docs/brief.md`. Cada afirmación tiene una URL oficial. Todo lo que no está confirmado se marca como NO VERIFICADO. Las páginas obtenidas con herramientas fueron resumidas por un modelo pequeño, por lo que las cifras de precios y límites deben revisarse nuevamente al momento del diseño.

## 0. Hallazgos clave

1. **Lambda Web Functions ya se pueden usar, pero solo en 5 regiones.**
   - Regiones: us-east-1, us-east-2, us-west-2, ap-northeast-1, eu-west-1. **sa-east-1 no está incluida.** Fuente: https://aws.amazon.com/blogs/aws/announcing-aws-lambda-web-functions-for-fast-consistent-web-app-performance-anywhere/
   - Se anunció como "available today" el 2026-10-12 (blog y https://aws.amazon.com/about-aws/whats-new/2026/10/cloudfront-lambda-web-functions-origin/). Ninguna de las dos páginas usa las palabras "GA" ni "preview". Considerarla lanzada, pero con solo unos días de antigüedad.
2. **Las Web Functions no necesitan adaptador.**
   - El servidor escucha en `AWS_LAMBDA_HTTP_ENDPOINT`. La documentación indica que no se necesita Lambda Web Adapter ni un adaptador de evento a HTTP. https://docs.aws.amazon.com/lambda/latest/dg/web-functions-runtimes.html
   - Esto disuelve en gran medida la decisión 3.
3. **Function URL + OAC obliga a los navegadores a calcular el hash de cada POST/PUT.**
   - Los clientes deben enviar el SHA-256 del cuerpo en `x-amz-content-sha256`. https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html
   - El Router de SST documenta el mismo límite. Su solución alternativa usa Lambda@Edge con un tope de 1 MB en el cuerpo. https://sst.dev/docs/component/aws/router/
4. **Web Functions + OAC evitan ese problema.** POST/PUT/PATCH se firman como `UNSIGNED-PAYLOAD`, por lo que no se necesita hash del cliente. https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda-web.html
5. **Detalle problemático del encabezado para rate limiting.**
   - `CloudFront-Viewer-Address` se reenvía solo cuando la origin request policy lo incluye. https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-cloudfront-headers.html
   - Si `AllViewerExceptHostHeader` lo reenvía es NO VERIFICADO.
   - `AllViewerAndCloudFrontHeaders-2022-06` reenvía `Host`, lo que rompe los orígenes Lambda.
   - Usar una origin request policy personalizada con una lista blanca de encabezados (`Origin`, `CloudFront-Viewer-Address`, ...) que excluya `Host`.
6. **Supabase Free se pausa tras 1 semana de inactividad.** https://supabase.com/pricing

## 1. Decisión 5 (condiciona las decisiones 2 y 3): proteger el origen de `/api`

| | a) API Gateway HTTP API + encabezado secreto | b) Function URL + OAC | c) Web Function + OAC |
|---|---|---|---|
| Protección contra bypass | Secreto compartido en un encabezado de origen (más débil; puede filtrarse, requiere rotación) | IAM/SigV4 | IAM/SigV4; las llamadas directas sin firma devuelven 403 (https://dev.classmethod.jp/en/articles/aws-lambda-web-functions-cloudfront-oac/) |
| Endpoint por defecto | Se puede deshabilitar (https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-disable-default-endpoint.html); CloudFront usa entonces un dominio personalizado como origen (mecánica NO VERIFICADA) | n/a | n/a |
| POST/PUT desde el navegador | Normal | Requiere `x-amz-content-sha256` | Normal (`UNSIGNED-PAYLOAD`) |
| Costo adicional | HTTP API ~$1.00/M solicitudes (https://aws.amazon.com/api-gateway/pricing/); capa gratuita solo por 12 meses | Ninguno más allá de Lambda | Ninguno más allá de Lambda; modelo de facturación distinto |
| ¿Requiere adaptador? | Sí | Sí | No |
| Regiones | Cualquiera, incl. sa-east-1 | Cualquiera, incl. sa-east-1 | us-east-1, us-east-2, us-west-2, ap-northeast-1, eu-west-1 |
| IaC | CDK L2 maduro | CDK `FunctionUrlOrigin.withOriginAccessControl` (https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.FunctionUrlOrigin.html); SST Router `protection: "oac"` | CloudFormation `AWS::Lambda::WebFunction`, `WebFunctionRevision`, `WebFunctionEndpoint` (https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-webfunction.html); no se encontró CDK L2; SST NO VERIFICADO |
| Madurez | Alta | Alta | Baja (pocos días de antigüedad) |

### 5b. Impacto práctico de `x-amz-content-sha256`
- Factible: `crypto.subtle.digest('SHA-256', body)` en un wrapper de fetch de ~10 líneas.
- Costos:
  - Toda solicitud que modifica datos pasa por el wrapper.
  - El "Try it out" de Swagger, curl y Postman necesitan el encabezado.
  - El formulario del magic link no puede ser un POST de `<form>` HTML clásico.
  - Los tests deben replicar el encabezado.
- La cobertura de DELETE/PATCH y el comportamiento ante un hash que no coincide son NO VERIFICADOS.

### 5c. Lambda Web Functions en detalle
- **Modelo** (https://docs.aws.amazon.com/lambda/latest/dg/web-functions.html):
  - Una Web Function contiene revisiones (inmutables) y endpoints (HTTPS, canary/blue-green).
  - El código es un .zip desde un bucket S3 con versionado.
- **Runtime** (páginas de runtimes y escalado, https://docs.aws.amazon.com/lambda/latest/dg/web-functions-scaling.html):
  - Node.js 24 solo en arm64.
  - El servidor debe comenzar a escuchar dentro de 10 s.
  - 2 GB y 2 vCPU por entorno.
  - Hasta 128 solicitudes concurrentes por entorno (64 por defecto).
  - Solo HTTP/1.1, sin WebSocket.
- **Ajuste con NestJS:** `app.listen()` sobre el endpoint que entrega el entorno. El código es idéntico al local, sin adaptador.
- **Control de acceso** (https://docs.aws.amazon.com/lambda/latest/dg/web-functions-endpoint-access-control.html):
  - `AuthType: IamAuth`.
  - Una resource policy otorga `lambda:InvokeWebFunctionEndpoint` a `cloudfront.amazonaws.com`, acotada por `aws:SourceArn`.
  - Nunca usar endpoints `ApplicationManaged`, que quedan accesibles públicamente.
- **CloudFront:**
  - OAC de tipo `lambda`, firma `always-amz-auth`, `sigv4` para endpoints regionales.
  - Excluir `Host`.
  - Sin triggers de origen de Lambda@Edge.
  - Usar un endpoint regional HomeRegion.
- **Encabezados** (https://docs.aws.amazon.com/lambda/latest/dg/web-functions-http.html):
  - `X-Real-IP` se elimina.
  - A `X-Forwarded-For` se le agrega la dirección de CloudFront, por lo que no sirve para rate limiting.
  - El límite de encabezados es 128 KiB.
  - El comportamiento de Set-Cookie y de binarios es NO VERIFICADO (requiere un spike).
- **Precios** (https://aws.amazon.com/lambda/pricing/, us-east-1, Arm):
  - Tarifas: $0.30/M solicitudes, ~$0.0000276944 por vCPU-segundo activo, ~$0.0000036667 por GB-segundo durante la vida del entorno, incluido el tiempo inactivo.
  - No se menciona capa gratuita.
  - Estimación (derivada): un entorno de 2 GB inactivo cuesta ~$0.026/h. Eso son centavos al mes para un portafolio, ~$19/mes si se mantiene fijo las 24 horas.
  - El tiempo de reducción de escala en inactividad es NO VERIFICADO.
  - Acotar el costo con `maxEnvironments` y `rateLimit`.
- **Cold start:** escala a cero, sin entornos mínimos. Mitigar con un bundle pequeño de esbuild y conexión diferida (lazy) a la base de datos.
- **Redes** (https://docs.aws.amazon.com/lambda/latest/dg/web-functions-networking.html):
  - IPv4 pública saliente sin VPC.
  - Sin dominio personalizado ni WAF en el endpoint, por lo que CloudFront es obligatorio.
- **IaC:**
  - Existen recursos de CloudFormation; CDK puede usar `CfnResource`/L1.
  - Las clases dedicadas de CDK son NO VERIFICADAS.
  - SAM `AWS::Serverless::WebFunction` existe según el resumen de una búsqueda.
  - El soporte de SST, Terraform y Pulumi es NO VERIFICADO.

### Recomendación
- **c) Web Function + OAC en us-east-1**, tras un spike.
- Alternativa de respaldo: **b) Function URL + OAC** con wrapper de hash y Lambda Web Adapter.
- No recomendada: **a)**, salvo que sa-east-1 sea obligatoria.
- Checklist del spike:
  - POST a través de CloudFront.
  - Ciclo completo de Set-Cookie.
  - `CloudFront-Viewer-Address` llega al origen.
  - Una llamada directa sin firma devuelve 403.
  - Cold start.
- ADR: protección del origen y runtime de Web Functions.

## 2. Decisión 2: IaC, SST vs AWS CDK

| | SST v3 | AWS CDK |
|---|---|---|
| Motor | Proveedores de Pulumi/Terraform (https://sst.dev/docs/) | CloudFormation |
| Sitio estático | `sst.aws.StaticSite` (https://sst.dev/docs/component/aws/static-site/) | `Distribution`, `S3BucketOrigin.withOriginAccessControl`, `BucketDeployment` |
| Enrutamiento de `/api/*` | `Router` + `url.router.path`; OAC para Function URLs (https://sst.dev/docs/component/aws/router/) | Cualquier comportamiento expresable en CloudFormation |
| Web Function + OAC | NO VERIFICADO | L1/`CfnResource` |
| Origin request policy personalizada | No se expone de forma evidente (NO VERIFICADO) | `cloudfront.OriginRequestPolicy` |
| Bundling | esbuild (https://sst.dev/docs/component/aws/function/) | `NodejsFunction` (esbuild) |
| Curva de aprendizaje | Menor | Más pronunciada |
| Mercado laboral | Nicho | Mayor (afirmación NO VERIFICADA) |
| Mantenimiento | Cuestionado por terceros | Mantenido por AWS |

**Recomendación: AWS CDK (TypeScript).** Requiere ADR.

## 3. Decisión 3: adaptador HTTP

| | Lambda Web Adapter | @codegenie/serverless-express | Web Functions |
|---|---|---|---|
| Fuentes de eventos | API GW, Function URL, ALB | API GW, ALB, Lambda@Edge, VPC Lattice (Function URL no se menciona) | Servidor HTTP real |
| Paridad con local | Mismo código de servidor | Entrypoint distinto | Idéntica |
| Cookies/binarios | Binarios documentados; cookies no se mencionan | `binarySettings`; cookies no cubiertas | NO VERIFICADO (spike) |
| Mantenimiento | AWS Labs | Autor original, busca colaboradores; v5 agrega Node 24 | AWS |

Fuentes: https://github.com/awslabs/aws-lambda-web-adapter, https://github.com/CodeGenieApp/serverless-express

**Recomendación:**
- Si se elige 5c, no se necesita adaptador.
- Si se elige 5b, usar Lambda Web Adapter.
- El PDF del CV se entrega mediante una URL firmada de S3, por lo que no se requiere pasar binarios por Lambda.

## 4. Decisión 4: región de AWS

- Web Functions: 5 regiones, ninguna en Sudamérica.
- SES: sa-east-1 y us-east-1 (https://docs.aws.amazon.com/general/latest/gr/ses.html).
  - El precio es $0.10 por cada 1,000 correos (https://aws.amazon.com/ses/pricing/); las diferencias regionales son NO VERIFICADAS.
  - La cuota en sandbox es 200 por 24 h y 1 por segundo.
- Neon: aws-us-east-1, us-east-2 y aws-sa-east-1. La región queda fija al crear el proyecto (https://neon.com/docs/introduction/regions).
- Supabase: sa-east-1 y us-east-1 (https://supabase.com/docs/guides/platform/regions).
- Los certificados de CloudFront residen en ACM us-east-1.
- Regiones de Upstash y latencia desde Chile: NO VERIFICADAS.

**Recomendación: us-east-1 para todo.** Con 5a o 5b, sa-east-1 pasa a ser viable. ADR breve.

## 5. Decisión 1: Neon vs Supabase

| Criterio | Neon Free | Supabase Free |
|---|---|---|
| Plan | 100 CU-horas por proyecto al mes, 1 GB por proyecto; al exceder los límites se suspende el cómputo y se conservan los datos (https://neon.com/pricing) | 500 MB, 2 proyectos, **se pausa tras 1 semana de inactividad** (https://supabase.com/pricing) |
| Pooler | PgBouncer en modo transaction, hasta 10k clientes (https://neon.com/docs/connect/connection-pooling) | Supavisor en el puerto 6543 en modo transaction (https://supabase.com/docs/guides/database/connecting-to-postgres) |
| Prepared statements | Soportados a nivel de protocolo (PgBouncer 1.22+); sin SQL PREPARE, SET, LISTEN ni advisory locks | No soportados en modo transaction |
| Migraciones | Conexión directa por IPv4 | La conexión directa es solo IPv6 sin un add-on |
| Suspensión | Tras 5 min de inactividad; despierta en unos cientos de ms (https://neon.com/docs/introduction/scale-to-zero) | El proyecto se pausa semanalmente; despausa manual |

- TypeORM detrás de un pooler en modo transaction: NO VERIFICADO. Probarlo.
- Mantener un pool pequeño y sin estado de sesión.
- Ejecutar las migraciones sobre la URL directa.

**Recomendación: Neon Free.** Requiere ADR.

## 6. Cambios consolidados respecto del brief

| Fila del brief | Cambio |
|---|---|
| Entrada | `/api/*` va a un endpoint de Lambda Web Function (IamAuth) mediante CloudFront OAC, sin API Gateway. Una origin request policy personalizada reenvía `CloudFront-Viewer-Address` y `Origin` y excluye `Host`. |
| Runtime | NestJS corre como servidor HTTP simple sobre Web Functions (Node 24, arm64), sin adaptador. El bundle de esbuild va a un bucket S3 con versionado. |
| Datos | Neon (URL con pooler para la app, URL directa para migraciones), us-east-1. |
| Infraestructura | AWS CDK (TypeScript). |
| Región | us-east-1. |

## 7. Preguntas abiertas para el usuario
1. ¿Se acepta una funcionalidad con pocos días de antigüedad (Web Functions), con una alternativa de respaldo documentada a Function URL + OAC?
2. ¿Es aceptable la latencia Chile → us-east-1 para `/api`?
3. ¿Es aceptable un peor caso de ~$0,10–$20.10–/mes para Web Functions?

## 8. Primeros cambios sugeridos
1. `project-scaffold`: TypeScript strict, ESLint, Jest con una primera prueba que pase (activa strict TDD), gitleaks, `.gitignore`, docker-compose, CI.
2. `infra-spike`: una Web Function desechable + CloudFront OAC para resolver la decisión 5.
3. `stack-adrs`: ADRs de las decisiones confirmadas.

## 9. Riesgos
- Las Web Functions son muy nuevas.
- No hay sa-east-1 para Web Functions.
- Las Web Functions no tienen capa gratuita y facturan la memoria inactiva.
- La región de Neon es inmutable.
- TypeORM detrás de PgBouncer es NO VERIFICADO.
- Que la política administrada reenvíe `CloudFront-Viewer-Address` es NO VERIFICADO.
- El estado de mantenimiento de SST está cuestionado.
- Strict TDD permanece desactivado hasta que se instale Jest.

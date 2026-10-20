# Spike: Web Function + CloudFront OAC

> **THROWAWAY.** Código desechable para medir Q1–Q8 (change `infra-spike`). No es parte del producto: nada fuera de `spikes/` lo referencia, no tiene tests ni CI, y se destruye en un máximo de 48 h tras las mediciones. Referencias: `openspec/changes/infra-spike/`.

## Verificaciones (tarea 0.3)

Fecha de verificación: 2026-10-20. Solo fuentes oficiales de AWS (documentación, referencia de CloudFormation, tipos de `aws-cdk-lib` publicados por AWS en npm, ayuda local del AWS CLI). No se ejecutó ningún comando contra una cuenta de AWS. Sin datos de cuenta.

Base de URLs: `https://docs.aws.amazon.com`. Abreviaturas: **LDG** = `/lambda/latest/dg/`, **CFN** = `/AWSCloudFormation/latest/TemplateReference/`, **CF** = `/AmazonCloudFront/latest/DeveloperGuide/`.

| Ítem | Resultado | Fuente |
|---|---|---|
| 0.3.1 Entrypoint | VERIFICADO. El runtime carga `index.js` en la raíz del zip. Otro archivo se indica con la variable de entorno `AWS_LAMBDA_NODEJS_ENTRYPOINT` (ruta relativa a la raíz del paquete). El servidor debe empezar a escuchar en un máximo de 10 s. Lambda NO valida que escuche al crear/actualizar: la revisión puede quedar `Active` aunque falle, por eso se prueba con una solicitud tras cada deploy. Runtime: `nodejs24.x`. Máximo 512 MB descomprimido. | LDG `web-functions-runtimes.html`, LDG `web-functions-code-s3.html` |
| 0.3.2a Campo de versión del objeto S3 | VERIFICADO. En CFN: `BuildConfig.CodeConfig.S3Object.{Bucket, Key, VersionId}` (`VersionId` opcional; si se omite, Lambda toma la última versión al crear y la fija). Requiere versionado en el bucket. | CFN `aws-properties-lambda-webfunctionrevision-s3object.html`, LDG `web-functions-code-s3.html` |
| 0.3.2b `maxConcurrencyPerEnvironment` | VERIFICADO. En CFN va en `ServiceConfig.MaxConcurrencyPerEnvironment` (Integer; rango 1–128, defecto 64; es la revisión, no el endpoint). `MaxEnvironments` (mín. 2) va en `ScalingConfig` del endpoint y `RateLimit` en `ThrottleConfig` del endpoint. | CFN `aws-properties-lambda-webfunctionrevision-serviceconfig.html`, CFN `aws-properties-lambda-webfunctionendpoint-scalingconfig.html`, CFN `aws-properties-lambda-webfunctionendpoint-throttleconfig.html`, LDG `web-functions-scaling.html` |
| 0.3.2c Principal de confianza del rol de ejecución | VERIFICADO: `lambda.amazonaws.com`, acción `sts:AssumeRole`. Permisos mínimos de logs sobre `/aws/lambda/web/<function-name>` y `/aws/lambda/web/<function-name>.local` (managed policy `AWSLambdaBasicExecutionRole` también sirve). | LDG `web-functions-permissions.html` |
| 0.3.3 Tipos nativos de CFN | VERIFICADO en la documentación (no con `list-types`, que exige credenciales): existen `AWS::Lambda::WebFunction`, `AWS::Lambda::WebFunctionRevision` y `AWS::Lambda::WebFunctionEndpoint`, y `AWS::Lambda::ResourcePolicy` acepta ARN de web function (`...:web-function/<name>`, sin forma calificada, sin comodines). `aws-cdk-lib@2.274.0` trae los L1 `CfnWebFunction`, `CfnWebFunctionRevision`, `CfnWebFunctionEndpoint` y `CfnResourcePolicy`. Decisión: la vía de la resource policy es **(1) nativa** (`CfnResourcePolicy`), y para los recursos de la función se usan los L1 en vez de `CfnResource`. No verificado: disponibilidad efectiva de los tipos en el registro de la cuenta en us-east-1 (se confirma con `cdk synth`/`deploy`). | CFN `aws-resource-lambda-webfunction.html`, `-webfunctionrevision.html`, `-webfunctionendpoint.html`, `aws-resource-lambda-resourcepolicy.html`; paquete npm `aws-cdk-lib@2.274.0` (`aws-lambda/lib/lambda.generated.d.ts`) |
| 0.3.4 Cliente SDK v3 `lambda-web` | VERIFICADO que existe: paquete npm `@aws-sdk/client-lambda-web` (3.1153.0). Queda como respaldo; con la vía nativa de 0.3.3 no hace falta `AwsCustomResource`. El AWS CLI local (2.38.2) trae el servicio `lambda-web` con `put-resource-policy`. | npm `@aws-sdk/client-lambda-web`; ayuda local `aws lambda-web help`; LDG `web-functions-endpoint-access-control.html` |
| 0.3.5 Formato de `AWS_LAMBDA_HTTP_ENDPOINT` | VERIFICADO: `host:port`. Ejemplo oficial: `const [host, port] = (process.env.AWS_LAMBDA_HTTP_ENDPOINT \|\| 'localhost:3000').split(':')`. Lambda no define la variable en local. | LDG `web-functions-runtimes.html` |
| 0.3.6 L2 `Distribution` y OAC `lambda` | VERIFICADO. `HttpOriginProps` extiende `OriginProps`, que tiene `originAccessControlId` y lo renderiza en la configuración del origen: NO hace falta `addPropertyOverride`. Existe `OriginAccessControlOriginType.LAMBDA`. Requisitos de CloudFront para Web Functions: endpoint con `IamAuth`; OAC con `SigningBehavior` **`always-amz-auth`** (el único soportado; `always`, `never` y `no-override` NO sirven; en CDK `SigningBehavior.ALWAYS_AMZ_AUTH`) y `sigv4` para endpoint regional; la origin request policy debe excluir `Host`. | CF `private-content-restricting-access-to-lambda-web.html`; CFN `aws-properties-cloudfront-originaccesscontrol-originaccesscontrolconfig.html`; paquete npm `aws-cdk-lib@2.274.0` (`aws-cloudfront/lib/origin.d.ts`, `origin-access-control.d.ts`) |
| 0.3.7 `Content-Type` y `CloudFront-Viewer-Address` | VERIFICADO. `Content-Type` es un encabezado que CloudFront reenvía al origen por defecto (tabla de comportamiento con origen personalizado); incluirlo en la lista permitida es inofensivo. `CloudFront-Viewer-Address` (IP:puerto del visitante) se puede agregar en una origin request policy pero NO en una cache policy. | CF `RequestAndResponseBehaviorCustomOrigin.html`, CF `adding-cloudfront-headers.html` |
| 0.3.8 `EndpointActiveEnvironments` | VERIFICADO. Namespace `AWS/Lambda/Web/Usage` (no `AWS/Lambda/Web`); dimensiones `FunctionName`, `EndpointName`, `ExecutionRegion`; estadística `Maximum`. **No hay datapoints mientras el endpoint no recibe solicitudes** (el valor puede ser 0 solo con solicitudes): para Q7 "0 entornos" debe interpretarse también como ausencia de datos. `EndpointRequestThrottles` (Sum, esparsa) está en el mismo namespace. | LDG `web-functions-monitoring-metrics.html` |
| 0.3.9 Log group | VERIFICADO: `/aws/lambda/web/<function-name>` más el auxiliar `/aws/lambda/web/<function-name>.local`. No existen hasta la primera solicitud y quedan sin expiración; Lambda los crea, por eso `cdk destroy` no los elimina: borrarlos a mano en el desmontaje (prefijo `/aws/lambda/web/`, no `/aws/lambda`). | LDG `web-functions-logging.html` |

### Hallazgos que afectan el diseño y las tareas (tarea 0.4)

Ninguno invalida la arquitectura (Web Function + CloudFront OAC + CDK), pero varios valores y supuestos del diseño/tareas son incorrectos y deben corregirse ANTES de la Fase 4. Pendiente de decisión de la usuaria:

1. **OAC `SigningBehavior`**: debe ser `always-amz-auth`, no `always` (tarea 4.4, diseño "Distribución"). Con `always` CloudFront rechaza la configuración.
2. **Falta una bucket policy** que permita a `lambda.amazonaws.com` hacer `s3:GetObject` y `s3:GetObjectVersion` sobre el bucket de código, con condición `ArnLike` sobre `aws:SourceArn` con el patrón de ARN de revisión de la función (`web-function/<name>/revision/*`, comodín obligatorio porque Lambda genera el ID de revisión). Lambda lo comprueba al crear la revisión y rechaza la solicitud si falta (tarea 4.2). Además, no se puede borrar el objeto/versión ni quitar el acceso mientras una revisión lo use (la revisión pasa a `Failed` de forma permanente): afecta el orden de `cdk destroy`.
3. **`X-Real-IP` lo elimina Lambda** antes de llegar a la app (Q3, `GET /headers`): se espera que aparezca vacío; usar `cloudfront-viewer-address` y `x-forwarded-for` (el último valor de `X-Forwarded-For` es una dirección de CloudFront).
4. **`Host`** que recibe la app es el dominio del endpoint (no el de la distribución).
5. **Q1**: la documentación indica que NO hace falta enviar `x-amz-content-sha256` a CloudFront (firma con `UNSIGNED-PAYLOAD` en PUT/POST/PATCH); es una predicción a confirmar con la medición, no un resultado.
6. **Endpoint**: el ejemplo oficial usa `RevisionWeights` (`RevisionId` + `Weight: 100`) para enrutar tráfico; la tarea 4.3 no lo menciona. Revisión y endpoint son recursos separados y las revisiones son inmutables (cambian = reemplazo).
7. **`rateLimit` 100 y `maxEnvironments` 2** son valores válidos (múltiplos de 100 hasta 1000; mín. 2).
8. **Q7**: ver 0.3.8 (namespace `AWS/Lambda/Web/Usage`, sin datos en inactividad).
9. **Limpieza de logs**: ver 0.3.9.

## Runbook manual de costos (tarea 1.3)

AWS no tiene un tope estricto de gasto. Budgets **solo notifica** y sus datos se actualizan hasta 3 veces al día, con 8–12 h de diferencia: una alerta puede llegar cuando el dinero ya se gastó (https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html). No hay kill switch automático (ni Budgets Actions ni Lambda de apagado). Las cotas reales son `maxEnvironments: 2`, `rateLimit: 100` y el desmontaje en un máximo de 48 h.

Ante CUALQUIER alerta de presupuesto, la usuaria elige una:

- **(a) Bloquear el tráfico** (el endpoint responde 503 con `lambda-web-error-type: Platform.EndpointDisabled` hasta que `rateLimit` sea distinto de 0):

  ```bash
  aws lambda-web update-web-function-endpoint \
    --function-name <function-name> \
    --endpoint-name <endpoint-name> \
    --throttle-config '{"rateLimit":0}' \
    --region us-east-1
  ```

- **(b) Desmontar todo**:

  ```bash
  cdk destroy --all
  ```

  Después, verificar restos: `aws s3api list-object-versions` vacío, log groups `/aws/lambda/web/<function-name>` y `.local` eliminados a mano, presupuesto inexistente y distribución eliminada. El stack de bootstrap permanece.

Fuentes: LDG `web-functions-scaling.html` (rateLimit 0 -> 503 `Platform.EndpointDisabled`), ayuda local `aws lambda-web update-web-function-endpoint` (`--throttle-config`).

## Escaneo de secretos (tarea 1.4)

Repo público: nada de IDs de cuenta, ARNs, hostnames reales de CloudFront/endpoint, IPs, correos ni `.env*`. Correr antes de cada commit, desde la raíz del repo:

```bash
bash spikes/web-functions/scripts/scan-secrets.sh
```

El script ejecuta `gitleaks detect --no-git --source .` (si está instalado), un barrido con `rg` y una verificación de `git status`. Termina con código 0 solo si no hay coincidencias.

**Por qué los patrones son más finos que los del diseño** (`cloudfront\.net|on\.aws` a secas): los documentos de `openspec/` mencionan legítimamente `*.cloudfront.net` y `*.on.aws`, así que el patrón simple marcaría falsos positivos y se terminaría ignorando. Se buscan hostnames reales según el formato verificado:

| Patrón | Qué detecta |
|---|---|
| `\b[0-9]{12}\b` | ID de cuenta de 12 dígitos (gitleaks no lo detecta) |
| `arn:aws[:][a-z0-9-]*:[a-z0-9-]*:[0-9]{12}` | ARNs con ID de cuenta real; los de ejemplo con `<region>:<account>` no se marcan (la clase `[:]` evita que el script y este README se detecten a sí mismos) |
| `AKIA[0-9A-Z]{16}` | Access key IDs |
| `\b[a-z0-9]{10,}\.cloudfront\.net\b` | Dominio real de distribución (los de ejemplo con `*` no calzan) |
| `\b[a-z0-9-]+\.[a-z0-9-]+\.lambda-web\.[a-z0-9-]+\.on\.aws\b` | Dominio real de endpoint (formato verificado: `<id>.<id>.lambda-web.<region>.on.aws`) |

gitleaks **no está instalado** en esta máquina (verificado con `which gitleaks`); el script lo omite con un aviso. Instalarlo (`brew install gitleaks`) requiere la aprobación de la usuaria.

## Inicio rápido

Las fases 2–4 (app NestJS, build, CDK) se agregan en el siguiente commit. Esta carpeta es aislada: tendrá su propio `package.json` y no comparte dependencias con el resto del repo.

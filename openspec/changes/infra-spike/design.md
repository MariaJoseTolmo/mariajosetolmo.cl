# Diseño: Infra Spike — Web Function + CloudFront OAC

## Enfoque técnico

El spike es una app CDK (TypeScript) aislada con dos stacks en us-east-1. `SpikeCodeStack` contiene el bucket de código con versionado y su bucket policy para Lambda. `SpikeWebStack` contiene la Web Function, CloudFront, OAC, las políticas y el presupuesto. Una app NestJS mínima de probes responde Q1–Q4. Scripts de Node miden Q5–Q7. Q8 es un inventario de constructs. La evidencia va en `results.md`.

El código es desechable. La regla hexagonal de `config.yaml` se omite a propósito: aquí no hay dominio.

> **Hechos verificados (2026-10-20, solo documentación oficial).** Los ítems antes marcados NO VERIFICADO se resolvieron en la sección "Verificaciones" de `spikes/web-functions/README.md` (tarea 0.3), con las URLs fuente. Este diseño los cita como **VERIFICADO (docs, README 0.3.x)**. Nada se probó todavía contra una cuenta: la disponibilidad real de los tipos de CFN en el registro de us-east-1 se confirma con `cdk synth`/`deploy`.

## Decisiones de arquitectura

| Decisión | Elección | Descartado | Justificación |
|---|---|---|---|
| Entrega del código | Dos stacks. `scripts/upload.sh` sube `app-<sha256>.zip` y captura `VersionId`, que se pasa como `-c codeKey= -c codeVersion=` | `BucketDeployment` / assets de CDK | Una revisión necesita una clave y una versión fijas (`BuildConfig.CodeConfig.S3Object.{Bucket, Key, VersionId}`, VERIFICADO docs, README 0.3.2a). `BucketDeployment` oculta la versión. Si el bucket de bootstrap tiene versionado sigue sin verificar (informativo; no se usa) |
| Acceso de Lambda al bucket de código | Bucket policy en `SpikeCodeStack`: principal `lambda.amazonaws.com`, acciones `s3:GetObject` + `s3:GetObjectVersion`, condición `ArnLike` `aws:SourceArn` = `arn:aws:lambda:<region>:<account>:web-function/<name>/revision/*` | Sin policy (confiar en el rol de ejecución) | Lambda la comprueba al crear la revisión y rechaza la solicitud si falta. El comodín es obligatorio porque Lambda genera el ID de revisión (VERIFICADO docs, README hallazgo 2) |
| Recursos de Web Function | L1 `CfnWebFunction`, `CfnWebFunctionRevision`, `CfnWebFunctionEndpoint` de `aws-cdk-lib` >= 2.274.0 | `CfnResource` genérico; esperar un L2 | Los L1 existen y tipan las propiedades (VERIFICADO docs, README 0.3.3). No existe L2. `CfnResource` queda solo como escape si los L1 fallan en synth |
| Revisión | `CfnWebFunctionRevision` con `ServiceConfig.MaxConcurrencyPerEnvironment` por defecto (64). Las revisiones son inmutables: cualquier cambio (código, config) es reemplazo | Mutar la revisión en sitio | VERIFICADO docs, README 0.3.2b y hallazgo 6 |
| Endpoint | `CfnWebFunctionEndpoint` con `IamAuth`, `HomeRegion`, `ScalingConfig.MaxEnvironments: 2`, `ThrottleConfig.RateLimit: 100` y `RevisionWeights: [{ RevisionId, Weight: 100 }]` | `maxEnvironments: 1` (de la propuesta); endpoint sin `RevisionWeights` | 1 no es válido (mín. 2). `RateLimit` 100 es válido (múltiplos de 100 hasta 1000). Sin `RevisionWeights` el endpoint no enruta tráfico (README hallazgos 6 y 7). El peor caso teórico es ~2× USD 19/mes |
| Presupuesto | `CfnBudget`: presupuesto mensual de COST de USD 20. Alertas por correo ACTUAL en USD 5, 10, 15 y 20, más una alerta FORECASTED en > USD 20 | Una sola alerta de USD 5; kill switch automático (Budgets → Lambda establece `rateLimit=0`) | El usuario rechazó la automatización. Las alertas más un runbook manual mantienen el stack simple. AWS no tiene un tope estricto |
| Resource policy | Orden de preferencia para Q8: (1) nativo `CfnResourcePolicy` (`AWS::Lambda::ResourcePolicy`, ARN `...:web-function/<name>` sin calificar ni comodines), (2) `AwsCustomResource` con `@aws-sdk/client-lambda-web` (`PutResourcePolicy`), (3) script de CLI con compuerta `aws lambda-web put-resource-policy` | Política en línea en la función | Se espera que (1) funcione (VERIFICADO docs, README 0.3.3), pero no está verificado en vivo en el registro de la cuenta; (2) y (3) quedan como respaldo en ese orden. La política en línea crearía un ciclo (función → distribución → endpoint → función). Como recurso hoja separado no hay ciclo |
| Distribución | L2 `Distribution` + `HttpOrigin(endpoint DomainName, { originAccessControlId })` + L1 `CfnOriginAccessControl` (`OriginAccessControlOriginType: lambda`, `SigningBehavior: always-amz-auth`, `SigningProtocol: sigv4`) | `addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId')`; `CfnDistribution` completo; `SigningBehavior` `always`/`never`/`no-override` | `HttpOriginProps` acepta `originAccessControlId` y lo renderiza: el override no hace falta (VERIFICADO docs, README 0.3.6). `always-amz-auth` es el ÚNICO valor soportado para orígenes Web Function; con `always` CloudFront rechaza la configuración (en CDK, `SigningBehavior.ALWAYS_AMZ_AUTH`) |
| Origin request policy | Personalizada: encabezados `CloudFront-Viewer-Address`, `Origin`, `Content-Type`, `Accept`; todas las cookies; todos los query strings; SIN `Host`. Cache policy `CACHING_DISABLED`, métodos `ALLOW_ALL` | Políticas administradas | CloudFront exige excluir `Host`. `CloudFront-Viewer-Address` solo se puede agregar en una origin request policy (no en cache policy). `Content-Type` se reenvía por defecto; incluirlo en la lista es inofensivo (VERIFICADO docs, README 0.3.6 y 0.3.7) |
| Bundling | esbuild → un único `index.js` CJS en la RAÍZ del zip, `platform: node`, `target: node24`, runtime `nodejs24.x`. Los opcionales lazy de Nest (`@nestjs/microservices`, `@nestjs/websockets`, `class-validator`, `class-transformer`) son externos. Se comprime con `zip -X`. Máx. 512 MB descomprimido | `tsc` + `node_modules`; otro nombre de archivo | El runtime carga `index.js` en la raíz; otro archivo requiere `AWS_LAMBDA_NODEJS_ENTRYPOINT` (VERIFICADO docs, README 0.3.1). Un bundle pequeño implica un cold start más rápido (Q5) |
| DI bajo esbuild | Un controller, sin inyección por constructor | Emisión con `tsc` | esbuild no emite `emitDecoratorMetadata`, por lo que la DI por constructor se rompe |

## Flujo de datos

```
Deploy (apply STOPS for confirmation at each [G]):
[G1] cdk deploy SpikeCodeStack  -> versioned bucket + bucket policy (lambda.amazonaws.com)
[G2] upload.sh                  -> zip + VersionId
[G3] cdk deploy SpikeWebStack -c codeKey -c codeVersion
       Role -> WebFunction -> Revision -> Endpoint(RevisionWeights 100, DomainName)
            -> OAC(always-amz-auth) + ORP -> Distribution(ARN) -> ResourcePolicy -> Budget
[G4] only if fallback (3): put-resource-policy script

Request:
Browser/curl (CL) --HTTPS--> CloudFront edge --SigV4 (OAC, UNSIGNED-PAYLOAD)--> Endpoint (IamAuth)
   --> NestJS on AWS_LAMBDA_HTTP_ENDPOINT (host:port)
Direct curl --> Endpoint (unsigned) --> 403 (Q4)
```

Notas del flujo de solicitud (VERIFICADO docs, README hallazgos 3–5):

- Lambda **elimina `X-Real-IP`** antes de llegar a la app. Q3 se evalúa con `cloudfront-viewer-address` y `x-forwarded-for` (el último valor de `X-Forwarded-For` es una dirección de CloudFront).
- El `Host` que recibe la app es el dominio del endpoint, no el de la distribución.
- `UNSIGNED-PAYLOAD` en PUT/POST/PATCH es lo que indica la documentación. Para Q1 es una **predicción a medir**, no un resultado.

## Cambios en archivos

| Archivo | Acción | Descripción |
|---|---|---|
| `.gitignore` | Crear | `node_modules/`, `cdk.out/`, `cdk.context.json`, `.env*`, `dist/`, `*.zip`, `*.log`, `.DS_Store` |
| `spikes/web-functions/README.md` | Crear | Aviso de "Throwaway", verificaciones, runbook de despliegue/desmontaje |
| `spikes/web-functions/{package.json,tsconfig.json,cdk.json}` | Crear | Dependencias aisladas (`aws-cdk-lib` >= 2.274.0, constructs, esbuild, @nestjs/*) |
| `spikes/web-functions/bin/app.ts` | Crear | Stacks; `env.account` proviene de `CDK_DEFAULT_ACCOUNT` |
| `spikes/web-functions/lib/code-stack.ts` | Crear | Bucket con versionado, `DESTROY` + `autoDeleteObjects`, bucket policy para `lambda.amazonaws.com` |
| `spikes/web-functions/lib/web-stack.ts` | Crear | Todo lo de la cadena de Deploy |
| `spikes/web-functions/app/src/main.ts` | Crear | Bootstrap y listen (en < 10 s) |
| `spikes/web-functions/app/src/probe.controller.ts` | Crear | Endpoints de prueba (probes) |
| `spikes/web-functions/scripts/{build.mjs,upload.sh}` | Crear | Bundle, zip, sha, subida |
| `spikes/web-functions/scripts/measure.mjs` | Crear | Ejecutor de Q1/Q3/Q4/Q5/Q6 con percentiles |
| `spikes/web-functions/scripts/q7-poll.sh` | Crear | Sondeo de CloudWatch |
| `openspec/changes/infra-spike/results.md` | Crear | Evidencia |

## Interfaces / Contratos

El prefijo global es `/api`.

| Ruta | Devuelve | Para |
|---|---|---|
| `GET /health` | `{ bootId, coldBootMs, uptimeMs }` (`bootId` es aleatorio por entorno) | Q5–Q7 |
| `POST /echo` | `{ body, sha256Header }` | Q1 |
| `GET /cookies/set` | 3 encabezados `Set-Cookie` (`HttpOnly; Secure; SameSite=Strict; Path=/api`) | Q2 |
| `GET /cookies/echo` | `{ cookieNames }` | Q2 |
| `GET /headers` | `cloudfront-viewer-address`, `x-forwarded-for`, `x-real-ip` (se espera vacío: Lambda lo elimina; solo diagnóstico), `origin`, `host` | Q3 |

`main.ts` registra en el log el valor crudo de `AWS_LAMBDA_HTTP_ENDPOINT` y lo interpreta como `host:port` (VERIFICADO docs, README 0.3.5; patrón oficial `split(':')`), con `localhost:3000` por defecto en local (Lambda no define la variable fuera de AWS). El servidor MUST empezar a escuchar en un máximo de 10 s. Lambda NO valida que escuche al crear/actualizar (la revisión puede quedar `Active` aunque falle), por eso se prueba con una solicitud tras cada deploy.

## Estrategia de pruebas (medición)

| Q | Comando (desde Chile) | n | Se registra |
|---|---|---|---|
| 1 | `measure.mjs echo` (POST JSON equivalente a curl, sin encabezado de hash) | 3 | estado, coincidencia del eco. La docs predice éxito con `UNSIGNED-PAYLOAD`; el resultado sale de la medición |
| 2 | Chrome: abrir `/api/cookies/set`, luego `/api/cookies/echo`; atributos de cookies en DevTools; `curl -i` para contar encabezados | 1 navegador + 1 curl | atributos, nombres devueltos |
| 3 | `measure.mjs headers` vs `curl checkip.amazonaws.com`; se compara contra `cloudfront-viewer-address` y `x-forwarded-for` (no `x-real-ip`) | 3 | coincide sí/no (IP enmascarada) |
| 4 | `curl -i https://<endpoint>/api/health` | 3 | estado |
| 5 | primera solicitud tras inactividad (Q7: 0 entornos o sin datapoints), más `coldBootMs` | ≥ 3 | mín/mediana/máx |
| 6 | `measure.mjs latency --n 50` tras 2 calentamientos, secuencial | 50 (≥ 20) | p50/p95 |
| 7 | Anotar T0 tras la última solicitud; `q7-poll.sh` cada 5 min hasta 60 min | 1 ejecución | minutos hasta 0 entornos (o ausencia de datapoints) |
| 8 | Tabla de inventario: L2 / L1 / `CfnResource` / custom resource / CLI | — | lista |

Q7 (VERIFICADO docs, README 0.3.8): métrica `EndpointActiveEnvironments` en el namespace `AWS/Lambda/Web/Usage` (no `AWS/Lambda/Web`), dimensiones `FunctionName`, `EndpointName`, `ExecutionRegion`, estadística `Maximum`. **No hay datapoints mientras el endpoint no recibe solicitudes**: para Q7 la ausencia de datos cuenta como 0 entornos. `EndpointRequestThrottles` (Sum, esparsa) está en el mismo namespace. Tras el deploy se reconfirma con `aws cloudwatch list-metrics --namespace AWS/Lambda/Web/Usage`.

Columnas de `results.md`: `# | value | n | PASS/FAIL | date (UTC) | notes`, luego la decisión Go/Plan B/sa-east-1. Ocultar (redact) IPs, dominios, ARNs e IDs de cuenta.

## Migración / Despliegue

- **Desmontaje (≤ 48 h)**:
  1. Destruir **`SpikeWebStack` ANTES que `SpikeCodeStack`** (`cdk destroy --all` respeta la dependencia; si se destruye por stack, ese orden). Si se borra el objeto/versión del zip o se quita el acceso de la bucket policy mientras una revisión lo usa, la revisión pasa a `Failed` de forma permanente (README hallazgo 2).
  2. Verificar que `aws s3api list-object-versions` esté vacío.
  3. Borrar a mano los log groups `/aws/lambda/web/<fn>` y `/aws/lambda/web/<fn>.local`: Lambda los crea y quedan sin expiración, por eso `cdk destroy` no los elimina. Buscar con `describe-log-groups --log-group-name-prefix /aws/lambda/web/` (VERIFICADO docs, README 0.3.9).
  4. Confirmar que el presupuesto ya no existe y que la distribución fue eliminada. El stack de bootstrap permanece.
- **Runbook de alertas de presupuesto (manual, sin automatización)**: ante cualquier alerta, elegir una:
  1. Bloquear el tráfico: `aws lambda-web update-web-function-endpoint ... --throttle-config '{"rateLimit":0}'`. El endpoint devuelve entonces 503 `Platform.EndpointDisabled`, según lo documentado en la documentación de escalado.
  2. Desmontar: `cdk destroy --all` (más los pasos 2–4 de arriba).

  Los datos de Budgets se actualizan hasta 3 veces al día, con 8–12 h de diferencia, por lo que una alerta puede llegar después de que el dinero ya se haya gastado (https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).
- **Higiene**: ejecutar `bash spikes/web-functions/scripts/scan-secrets.sh` (gitleaks + `rg` con patrones finos, ver README 1.4) antes de cada commit. gitleaks no detecta IDs de cuenta, por eso existe la pasada con `rg`. Pasar el correo de alerta mediante `-c alertEmail=`; nunca commitearlo.
- **Delta del Plan B** (solo `web-stack.ts` más un cambio en un script; la app y los probes no se tocan):
  1. `NodejsFunction` (arm64) + layer de Lambda Web Adapter (ARN NO VERIFICADO) + `FunctionUrl` `AWS_IAM` + `FunctionUrlOrigin.withOriginAccessControl`.
  2. `measure.mjs` agrega `x-amz-content-sha256`; el navegador usa un wrapper de `crypto.subtle` de ~10 líneas.
- **Insumos de ADR para `stack-adrs`**: runtime de Web Functions (Q5–Q7), protección del origen mediante OAC (Q1–Q4), CDK como IaC (Q8), región us-east-1 (Q6).
- **Tamaño de revisión**: ~450–500 líneas sin el lockfile, lo que supera el presupuesto de 400. División sugerida: PR1 = infra + app + build (~330); PR2 = scripts + results (~150). `sdd-tasks` decide.

## Preguntas abiertas

- [x] Convención de entrypoint/comando de inicio dentro del zip. VERIFICADO (docs, README 0.3.1): `index.js` en la raíz; override con `AWS_LAMBDA_NODEJS_ENTRYPOINT`; escuchar en ≤ 10 s.
- [x] Campo de versión del objeto S3, capitalización de `MaxConcurrencyPerEnvironment` y principal de confianza del rol. VERIFICADO (docs, README 0.3.2a–c): `S3Object.VersionId`; `ServiceConfig.MaxConcurrencyPerEnvironment` (1–128, defecto 64); `lambda.amazonaws.com` + `sts:AssumeRole`.
- [x] Vía de la resource policy / cliente SDK v3 `lambda-web`. VERIFICADO (docs, README 0.3.3–0.3.4): existe `AWS::Lambda::ResourcePolicy` (L1 `CfnResourcePolicy`) y `@aws-sdk/client-lambda-web`. Pendiente solo la confirmación en vivo con `cdk synth`/`deploy`.
- [x] ¿Un fallback de CLI para la política cuenta como Q8 FAIL? Resuelto en spec R8: no; es PASS con deuda registrada + test de humo que verifica el 403 directo.
- [ ] Disponibilidad efectiva de `AWS::Lambda::WebFunction*` y `AWS::Lambda::ResourcePolicy` en el registro de CloudFormation de la cuenta en us-east-1 (se confirma en 4.8/5.3; si falla, aplicar el orden de respaldo de Q8).

## Riesgos

- AWS no tiene un tope estricto de gasto. Budgets solo notifica, y sus datos se retrasan hasta 8–12 h. Las cotas de costo son `maxEnvironments: 2`, `rateLimit: 100`, el runbook manual y el desmontaje dentro de 48 h.
- Orden de desmontaje: destruir el stack de código (o borrar la versión del zip) antes que el web stack deja la revisión en `Failed` permanente y puede trabar el destroy.
- Log groups huérfanos sin expiración si se omite el borrado manual por prefijo `/aws/lambda/web/`.
- Los tipos nativos están verificados solo en documentación; un fallo en el registro de la cuenta obliga a usar el respaldo (`AwsCustomResource` → script).

# Tareas: Infra Spike — Web Function + CloudFront OAC

Trazabilidad: cada tarea cita el requisito (R1–R14) de `specs/infra-spike-evidence/spec.md`. Apply NO implementa nada fuera de esta lista.

## Reglas transversales (aplican a TODAS las tareas)

- **Compuerta de deploy [G]**: toda tarea marcada `[G]` DETIENE apply. Se muestra el resumen de `cdk diff` y se espera confirmación explícita de la usuaria. Cada redeploy requiere una confirmación nueva (R10). La usuaria ejecuta los comandos de AWS ella misma o autoriza cada uno.
- **Shell**: usar `rg`, `bat`, `fd`, `sd`, `eza`. Nunca `grep`, `cat`, `find`, `sed`, `ls`.
- **Commits**: conventional commits, sin atribución de IA y sin `Co-Authored-By`. Un commit por unidad de trabajo (ver slices).
- **Repo público**: nada de IDs de cuenta, ARNs, URLs `*.cloudfront.net` / `*.on.aws`, IPs ni correos commiteados. Valores vía `CDK_DEFAULT_ACCOUNT` y `-c alertEmail=`.
- **Costo**: sin kill switch automático (ni Budgets Actions ni Lambda de apagado). Solo alertas + runbook manual.

## Fase 0: Prerrequisitos (acciones de la usuaria) y verificación de NO VERIFICADOS

- [x] 0.1 (USUARIA) Confirmar perfil de credenciales de AWS para CDK y exportar `AWS_PROFILE` / `CDK_DEFAULT_ACCOUNT` localmente (no commitear). Dependencia de todo el despliegue. (R10) HECHO: perfil configurado (usuario IAM, no root).
- [x] 0.2 (USUARIA) Ejecutar `cdk bootstrap aws://<account>/us-east-1`. Anotar si el bucket de bootstrap tiene versionado (NO VERIFICADO; informativo, el diseño ya usa un bucket propio). (R10) HECHO: bootstrap exitoso en us-east-1.
- [x] 0.3 Verificar contra la documentación oficial de AWS, ANTES de escribir el código que depende de cada ítem, y anotar la fuente y el resultado en una sección "Verificaciones" al inicio de `spikes/web-functions/README.md` (sin datos de cuenta):
  - [x] 0.3.1 Convención de entrypoint/comando de inicio de la Web Function dentro del zip (runtimes).
  - [x] 0.3.2 Nombre del campo de versión del objeto S3 en la revisión, capitalización de `maxConcurrencyPerEnvironment` y principal de confianza del rol de ejecución.
  - [x] 0.3.3 Existencia de tipos nativos de CFN: `aws cloudformation list-types --filters TypeNamePrefix=AWS::Lambda::Web` (decide la vía de la resource policy: nativo / `AwsCustomResource` / script).
  - [x] 0.3.4 Disponibilidad del cliente SDK v3 `lambda-web` para `AwsCustomResource`.
  - [x] 0.3.5 Formato de `AWS_LAMBDA_HTTP_ENDPOINT` (puerto solo, `host:port` o URL).
  - [x] 0.3.6 Si el L2 `Distribution` acepta un OAC de tipo `lambda`, o se requiere `addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId')`.
  - [x] 0.3.7 Reenvío de `Content-Type` con la origin request policy personalizada, y soporte de `CloudFront-Viewer-Address` en políticas.
  - [x] 0.3.8 Namespace y dimensiones de `EndpointActiveEnvironments` (se confirma de nuevo en 6.5 con `list-metrics` tras el deploy).
  - [x] 0.3.9 Nombre del log group de la función. VERIFICADO (docs, README 0.3.9): `/aws/lambda/web/<fn>` y `/aws/lambda/web/<fn>.local`.
  - Resultados de 0.3.x: VERIFICADOS en documentación (ver "Verificaciones" en `spikes/web-functions/README.md`); las tareas 2.x–7.x de abajo ya los incorporan.
- [x] 0.4 Si 0.3 invalida una decisión del diseño, registrar el hallazgo en el README y STOP: avisar a la usuaria antes de seguir. (R8)

## Fase 1: Higiene del repositorio y runbook de costos (ANTES de cualquier commit/deploy)

- [x] 1.1 Crear `.gitignore` (raíz): `node_modules/`, `cdk.out/`, `cdk.context.json`, `.env*`, `dist/`, `*.zip`, `*.log`, `.DS_Store`. (R13)
- [x] 1.2 Crear `spikes/web-functions/README.md` con aviso "Throwaway", nota de que nada fuera de `spikes/` lo referencia, y la sección de verificaciones de 0.3. (R14)
- [x] 1.3 Escribir en el README el **runbook manual de costos** (debe existir antes del primer deploy): ante cualquier alerta, la usuaria elige (a) `aws lambda-web update-web-function-endpoint ... --throttle-config '{"rateLimit":0}'` (503 `Platform.EndpointDisabled`) o (b) `cdk destroy --all`. Incluir la advertencia de que los datos de Budgets se retrasan 8–12 h y que AWS no tiene tope estricto. (R9)
- [x] 1.4 Definir y documentar el script de escaneo de secretos (comandos, no secretos): `gitleaks detect --no-git --source .` y `rg -n '\b\d{12}\b|arn:aws|cloudfront\.net|on\.aws|AKIA'` + verificación de que no hay `.env*` en staging. Ejecutarlo; debe dar cero coincidencias. (R13)
- [x] 1.5 Verificar que `cdk.out/` y `.env*` no aparecen como untracked (`git status`). (R13)
- **Commit 1**: `chore: add gitignore and spike readme with cost runbook` (solo si 1.4 y 1.5 pasan).

## Fase 2: App NestJS de probes (código desechable)

- [x] 2.1 Crear `spikes/web-functions/{package.json,tsconfig.json,cdk.json}` con dependencias aisladas (aws-cdk-lib, constructs, esbuild, @nestjs/*, TypeScript strict). Sin Jest ni CI. (R14)
- [x] 2.2 `app/src/main.ts`: bootstrap con prefijo global `/api`, loguea el valor crudo de `AWS_LAMBDA_HTTP_ENDPOINT` y lo interpreta como `host:port` (`split(':')`, VERIFICADO docs, README 0.3.5), `localhost:3000` por defecto en local. Debe empezar a escuchar en ≤ 10 s (Lambda no lo valida al deploy; se prueba con una solicitud). (R5)
- [x] 2.3 `app/src/probe.controller.ts`, un solo controller sin inyección por constructor (esbuild no emite `emitDecoratorMetadata`): (R1, R2, R3, R4, R5)
  - [x] 2.3.1 `GET /health` → `{ bootId, coldBootMs, uptimeMs }`
  - [x] 2.3.2 `POST /echo` → `{ body, sha256Header }`
  - [x] 2.3.3 `GET /cookies/set` → 3 `Set-Cookie` separados (`HttpOnly; Secure; SameSite=Strict; Path=/api`)
  - [x] 2.3.4 `GET /cookies/echo` → `{ cookieNames }`
  - [x] 2.3.5 `GET /headers` → `cloudfront-viewer-address`, `x-forwarded-for`, `x-real-ip` (se espera vacío: Lambda lo elimina; solo diagnóstico), `origin`, `host`
- [x] 2.4 Smoke local (sin AWS): levantar la app y verificar los 5 endpoints con `curl -i`. Confirmar 3 `Set-Cookie` como encabezados separados. (R2)

## Fase 3: Build y subida

- [x] 3.1 `scripts/build.mjs`: esbuild a un único `index.js` CJS (`platform: node`, `target: node24`), externos `@nestjs/microservices`, `@nestjs/websockets`, `class-validator`, `class-transformer`; empaquetar con `zip -X` a `app-<sha256>.zip` con `index.js` en la RAÍZ del zip (entrypoint por defecto del runtime `nodejs24.x`; otro nombre exigiría `AWS_LAMBDA_NODEJS_ENTRYPOINT`, VERIFICADO docs, README 0.3.1). Máx. 512 MB descomprimido. Registrar el tamaño del bundle. (R5)
- [x] 3.2 `scripts/upload.sh`: sube el zip al bucket versionado, captura `VersionId` y lo imprime para `-c codeKey= -c codeVersion=`. Sin hardcodear nombres de bucket ni cuentas. (R8, R13)

## Fase 4: Infraestructura CDK (solo synth/diff; sin deploy)

- [x] 4.1 `bin/app.ts`: dos stacks en us-east-1, `env.account` desde `CDK_DEFAULT_ACCOUNT`. (R13)
- [x] 4.2 `lib/code-stack.ts`: bucket con versionado, `RemovalPolicy.DESTROY` + `autoDeleteObjects`, y **bucket policy** para Lambda: principal `lambda.amazonaws.com`, acciones `s3:GetObject` + `s3:GetObjectVersion` sobre los objetos del bucket, condición `ArnLike` `aws:SourceArn` = `arn:aws:lambda:<region>:<account>:web-function/<name>/revision/*` (comodín obligatorio; región/cuenta desde `Stack.of(this)`, sin hardcodear). Sin esta policy Lambda rechaza la creación de la revisión (VERIFICADO docs, README hallazgo 2). (R8, R11)
- [x] 4.3 `lib/web-stack.ts` — parte 1: rol de ejecución (`lambda.amazonaws.com` + `sts:AssumeRole`, logs sobre `/aws/lambda/web/<fn>` y `.local` o `AWSLambdaBasicExecutionRole`), L1 `CfnWebFunction`, `CfnWebFunctionRevision` (`BuildConfig.CodeConfig.S3Object.{Bucket, Key, VersionId}` desde `codeKey`/`codeVersion`; inmutable: cualquier cambio es reemplazo) y `CfnWebFunctionEndpoint` con `IamAuth`, `HomeRegion`, `ScalingConfig.MaxEnvironments = 2`, `ThrottleConfig.RateLimit = 100` y `RevisionWeights: [{ RevisionId: <revisión>, Weight: 100 }]`. Dejar `ServiceConfig.MaxConcurrencyPerEnvironment` por defecto (64). Requiere `aws-cdk-lib` >= 2.274.0; `CfnResource` solo si los L1 fallan en synth. (VERIFICADO docs, README 0.3.2–0.3.3 y hallazgo 6) (R8, R9)
- [x] 4.4 `lib/web-stack.ts` — parte 2: `CfnOriginAccessControl` (`OriginAccessControlOriginType: lambda`, `SigningBehavior: always-amz-auth` — el ÚNICO soportado para Web Functions; en CDK `SigningBehavior.ALWAYS_AMZ_AUTH`; `always` es rechazado —, `SigningProtocol: sigv4`), origin request policy personalizada (`CloudFront-Viewer-Address`, `Origin`, `Content-Type`, `Accept`; todas las cookies; todos los query strings; SIN `Host`), `CACHING_DISABLED`, `ALLOW_ALL`, `Distribution` con `HttpOrigin(endpoint DomainName, { originAccessControlId })` (sin `addPropertyOverride`, VERIFICADO docs, README 0.3.6). Sin dominio propio ni ACM. (R3, R8, R9)
- [x] 4.5 `lib/web-stack.ts` — parte 3: resource policy de CloudFront sobre el endpoint, como recurso hoja separado (evita el ciclo). Orden: (1) nativo `CfnResourcePolicy` (ARN `...:web-function/<name>`, sin calificar ni comodines; esperado según docs, README 0.3.3, pero NO verificado en vivo en el registro de la cuenta) → (2) `AwsCustomResource` con `@aws-sdk/client-lambda-web` → (3) script versionado (`scripts/put-resource-policy.sh`). Registrar la vía efectiva para el inventario de Q8. (R8)
- [x] 4.6 `lib/web-stack.ts` — parte 4: `CfnBudget` mensual COST de USD 20 con alertas por correo ACTUAL en USD 5, 10, 15, 20 y FORECASTED > USD 20; correo vía `-c alertEmail=`. Sin Budgets Actions ni Lambda de apagado. (R9)
- Nota de 4.2/4.3: `SpikeWebStack` depende de `SpikeCodeStack`; el desmontaje DEBE destruir el web stack primero (ver 7.5). Borrar el objeto/versión o quitar el acceso mientras una revisión lo usa deja la revisión en `Failed` permanente.
- [ ] 4.7 (N/A en esta pasada: la vía nativa de 4.5 sigue vigente; solo si el primer deploy obliga a caer al script) Si la vía de 4.5 fue script: crear `scripts/smoke-direct-403.sh` (curl sin firma al endpoint, debe dar 403; imprime solo el código de estado, no la URL) para correr tras cada deploy. (R8)
- [x] 4.8 `cdk synth -c ...` y verificar en el template: `maxEnvironments` = 2, `rateLimit` = 100, presupuesto USD 20 con 4 alertas ACTUAL + 1 FORECASTED, ninguna acción automatizada, OAC con `SigningBehavior: always-amz-auth`, bucket policy de 4.2 presente, `RevisionWeights` con peso 100, ausencia de recursos fuera de alcance. Si synth/deploy rechaza los L1 nativos, aplicar el respaldo de 4.5. Ejecutar `cdk diff` y guardar el resumen para las compuertas. (R9, R14) NOTA: synth OK (app ejecutada directo con CDK_CONTEXT_JSON; el CLI `cdk synth` resuelve la cuenta vía STS, evitado). `cdk diff` OMITIDO: exige credenciales. Respaldo de 4.5 sin necesidad por ahora; el validador de CDK avisa de tipos Web Function desconocidos y del patrón de ResourceArn (esquema local desactualizado).
- [x] 4.9 Reejecutar el escaneo de secretos (1.4) sobre todo lo nuevo; cero coincidencias. (R13)
- **Commit 2**: `feat(spike): add nestjs probe app and cdk stacks for web function` (tras 2.4, 3.x, 4.8 y 4.9).

## Fase 5: Despliegue con compuertas (secuencial, cada paso requiere confirmación)

- [x] 5.1 **[G1]** STOP. Mostrar `cdk diff` de `SpikeCodeStack` y esperar confirmación. Luego `cdk deploy SpikeCodeStack`. (R10)
- [x] 5.2 **[G2]** STOP. Confirmación explícita. Ejecutar `scripts/build.mjs` y `scripts/upload.sh`; anotar `VersionId` localmente (no commitear). (R10) HECHO: zip construido y subido (sin registrar clave/VersionId/bucket aquí).
- [ ] 5.3 **[G3]** STOP. Mostrar `cdk diff` de `SpikeWebStack` y esperar confirmación. Luego `cdk deploy SpikeWebStack -c codeKey=... -c codeVersion=... -c alertEmail=...`. (R10)
  - BLOQUEADA (2026-10-20): el create de `SpikeWebStack` falló en `AWS::CloudFront::Distribution`: "Your account must be verified before you can add new CloudFront resources" (403, restricción de cuenta nueva). La usuaria abrió un caso en AWS Support. Señal positiva para Q8: CloudFormation aceptó crear el change set con `AWS::Lambda::WebFunction*` y `AWS::Lambda::ResourcePolicy` (aún no es un create en vivo). El stack queda en `ROLLBACK_COMPLETE`; CONFIRMADO en el código del CLI que el siguiente `cdk deploy` lo elimina antes de recrearlo (ver README). Retomar 5.3 con nueva confirmación cuando AWS verifique la cuenta.
- [ ] 5.4 **[G4]** Solo si la vía de la policy es script: STOP, confirmación y ejecutar `put-resource-policy`. (R8, R10)
- [ ] 5.5 Ejecutar el test de humo de 403 directo (4.7) tras cada deploy si aplica. (R8)
- [ ] 5.6 (USUARIA) Confirmar que llegó el correo de suscripción/alertas del presupuesto. (R9)
- Cada redeploy posterior (por ejemplo, tras reducir el bundle por Q5) repite la compuerta correspondiente con nueva confirmación. (R10)

## Fase 6: Mediciones desde Chile (máquina de la usuaria)

- [x] 6.1 `scripts/measure.mjs`: ejecutor para `echo`, `headers`, `latency --n 50` (curl o equivalente, secuencial, p50/p95, excluye frío y 2 calentamientos). Parametrizado por variable de entorno; no imprime dominios ni IPs completas. (R6) HECHO: Node `.mjs` sin dependencias (`echo|cookies|headers|direct|cold|latency`); probado solo en local (`headers` no: usa `MY_IP` o checkip externo).
- [x] 6.2 `scripts/q7-poll.sh`: sondeo cada 5 min de CloudWatch hasta 60 min. Métrica `EndpointActiveEnvironments`, namespace `AWS/Lambda/Web/Usage`, dimensiones `FunctionName`, `EndpointName`, `ExecutionRegion`, estadística `Maximum`; apoyo: `EndpointRequestThrottles` (Sum). Sin datapoints en el período = 0 entornos (VERIFICADO docs, README 0.3.8). (R7) HECHO: escrito, solo `bash -n`; la usuaria lo corre.
- [ ] 6.3 **Q1**: `measure.mjs echo` (POST JSON sin `x-amz-content-sha256`), n=3. PASS = 2xx + eco. La docs predice éxito (CloudFront firma con `UNSIGNED-PAYLOAD`); es una predicción, el resultado es la medición. (R1)
- [ ] 6.4 **Q2**: Chrome: `/api/cookies/set` → `/api/cookies/echo`, atributos en DevTools; `curl -i` para contar encabezados. PASS = todas las cookies almacenadas y reenviadas. (R2)
- [ ] 6.5 Reconfirmar en vivo namespace/dimensiones con `aws cloudwatch list-metrics --namespace AWS/Lambda/Web/Usage --metric-name EndpointActiveEnvironments` (requiere al menos una solicitud previa; sin tráfico no hay métrica). (R7)
- [ ] 6.6 **Q3**: `measure.mjs headers` vs `curl checkip.amazonaws.com`, n=3; la aserción usa `cloudfront-viewer-address` y `x-forwarded-for` (el último valor de `X-Forwarded-For` es de CloudFront). `x-real-ip` NO se evalúa: Lambda lo elimina. Registrar coincide sí/no con la IP enmascarada. (R3)
- [ ] 6.7 **Q4**: `curl -i` sin firma al endpoint directo, n=3. PASS = 403. (R4)
- [ ] 6.8 **Q5**: tras `EndpointActiveEnvironments` = 0 (o sin datapoints), primera solicitud vía CloudFront más `coldBootMs`, n>=3 (mín/mediana/máx). Si > 3 s: reducir bundle, repetir 3.x, **[G3]** de nuevo y remedir; el Plan B solo si es medible y notablemente más rápido. (R5)
- [ ] 6.9 **Q6**: `measure.mjs latency --n 50`, p50 y p95, en caliente. Reglas: p50 <= 300 ms PASS; 300–400 ms = FAIL SIN Plan B automático (decide la usuaria; registrar decisión y fundamento); > 400 ms = reconsiderar sa-east-1 (fuerza Plan B). (R6)
- [ ] 6.10 **Q7**: anotar T0 tras la última solicitud, correr `q7-poll.sh`; PASS = 0 entornos (valor `Maximum` 0 o ausencia de datapoints) en <= 30 min. Si no, recalcular costo mensual (Plan B si > USD 5/mes). (R7)
- [ ] 6.11 **Q8**: tabla de inventario de constructs (L2 / L1 / `CfnResource` / `AwsCustomResource` / CLI), con la vía efectiva de 4.5 (nativo esperado; registrar si hubo que caer al respaldo) y confirmación de cero pasos manuales en consola. Script-only = PASS con deuda registrada + humo 403; cualquier otro paso manual = FAIL. (R8)
- [ ] 6.12 (Opcional) Ráfaga > 100 rps para observar 429 y `EndpointRequestThrottles`. Solo con autorización de la usuaria, por el costo. (R9)

## Fase 7: Evidencia, decisión y desmontaje

- [ ] 7.1 (esqueleto creado; faltan valores) Crear `openspec/changes/infra-spike/results.md` en español con columnas `# | value | n | PASS/FAIL | date (UTC) | notes` para Q1–Q8; IPs, dominios, ARNs e IDs de cuenta redactados. Incluir el inventario de Q8 y la deuda si aplica. (R12, R13)
- [ ] 7.2 Aplicar la regla de go/no-go y escribir la decisión explícita (GO 5c / Plan B / reconsiderar sa-east-1) citando la regla. Si Q6 cayó en 300–400 ms, registrar la decisión de la usuaria. Verificar que ninguna Q quede sin valor y fecha. (R12)
- [ ] 7.3 Listar insumos de ADR para `stack-adrs` (runtime Q5–Q7, OAC Q1–Q4, CDK Q8, región Q6). No promover la spec a `openspec/specs/`. (R12)
- [ ] 7.4 Escaneo de secretos final sobre `results.md` y todo lo staged; cero coincidencias. (R13)
- **Commit 3**: `feat(spike): add measurement scripts` (6.1, 6.2; puede ir antes de 6.3).
- **Commit 4**: `docs(spike): record infra spike results and decision` (7.1–7.4).
- [ ] 7.5 **[G-destroy]** STOP. Dentro de las 48 h de terminadas las mediciones y con confirmación de la usuaria: `cdk destroy --all` (destruye `SpikeWebStack` antes que `SpikeCodeStack` por la dependencia; si se destruye por stack, ese mismo orden). Nunca borrar el zip/versión ni la bucket policy antes que el web stack: la revisión quedaría en `Failed` permanente. O registrar retención aprobada (fecha y plazo de revisión) en `results.md`. (R11)
- [ ] 7.6 Verificación manual de restos y registro de fecha en `results.md`: `aws s3api list-object-versions` vacío; log groups `/aws/lambda/web/<fn>` y `/aws/lambda/web/<fn>.local` borrados A MANO (`cdk destroy` no los elimina: los crea Lambda, sin expiración; buscar con `describe-log-groups --log-group-name-prefix /aws/lambda/web/`, VERIFICADO docs, README 0.3.9); presupuesto inexistente; distribución eliminada. El stack de bootstrap permanece. (R11)
- [ ] 7.7 Si el Plan B resulta aplicable, NO implementarlo aquí: registrar el delta (solo `web-stack.ts` + `measure.mjs`) como siguiente cambio.

## Dependencias y paralelismo

| Tarea(s) | Depende de | Paralelo con |
|---|---|---|
| 0.1, 0.2 (usuaria) | — | 0.3 |
| 0.3 | — | 0.1, 0.2 |
| 1.x | 0.4 | — |
| 2.x | 1.5 (primer commit limpio) | 3.1 (parcial) |
| 3.x | 2.3 | 4.x |
| 4.x | 0.3, 1.3 | 3.x |
| 5.1 → 5.2 → 5.3 → 5.4 | 4.9, 0.2, 1.3 | Secuencial estricto (compuertas) |
| 6.1, 6.2 | 2.x | Fase 5 (se pueden escribir antes del deploy) |
| 6.3–6.11 | 5.5 | 6.3/6.4/6.6/6.7 entre sí; 6.8 y 6.10 son secuenciales (requieren inactividad) |
| 7.x | 6.x | — |

Cuellos de botella: acciones de la usuaria (bootstrap, confirmaciones [G], mediciones desde Chile, correo de Budgets) y la espera de inactividad para Q5/Q7 (hasta ~60 min).

## Review Workload Forecast

| Campo | Valor |
|---|---|
| Líneas modificadas estimadas | ~450–500 sin lockfile (código del spike) + `results.md` (~60); `tasks.md`/artefactos SDD no cuentan como diff de código |
| Riesgo de presupuesto de 400 líneas | **Alto** (supera 400 si va en un solo PR) |
| Chained PRs recomendados | **Sí** |
| Decisión necesaria antes de apply | **Sí** (con `ask-on-risk`: dividir en PRs encadenados o proceder con `size:exception`; si se encadena, elegir `stacked-to-main` o `feature-branch-chain`) |

### Slices sugeridos (unidades de trabajo con límite claro)

| Slice | Contenido | Líneas aprox. | Inicio / fin | Verificación | Reversión |
|---|---|---|---|---|---|
| PR1 | Fases 1–4: `.gitignore`, README+runbook, app NestJS, build/upload, stacks CDK (Commits 1 y 2) | ~330 | Inicia en 1.1, termina en 4.9 (synth/diff OK, escaneo limpio, sin deploy) | `cdk synth`, smoke local, escaneo de secretos | Revertir el PR; no hay recursos en AWS |
| PR2 | Scripts de medición y evidencia: `measure.mjs`, `q7-poll.sh`, `results.md` (Commits 3 y 4) | ~150–210 | Inicia en 6.1, termina en 7.4 | Q1–Q8 con valor y fecha, escaneo limpio | Revertir el PR; el destroy (7.5) es independiente |

Las Fases 5 y 7.5–7.6 son operaciones sobre AWS, no cambian líneas de código y no pertenecen a ningún PR. PR1 debe estar fusionado (o su rama disponible según la estrategia de cadena) antes de iniciar la Fase 5.

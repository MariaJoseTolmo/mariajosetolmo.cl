# Especificación: infra-spike-evidence (local al cambio)

Define lo que DEBE cumplirse para que el spike de Web Function + CloudFront OAC produzca una decisión go/no-go válida para la Decisión 5c. Esta capacidad es local al cambio: MUST NOT promoverse a `openspec/specs/` al archivar.

## Ruta rápida

1. Desplegar el stack con límites (después de confirmación explícita).
2. Ejecutar los probes Q1-Q8; registrar cada uno en `results.md`.
3. Aplicar la regla de go/no-go; desmontar el stack.

## Tipo

Capacidad AGREGADA (no se modifica ninguna especificación existente). Las palabras clave siguen RFC 2119.

## Resumen de requisitos

| ID | Área | Resumen |
|----|------|---------|
| R1 | Q1 | POST JSON vía CloudFront sin `x-amz-content-sha256` |
| R2 | Q2 | Ciclo completo de varios `Set-Cookie` en un navegador |
| R3 | Q3 | `CloudFront-Viewer-Address` reenviado |
| R4 | Q4 | Llamada directa sin firma al endpoint denegada |
| R5 | Q5 | Presupuesto de cold start de NestJS |
| R6 | Q6 | Presupuesto de latencia desde Chile |
| R7 | Q7 | Reducción de escala en inactividad |
| R8 | Q8 | Cobertura de CDK |
| R9 | Costo | Límites de protección |
| R10 | Compuerta | Confirmación de despliegue |
| R11 | Desmontaje | Destruir y verificar |
| R12 | Evidencia | `results.md` y decisión |
| R13 | Seguridad | Higiene del repositorio público |
| R14 | Alcance | Aislamiento del código desechable |

## R1 - Q1: POST JSON sin hash del payload

El sistema MUST aceptar un `POST` JSON enviado a través del dominio de CloudFront sin que el cliente proporcione `x-amz-content-sha256`. PASS: 2xx y el cuerpo de la respuesta devuelve como eco el cuerpo de la solicitud.

#### Scenario: POST JSON devuelto como eco
- GIVEN el stack está desplegado y existe el probe `POST /api/echo`
- WHEN un cliente envía `POST` con `Content-Type: application/json` y sin el encabezado `x-amz-content-sha256` a través de `*.cloudfront.net`
- THEN el estado de la respuesta es 2xx y el cuerpo es igual al JSON enviado

#### Scenario: Q1 falla
- GIVEN la misma solicitud
- WHEN la respuesta es 403 o el cuerpo no se devuelve como eco
- THEN Q1 se registra como FAIL y la regla de go/no-go selecciona el Plan B

## R2 - Q2: Ciclo completo de varios Set-Cookie

El probe MUST emitir al menos dos cookies, cada una con `HttpOnly`, `Secure`, `SameSite=Strict`, como encabezados `Set-Cookie` separados. PASS: un navegador real almacena todas las cookies y las envía de vuelta en la siguiente solicitud.

#### Scenario: Ciclo completo de cookies
- GIVEN `GET /api/cookies` establece dos o más cookies
- WHEN un navegador lo invoca vía CloudFront y luego invoca `GET /api/cookies/echo`
- THEN el almacenamiento del navegador muestra todas las cookies con los tres atributos y el endpoint de eco informa cada cookie recibida

#### Scenario: Cookie colapsada
- GIVEN el mismo flujo
- WHEN se almacenan menos cookies de las emitidas
- THEN Q2 se registra como FAIL y aplica el Plan B

## R3 - Q3: Encabezado de dirección del visitante

Una origin request policy personalizada que excluya `Host` MUST reenviar `CloudFront-Viewer-Address`. PASS: el encabezado llega a la app y contiene la IP del cliente.

#### Scenario: Dirección del visitante presente
- GIVEN la origin request policy reenvía `CloudFront-Viewer-Address` y no `Host`
- WHEN el cliente invoca `GET /api/headers` vía CloudFront
- THEN el valor del encabezado informado contiene la IP pública del cliente (comparada localmente, no commiteada)

## R4 - Q4: Llamada directa sin firma denegada

El endpoint (`IamAuth`) MUST rechazar las llamadas que eviten CloudFront. PASS: HTTP 403.

#### Scenario: Llamada directa sin firma
- GIVEN la URL del endpoint es conocida por el operador
- WHEN se envía una solicitud sin firma directamente a él
- THEN la respuesta es 403

## R5 - Q5: Cold start

PASS: el cold start de NestJS, medido de extremo a extremo vía CloudFront, es <= 3 s.

#### Scenario: Cold start dentro del presupuesto
- GIVEN no hay ningún entorno activo (inactivo más allá de la ventana de Q7 o recién desplegado)
- WHEN la primera solicitud se envía vía CloudFront
- THEN el tiempo total es <= 3 s; se registran el valor y el método

#### Scenario: Cold start sobre el presupuesto
- GIVEN un cold start medido > 3 s
- WHEN el bundle aún no ha sido reducido
- THEN el bundle MUST reducirse y volver a medirse; el Plan B aplica solo si el Plan B es medible y notablemente más rápido

## R6 - Q6: Latencia desde Chile

PASS: p50 en caliente <= 300 ms desde la máquina del usuario en Chile, n >= 20 muestras excluyendo la solicitud en frío.

#### Scenario: Latencia dentro del presupuesto
- GIVEN un entorno en caliente
- WHEN se miden al menos 20 solicitudes a `/api` desde Chile
- THEN se registra p50 <= 300 ms junto con n, p50 y p95

#### Scenario: La latencia escala
- GIVEN p50 en caliente > 400 ms
- WHEN se evalúan los resultados
- THEN se reconsidera sa-east-1, lo que fuerza el Plan B (no hay Web Functions allí)

#### Scenario: Zona gris
- GIVEN p50 en caliente entre 300 ms y 400 ms
- WHEN se evalúan los resultados
- THEN Q6 es FAIL, no se activa un Plan B automático; la usuaria decide con el valor medido, y la decisión y su fundamento se registran explícitamente

## R7 - Q7: Reducción de escala en inactividad

PASS: los entornos activos llegan a 0 dentro de los 30 min posteriores a la última solicitud. La evidencia es la métrica de CloudWatch `EndpointActiveEnvironments`; `EnvironmentConcurrentRequests`, `EndpointRequestThrottles` y `EndpointActiveEnvironmentThrottles` MAY registrarse como apoyo.

#### Scenario: Escala a cero
- GIVEN el tráfico se detuvo en el tiempo T
- WHEN se observa `EndpointActiveEnvironments`
- THEN es 0 en T + 30 min o antes, y se registra el tiempo

#### Scenario: Reducción de escala lenta
- GIVEN quedan entornos después de 30 min
- WHEN se evalúan los resultados
- THEN se recalcula el costo mensual; el Plan B aplica si la proyección supera USD 5/mes

## R8 - Q8: Cobertura de CDK

El stack MUST estar definido completamente en CDK usando constructs L2 más `CfnResource` donde falte L2. PASS: ningún paso manual en la consola. Los constructs usados (L2 vs `CfnResource` vs `AwsCustomResource`) MUST listarse.

Excepción acordada para la resource policy de la Web Function (permiso de CloudFront para invocar el endpoint): se intenta, en orden, recurso nativo de CloudFormation, luego `AwsCustomResource`, luego un script versionado con `aws lambda-web put-resource-policy`. Nativo o `AwsCustomResource` -> PASS. Solo script -> PASS con deuda registrada en `results.md` (sin Plan B), y un test de humo MUST verificar el 403 en la llamada directa sin firma después de cada deploy.

#### Scenario: Cobertura completa
- GIVEN `cdk deploy` finaliza
- WHEN se inspeccionan los recursos
- THEN cada recurso proviene de la app CDK y `results.md` lista el uso de L2 vs `CfnResource` vs `AwsCustomResource`

#### Scenario: Resource policy solo por script
- GIVEN la resource policy no se puede expresar como recurso nativo ni con `AwsCustomResource`
- WHEN se aplica con el script versionado
- THEN Q8 es PASS con deuda, `results.md` registra la deuda y el test de humo confirma el 403 directo tras el deploy

#### Scenario: Brecha
- GIVEN cualquier otro recurso requerido necesita un paso manual
- WHEN se registra
- THEN Q8 es FAIL y aplica el Plan B

## R9 - Límites de costo

El stack MUST establecer: en el endpoint `ScalingConfig.maxEnvironments = 2` (rango válido 2-10,000; 1 no es válido), en el endpoint `ThrottleConfig.rateLimit = 100` rps (los valores <= 1,000 son múltiplos de 100; 0 bloquea todo el tráfico), y un presupuesto de costo mensual de AWS Budgets de USD 20 con alertas por correo sobre el gasto ACTUAL en USD 5, 10, 15 y 20, más una alerta FORECASTED en > USD 20. MUST NOT existir un kill switch automático (decisión del usuario). `maxConcurrencyPerEnvironment` (a nivel de revisión, 1-128, por defecto 64) MAY dejarse en su valor por defecto. MUST NOT aprovisionarse un dominio personalizado, ACM ni ningún otro servicio fuera del alcance.

#### Scenario: Límites presentes en synth
- GIVEN la app CDK se sintetiza
- WHEN se inspecciona el template
- THEN `maxEnvironments` es 2, `rateLimit` es 100, y existe un presupuesto mensual de USD 20 con alertas actuales en 5/10/15/20 y una alerta forecasted en > 20, y no se define ninguna acción automatizada (p. ej., Budgets Actions, apagado mediante Lambda)

#### Scenario: Runbook manual ante una alerta
- GIVEN llega un correo de alerta del presupuesto
- WHEN el usuario sigue el runbook (documentado en el README del spike o en `results.md`)
- THEN el runbook ofrece dos acciones manuales: establecer `rateLimit=0` en el endpoint (bloquea todo el tráfico, 503 `Platform.EndpointDisabled`) o ejecutar `cdk destroy`; la ejecuta el usuario, no el sistema

#### Scenario: Rate limit aplicado (opcional)
- GIVEN `rateLimit = 100`
- WHEN se envía una ráfaga que supera 100 rps
- THEN las solicitudes en exceso devuelven HTTP 429 y `EndpointRequestThrottles` las registra

DEBE existir un runbook manual de incidentes de costo antes del primer despliegue (ver el scenario del runbook en R9).

## R10 - Compuerta de confirmación de despliegue

Apply MUST detenerse y obtener confirmación explícita del usuario antes de cada `cdk deploy`. Synth y diff MAY ejecutarse sin confirmación. Los prerrequisitos (perfil de AWS, `cdk bootstrap` en us-east-1) son acciones del usuario.

#### Scenario: Despliegue solicitado
- GIVEN la app está lista para desplegarse
- WHEN el implementador llega a un paso de despliegue
- THEN se detiene, muestra el resumen de `cdk diff` y espera confirmación explícita

#### Scenario: Redespliegue
- GIVEN un despliegue previo confirmado
- WHEN se necesita otro `cdk deploy`
- THEN se requiere una nueva confirmación

## R11 - Desmontaje

El stack MUST destruirse con `cdk destroy` dentro de las 48 h posteriores a terminar las mediciones, salvo que el usuario apruebe explícitamente la retención (registrada en `results.md`). Tras el destroy, el operador MUST verificar manualmente si quedaron restos del bucket S3, de los log groups de CloudWatch y del presupuesto.

#### Scenario: Desmontaje limpio
- GIVEN las mediciones están completas
- WHEN se ejecuta `cdk destroy` y se revisan los restos
- THEN no queda ningún bucket, log group ni otro recurso facturable (o cada uno se elimina/justifica) y `results.md` registra la fecha

#### Scenario: Retención aprobada
- GIVEN el usuario aprueba la retención
- WHEN se registra
- THEN `results.md` indica la aprobación, la fecha y el plazo de revisión

## R12 - Evidencia y decisión

`openspec/changes/infra-spike/results.md` MUST contener, para cada una de Q1-Q8: el valor medido, PASS/FAIL y la fecha. MUST terminar con una decisión explícita: GO (5c), Plan B o reconsideración de sa-east-1, citando la regla de go/no-go.

Regla de go/no-go: Q1, Q2, Q3, Q4 o Q8 FAIL -> Plan B (Function URL + OAC, wrapper de hash, Lambda Web Adapter). Q6 p50 > 400 ms -> reconsiderar sa-east-1 (fuerza el Plan B). Q6 p50 entre 300 y 400 ms -> FAIL sin Plan B automático; decide la usuaria. Q5 > 3 s -> primero reducir el bundle. Q7 > 30 min -> recalcular el costo.

#### Scenario: Todo pasa
- GIVEN Q1-Q8 todas en PASS
- WHEN los resultados se finalizan
- THEN la decisión es GO para 5c

#### Scenario: Evidencia faltante
- GIVEN una pregunta no tiene valor ni fecha
- WHEN se revisa el spike
- THEN el spike NO está completo y no se acepta ninguna decisión

## R13 - Seguridad del repositorio público

El contenido commiteado MUST NOT incluir IDs de cuenta de AWS, ARNs, credenciales, URLs de distribución/endpoint asociadas a la cuenta, ni la IP del usuario. Los valores específicos de la cuenta MUST provenir de variables de entorno o de contexto de CDK no commiteado. `.gitignore` MUST existir y cubrir `cdk.out/`, `.env*`, `node_modules/`, `*.log`. El repositorio ya está inicializado en `main`; un escaneo de secretos MUST pasar antes del primer commit. `results.md` MUST ocultar (redact) dichos identificadores.

#### Scenario: Escaneo de secretos antes del primer commit
- GIVEN hay archivos en staging
- WHEN se ejecuta el escaneo de IDs de cuenta (12 dígitos), `arn:aws`, patrones de claves de acceso y archivos `.env`
- THEN hay cero coincidencias; de lo contrario, el commit se bloquea

#### Scenario: Artefactos ignorados
- GIVEN existen localmente `cdk synth` y un archivo `.env`
- WHEN se revisa `git status`
- THEN `cdk.out/` y `.env*` no aparecen como no rastreados (untracked)

## R14 - Aislamiento del código desechable

El código MUST residir en `spikes/web-functions/` con su propio `package.json` y un README que lo marque como "throwaway". MUST NOT ser importado por código de producción. Se elimina cuando la infraestructura de producción lo reproduzca. Fuera del alcance: Neon, Upstash, SES, SQS, frontend, lógica de autenticación, dominio personalizado, CI, Jest.

#### Scenario: Aislamiento
- GIVEN el repositorio
- WHEN se inspeccionan las dependencias y el README
- THEN el spike tiene su propio `package.json` y un README de throwaway, y nada fuera de `spikes/` lo referencia

## Notas

- Las tecnologías ausentes del CV (Lambda Web Functions, CloudFront OAC, AWS CDK) requieren ADRs en `stack-adrs`; este spike solo aporta evidencia.
- Presupuesto de revisión: unas 300 líneas modificadas (< 400).

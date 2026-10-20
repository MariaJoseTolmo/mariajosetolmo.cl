# Propuesta: Infra Spike — Web Function + CloudFront OAC

## Intención

La decisión 5c descansa en una funcionalidad que tiene solo unos días de antigüedad. Antes de que exista el scaffold, este spike responde si se procede o no (go/no-go) con Web Function + CloudFront OAC en us-east-1. Es código desechable. El entregable es evidencia en `results.md`, que alimenta el ADR.

**No está en el CV (ADR requerido en `stack-adrs`)**: Lambda Web Functions, CloudFront OAC, AWS CDK.

## Alcance

### Dentro del alcance
- `spikes/web-functions/`: app CDK (TypeScript) aislada, con su propio `package.json` y una app NestJS mínima (esbuild, Node 24, arm64).
- Stack: bucket S3 de código con versionado, Web Function (`IamAuth`), CloudFront sobre `*.cloudfront.net`, OAC (`lambda`), origin request policy personalizada sin `Host`, `maxEnvironments: 1`, `rateLimit` bajo, alerta de AWS Budgets (USD 5).
- Endpoints de prueba (probe) y scripts de medición para Q1–Q8.
- `openspec/changes/infra-spike/results.md`: cada pregunta con su valor, PASS/FAIL y fecha.
- `.gitignore` que cubra `cdk.out/`, `.env*`, `node_modules/`, `*.log`.

### Fuera del alcance
Neon, Upstash, SES, SQS, frontend, lógica de autenticación, dominio personalizado/ACM, CI, Jest/strict TDD, endurecimiento para producción.

## Capacidades

### Capacidades nuevas
- `infra-spike-evidence`: criterios de PASS/FAIL para Q1–Q8. Solo local al cambio; NO promover a `openspec/specs/` al archivar.

### Capacidades modificadas
Ninguna.

## Enfoque

| # | Pregunta | PASS |
|---|----------|------|
| 1 | POST JSON a través de CloudFront, sin `x-amz-content-sha256` | 2xx, cuerpo devuelto como eco |
| 2 | Varios `Set-Cookie` (HttpOnly, Secure, SameSite=Strict) hacen el ciclo completo en un navegador | Todas las cookies se establecen y se reenvían |
| 3 | `CloudFront-Viewer-Address` llega mediante la política personalizada | El encabezado contiene la IP del cliente |
| 4 | Llamada directa sin firma al endpoint | 403 |
| 5 | Cold start de NestJS | ≤ 3 s de extremo a extremo vía CloudFront |
| 6 | Latencia Chile → `/api` (máquina del usuario, n ≥ 20) | p50 en caliente ≤ 300 ms |
| 7 | Reducción de escala en inactividad | Entorno liberado ≤ 30 min después de la última solicitud |
| 8 | Cobertura de CDK | Todo mediante L2 + `CfnResource`; registrar qué constructs se usaron |

**Regla de go/no-go**
- Si falla Q1, Q2, Q3, Q4 o Q8 → **Plan B**: Function URL + OAC, wrapper de hash, Lambda Web Adapter.
- Si Q6 p50 en caliente > 400 ms → reconsiderar **sa-east-1**, lo que fuerza el Plan B (no hay Web Functions allí).
- Si Q5 > 3 s → primero reducir el bundle. El Plan B aplica solo si B es medible y notablemente más rápido.
- Si Q7 > 30 min → recalcular el costo. Plan B si la proyección supera USD 5/mes.

**Compuertas (gates)**: apply SE DETIENE para obtener confirmación explícita del usuario antes de cada `cdk deploy`. El código se commitea solo después de un escaneo de secretos (sin IDs de cuenta, ARNs ni credenciales).

**Destino del código**: se mantiene congelado en `spikes/web-functions/` con un README que lo marca como "throwaway" (desechable). Se elimina cuando la infraestructura de producción lo reproduzca.

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `spikes/web-functions/` | Nuevo |
| `openspec/changes/infra-spike/results.md` | Nuevo |
| `.gitignore` | Nuevo/Modificado |

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|------|------------|------------|
| No hay cobertura utilizable de CDK/CFN para Web Function | Media | `CfnResource`; si no, Plan B |
| Facturación por tiempo inactivo | Baja | Límites, alerta de Budgets, desmontaje |
| Filtración de datos de la cuenta en el repositorio público | Media | Variables de entorno/contexto, revisión antes de commitear |

## Plan de reversión

`cdk destroy` dentro de las 48 h posteriores a terminar las mediciones. Luego revisar manualmente el bucket S3, los log groups y el presupuesto. Los recursos se eliminan, salvo que el usuario decida lo contrario. Eliminar `spikes/` revierte el repositorio.

## Dependencias (acciones del usuario)
- Acceso a la cuenta de AWS y un perfil de credenciales para CDK.
- `cdk bootstrap` en us-east-1.
- Navegador y terminal desde Chile para Q2 y Q6.

## Criterios de éxito
- [ ] Q1–Q8 registradas en `results.md` con evidencia.
- [ ] Decisión explícita: GO (5c) o Plan B/sa-east-1.
- [ ] Stack destruido, o retención aprobada.
- [ ] Ningún identificador sensible commiteado.
- [ ] Tamaño de revisión ~300 líneas modificadas (< presupuesto de 400).

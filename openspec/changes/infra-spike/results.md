# Resultados: Infra Spike (Q1-Q8)

Estado: ESQUELETO. Se completa en las fases 6 y 7 de `tasks.md`. Mediciones desde Chile (máquina de la usuaria).

**Redacción (R13):** este archivo es público. NO incluir IDs de cuenta, ARNs, dominios `*.cloudfront.net` / `*.on.aws`, IPs (ni la de la usuaria), correos ni `VersionId`. Escribir `<redactado>` y, para IPs, a lo sumo "coincide: sí/no".

## Tabla de resultados

| # | Pregunta | Valor medido | n | PASS/FAIL | Fecha (UTC) | Notas |
|---|---|---|---|---|---|---|
| Q1 | POST sin `x-amz-content-sha256` llega a la app (OAC) | | | | | |
| Q2 | Varios `Set-Cookie` de ida y vuelta | | | | | |
| Q3 | `CloudFront-Viewer-Address` presente y coincide con la IP | | | | | |
| Q4 | Llamada directa sin firma al endpoint = 403 | | | | | |
| Q5 | Arranque en frío (primera solicitud tras inactividad) <= 3 s | | | | | |
| Q6 | Latencia en caliente: p50 <= 300 ms (reporta p50 y p95) | | | | | |
| Q7 | Entornos activos vuelven a 0 en <= 30 min | | | | | |
| Q8 | Cobertura de CDK sin pasos manuales | | | | | |

## Regla de go/no-go (spec R12)

Q1, Q2, Q3, Q4 o Q8 FAIL -> Plan B (Function URL + OAC, wrapper de hash, Lambda Web Adapter).
Q6 p50 > 400 ms -> reconsiderar sa-east-1 (fuerza el Plan B).
Q6 p50 entre 300 y 400 ms -> FAIL sin Plan B automático; decide la usuaria (registrar decisión y fundamento).
Q5 > 3 s -> primero reducir el bundle y remedir; Plan B por cold start solo si es medible y notablemente más rápido (R5).
Q7 > 30 min -> recalcular el costo mensual (Plan B si > USD 5/mes).
Q8: solo con script (sin pasos manuales en consola) = PASS con deuda registrada + test de humo de 403 directo tras el deploy; cualquier otro paso manual = FAIL.
Q1-Q8 todas en PASS -> GO (5c).

## Inventario de constructs (Q8)

| Recurso | Vía (L2 / L1 / `CfnResource` / `AwsCustomResource` / CLI) | Pasos manuales |
|---|---|---|
| | | |

Deuda registrada (si aplica):

## Decisión

Decisión: _(pendiente: GO 5c / Plan B / reconsiderar sa-east-1)_
Regla citada: _(pendiente)_
Decisión de la usuaria si Q6 cayó en 300-400 ms: _(n/a o pendiente)_

## Insumos para ADR (`stack-adrs`)

- Runtime (Q5-Q7):
- OAC (Q1-Q4):
- CDK (Q8):
- Región (Q6):

## Desmontaje (R11)

- Fecha de `cdk destroy --all`:
- Retención aprobada (R11, solo si aplica): aprobación de la usuaria, fecha y plazo de revisión:
- Verificación de restos (versiones S3, log groups `/aws/lambda/web/`, presupuesto, distribución):

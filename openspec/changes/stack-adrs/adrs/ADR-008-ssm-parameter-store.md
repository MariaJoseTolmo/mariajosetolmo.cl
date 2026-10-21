# ADR-008: AWS SSM Parameter Store (SecureString) para secretos

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva |

## Decisión

Los secretos de producción (llave privada RS256 del JWT, URLs de Neon, credenciales de Upstash) se guardan en AWS SSM Parameter Store como `SecureString`. La función los lee en el arranque con un rol IAM de permisos mínimos. El repositorio solo contiene `.env.example` con valores ficticios.

## Contexto y problema

El repositorio es público. Ninguna llave puede vivir en el código, en el historial ni en variables de CI. Se necesita un almacén cifrado, con control de acceso por IAM y costo cero o casi cero para pocos secretos.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **SSM Parameter Store `SecureString`** | Cifrado con KMS; acceso por IAM; parámetros estándar sin cargo adicional y llamadas a la API sin cargo con rendimiento estándar (rendimiento alto: USD 0.05 por 10.000 interacciones) | Sin rotación automática integrada |
| AWS Secrets Manager | Rotación automática | USD 0.40 por secreto al mes y USD 0.05 por 10.000 llamadas a la API |
| Variables de entorno de la función | Simple | Visibles en la configuración de la función; mezclan secretos con config |
| Secrets de GitHub Actions | Ya existen en CI | Requieren inyectarlos en el deploy; el CI usa OIDC precisamente para no guardar llaves |

## Consecuencias

- **Positivas:** llaves fuera del repo y del CI; el rol de la función define exactamente qué puede leer.
- **Negativas:** la rotación de la llave JWT es manual; el endpoint JWKS público debe publicar la llave nueva antes de retirar la anterior.
- **Riesgos:** una lectura en cada arranque suma latencia al cold start; se mitiga leyendo una vez por entorno. Los parámetros avanzados cuestan USD 0.05 por parámetro al mes; el límite de tamaño de los estándar frente a una llave RS256 en PEM es NO VERIFICADO (confirmar en la documentación de Parameter Store). Sin clave KMS explícita, `SecureString` usa la clave administrada `alias/aws/ssm`: AWS KMS no cobra por crearla ni almacenarla, pero sí por solicitudes a claves administradas (20.000 gratis al mes); el volumen de este proyecto es órdenes de magnitud menor. Con esa clave, cualquier principal de la cuenta con `ssm:GetParameter` puede leer los valores: para aislar, usar una clave propia (con cargo mensual).

## Relación con mi experiencia

He trabajado con JWT y CI/CD (GitHub Actions) en producción, donde la gestión de secretos es un requisito. Parameter Store es nuevo para mí (AWS: aprendiendo, aplicado en este proyecto).

## Fuentes

- https://aws.amazon.com/systems-manager/pricing/ (verificado 2026-10-20)
- https://aws.amazon.com/secrets-manager/pricing/
- https://aws.amazon.com/kms/pricing/
- https://docs.aws.amazon.com/systems-manager/latest/userguide/secure-string-parameter-kms-encryption.html
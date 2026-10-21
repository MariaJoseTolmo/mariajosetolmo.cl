# ADR-007: Amazon SES para el correo del magic link

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Nueva |

## Decisión

El magic link se envía con Amazon SES desde el dominio `mariajosetolmo.cl`, con DKIM, SPF y DMARC configurados. Los rebotes y quejas llegan vía SNS. En local, Mailpit captura los correos sin enviar nada real. El envío pasa por un puerto de correo, así SES y Mailpit son adaptadores intercambiables.

## Contexto y problema

El login sin contraseña depende de que el correo llegue a la bandeja de entrada y no a spam. Además, la respuesta de `/auth/magic-link` debe ser idéntica exista o no el correo, por lo que el envío no puede filtrar información.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Amazon SES** | USD 0.10 por cada 1.000 correos; disponible en us-east-1 y sa-east-1; misma cuenta que el resto de la infra | Sandbox inicial (200 correos/24 h, 1/s) hasta pedir salida; configuración DNS |
| Proveedor transaccional externo | Configuración guiada | Otra cuenta y otras credenciales; precios NO VERIFICADOS |
| SMTP de un correo personal | Sin costo | Mala entregabilidad y límites; no apto para producción |

## Consecuencias

- **Positivas:** costo marginal; credenciales en IAM, no en el repo; Mailpit permite tests e2e del flujo sin red.
- **Negativas:** hay que solicitar la salida del sandbox antes de abrir el login a reclutadores.
- **Riesgos:** sin DKIM/SPF/DMARC el magic link cae en spam; sin manejo de rebotes vía SNS la reputación del remitente se degrada. Configuración verificada en la documentación de SES: Easy DKIM firma con clave de 2048 bits y requiere publicar registros DNS; SPF se alinea con un dominio MAIL FROM personalizado (registros MX y TXT); DMARC exige alineación por SPF o DKIM y se publica como TXT en `_dmarc.<dominio>`, con despliegue gradual `p=none` → `quarantine` → `reject`; las notificaciones de rebotes, quejas y entregas se configuran hacia un tópico SNS.

## Relación con mi experiencia

No he operado SES antes. Sí he implementado autenticación con JWT y OAuth en producción; aquí el correo es solo el canal de entrega del token. AWS: aprendiendo, aplicado en este proyecto.

## Fuentes

- https://docs.aws.amazon.com/general/latest/gr/ses.html (regiones)
- https://aws.amazon.com/ses/pricing/ (precio)
- https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim-easy.html
- https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-spf.html
- https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html
- https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications-sns.html
- https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html (sandbox: 200 mensajes/24 h, 1/s, solo destinatarios verificados; respuesta inicial en 96 h)
- Nota de precio (2026-10-20): USD 0.10 por 1.000 correos corresponde al modelo a la carta; la página también muestra planes Essentials (USD 0.16), Pro y Enterprise con cargo fijo.

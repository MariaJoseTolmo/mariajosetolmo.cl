# Proyecto: Portafolio de María José Tolmo (mariajosetolmo.cl)

> Fuente única de verdad del proyecto. Cualquier documento previo que contradiga este brief queda descartado.

## Objetivo
Construir mi web de presentación como Desarrolladora Backend Node.js/NestJS. El diseño **aprobado** está en
`Diseño/html/` (Inicio, Experiencia, Login con magic link y Zona reclutador; escritorio y móvil).
Son mockups de referencia exportados (`*.dc.html`): se replican sus valores (colores, tipografía, espaciados) en componentes propios, no se copia el markup.
Los PNG de `Diseño/` son una versión anterior; ante cualquier diferencia manda `Diseño/html/`.
La web en sí es mi código de muestra: cada decisión técnica debe ser defendible en una entrevista.

## Regla principal: coherencia con mi CV
Mi stack declarado es:
- **Avanzado:** JavaScript, Node.js, NestJS, PostgreSQL
- **En producción:** TypeScript, Express.js, Kafka, Redis, TypeORM, JWT, OAuth, Swagger, Docker, Jest, CI/CD (GitHub Actions)
- **Arquitectura:** Hexagonal, Microservicios, SOLID, Spec-Driven Development
- **Aprendiendo:** AWS, Java/Spring Boot, Python

Reglas:
1. El núcleo del proyecto usa lo que ya domino. Las tecnologías nuevas se suman solo cuando resuelven un problema concreto.
2. Cada tecnología que NO está en mi CV necesita un ADR en `openspec/`
   con: problema, alternativas consideradas, por qué se eligió y cómo se relaciona con mi experiencia.
3. El README tiene una sección "Por qué esta tecnología" con un resumen de una línea por cada pieza nueva.
4. Nunca inflar niveles: AWS se presenta como "aprendiendo, aplicado en este proyecto".
   Los textos de la web describen el stack real (por ejemplo, "Next.js estático", "Kafka en local / SQS en producción").

## Stack decidido
| Capa | Tecnología | Por qué | Relación con mi CV |
|---|---|---|---|
| Frontend | Next.js con SSG puro (`output: 'export'`) en S3 + CloudFront; la zona reclutador se renderiza en el cliente; el CI reconstruye cuando cambia el contenido | El contenido público casi no cambia: carga instantánea y costo casi cero | Nueva (ADR) |
| Entrada | Un solo dominio en CloudFront: `/api/*` → origen de la API (mecanismo a definir, ver pendiente 5) | Cookies same-origin, sin CORS | Nueva (ADR) |
| API | NestJS + TypeScript, arquitectura hexagonal, prefijo global `/api` | Mi stack principal | Avanzado |
| Runtime | AWS Lambda: bundle con esbuild, instancia de la app cacheada, adaptador HTTP (ver pendiente 3) | Paga por uso; el dominio no sabe que corre en Lambda | AWS en aprendizaje (ADR) |
| Datos | PostgreSQL serverless + TypeORM; migraciones por conexión directa (sin pooler) | Postgres real, apto para Lambda | Avanzado |
| Caché / sesiones | Redis: Upstash en producción, Docker en local | Tokens del magic link con TTL y rate limit, sin VPC ni NAT Gateway | En producción (ADR solo por el proveedor) |
| Eventos | Puerto `EventPublisher`: adaptador Kafka en local, Amazon SQS en producción | MSK cuesta ~USD 558/mes (fuente: aws.amazon.com/msk/pricing); mismo puerto, distinto adaptador | Kafka en producción; SQS nuevo (ADR) |
| Correo | Amazon SES + DKIM/SPF/DMARC; Mailpit en local; rebotes vía SNS | Entregabilidad del magic link | Nueva (ADR) |
| Auth | Magic link + JWT RS256 (15 min) + refresh rotativo (7 días), guards por rol (RECRUITER, ADMIN), endpoint JWKS público | Según el diseño | JWT/OAuth en producción |
| Secretos | AWS SSM Parameter Store (SecureString) | Llaves fuera del repo, sin costo | Nueva (ADR) |
| Infraestructura | Infraestructura como código en TypeScript (ver pendiente 2) | Entorno reproducible y versionado | Nueva (ADR) |
| CI/CD | GitHub Actions con OIDC hacia AWS | Despliegue sin llaves de AWS guardadas | En producción |
| Docs API | Swagger en `/api-docs` | Según el diseño | En producción |
| Tests | Jest (unitarios y de integración) + E2E del flujo de login | Según el diseño | En producción |
| Local | docker-compose: Postgres, Redis, Kafka, Mailpit | Desarrollo sin depender de la nube | Docker en producción |

## Decisiones pendientes: compararlas en la exploración
Verificá cada dato en documentación oficial y citá la fuente.
1. **PostgreSQL serverless: Neon vs Supabase.** Criterios: plan gratuito vigente, pooler compatible con Lambda,
   compatibilidad de TypeORM con el pooler en modo transacción (prepared statements), latencia hacia la región de AWS,
   comportamiento cuando la base "se duerme".
2. **IaC: SST vs AWS CDK.** Como no hay ISR ni SSR, el criterio central es publicar un sitio estático en S3 + CloudFront
   con `/api/*` hacia la API. También: soporte del mecanismo elegido en el pendiente 5, curva de aprendizaje, valor en el mercado laboral.
3. **Adaptador HTTP: Lambda Web Adapter vs @codegenie/serverless-express.** Criterios: cold start, manejo de cookies y binarios (PDF),
   paridad local/Lambda, compatibilidad con el origen elegido en el pendiente 5.
4. **Región de AWS** para Lambda, SES y la base, pensando en usuarios de Chile.
5. **Protección del origen `/api`** (nadie puede llamar a la API saltándose CloudFront):
   - a) API Gateway + header secreto que CloudFront agrega y la API valida; endpoint `execute-api` por defecto desactivado si es posible.
   - b) Lambda Function URL + OAC (sin API Gateway). Verificar: los POST/PUT requieren que el cliente envíe `x-amz-content-sha256`,
     lo que afecta al formulario del magic link.
   - c) Lambda Web Functions + OAC (sin API Gateway; anunciado el 12-10-2026). Verificar: soporte en SST/CDK, madurez,
     disponibilidad en la región elegida, firma `UNSIGNED-PAYLOAD` en POST.
   Si se elige b) o c), actualizar la fila "Entrada" y sacar API Gateway del stack.

## Requisitos de seguridad (repo público en GitHub)
- `.gitignore` desde el primer commit; gitleaks en pre-commit; push protection de GitHub activada.
- Ningún dato personal en el repo: renta, disponibilidad y CV en PDF/Word se guardan en la base o en un bucket S3 privado.
  El teléfono es público por decisión consciente (aparece en `Diseño/html/`, que se versiona).
  El CV se entrega con una URL firmada que expira. Los seeds del repo usan datos falsos.
- Ningún código, nombre de cliente ni endpoint de empleadores anteriores. El caso de estudio de migración se reconstruye con un dominio inventado.
- GitHub Actions: OIDC, rol de deploy limitado a `main` y con permisos mínimos, actions fijadas por SHA, sin `pull_request_target`.
- Dependabot y protección de rama en `main`.
- El origen `/api` no se puede invocar sin pasar por CloudFront (pendiente 5).
- El rate limit toma la IP de `CloudFront-Viewer-Address` (la origin request policy debe reenviarlo); nunca de `X-Forwarded-For`.
- El rate limit se guarda en Redis (Upstash), nunca en memoria: cada instancia de Lambda tiene su propia memoria.
- Cookies HttpOnly, Secure, SameSite=Strict + validación del header `Origin` en métodos mutantes.
- Respuesta idéntica en `/auth/magic-link` exista o no el correo; tokens guardados solo como hash.
- Commits con `mariajosetolmo@gmail.com` (decisión consciente: ya es público en la web); commits convencionales.
- `/api/v1/admin/*` solo para el rol ADMIN, con tests que verifiquen el 403 para RECRUITER.

## Calidad
TypeScript strict, ESLint, CI que bloquea el merge si fallan lint, tipos o tests.

## Fuera de alcance por ahora
Usar Kafka gestionado (MSK) o ElastiCache en producción; meter recursos dentro de una VPC; ISR y SSR (ambos requieren servidor).

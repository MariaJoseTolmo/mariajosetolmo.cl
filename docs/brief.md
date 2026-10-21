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
| Entrada | Un solo dominio (`mariajosetolmo.cl`) en CloudFront: `/api/*` → origen de la API protegido con OAC (ver decisión 5) | Cookies same-origin, sin CORS | Nueva (ADR) |
| API | NestJS + TypeScript, arquitectura hexagonal, prefijo global `/api` | Mi stack principal | Avanzado |
| Runtime | AWS Lambda Web Functions (Node 24, arm64): el servidor NestJS escucha en `AWS_LAMBDA_HTTP_ENDPOINT`, sin adaptador HTTP; condicionado al infra-spike (Plan B: Function URL + Lambda Web Adapter). El bundle debe conservar la metadata de decoradores (tsc/SWC, no esbuild solo) | Paga por uso; el dominio no sabe que corre en Lambda | AWS en aprendizaje (ADR) |
| Datos | PostgreSQL serverless en Neon (us-east-1) + TypeORM; migraciones por conexión directa (sin pooler) | Postgres real, apto para Lambda | Avanzado |
| Caché / sesiones | Redis: Upstash en producción, Docker en local | Tokens del magic link con TTL y rate limit, sin VPC ni NAT Gateway | En producción (ADR solo por el proveedor) |
| Eventos | Puerto `EventPublisher`: adaptador Kafka en local, Amazon SQS en producción | MSK Serverless cuesta ~USD 558/mes y el MSK aprovisionado mínimo (2 brokers `kafka.m5.large`) ~USD 307/mes (fuente: aws.amazon.com/msk/pricing); mismo puerto, distinto adaptador | Kafka en producción; SQS nuevo (ADR) |
| Correo | Amazon SES + DKIM/SPF/DMARC; Mailpit en local; rebotes vía SNS | Entregabilidad del magic link | Nueva (ADR) |
| Auth | Magic link + JWT RS256 (15 min) + refresh rotativo (7 días), guards por rol (RECRUITER, ADMIN), endpoint JWKS público | Según el diseño | JWT/OAuth en producción |
| Secretos | AWS SSM Parameter Store (SecureString) | Llaves fuera del repo, sin costo | Nueva (ADR) |
| Infraestructura | AWS CDK en TypeScript (L1 para Web Functions) | Entorno reproducible y versionado | Nueva (ADR) |
| CI/CD | GitHub Actions con OIDC hacia AWS | Despliegue sin llaves de AWS guardadas | En producción |
| Docs API | Swagger en `/api/docs` (bajo el prefijo `/api`, así CloudFront lo enruta sin un behavior extra) | Según el diseño | En producción |
| Tests | Jest (unitarios y de integración) + E2E del flujo de login | Según el diseño | En producción |
| Local | docker-compose: Postgres, Redis, Kafka, Mailpit | Desarrollo sin depender de la nube | Docker en producción |

## Decisiones resueltas (2026-10-20)
Comparadas en `openspec/changes/stack-decisions/exploration.md`; cada una con su ADR en `openspec/changes/stack-adrs/`.
1. **PostgreSQL serverless:** Neon (Supabase Free se pausa tras una semana). La región es inmutable: el proyecto se crea solo después del spike. TypeORM detrás del pooler en modo transacción queda por verificar.
2. **IaC:** AWS CDK en TypeScript (L1 para Web Functions).
3. **Adaptador HTTP:** ninguno con Web Functions (el servidor escucha en `AWS_LAMBDA_HTTP_ENDPOINT`). Con el Plan B, Lambda Web Adapter.
4. **Región:** us-east-1 para todo (Web Functions no existe en sa-east-1). La latencia desde Chile se mide en el spike.
5. **Protección del origen `/api`:** c) Lambda Web Functions + CloudFront OAC (`always-amz-auth`, POST con `UNSIGNED-PAYLOAD`), **condicionada al infra-spike**. Plan B: b) Function URL + OAC, que obliga al cliente a enviar `x-amz-content-sha256`. API Gateway queda fuera del stack.

## Requisitos de seguridad (repo público en GitHub)
- `.gitignore` desde el primer commit; gitleaks en pre-commit; push protection de GitHub activada.
- Ningún dato personal en el repo: renta, disponibilidad y CV en PDF/Word se guardan en la base o en un bucket S3 privado.
  El teléfono es público por decisión consciente (aparece en `Diseño/html/`, que se versiona).
  El CV se entrega con una URL firmada que expira. Los seeds del repo usan datos falsos.
- Ningún código ni endpoint de empleadores anteriores. El caso de estudio de migración se reconstruye con un dominio inventado.
  Los nombres de empleadores (Accenture, Kabeli, Amecs) y el cliente "Banco Itaú" se muestran por decisión consciente de la dueña del CV.
- GitHub Actions: OIDC, rol de deploy limitado a `main` y con permisos mínimos, actions fijadas por SHA, sin `pull_request_target`.
- Dependabot y protección de rama en `main`.
- El origen `/api` no se puede invocar sin pasar por CloudFront (decisión 5; el spike verifica el 403 en la llamada directa).
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

# web_cv

Portafolio público (mariajosetolmo.cl). El sitio es, a la vez, la muestra de código: una API NestJS con arquitectura hexagonal, desarrollada con Spec-Driven Development. La fuente de verdad del alcance es [`docs/brief.md`](docs/brief.md).

Estado actual: base del monorepo (`apps/api` con el slice `health`), entorno local, CI y documentación de la API. El frontend, la autenticación y la infraestructura llegan en cambios posteriores.

## Inicio rápido

Requisitos: Node `>=24.15.0 <25` (ver `.nvmrc`), Docker y [gitleaks](https://github.com/gitleaks/gitleaks) (lo usa el hook pre-commit).

```bash
nvm use                      # Node 24 según .nvmrc
npm ci                       # instala dependencias y activa el hook pre-commit
cp .env.example .env         # valores ficticios, solo para desarrollo local
docker compose up -d --wait  # Postgres, Redis, Kafka y Mailpit
npm run start:dev -w @web-cv/api
```

- Salud: <http://localhost:3000/api/health>
- Documentación OpenAPI (Swagger UI): <http://localhost:3000/api/docs> (JSON en `/api/docs-json`)

Si ya tienes Postgres o Redis nativos ocupando los puertos por defecto, cambia `POSTGRES_HOST_PORT` y `REDIS_HOST_PORT` en `.env`. Todos los puertos se publican solo en `127.0.0.1`.

## Scripts

| Script                              | Qué hace                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                      | ESLint (type-checked) sobre todo el repo, sin `spikes/`                                                                                   |
| `npm run lint:boundaries`           | Verifica que las capas hexagonales respeten sus límites                                                                                   |
| `npm run format:check`              | Prettier en modo verificación                                                                                                             |
| `npm run typecheck`                 | `tsc --noEmit` en modo `strict`                                                                                                           |
| `npm test`                          | Pruebas unitarias (Jest)                                                                                                                  |
| `npm run test:cov`                  | Unitarias con cobertura (umbral 80 % en `domain/` y `application/`)                                                                       |
| `npm run test:e2e`                  | Pruebas e2e con supertest                                                                                                                 |
| `npm run build`                     | Compila `apps/api` a `dist/`                                                                                                              |
| `npm run test:int -w apps/api`      | Integración contra Redis y Postgres reales (`docker compose up -d --wait`; exporta `REDIS_URL` y `DATABASE_URL` si cambiaste los puertos) |
| `npm run migration:run -w apps/api` | Compila y aplica las migraciones con `MIGRATIONS_DATABASE_URL` (`migration:revert` deshace la última)                                     |

## Estructura

```
apps/api/src/
  health/
    domain/          TypeScript puro (sin Nest): reglas y tipos
    application/     casos de uso y puertos (HealthProbe, HEALTH_PROBES)
    infrastructure/  adaptadores: controlador HTTP, sondas, DTO de Swagger
  bootstrap/         configuración de la app (prefijo /api, Swagger)
docs/brief.md        alcance y decisiones de producto
openspec/            specs, diseños, tareas y ADR (SDD)
spikes/              experimentos aislados; fuera del workspace, del lint y del CI
```

Reglas de capas (las hace cumplir `npm run lint:boundaries`): `domain` no importa Nest ni otras capas; `application` no importa `infrastructure`; solo `infrastructure` conoce frameworks. El enlace entre puertos y adaptadores vive únicamente en `health.module.ts`.

## Compuertas de calidad

- CI (GitHub Actions): job `quality` (lint, límites, formato, tipos, cobertura, e2e, build), job `integration` (pruebas contra Redis y Postgres reales, con los mismos digests de imagen que docker-compose) y job `secrets` (gitleaks sobre todo el historial). Acciones fijadas por SHA.
- Hook pre-commit (`.githooks/pre-commit`): ejecuta `gitleaks git --pre-commit --staged`; falla cerrado si gitleaks no está instalado. `npm ci` lo activa con `core.hooksPath`.
- Dependabot: npm (sin saltos de major de TypeScript), GitHub Actions y docker-compose, de forma semanal.
- Strict TDD: todo comportamiento nuevo se escribe primero como prueba que falla.

## Por qué esta tecnología

Una línea por pieza que no figura en mi CV (regla 3 del brief). Lo que sí domino (NestJS, TypeORM, Redis, Kafka, Jest, Swagger, Docker) no se justifica acá.

- **Mailpit**: captura localmente los correos del magic link sin enviar nada real; reemplaza a SES solo en desarrollo.
- **`nodemailer`**: adaptador SMTP hacia Mailpit en local, igual que Mailpit es herramienta de desarrollo; en producción el puerto `MailSender` usa el adaptador de SES.
- **`apache/kafka` en modo KRaft**: broker de un solo nodo sin ZooKeeper para el adaptador local del puerto `EventPublisher`; en producción se usaría SQS por costo.
- **Redis 8**: se usa solo en desarrollo local; a partir de la versión 8 cambió la licencia (RSALv2/SSPL/AGPLv3), algo a revisar antes de usarlo en producción (allí se prevé Upstash).
- **gitleaks**: detecta secretos en el hook pre-commit y en CI; imprescindible en un repo público.
- **Jest con `--experimental-vm-modules`**: Nest 12 publica paquetes solo ESM y Jest 30 necesita módulos de VM para cargarlos desde un build CommonJS; se limita al script de Jest para no migrar todo el proyecto a ESM ni cambiar de runner.
- **Planeadas en cambios posteriores** (cada una requerirá su ADR): Next.js con exportación estática, S3 + CloudFront, AWS Lambda, SES, SQS y SSM. AWS está en la categoría "aprendiendo, aplicado en este proyecto".

## Seguridad

- Repositorio público: no se versionan secretos, `.env` reales ni datos personales; `.env.example` solo trae valores ficticios.
- No hay código de empleadores anteriores.
- Swagger está siempre activo, producción incluida; las rutas `/admin` se excluirán del documento cuando exista la autenticación.
- Vulnerabilidades: abrir un aviso privado de seguridad en GitHub en lugar de un issue público.

## Proceso (SDD)

Los cambios se especifican en [`openspec/`](openspec/) (propuesta, specs, diseño y tareas) antes de implementarse, y se entregan en PR encadenados de hasta 400 líneas con commits convencionales.

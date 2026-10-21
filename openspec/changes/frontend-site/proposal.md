# Propuesta: Frontend Site — `apps/web` estático con Next.js

## Intención

No hay frontend. Este cambio crea `apps/web`: el sitio público (Inicio, Experiencia) y el acceso de reclutadores (login con magic link y zona reclutador), con los valores del diseño aprobado en `Diseño/html/`. La salida es un export estático listo para S3 + CloudFront. La web es la muestra de código: cada decisión tiene que poder defenderse.

**Fuera del CV (ADR obligatorio):** Next.js con export estático. El ADR se redacta en `openspec/changes/stack-adrs/`; aquí solo se referencia. Exigirían ADR nuevo: Tailwind, vanilla-extract, TanStack Query, SWR, MSW, Playwright y Vitest (no se usan).

## Alcance

### Dentro del alcance
- `apps/web` con Next.js 16.4.2 + React 19.3.1, App Router, `output: 'export'`, `trailingSlash: true`, `images.unoptimized`.
- Rutas: `/`, `/experiencia/`, `/acceso/`, `/acceso/verificar/#token=…`, `/reclutador/`, `404.html`.
- CSS Modules + `src/styles/tokens.css`; IBM Plex Sans/Mono con `next/font/google` (plan B: `next/font/local`).
- Una sola implementación responsive: los mockups "Móvil" son el mismo componente a 390 px.
- Contenido en módulos TS tipados (`src/content/`) + test de guardas de contenido.
- Puerto `ApiGateway` con adaptadores `http` y `mock`, elegidos con `NEXT_PUBLIC_API_MODE`; el mock queda fuera del bundle de producción (con test).
- Jest 30 + `next/jest` + RTL + jest-dom + jest-axe; test de contraste de los pares de tokens.
- Ignores de `.next/`, `out/` y `next-env.d.ts` en ESLint y `.gitignore`; README ("Por qué esta tecnología").

### Decisiones de contenido (cerradas)

| # | Decisión |
|---|----------|
| H1/H8 | Se mantienen Accenture, Kabeli, Amecs y "Banco Itaú" (excepción consciente; el brief se actualiza) |
| H2 | Donde aparezca Kafka: "Kafka en local / SQS en producción" |
| H3 | Pie: "María José Tolmo Tolmo" (correcto) |
| H4 | Chip `/status` → `/api/health`; chip `/api-docs` → `/api/docs` |
| H5 | Una sola nav: Experiencia, `/#proyectos`, `/#stack`, `/#como`, Acceso reclutadores |
| H6 | Sin botón Word ni tarjeta "Agendar entrevista": la zona reclutador tiene 3 tarjetas |
| H7 | Login: email (obligatorio), empresa y nombre (opcionales). Saludo: empresa → "Gracias por tu interés, equipo de {empresa}"; si no, nombre → "Gracias por tu interés, {nombre}"; si no, "Gracias por tu interés" |
| Datos | Teléfono público. Renta, disponibilidad y CV nunca en el repo: llegan por API (mock con datos falsos) |

### Fuera del alcance
Backend real de auth, infra/CDK de S3 + CloudFront (solo se entrega el contrato), Playwright, Lighthouse CI.

## Capacidades

### Capacidades nuevas
- `web-public-pages`: Inicio, Experiencia, 404, nav compartida, tokens, accesibilidad y guardas de contenido.
- `web-recruiter-access`: login y verificación del magic link, zona reclutador, guard de sesión, puerto `ApiGateway` y modo mock.
- `web-delivery-contract`: forma de `out/`, `trailingSlash`, CloudFront Function de reescritura, 404, caché y cabeceras que infra debe aplicar.

### Capacidades modificadas
Ninguna (`openspec/specs/` está vacío).

## Enfoque

Recomendación de la exploración, sin cambios. **Tarea 1 = smoke test**: `next build` con export, `eslint-config-next` con peers de ESLint 10, `next/jest` con Jest 30 y `typecheck`. Si falla: DETENERSE y consultar a la usuaria; no cambiar de herramienta sin ADR y aprobación. Strict TDD: cada componente nace de un test que falla. Páginas síncronas; solo el menú móvil, el login y el playground son Client Components.

## Plan de PRs (stacked-to-main, sin lockfile)

| PR | Contenido | Líneas |
|----|-----------|--------|
| 1 | Smoke test, `apps/web`, Jest/RTL/axe, tokens, fuentes, layout, `Button`, `SiteHeader`, `Footer`, ignores | ~350 |
| 2 | Inicio | ~380 |
| 3 | Experiencia | ~300 |
| 4 | `ApiGateway` + mock, `/acceso/`, `/acceso/verificar/` | ~400 |
| 5 | Zona reclutador: guard, cliente `http` + refresh, 3 tarjetas, playground | ~400 |
| 6 | Metadata, sitemap, robots, 404, guardas de contenido, contrato de entrega, README | ~200 |

## Áreas afectadas

| Área | Impacto |
|------|---------|
| `apps/web/` | Nuevo |
| `eslint.config.mjs`, `.gitignore`, `README.md` | Modificado |
| `docs/brief.md` | Lo actualiza otro agente (excepción Itaú); no se toca aquí |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Peers de ESLint 10 en `eslint-config-next` | Alta | Smoke test; plan B `@next/eslint-plugin-next` + `react-hooks` |
| `next/jest` + Jest 30 (¿`--experimental-vm-modules`?) | Media | Smoke test; parar y preguntar |
| `next dev` no hace proxy de `/api` | Alta | Modo mock hasta el cambio de auth |
| Mock en el bundle de producción | Baja | Test sobre `out/` |
| Acento ≈ 4.6:1 de contraste | Media | Test de contraste falla bajo 4.5 |
| Google Fonts en build | Baja | `next/font/local` |
| Subrutas y CSP dependen de CloudFront | Media | Contrato de entrega explícito |
| Nombre "Banco Itaú" contra la regla del brief | Media | Excepción registrada en el brief |

## Plan de reversión

Cada PR se revierte con `git revert` del merge, en orden inverso (6 → 1). `apps/web` es aditivo: borrarlo deja `apps/api` y el CI como estaban. No hay despliegue en este cambio.

## Dependencias

- **Cambio de auth**: endpoints reales (`magic-link`, `verify`, `refresh`, `me`, URL firmada del CV); su contrato debe aceptar `name?` además de `email` y `company?`.
- **Cambio de infra**: CloudFront Function, error response 404, políticas de caché y cabeceras (CSP, `Referrer-Policy: no-referrer`).
- ADR de Next.js estático (`stack-adrs`).

## Criterios de éxito

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` en verde, local y CI.
- [ ] `out/` contiene las 5 rutas + `404.html`, sin código del mock.
- [ ] jest-axe: 0 violaciones en cada página y estado del login.
- [ ] Test de contraste: texto ≥ 4.5:1, UI ≥ 3:1.
- [ ] Test de guardas: sin `.pdf`/`.docx` ni renta/disponibilidad en `apps/web`.
- [ ] Manual: Lighthouse móvil Performance ≥ 95, Accessibility 100, BP/SEO ≥ 95, LCP < 2.5 s, CLS < 0.1.
- [ ] Cada PR ≤ 400 líneas; cobertura ≥ 80 %.

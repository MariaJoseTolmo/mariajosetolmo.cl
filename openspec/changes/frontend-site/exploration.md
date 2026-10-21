# Exploración: `frontend-site`

> Fecha: 2026-10-20. Fuente de verdad: `docs/brief.md`. Versiones consultadas hoy en el registro npm y en la documentación oficial de Next.js y AWS.

## 1. Respuesta corta

| Tema | Recomendación |
|------|---------------|
| Framework | Next.js 16.4.2 + React 19.3.1, App Router, `output: 'export'`, `trailingSlash: true` |
| Entrega | S3 (OAC) + CloudFront con una CloudFront Function que reescribe a `index.html`; `404.html` por error response |
| Estilos | CSS Modules + tokens en CSS custom properties. Sin Tailwind ni vanilla-extract; sin ADR más allá del de Next |
| Fuentes | IBM Plex Sans (400/600/700) + IBM Plex Mono (400/500) con `next/font/google`, autoalojadas en el build. Alternativa: `next/font/local` |
| Tests | Jest 30 + `next/jest` (SWC) + RTL + jest-dom + jsdom + jest-axe. Sin Playwright ni MSW por ahora |
| Zona reclutador | Cliente puro: puerto `ApiGateway`, adaptadores `http` y `mock`, `fetch` + `useReducer`. Sin TanStack Query |
| Magic link | Ruta estática `/acceso/verificar/?token=…` |
| Contenido | Módulos TS tipados en `src/content/` con test de guardas de contenido. Sin MDX |
| PRs | 6 PRs de ≤ 400 líneas (sin lockfile), ~1.900–2.300 líneas en total |

## 2. Estado actual

- Workspace `apps/*` con solo `apps/api`. No existe `apps/web`.
- Scripts raíz delegan con `--workspaces --if-present`: `apps/web` solo define sus scripts y el job `quality` del CI lo recoge sin cambios.
- `eslint.config.mjs` raíz: falta ignorar `**/.next/**`, `**/out/**` y `**/next-env.d.ts`. `.gitignore`: falta `.next/`, `out/`, `next-env.d.ts`.
- `tsconfig.base.json` es CommonJS/ES2023/node: web sobrescribe `module`, `lib`, `jsx`, `noEmit`, `isolatedModules`, `types` y desactiva decoradores.
- El frontend asume strict TDD (se activa en el PR 3 del scaffold).

## 3. Diseño aprobado: inventario

### 3.1 Hallazgo estructural

Las carpetas "Móvil · …" no son diseños distintos: `Movil-*.dc.html` importa el mismo componente dentro de un marco de 390 px. Hay **una sola implementación responsive**. Los PNG de `Diseño/` son una versión antigua y no se usan.

### 3.2 Tokens

**Color**

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-bg` | `#F5F4FA` | Fondo de página |
| `--color-surface` | `#FFFFFF` | Tarjetas, secciones alternas, inputs |
| `--color-ink` | `#15132B` | Texto principal, borde de botón secundario, fondo oscuro |
| `--color-ink-2` | `#3A3654` | Texto de cuerpo |
| `--color-muted` | `#5A5675` | Metadatos, etiquetas |
| `--color-border` | `#DEDCEB` | Bordes de tarjeta y separadores |
| `--color-border-strong` | `#8F8AAE` | Bordes de input y botón secundario |
| `--color-accent` | `#6D5BDF` | Botón primario, eyebrow, enlaces |
| `--color-accent-hover` | `#5546C2` | Hover de enlaces |
| `--color-green` | `#9EDF81` | CTA sobre oscuro, claves JSON, paso activo |
| `--color-code-string` | `#C9C1FF` | Strings en bloques de código |
| `--color-dark-border` | `#2B2847` | Bordes en superficies oscuras |
| `--color-dark-active` | `#221F3D` | Fila activa del panel del login |
| `--color-on-dark` | `#ECEAF7` | Texto sobre oscuro |
| `--color-on-dark-2` | `#C4C0DC` | Texto secundario sobre oscuro |
| `--color-on-dark-muted` | `#A9A5C4` | Texto terciario sobre oscuro |

**Tipografía:** IBM Plex Sans 400/600/700; IBM Plex Mono 400/500 (500 solo en logo y etiquetas de método).

| Rol | Valor (tamaño / interlineado / peso) |
|-----|-------|
| H1 hero | `clamp(40px, 5vw, 64px)` / 1.05 / 700 / `-0.02em` |
| H1 Experiencia | `clamp(36px, 4.5vw, 56px)` / 1.08 / 700 / `-0.02em` |
| H1 reclutador | `clamp(32px, 4vw, 46px)` / 1.1 / 700 / `-0.01em` |
| H1 login | 34 / 1.15 / 700 |
| H2 sección | 36 / 1.15 / 700 / `-0.01em` |
| H2 banda CTA | 34 / 1.15 / 700 |
| H2 playground | 28 / 700 |
| H2/H3 tarjeta | 22 / 600 (reclutador: 18 / 600) |
| Lead | 19 / 1.55; 18 / 1.6; 17 / 1.6 |
| Cuerpo | 16 / 1.6–1.7; 15 |
| Pequeño | 14; 13 |
| Mono | eyebrow 14 (login 13); código 14.5 / 1.7 (hero) y 14 / 1.65 (playground); listas del stack 14.5 / 1.9; pill 12.5; etiquetas 12 |

**Espaciado y layout:** contenedor `max-width: 1200px; padding-inline: 24px` (login 16px); padding vertical de sección 88px (hero 88/96, banda CTA 80, Experiencia 72/96, reclutador 56/88); gaps 4–56; alto táctil 44/48/52; grillas `repeat(auto-fit, minmax(280|260|240px, 1fr))`.

**Radios:** 8, 10, 12, 14, 50%, 999. **Sombras:** ninguna. **Bordes:** 1px `--color-border`; 2px en cabeceras de columna del Stack y nodo API del diagrama.

**Breakpoint:** uno solo a 760px (en el mockup como `@container`). En producción: mobile-first con `@media (min-width: 761px)` y `vw` en lugar de `cqw`. **No replicar** `scrollbar-width: none` (artefacto del visor).

### 3.3 Páginas

| Ruta | Página | Secciones |
|------|--------|-----------|
| `/` | Inicio | Header con nav; Hero (eyebrow, h1, lead, 2 CTAs, tarjeta `GET /api/v1/profile`); 01 Lo que aporto; 02 Stack (4 columnas); 03 Proyectos; 04 Cómo está hecha (diagrama + chips); banda CTA; Footer |
| `/experiencia/` | Experiencia | Header (`aria-current`); línea de tiempo de 5 ítems; Formación; banda CTA |
| `/acceso/` | Login | Header mínimo; tarjeta `form` → `sent`; panel "Detrás de este formulario" con 4 pasos |
| `/acceso/verificar/` | Login (`confirm`, `done`) | Ver 3.5 |
| `/reclutador/` | Zona reclutador | Header con pill de sesión; saludo; 4 tarjetas; API Playground |
| `/404` | No encontrada | No está en el diseño: hace falta una mínima |

### 3.4 Componentes compartidos

`SiteHeader` (public/minimal/session), `Button`/`LinkButton` (primario, secundario, outline, on-dark; 44/48/52), `Eyebrow`, `SectionHeading`, `Card`, `CodeWindow` (con resaltado JSON), `Callout`, `TimelineItem`, `StackColumn`, `ProjectRow`, `ArchitectureDiagram`, `CtaBand`, `FormField`, `StepsPanel`, `EndpointButton` + `ApiPlayground` (`aria-pressed` estilado desde CSS), `Footer`.

### 3.5 Flujo de login

| Estado en la maqueta | Producción |
|----------------------|------------|
| `form` | `/acceso/`: `POST /api/auth/magic-link` con `{ email, company? }` |
| `sent` | Mismo URL. "Simular: abrir el enlace" solo en modo mock |
| `confirm` | `/acceso/verificar/?token=…`; "Confirmar ingreso" → `POST /api/auth/verify` |
| `done` | Enlaza a `/reclutador/`. "Reiniciar demo" solo en mock |

La confirmación en dos pasos evita que los previsualizadores de enlaces consuman el token. `useSearchParams` exige un `<Suspense>` en rutas prerenderizadas. El token se borra de la URL con `history.replaceState` y se requiere `Referrer-Policy: no-referrer` (CloudFront). Las rutas exactas de auth las define el cambio de auth.

## 4. Decisiones por tema

### 4.1 Next.js y static export

Versiones: `next` 16.4.2 (`engines.node >=20.9.0`), `react` 19.3.1.

Con `output: 'export'` no se puede usar ([doc](https://nextjs.org/docs/app/guides/static-exports)): rutas dinámicas sin `generateStaticParams()`, Route Handlers que dependen de `Request`, cookies, rewrites, redirects, headers, Proxy (ex middleware), ISR, Draft Mode, Server Actions, optimización de imágenes por defecto, Intercepting Routes. **`next dev` tampoco puede hacer proxy de `/api`**: hasta el cambio de auth se desarrolla en modo mock. `images.unoptimized: true` por si se agregan imágenes.

**App Router** recomendado; las páginas se mantienen síncronas para que Jest pueda renderizarlas.

**`trailingSlash` y CloudFront.** El *default root object* solo aplica a la raíz: `/ruta/` no devuelve `index.html` desde un origen S3 REST con OAC ([doc](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html)). Solución documentada: CloudFront Function en viewer-request ([ejemplo](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html)):

```js
async function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) { request.uri += 'index.html'; }
  else if (!uri.includes('.')) { request.uri += '/index.html'; }
  return request;
}
```

**Recomendación:** `trailingSlash: true` + esta Function. Contrato de salida hacia infra: Function solo en el behavior por defecto (nunca `/api/*`); 403/404 de S3 → `/404.html` con 404; `_next/static/*` inmutable y HTML con TTL corto. Entregable: `apps/web/out/`.

**Cabeceras de seguridad:** `headers()` no funciona en export. CSP, `Referrer-Policy`, etc. van en una response headers policy de CloudFront. CSP con nonce no sirve en estático; SRI es experimental ([doc](https://nextjs.org/docs/app/guides/content-security-policy)). Riesgo y tarea de infra.

### 4.2 Estilos

| Opción | Pros | Contras | Esfuerzo |
|--------|------|---------|----------|
| CSS Modules + custom properties | Nativo en Next; cero dependencias; valores del mockup 1 a 1; sin ADR | Sin utilidades | Bajo |
| Tailwind v4 | Rápido de escribir | ADR obligatorio; los tokens son literales exactos, no una escala | Medio |
| vanilla-extract | Tokens tipados | Plugin de build; ADR | Alto |

**Recomendación:** CSS Modules con `src/styles/tokens.css`, `globals.css` mínimo y un `.module.css` por componente.

### 4.3 Fuentes

El mockup carga Google Fonts desde el navegador: no se replica. IBM Plex es OFL 1.1 ([LICENSE](https://github.com/IBM/plex/blob/master/LICENSE.txt)). `next/font` descarga en build y sirve local ([doc](https://nextjs.org/docs/app/api-reference/components/font)). **Recomendación:** `next/font/google` (`subsets: ['latin']`, `display: 'swap'`, `variable`), solo los 5 pesos usados. Plan B: `next/font/local` si la red del build es frágil. Documentar la licencia en el README.

### 4.4 Testing

Versiones: `jest` 30.5.2, `jest-environment-jsdom` 30.5.2, `@testing-library/react` 16.3.3, `jest-axe` 11.0.0.

- **Jest + `next/jest` + RTL** ([guía](https://nextjs.org/docs/app/guides/testing/jest)): transform SWC, mocks de CSS y `next/font`. TS 6.0.3 no influye en los tests (tipado aparte con `tsc`). `jest.config.js` en CJS como `apps/api`. **NO VERIFICADO:** si web necesita `--experimental-vm-modules`; lo confirma el smoke test de la tarea 1.
- **Vitest:** descartado. **Playwright:** diferido al cambio de auth (con ADR). **Accesibilidad:** `jest-axe`; jsdom no mide contraste, así que un test unitario calcula la razón de los pares de tokens.

| Par | Razón estimada |
|-----|----------------|
| Blanco sobre `#6D5BDF` | ≈ 5.0 |
| `#6D5BDF` sobre `#F5F4FA` | ≈ 4.6 (justo sobre 4.5) |
| `#5A5675` sobre `#F5F4FA` | ≈ 6.3 |
| `#A9A5C4` sobre `#15132B` | ≈ 7.6 |
| `#8F8AAE` sobre blanco (UI, mínimo 3:1) | ≈ 3.3 |

### 4.5 Zona reclutador, login y datos sin servidor

- **Guard de sesión:** `/reclutador/` es HTML estático; al montar llama `GET /api/v1/me` y redirige a `/acceso/` con 401. Disponibilidad y renta llegan siempre desde la API.
- **Cookies:** HttpOnly, Secure, SameSite=Strict; `fetch` same-origin las envía. El POST de confirmación sale desde la propia página (same-site).
- **Refresh:** ante 401, un intento de `POST /api/auth/refresh` y se repite.
- **Decisión 5 del brief:** con Plan B (Function URL + OAC) los POST necesitan `x-amz-content-sha256`; el cliente aísla ese detalle en un solo lugar.
- **Datos:** `fetch` + hook propio, sin librería ni ADR.
- **Mocks:** puerto `ApiGateway` + adaptadores `http`/`mock` elegidos con `NEXT_PUBLIC_API_MODE` en build; el mock se elimina del bundle de producción y un test falla si se cuela. Los botones "Simular" y "Reiniciar demo" solo existen en mock.

Contrato mínimo (tipos a mano en `src/lib/api/`): `POST /api/auth/magic-link`, `POST /api/auth/verify`, `POST /api/auth/refresh`, `POST /api/auth/logout` (por definir), `GET /api/v1/me`, playground (`/api/v1/profile`, `/experience?limit=2`, `/skills?level=advanced`, `/me`, `/admin/visits` → 403 para RECRUITER), descarga del CV por URL firmada (por definir en auth).

### 4.6 Integración con el workspace

- `apps/web/package.json`: `dev`, `build`, `typecheck` (`next typegen && tsc --noEmit`), `test`, `test:cov`; sin `test:e2e`.
- `tsconfig.json` de web **pre-poblado** (Next lo reescribe en el primer build).
- TypeScript se queda en 6.0.3 (`typescript-eslint` exige `<6.1.0`).
- ESLint: `next lint` ya no existe en Next 16; se usa el CLI con `eslint-config-next` ([doc](https://nextjs.org/docs/app/api-reference/config/eslint)). **Riesgo:** sus dependencias (`eslint-plugin-react`, `jsx-a11y`, `import`) declaran peers solo hasta ESLint 9; con ESLint 10 `npm ci` puede fallar con `ERESOLVE`. Plan B: `overrides`, o `@next/eslint-plugin-next` + `eslint-plugin-react-hooks` 7.1.1 y accesibilidad vía jest-axe.
- CI: `quality` sin cambios; crece el tiempo de `build`.

### 4.7 Presupuestos

Lighthouse móvil en páginas públicas: Performance ≥ 95, Accessibility 100, Best Practices/SEO ≥ 95, LCP < 2.5 s, CLS < 0.1, JS de primera carga ≤ ~150 kB gzip (a calibrar). Solo el menú móvil, el login y el playground son Client Components. Falta agregar `aria-controls` en el menú, cierre con Escape, "saltar al contenido" y foco visible.

### 4.8 Contenido

Módulos TS tipados (`site.ts`, `experience.ts`, `stack.ts`, `projects.ts`). Renta, disponibilidad y CV nunca en el repo (llegan por API; mock con datos falsos). El teléfono es público por decisión de la usuaria (estará en el bundle). Test de guardas: falla con términos prohibidos o archivos `.pdf`/`.docx` en `apps/web`. Copia honesta: la tarjeta del hero se etiqueta como ejemplo o coincide con el contrato real.

## 5. Hallazgos de contenido a decidir

| # | Hallazgo | Dónde | Regla afectada |
|---|----------|-------|----------------|
| H1 | "cliente Banco Itaú" y "Accenture / Itaú" | `Experiencia.dc.html`, `Main.dc.html` | Brief: sin nombres de cliente |
| H2 | Kafka en el JSON del hero y en la fila de proyecto, sin tarjeta de eventos | `Main.dc.html` | Copia honesta: "Kafka en local / SQS en producción" |
| H3 | "María José Tolmo Tolmo" en el pie | `Main.dc.html` | Posible error tipográfico |
| H4 | Chips `/api-docs` y `/status` apuntan a `#como` | `Main.dc.html` | Swagger real en `/api/docs`; `/status` no existe |
| H5 | Nav de Experiencia inconsistente | `Experiencia.dc.html` | Unificar nav con `/#proyectos`, `/#stack` |
| H6 | "Proponer horario" y descarga en Word sin backend previsto | `Reclutador.dc.html` | Funcionalidad sin respaldo en el brief |
| H7 | "Gracias por tu interés, [Nombre]": la API no conoce el nombre | `Reclutador.dc.html` | Definir el saludo |
| H8 | Empleadores (Kabeli, Amecs, Accenture Chile) | `Main.dc.html`, `Experiencia.dc.html` | Se asume permitido; solo H1 es el problema |

## 6. Estimación y PRs

| PR | Contenido | Líneas aprox. |
|----|-----------|---------------|
| 1 | Cimientos: `apps/web`, Jest + RTL + jest-axe, tokens, globals, fuentes, layout, `Button`, `SiteHeader`/`Footer`, ignores, smoke test, README | ~350 |
| 2 | Inicio | ~380 |
| 3 | Experiencia | ~300 |
| 4 | Login: `ApiGateway` + mock, reducer, `/acceso/` y `/acceso/verificar/`, `StepsPanel` | ~400 |
| 5 | Zona reclutador: guard, cliente `http` + refresh, tarjetas, playground | ~400 |
| 6 | Endurecimiento: metadata/sitemap/robots/404, accesibilidad, guardas de contenido, contrato de entrega | ~200 |

**ADR requerido:** Next.js estático (brief). Exigirían ADR: Tailwind, vanilla-extract, TanStack Query, SWR, MSW, Playwright, Vitest.

## 7. Riesgos

1. Peers de ESLint 10 con `eslint-config-next` (smoke test + plan B).
2. `next/jest` con Jest 30 y el flag de VM modules sin verificar (smoke test; parar y consultar si falla).
3. Next reescribe `tsconfig.json` (pre-poblarlo).
4. Sin proxy de `/api` en `next dev` (modo mock hasta auth).
5. Infra depende de la CloudFront Function para subrutas.
6. CSP y `Referrer-Policy` solo desde CloudFront.
7. Acoplamiento con la decisión 5 si se usa Plan B (hash SHA-256 en POST).
8. Mock en producción (mitigado con `NEXT_PUBLIC_API_MODE` y test de build).
9. Contraste del acento ≈ 4.6 (verificar con herramienta).
10. Google Fonts en build (plan B `next/font/local`).
11. Rutas de auth con y sin `/v1` en el brief (alinear en auth).
12. Hallazgos H1–H8 pueden cambiar la copia.

## 8. Preguntas abiertas para la usuaria

1. **Itaú (H1) y empleadores (H8):** ¿"banca" a secas (recomendado) o se mantiene? ¿Kabeli, Amecs y Accenture pueden aparecer?
2. **Kafka (H2):** ¿reescribir con "Kafka en local / SQS en producción" o quitarlo mientras no exista la tarjeta de eventos?
3. **Funcionalidades sin backend (H4, H6):** ¿omitir "Proponer horario", Word y `/status` (recomendado), mostrarlas como "próximamente", o entran al alcance?

## Fuentes

- https://nextjs.org/docs/app/guides/static-exports
- https://nextjs.org/docs/app/api-reference/config/next-config-js/trailingSlash
- https://nextjs.org/docs/app/api-reference/components/font
- https://nextjs.org/docs/app/getting-started/css
- https://nextjs.org/docs/app/guides/testing/jest
- https://nextjs.org/docs/app/api-reference/config/eslint
- https://nextjs.org/docs/app/guides/content-security-policy
- https://nextjs.org/docs/app/api-reference/functions/use-search-params
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example_cloudfront_functions_url_rewrite_single_page_apps_section.html
- https://github.com/IBM/plex/blob/master/LICENSE.txt
- Registro npm (consultado el 2026-10-20)

# Diseño: Frontend Site — `apps/web` estático con Next.js

> Fecha: 2026-10-20. Base: `proposal.md` y `exploration.md` de este cambio, `docs/brief.md` y ADR-001 (`stack-adrs`). Reconciliado con las specs el 2026-10-20: las 8 discrepancias y su resolución están en §16. Los nombres de §16 son los únicos válidos en specs, design y tasks.
> Nota de tamaño: supera el presupuesto de 800 palabras porque el orquestador pidió 13 decisiones concretas. Todo está en tablas para poder leerlo rápido.

## 1. Resumen

| Tema | Decisión |
|------|----------|
| Arquitectura | Páginas de Server Components síncronas. Tres islas de cliente: menú móvil, login (`/acceso/` y `/acceso/verificar/`) y zona reclutador. Puerto `ApiGateway` con dos adaptadores, `http` y `mock` (hexagonal, igual que la API). |
| Organización | Arquitectura que grita: `src/features/<funcionalidad>/` para containers, reducers y hooks; `src/components/` para la UI presentacional compartida. Cada componente tiene junto a él su `.module.css` y su `.test.tsx`. |
| Mock | Se elige con `NEXT_PUBLIC_API_MODE` en build. Se carga con `import()` dentro de una rama que el compilador elimina como código muerto. `check-out` busca un marcador en `out/` para demostrar que el mock no llegó a producción. |
| Calidad | Jest 30 + `next/jest` + RTL + jest-axe. Test de contraste WCAG sobre `tokens.css`, test de "sin hex fuera de tokens", guardas de contenido y verificación de `out/` dentro del script `build`. |
| **Cambio frente a la propuesta** | **Plan de PRs: 6 no alcanzan.** Con los tests de strict TDD y el CSS, el total realista es de unas 3.900 líneas. Plan: 12 PRs de ≤ 400 líneas (§13). **Hace falta una decisión antes de `apply`.** |

## 2. Árbol de archivos

```
apps/web/
├── package.json  next.config.ts  tsconfig.json  jest.config.js  jest.setup.ts
├── scripts/check-out.js (+ check-out.test.js)          # CJS: se testea sin VM modules; `npm run check:out`
├── docs/delivery-contract.md                           # contrato para infra (lo produce y versiona apps/web)
├── README.md                                           # enlaza docs/delivery-contract.md
├── app/
│   ├── layout.tsx  not-found.tsx  sitemap.ts  robots.ts  page.tsx (+ page.test.tsx)
│   ├── experiencia/page.tsx (+test)
│   ├── acceso/page.tsx (+test)   acceso/verificar/page.tsx (+test)
│   └── reclutador/page.tsx (+test)
└── src/
    ├── next-types.d.ts                                  # /// <reference types="next" /> (tipos de CSS Modules sin next-env.d.ts)
    ├── styles/ tokens.css  globals.css  fonts.ts  contrast.test.ts  no-raw-colors.test.ts
    ├── content/ types.ts  site.ts  home.ts  stack.ts  projects.ts  experience.ts  content-guard.test.ts
    ├── components/
    │   ├── ui/ Button  LinkButton  Eyebrow  SectionHeading  Card  CodeWindow(+highlightJson.ts)  Callout  FormField
    │   └── layout/ SiteHeader  MobileMenu('use client')  Footer  SkipLink  CtaBand
    ├── features/
    │   ├── home/ Hero  Contributions  StackSection  ProjectsSection  ArchitectureSection
    │   ├── experience/ Timeline  TimelineItem  EducationSection
    │   ├── login/ loginReducer.ts  verifyReducer.ts  LoginForm  LoginContainer('use client')
    │   │          VerifyView  VerifyContainer('use client')  StepsPanel  useMagicLinkToken.ts
    │   └── recruiter/ greeting.ts  useRecruiterSession.ts  RecruiterZone('use client')
    │                  CvCard  ContactCard  DetailsCard  playground/{endpoints.ts, ApiPlayground, EndpointButton, ResponseViewer}
    └── lib/api/ types.ts  port.ts  errors.ts  index.ts(loadGateway)  http.ts  mock/{index.ts, fixtures.ts}
```

Cada carpeta de componente contiene `X.tsx`, `X.module.css` y `X.test.tsx`. No hay archivos barril (*barrel files*): cada import apunta al archivo directo (`bundle-barrel-imports`).

## 3. Versiones (pin exacto, sin `^`, igual que el repo)

| Paquete | Versión | Dónde | Estado |
|---------|---------|-------|--------|
| `next` | 16.4.2 | web deps | Verificado (exploración) |
| `react` / `react-dom` | 19.3.1 / 19.3.1 | web deps | `react` verificado; `react-dom` **NO VERIFICADO** |
| `@types/react` / `@types/react-dom` | 19.x más reciente | web dev | **NO VERIFICADO** |
| `typescript` | 6.0.3 | raíz (existente) | No se toca (`typescript-eslint` exige `<6.1.0`) |
| `@types/node` / `@types/jest` | 24.19.2 / 30.0.0 | web dev | Los mismos que `apps/api` |
| `jest` / `jest-environment-jsdom` | 30.5.2 / 30.5.2 | web dev | Verificado |
| `@testing-library/react` | 16.3.3 | web dev | Verificado |
| `@testing-library/dom` (peer de RTL 16) | más reciente | web dev | **NO VERIFICADO** |
| `@testing-library/jest-dom`, `@testing-library/user-event` | más reciente | web dev | **NO VERIFICADO** |
| `jest-axe` / `@types/jest-axe` | 11.0.0 / más reciente | web dev | jest-axe verificado; tipos **NO VERIFICADO** (compatibilidad con los tipos de Jest 30) |
| Plan A: `eslint-config-next` | 16.4.2 | raíz dev | **NO VERIFICADO** (peers de ESLint 10) |
| Plan B: `@next/eslint-plugin-next` + `eslint-plugin-react-hooks` | 16.4.2 + 7.1.1 | raíz dev | hooks verificado; next **NO VERIFICADO** |

La tarea 1.1 resuelve cada **NO VERIFICADO** con `npm view <pkg> version peerDependencies` y deja el resultado en `apply-progress`. Los plugins de ESLint se instalan en la **raíz**, porque los importa `eslint.config.mjs` de la raíz.

## 4. Configuración

**`next.config.ts`** (además, valida el modo de API en tiempo de build):

```ts
const mode = process.env.NEXT_PUBLIC_API_MODE ?? 'http';
if (mode !== 'http' && mode !== 'mock') throw new Error(`Invalid NEXT_PUBLIC_API_MODE: ${mode}`);
const config: NextConfig = { output: 'export', trailingSlash: true, images: { unoptimized: true }, reactStrictMode: true };
export default config;
```

**`tsconfig.json`** viene pre-poblado: extiende la base y sobrescribe `lib: ["dom","dom.iterable","ES2023"]`, `module: "esnext"`, `jsx: "react-jsx"`, `noEmit`, `isolatedModules`, `incremental`, `allowJs: false`, `resolveJsonModule`, `experimentalDecorators: false`, `emitDecoratorMetadata: false`, `types: ["node","jest","@testing-library/jest-dom"]`, `plugins: [{ "name": "next" }]` y `paths: { "@/*": ["./src/*"] }`. `include` abarca `next-env.d.ts`, `src`, `app`, `jest.setup.ts`, `next.config.ts` y `.next/types/**/*.ts`. **Criterio:** después de `next build`, `git diff apps/web/tsconfig.json` tiene que estar vacío. Si Next agrega claves, se aceptan y se registran.

**`jest.config.js`** (CJS, como `apps/api`):

```js
const nextJest = require('next/jest');
module.exports = nextJest({ dir: './' })({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],          // jest-dom + toHaveNoViolations
  testMatch: ['<rootDir>/{app,src,scripts}/**/*.test.{ts,tsx,js}'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/{lib,features,components}/**/*.{ts,tsx}', '!**/*.test.*', '!src/lib/api/mock/fixtures.ts'],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
});
```

`jest.setup.ts` desactiva la regla `color-contrast` de axe (jsdom no la puede medir; la cubre `contrast.test.ts`).

**Scripts de `apps/web`:**

| Script | Comando |
|--------|---------|
| `dev` | `NEXT_PUBLIC_API_MODE=mock next dev` |
| `build` | `next build && npm run check:out` |
| `check:out` | `node scripts/check-out.js` |
| `typecheck` | `next typegen && tsc --noEmit` |
| `test` / `test:cov` | `jest` / `jest --coverage` |

No hay `test:e2e`.

**ESLint (raíz, `eslint.config.mjs`):**
- Agregar a `ignores`: `**/.next/**`, `**/out/**`, `**/next-env.d.ts`.
- Bloque con `files: ['apps/web/**/*.{ts,tsx}']`:
  - Plan A: la config plana de `eslint-config-next/core-web-vitals`.
  - Plan B: `@next/next` (reglas `recommended` + `core-web-vitals`) y `react-hooks` (`recommended`).
  - En los dos planes: `no-restricted-syntax` sobre `JSXAttribute[name.name="style"]`. No se permiten estilos inline; todo va a CSS Modules.
- Plan B se activa si Plan A da `ERESOLVE`. **Se rechazan** `--legacy-peer-deps`, `--force` y `overrides`: ocultan una incompatibilidad real. Lo que se pierde de `jsx-a11y` lo cubre jest-axe.

**`.gitignore`:** agregar `.next/`, `out/` y `next-env.d.ts`. `src/next-types.d.ts` existe para que el lint con tipos del CI, que corre antes de `typecheck`, conozca los tipos de `*.module.css` aunque `next-env.d.ts` no exista todavía.

## 5. Tokens y regla de colores

`tokens.css` define en `:root`:
- Los 16 colores de la exploración §3.2 (`--color-bg` … `--color-on-dark-muted`) más `--color-white: #FFFFFF`.
- `--font-sans` y `--font-mono` (las inyecta `next/font` mediante `variable`).
- `--radius-{8,10,12,14}`, `--radius-pill: 999px` y `--container: 1200px`.
- `--space-section` y sus variantes (88/96/80/72/56) y `--tap-{44,48,52}`.
- `--focus-ring: 2px solid var(--color-accent)`.

Hay un solo breakpoint: `@media (min-width: 761px)`, mobile-first. Excepción: el header (SiteHeader/MobileMenu) cambia a la nav completa en `min-width: 900px` para evitar que la nav se parta en dos filas entre 761 y ~850px.

**Regla "sin hex fuera de `tokens.css`"** (sin stylelint, que sería tecnología nueva):

| Superficie | Mecanismo |
|------------|-----------|
| `*.module.css` y `globals.css` | `no-raw-colors.test.ts` recorre `src/**/*.css` excepto `tokens.css` y falla si encuentra `#[0-9a-fA-F]{3,8}\b`, `rgb(` o `hsl(` |
| TSX | La regla de ESLint que prohíbe `style` ya impide colores inline. Además, el test escanea los `.tsx` en busca de literales hex |

## 6. Componentes y puerto `ApiGateway`

| Componente | Tipo | Patrón |
|------------|------|--------|
| Páginas, secciones, `SiteHeader`, `Footer` | Server | Presentacional, sin hooks (Jest las renderiza directo) |
| `MobileMenu` | Client | Estado local: `aria-expanded`, `aria-controls`, Escape y devolución del foco |
| `LoginContainer` → `LoginForm`, `StepsPanel` | Client → presentacional | El container es dueño del reducer y del gateway; la vista solo recibe props |
| `VerifyContainer` → `VerifyView` | Client → presentacional | Lee el token de `location.hash` tras el montaje; sin `useSearchParams` ni `<Suspense>` |
| `RecruiterZone` → `CvCard`, `ContactCard`, `DetailsCard`, `ApiPlayground` | Client → presentacional | El guard vive en el container |

Cada página renderiza su propio `SiteHeader variant="public|minimal|session"`, su `<main id="contenido">` y su `Footer`. El layout solo aporta `html`, `body`, las fuentes, la metadata y `SkipLink`.

```ts
// src/lib/api/types.ts
export type Role = 'RECRUITER' | 'ADMIN';
export interface MagicLinkRequest { email: string; company?: string; name?: string }
export interface Availability { modality: string; start: string; salary: string }         // siempre vienen de la API
export interface Me { email: string; role: Role; company: string | null; name: string | null; availability: Availability }
export interface CvLink { url: string; expiresAt: string }
export interface RawResponse { status: number; statusText: string; body: unknown }
export type ApiErrorKind = 'unauthorized' | 'forbidden' | 'invalid-token' | 'rate-limited' | 'network' | 'server' | 'unexpected';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorKind; status?: number };

// src/lib/api/port.ts
export interface ApiGateway {
  requestMagicLink(req: MagicLinkRequest): Promise<ApiResult<void>>;
  verifyToken(token: string): Promise<ApiResult<void>>;
  getMe(): Promise<ApiResult<Me>>;                     // GET /api/v1/me; el refresh ante 401 es interno del adaptador
  getCvLink(): Promise<ApiResult<CvLink>>;
  logout(): Promise<ApiResult<void>>;
  call(endpoint: PlaygroundEndpoint): Promise<ApiResult<RawResponse>>; // 4xx = ok:true (el playground muestra el 403)
}

// src/lib/api/index.ts — la única puerta de entrada
let cached: Promise<ApiGateway> | undefined;
export function loadGateway(): Promise<ApiGateway> {
  cached ??= process.env.NEXT_PUBLIC_API_MODE === 'mock'
    ? import('./mock').then((m) => m.createMockGateway())
    : import('./http').then((m) => m.createHttpGateway());
  return cached;
}
```

**Adaptador `http`:**
- `fetch` relativo a `/api` con `credentials: 'same-origin'`.
- Una sola función, `buildInit(method, body)`, arma las cabeceras. Es el único lugar donde, con Plan B, se agregaría `x-amz-content-sha256` (vía `crypto.subtle.digest`).
- Ante un 401 en una ruta que no es `/api/auth/*` hace un `POST /api/auth/refresh` *single-flight* (una promesa compartida) y reintenta una vez. `refresh` **no** forma parte del puerto: es un detalle del adaptador `http` (el mock no lo necesita) y así ningún container puede olvidarlo ni duplicarlo.
- Mapeo de errores: 401 tras el refresh → `unauthorized`; 403 → `forbidden`; 400/401/410 en `verify` → `invalid-token`; 429 → `rate-limited`; 5xx → `server`; si `fetch` lanza → `network`.
- Cualquier 2xx de `magic-link` cuenta como enviado: la respuesta es idéntica exista o no el correo.

**Adaptador `mock`:**
- Determinista: sin `Math.random` ni temporizadores.
- `verify` acepta solo `mock-token`. La sesión vive en `sessionStorage`.
- Los fixtures usan placeholders `[dato de ejemplo]`, sin cifras.
- `/admin/visits` responde 403.
- Exporta `MOCK_MARKER = '__WEB_CV_MOCK__'` y lo incluye en la respuesta de `getMe`, para que el minificador no lo elimine. El prefijo del proyecto evita falsos positivos con cadenas de dependencias en `out/`.

Los botones "Simular: abrir el enlace" y "Reiniciar demo" se renderizan bajo la condición literal `process.env.NEXT_PUBLIC_API_MODE === 'mock'`, así que el compilador los elimina del build de producción.

**Inyección:** cada container recibe `gatewayLoader = loadGateway` como prop. Los tests pasan un fake y no usan `jest.mock`.

**Plan B si el código muerto no se elimina** (lo detecta `check-out`): un alias de módulo en `next.config.ts` (`turbopack.resolveAlias` + `webpack`) que apunte `@/lib/api/adapter` a `http` o `mock`, más el `moduleNameMapper` equivalente en Jest.

## 7. Flujo de login

```
Usuario      LoginContainer      Gateway             API
  │ submit ───→│ SUBMIT           │                    │
  │            │──requestMagicLink→──POST magic-link──→│ 202 (siempre igual)
  │            │ SENT             │                    │
  │  (correo) abre /acceso/verificar/#token=T          │
  │            VerifyContainer: 1er render neutral; tras montar lee T de location.hash → history.replaceState(…'/acceso/verificar/')
  │ "Confirmar"→│ CONFIRM          │──verifyToken──────→──POST verify─────→│ Set-Cookie (HttpOnly)
  │            │ DONE → enlace a /reclutador/ | ERROR (invalid-token / rate-limited / network)
```

| Reducer | Estados | Eventos |
|---------|---------|---------|
| `loginReducer` | `editing` → `submitting` → `sent{email}` / `error{kind}` | `SUBMIT`, `SUCCEEDED`, `FAILED`, `RESET` |
| `verifyReducer` | `missing-token` / `ready` → `confirming` → `done` / `error{kind}` | `CONFIRM`, `SUCCEEDED`, `FAILED` |

- El correo es obligatorio y se valida con `type="email"` y `required`. Los errores se anuncian con `aria-describedby` y una región `role="alert"`.
- `name` y `company` vacíos no se envían (se recortan con `trim`).
- **Captura del token (`useMagicLinkToken`):** el token viaja en el fragmento (`#token=`), que solo existe en el cliente. El hook lo lee de `window.location.hash` en un efecto tras el montaje (nunca durante el prerender), lo guarda en `useState` (memoria) y llama a `history.replaceState(null, '', '/acceso/verificar/')`, que vacía el fragmento. Ignora por completo `location.search`: un `?token=` no se lee. Toda la lectura del token está en ese hook (único archivo que la hace; lo garantiza `token-guard.test.ts`).
- **Enlace nuevo en la misma pestaña:** el hook también escucha `hashchange` (con limpieza al desmontar). Si llega un `#token=`, lo captura, lo borra con `replaceState` y REEMPLAZA el token en memoria; `VerifyContainer` usa el token como `key` del flujo, de modo que vuelve a la confirmación con el token nuevo sea cual sea el estado (ready, confirming, done o error) y descarta la respuesta de una confirmación pendiente del token anterior.
- **Primer render:** el hook expone un estado `pending` hasta que el efecto corre; la vista muestra la tarjeta neutral "Cargando…" (es lo que queda prerenderizado en el HTML) y solo después decide entre `ready` o `missing-token`. No se usa `useSearchParams`, por lo que no hace falta `<Suspense>`.

**Saludo** (`greeting.ts`, función pura con su test):
1. Si `company` tiene texto (tras `trim`): "Gracias por tu interés, equipo de {company}".
2. Si no, y `name` tiene texto: "Gracias por tu interés, {name}".
3. Si no: "Gracias por tu interés".

## 8. Zona reclutador

`useRecruiterSession(gatewayLoader)` llama a `getMe()` al montar y recorre estos estados: `checking` → `authorized{me}` | `redirecting` | `error{kind}`.

- `unauthorized` (el adaptador ya intentó un único refresh) → `router.replace('/acceso/')`.
- `network` o `server` → `error` con botón "Reintentar". Un problema de red no debe parecer un cierre de sesión.
- Mientras está en `checking` se muestra un esqueleto con `aria-busy`.

| Tarjeta | Fuente |
|---------|--------|
| CV completo | `getCvLink()` al hacer clic: se navega a la URL firmada, que expira. En el repo nunca hay un PDF |
| Contacto directo | `src/content/site.ts` (datos públicos por decisión de la usuaria) |
| Disponibilidad | `me.availability`, de la misma respuesta de `getMe()` que usa el guard (sin segunda petición ni segundo estado de carga). Las etiquetas son estáticas; los valores llegan solo por la API |

La pill de sesión muestra `me.email · rol {me.role}`. "Cerrar sesión" llama a `logout()` y luego hace `replace` a `/` (decisión del dueño, 2026-10-21; reemplaza el `/acceso/` original). Una sesión ya expirada (`unauthorized`) también termina en `/`. Descargar el CV solo navega a URLs `https:`.

**Playground:**
- `endpoints.ts` es una allowlist tipada de 5 endpoints `GET`: `/api/v1/profile`, `/api/v1/experience?limit=2`, `/api/v1/skills?level=advanced`, `/api/v1/me` y `/api/v1/admin/visits` (403 esperado). `call()` solo acepta esa lista.
- `EndpointButton` usa `aria-pressed`, y el CSS lo estiliza con `[aria-pressed="true"]`.
- `ResponseViewer` es un `<pre>` con `aria-live="polite"` que muestra método, ruta, estado y el JSON formateado con `JSON.stringify(_, null, 2)`.
- El primer endpoint se pide al pasar a `authorized`; los demás, al hacer clic.

## 9. Contenido

| Módulo | Tipo (`src/content/types.ts`) |
|--------|-------------------------------|
| `site.ts` | `SiteContent { domain; ownerName; nav: NavLink[]; contact: ContactLink[]; footer }` |
| `home.ts` | `HomeContent { hero: { eyebrow; title; lead; ctas: NavLink[]; sample: { path; json } }; contributions: Item[]; architecture: { nodes; chips: NavLink[] } }` |
| `stack.ts` / `projects.ts` | `StackColumn { id; title; items: string[] }[]` / `Project { id; title; summary; href; tags }[]` |
| `experience.ts` | `ExperienceItem { id; company; role; period: { start; end: string \| null }; summary; highlights[] }[]` y `EducationItem[]` |

**`content-guard.test.ts`** falla cuando:

| # | Condición |
|---|-----------|
| 1 | Existe algún `.pdf`, `.doc`, `.docx` u `.odt` en `apps/web` (sin contar `node_modules`, `.next`, `out` ni `coverage`) |
| 2 | Hay patrones de dinero en `app/` o `src/` (`\$\s?\d`, `\d+\s?(CLP\|UF\|USD)`, `\d{1,3}(\.\d{3})+`), fixtures del mock incluidos |
| 3 | Aparece un teléfono fuera de `src/content/site.ts` |
| 4 | `Kafka` aparece en un string sin `SQS` (H2) |
| 5 | Aparece `/status`, `/api-docs`, `Word` o `Agendar` (H4 y H6) |

## 10. Accesibilidad y contraste

| Requisito | Implementación |
|-----------|----------------|
| Saltar al contenido | `SkipLink` es el primer elemento enfocable y apunta a `#contenido` |
| Foco visible | `:focus-visible { outline: var(--focus-ring); outline-offset: 2px }` en `globals.css`; en superficies oscuras, anillo `--color-green` |
| Menú móvil | `aria-expanded`, `aria-controls`, Escape cierra y devuelve el foco al botón, `aria-current="page"` en la nav |
| Formularios | `label` + `for`, `autocomplete`, `aria-describedby` para el error, `role="alert"` |
| Live regions | `aria-busy` en `checking` y `aria-live` en el playground |
| Movimiento | `prefers-reduced-motion` desactiva las transiciones |

`contrast.test.ts` lee `tokens.css` con una regex, calcula la luminancia relativa de WCAG 2.x (`(L1+0.05)/(L2+0.05)`) y exige:
- **Texto ≥ 4.5:1:**
  - `ink`, `ink-2` y `muted` sobre `bg` y sobre `surface`
  - `accent` y `accent-hover` sobre `bg` y sobre `surface`
  - `white` sobre `accent` y sobre `accent-hover` (hover de `Button primary`)
  - `on-dark`, `on-dark-2`, `on-dark-muted`, `green`, `code-string` y `white` sobre `ink`
  - `on-dark` sobre `dark-active`
  - `ink` sobre `green`
- **UI ≥ 3:1:**
  - `border-strong` sobre `surface` (sobre `bg` da 2,99:1 con la paleta aprobada, ver regla abajo)
  - `accent` sobre `surface` (anillo de foco)
  - `green` sobre `ink` (foco sobre oscuro)

`accent` sobre `bg` calculado a mano da ≈ 4.56. Pasa, pero sin margen.

Regla: inputs con borde y botones secundarios (`border-strong`) van siempre sobre `surface` (blanco), nunca directamente sobre `bg`.

Regla: los estilos globales de enlaces usan `:where()` (especificidad 0) para que las clases de componente (`.primary`, etc.) ganen siempre, incluso en `:hover`.

## 11. `scripts/check-out.js` y CI

Exporta `findViolations(outDir)` (con su test sobre fixtures en un directorio temporal) y tiene un modo CLI que sale con código ≠ 0 y nombra cada archivo faltante o infractor. Se expone como `npm run check:out -w apps/web`. Se usa CJS en lugar de `.mjs` para poder testearlo sin `--experimental-vm-modules`. Verifica:
- Que exista `index.html` en `/`, `experiencia/`, `acceso/`, `acceso/verificar/` y `reclutador/`.
- Que existan `404.html`, `robots.txt`, `sitemap.xml` y el directorio `_next/static/`.
- Que no aparezcan `fonts.googleapis.com` ni `fonts.gstatic.com`.
- Que no aparezcan `__WEB_CV_MOCK__`, "Simular: abrir el enlace" ni "Reiniciar demo" en `out/**/*.{js,html}`.
- Que no haya `.pdf` ni `.docx`.

**CI:** `build` encadena `npm run check:out`, y el `npm run build` del job `quality` ya lo ejecuta. **`ci.yml` no cambia**. A cambio, un `next build` en modo mock falla a propósito. Para el desarrollo con mock está `dev`.

## 12. Contrato de entrega (`apps/web/docs/delivery-contract.md`)

Vive junto a su productor: el test que compara rutas documentadas con `out/` corre en el Jest de `apps/web`, y un cambio de rutas toca código y contrato en el mismo workspace. `apps/web/README.md` lo enlaza.

| Sección | Contenido |
|---------|-----------|
| Artefacto | `apps/web/out/`: árbol de rutas, `404.html`, `_next/static/*` con hash |
| CloudFront Function | La de la exploración §4.1 (viewer-request, `cloudfront-js-2.0`), **solo** en el behavior por defecto |
| Behaviors | Por defecto → S3 con OAC. `/api/*` → origen de la API con `CachingDisabled` y `AllViewerExceptHostHeader`, sin Function |
| 404 | Dar al OAC el permiso `s3:ListBucket` para que S3 devuelva 404 (no 403) ante una clave inexistente y mapear **solo el 404** a `/404.html` con código 404. El 403 **nunca** se mapea: las custom error responses aplican a toda la distribución, `/api/*` incluido, y mapear 403 convertiría el 403 real de `admin/visits` (que el playground debe mostrar) en una página HTML. **Ojo:** por la misma razón, los 404 de la API llegarían como HTML. Infra elige entre aceptarlo o usar Lambda@Edge origin-response solo en el behavior por defecto |
| Descubrimiento | `sitemap.xml` lista solo `/`, `/experiencia/` y `/acceso/`. `/reclutador/` y `/acceso/verificar/` llevan `noindex` y no van en el sitemap. `robots.txt` referencia el sitemap y **no** bloquea esas rutas con `Disallow`: si el crawler no puede entrar, no lee el `noindex` |
| Caché | `_next/static/*`: `public, max-age=31536000, immutable`. HTML: `max-age=0, must-revalidate` + invalidación en cada deploy. La query string queda fuera de la clave de caché |
| Cabeceras (response headers policy) | CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. `Referrer-Policy: no-referrer` (protege el token). HSTS de 2 años. `nosniff`. `X-Frame-Options: DENY`. `Permissions-Policy` restrictiva |
| Por qué `'unsafe-inline'` | El export estático inyecta `<script>self.__next_f.push(…)</script>` inline. No se pueden usar nonces porque no hay servidor, y SRI es experimental. Mejora futura: que `check-out` calcule hashes. `style-src` sin `'unsafe-inline'` está **NO VERIFICADO**: se prueba en el navegador y, si falla, se documenta |
| Logs | Los logs estándar de CloudFront registran la query string, pero el fragmento nunca llega al servidor. Como el token viaja en el fragmento (`#token=`), no llega a los logs ni a `Referer`. `Referrer-Policy: no-referrer` se mantiene como defensa en profundidad |

## 13. Plan de PRs (stacked-to-main, sin lockfile)

| PR | Contenido | Líneas |
|----|-----------|--------|
| 1 | **Smoke test:** `package.json`, configuraciones, `next-types.d.ts`, ESLint y `.gitignore`, layout mínimo y una página con un test de render + axe | ~220 |
| 2 | `tokens.css`, `globals.css`, `fonts.ts`, `contrast.test`, `no-raw-colors.test`, `Button`/`LinkButton`, `Eyebrow`, `SkipLink` | ~380 |
| 3 | `content/types.ts` + `site.ts`, `SiteHeader` (3 variantes), `MobileMenu`, `Footer` | ~380 |
| 4 | Inicio A: `Hero`, `CodeWindow` + `highlightJson`, `Contributions`, `StackSection`, `home.ts`/`stack.ts` | ~390 |
| 5 | Inicio B: `ProjectsSection`, `ArchitectureSection` (chips), `CtaBand`, `projects.ts` | ~330 |
| 6 | Experiencia: `Timeline`, `TimelineItem`, `EducationSection`, `experience.ts` | ~330 |
| 7 | `lib/api`: tipos, puerto, errores, `loadGateway`, `http` + refresh, `mock` | ~390 |
| 8 | `/acceso/`: `loginReducer`, `LoginForm`, `LoginContainer`, `StepsPanel`, `FormField` | ~400 |
| 9 | `/acceso/verificar/`: `verifyReducer`, `useMagicLinkToken`, `VerifyView`, `VerifyContainer` | ~260 |
| 10 | `/reclutador/`: `useRecruiterSession`, `greeting`, 3 tarjetas, `RecruiterZone` | ~390 |
| 11 | Playground: `endpoints`, `EndpointButton`, `ResponseViewer`, `ApiPlayground` | ~280 |
| 12 | Metadata, `sitemap`, `robots`, `not-found`, `content-guard`, `check-out` en `build`, contrato de entrega, README | ~380 |

Total ≈ 3.930 líneas, contra unas 2.000 en la propuesta.

**Reversión:** cada PR se revierte con `git revert` del merge, en orden inverso, porque cada uno depende de los anteriores. Revertir el PR 1 elimina el workspace y obliga a regenerar el lockfile. Revertir el PR 12 saca `check-out` del `build`. Ningún PR toca `apps/api` ni `ci.yml`.

## 14. Puerta del smoke test (tarea 1)

1. Ejecutar `npm view` para cada paquete **NO VERIFICADO** y registrar la versión y sus peers.
2. Crear el esqueleto del PR 1 y ejecutar `npm install` en la raíz, sin flags.
3. Correr en verde, **desde un clon limpio** (sin `.next/` ni `next-env.d.ts`): `npm run lint`, `npm run typecheck`, `npm test -w apps/web`, `npm run build -w apps/web` (debe generar `out/index.html`), `npm run test:cov` y `npm run format:check` en la raíz. Después del build, `git diff apps/web/tsconfig.json` debe estar vacío.
4. **VM modules:** primero probar sin el flag. Si Jest falla por ESM (por ejemplo, porque `jest-axe` 11 sea solo ESM), agregar `NODE_OPTIONS=--experimental-vm-modules`, igual que en `apps/api`. Hay precedente en el repo, así que no hace falta consultar.

**Planes B ya aprobados** (se aplican sin consultar y se informan): Plan B de ESLint y `next/font/local`.

**DETENERSE y consultar a la usuaria si:**
- Plan B de ESLint también falla.
- La única salida es usar `--legacy-peer-deps`, `--force` u `overrides`.
- `next/jest` no funciona con Jest 30.
- Hace falta otra versión de TypeScript.
- `output: 'export'` falla.
- Haría falta cualquier herramienta fuera de la propuesta.

## 15. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| **El plan de 6 PRs no cumple el presupuesto de 400 líneas** | Plan de 12 PRs o `size:exception`. **Hace falta una decisión antes de `apply`** |
| Peers de ESLint 10 | Plan B ya aprobado |
| Turbopack no elimina la rama del mock | `check-out` lo detecta; plan B con alias de módulo |
| Las custom error responses afectan también a `/api/*` | Está documentado en el contrato; decide infra |
| `me` debe devolver `company`, `name` y `availability`; los endpoints de CV y `logout` no están definidos | Dependencia con el cambio de auth; los tipos son provisionales |
| Contraste del acento ≈ 4.56 | El test falla si baja de 4.5 |
| Dependencia con el cambio de auth: el token MUST ser base64url (alfabeto `A-Z a-z 0-9 - _`, sin `+`, `/` ni `=`, que se corrompen o se interpretan mal en un fragmento tipo `application/x-www-form-urlencoded`), de un solo uso y con TTL corto (el copy dice 15 minutos). Límite de `replaceState`: vacía la URL de la entrada actual, pero el historial global del navegador, el autocompletado de la barra y el cliente de correo conservan la URL original con el token; es aceptable porque el token es de un solo uso y vence pronto | Un token reutilizable o de TTL largo haría insuficiente esta mitigación |
| Dependencia con el cambio de auth: el enlace del correo MUST ser `https://mariajosetolmo.cl/acceso/verificar/#token=<token>` (fragmento, no query) | Decisión registrada en §16; `Referrer-Policy: no-referrer` sigue recomendada como defensa en profundidad |

## 16. Reconciliación spec/design (2026-10-20)

Regla aplicada: prevalece la spec, salvo que la opción del design sea técnicamente mejor; en ese caso se actualizó también la spec.

| # | Tema | Resolución | Gana | Motivo |
|---|------|------------|------|--------|
| 1 | Destino del skip link | `#contenido` / `<main id="contenido">` | Design | El fragmento queda visible en la URL de un sitio en español; no hay otra razón técnica en contra |
| 2 | Nombres del puerto | `requestMagicLink`, `verifyToken(token)`, `getMe`, `getCvLink`, `logout`, `call`. `refresh` es interno del adaptador `http` | Spec (nombres) + design (refresh interno) | Los nombres reflejan los endpoints. El refresh *single-flight* en un único lugar evita duplicarlo en cada container |
| 3 | Script de salida | `scripts/check-out.js` (CJS), expuesto como `npm run check:out` y encadenado en `build` | Mixto | CJS se testea sin `--experimental-vm-modules`; el script con nombre cumple la spec; `build` lo ejecuta en CI sin tocar `ci.yml` |
| 4 | Marcador del mock | `__WEB_CV_MOCK__` | Design | Con el prefijo del proyecto no hay falsos positivos con cadenas de dependencias |
| 5 | Ruta del contrato | `apps/web/docs/delivery-contract.md` | Spec | Lo produce y lo testea `apps/web`; se versiona con su código |
| 6 | Mapeo de errores en CloudFront | Solo 404 → `/404.html` (404), con `s3:ListBucket` en el OAC; 403 nunca | Design | Las custom error responses aplican a toda la distribución; mapear 403 rompe el 403 de `admin/visits` |
| 7 | Origen de "Disponibilidad" | `getMe().availability` | Spec | Reutiliza la respuesta del guard (una petición menos) y no inventa un endpoint que el cambio de auth no tiene |
| 9 | Token del magic link en el fragmento (`#token=`), decisión de la usuaria 2026-10-21 | Usuaria | El fragmento no llega a CloudFront, sus logs ni `Referer`, y elimina `useSearchParams`/`Suspense` en la verificación |
| 8 | Contenido del sitemap | `/`, `/experiencia/`, `/acceso/`; sin `/reclutador/` ni `/acceso/verificar/` (`noindex`) | Ambos (ya coincidían) | Se agrega al design la regla de `robots.txt` sin `Disallow` |

## Preguntas abiertas

- [x] 1. Resuelta (2026-10-21): el token viaja en el fragmento (`/acceso/verificar/#token=…`). El correo del cambio de auth debe usar `https://mariajosetolmo.cl/acceso/verificar/#token=<token>`.
- [ ] 2. ¿Se pasa a 12 PRs o se acepta `size:exception` con menos PRs?

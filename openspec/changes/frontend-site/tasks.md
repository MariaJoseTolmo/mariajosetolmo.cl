# Tareas: Frontend Site — `apps/web` estático con Next.js

> Plan de 12 PRs apilados a `main` (`stacked-to-main`), tomado de `design.md` §13. Strict TDD activo (`openspec/config.yaml`): toda tarea de comportamiento es RED (test que falla) → GREEN (mínimo para pasar) → REFACTOR. Comandos, rutas y código en inglés. Shell: `rg`/`bat`/`fd`/`sd`/`eza`. No se toca `spikes/` ni `apps/api` ni `ci.yml`.

## Review Workload Forecast

| Campo | Valor |
|-------|-------|
| Líneas cambiadas estimadas | ~3.930 (excluye lockfile) |
| Riesgo de presupuesto de 400 líneas | High si fuera un solo PR; Medium por PR (PR 8, 4, 7 y 10 rondan 390-400) |
| PRs encadenados recomendados | Sí |
| División sugerida | PR1 → PR2 → … → PR12 |
| Estrategia de entrega | ask-on-risk |
| Estrategia de cadena | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Decisión pendiente de la usuaria (no se asume):**
- **Opción A, 12 PRs ≤ 400 líneas:** cada uno se revisa en ≤ 60 min y se revierte solo. Más PRs y más CI, pero cumple la regla sin excepciones.
- **Opción B, `size:exception`:** menos PRs (p. ej. 3-4, agrupando por capa) con aprobación explícita de mantenedora. Menos fricción, pero diffs de ~1.000 líneas y reversión más gruesa.

### Unidades de trabajo (base = `main` tras mergear el PR anterior)

| PR | Objetivo | ~Líneas | Depende de |
|----|----------|---------|------------|
| 1 | Smoke test: workspace, Jest, ESLint, build export, página con render + axe | 220 | — |
| 2 | Tokens, globals, fuentes, tests de contraste y colores, Button/LinkButton/Eyebrow/SkipLink | 380 | 1 |
| 3 | Contenido base, SiteHeader (3 variantes), MobileMenu, Footer | 380 | 2 |
| 4 | Inicio A: Hero, CodeWindow, Contributions, StackSection | 390 | 3 |
| 5 | Inicio B: Projects, Architecture, CtaBand; `/` completa | 330 | 4 |
| 6 | Experiencia: Timeline, Education; `/experiencia/` | 330 | 3 |
| 7 | `lib/api`: puerto, errores, `loadGateway`, `http` + refresh, `mock` | 390 | 1 |
| 8 | `/acceso/`: reducer, LoginForm, LoginContainer, StepsPanel, FormField | 400 | 3, 7 |
| 9 | `/acceso/verificar/`: reducer, `useMagicLinkToken`, vistas | 260 | 8 |
| 10 | `/reclutador/`: sesión, saludo, 3 tarjetas | 390 | 7, 9 |
| 11 | Playground | 280 | 10 |
| 12 | Metadata, sitemap, robots, 404, guardas, `check-out`, contrato, README | 380 | todos |

PR 5, 6 y 7 pueden prepararse en paralelo en ramas distintas, pero se mergean en orden numérico. Un solo hilo de escritura (sin worktrees paralelos).

## Preguntas abiertas (NO decidir en apply; preguntar a la usuaria)

- [ ] Q1. Token del magic link en `?token=` (llega a logs de CloudFront y `Referer`) vs `#token=` (fragmento, no llega al servidor y elimina `Suspense`). Hoy: `?token=` según propuesta y spec. Afecta solo a `useMagicLinkToken.ts` (PR 9) y al correo del cambio de auth. Bloquea el PR 9.
- [ ] Q2. 12 PRs vs `size:exception` (ver forecast). Bloquea el inicio de apply.

> Conflictos spec/design resueltos el 2026-10-20 (ver design.md §16).

## Cierre estándar de PR (se referencia como «CIERRE»)

- [ ] C1. Contar líneas (`additions + deletions`, sin `package-lock.json`) ≤ 400; si excede, STOP y re-dividir.
- [ ] C2. `npm run lint && npm run typecheck && npm test -w apps/web && npm run format:check` en verde; cobertura ≥ 80 %.
- [ ] C3. Secretos: `bash spikes/web-functions/scripts/scan-secrets.sh` (solo ejecutar; exit 0), `gitleaks git` y `gitleaks dir <cada ruta nueva>`.
- [ ] C4. Revisión con contexto fresco (sub-agente nuevo) del diff; corregir hallazgos.
- [ ] C5. Commits por unidad de trabajo, conventional commits, sin `Co-Authored-By` ni atribución de IA; tests con su código.
- [ ] C6. PR solo tras OK de la usuaria; cuerpo con diagrama de cadena (📍), inicio/fin, fuera de alcance. `quality` y `secrets` son checks requeridos en `main`.

## PR 1: Smoke test y esqueleto (~220)

- [ ] 1.1 **Puerta del smoke test** (design §14). `npm view <pkg> version peerDependencies` para cada NO VERIFICADO: `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@types/jest-axe`, `eslint-config-next`, `@next/eslint-plugin-next`. Registrar en `apply-progress`.
- [ ] 1.2 Crear `apps/web/package.json` (pins exactos, scripts de design §4), `tsconfig.json`, `next.config.ts` (validación de `NEXT_PUBLIC_API_MODE`), `src/next-types.d.ts`; `npm install` en la raíz sin flags.
- [ ] 1.3 Plan A: instalar `eslint-config-next` en la raíz. Si hay `ERESOLVE` por peers de ESLint 10 → Plan B una vez (`@next/eslint-plugin-next` + `eslint-plugin-react-hooks` 7.1.1) y avisar. Si Plan B falla → STOP y preguntar. Prohibido `--legacy-peer-deps`, `--force`, `overrides` y cambiar de herramienta sin ADR + aprobación.
- [ ] 1.4 Editar `eslint.config.mjs` (ignores `.next`, `out`, `next-env.d.ts`; bloque `apps/web/**` con `no-restricted-syntax` sobre `style`) y `.gitignore`.
- [ ] 1.5 RED: `jest.config.js` (`next/jest`, Jest 30), `jest.setup.ts` y `app/page.test.tsx` (render + `axe`, un `h1`, `lang="es"`) fallando. Primero sin `--experimental-vm-modules`; si falla por ESM (p. ej. `jest-axe` 11), añadir `NODE_OPTIONS=--experimental-vm-modules` como en `apps/api` (precedente aprobado). Si `next/jest` no funciona con Jest 30 → STOP y preguntar.
- [ ] 1.6 GREEN: `app/layout.tsx` mínimo y `app/page.tsx` con `h1`; test en verde.
- [ ] 1.7 Desde clon limpio (sin `.next/` ni `next-env.d.ts`): `npm run lint`, `npm run typecheck`, `npm test -w apps/web`, `npm run build -w apps/web` (genera `out/index.html`), `npm run test:cov`, `npm run format:check`. Tras el build, `tsconfig.json` sin cambios (si Next añade claves, aceptarlas y registrarlas). Si `output: 'export'` falla → STOP y preguntar.
- [ ] 1.8 Verificar que `ci.yml` pasa sin cambios con el nuevo workspace.
- [ ] 1.9 CIERRE (`gitleaks dir apps/web`, `eslint.config.mjs`).

## PR 2: Tokens, estilos y átomos (~380)

- [ ] 2.1 Resolver NO VERIFICADO de este PR: `next/font/google` en build offline/CI; si falla → `next/font/local` (plan B aprobado, informar).
- [ ] 2.2 RED: `src/styles/contrast.test.ts` (pares de design §10; valores leídos de `tokens.css`; nombra el par infractor). Spec: «Todos los pares cumplen», «Un token degradado rompe el build».
- [ ] 2.3 GREEN: `tokens.css` (16 colores de `exploration.md` §3.2 + `--color-white`, radios, espacios, `--focus-ring`). Verificar `accent` sobre `bg` ≥ 4.5 (≈ 4.56).
- [ ] 2.4 RED→GREEN: `no-raw-colors.test.ts` (CSS fuera de `tokens.css` y TSX sin hex/`rgb(`/`hsl(`), con caso de infracción sobre un temporal.
- [ ] 2.5 `globals.css` (`:focus-visible`, `prefers-reduced-motion`) y `fonts.ts` (Plex Sans 400/600/700, Mono 400/500); conectar en `layout.tsx`.
- [ ] 2.6 RED→GREEN por componente (`.tsx` + `.module.css` + `.test.tsx` + axe): `Button`, `LinkButton`, `Eyebrow`, `SkipLink` (primer foco, `href="#contenido"`; cada página con `<main id="contenido">`).
- [ ] 2.7 REFACTOR: quitar duplicación de CSS; tap targets `--tap-44`.
- [ ] 2.8 CIERRE (`gitleaks dir apps/web/src/styles apps/web/src/components`).

## PR 3: Contenido base y navegación (~380)

- [ ] 3.1 RED→GREEN: `src/content/types.ts` y `site.ts` (nav de 5 ítems en orden, contacto público, pie «María José Tolmo Tolmo»).
- [ ] 3.2 RED: `SiteHeader.test.tsx` (nav idéntica entre páginas, `aria-current="page"` solo en la ruta actual, logo a `/`, variantes `public|minimal|session`). GREEN: `SiteHeader`.
- [ ] 3.3 RED: `MobileMenu.test.tsx` (`aria-expanded`, `aria-controls` resuelve a un id existente, Escape cierra y devuelve foco, `user-event`). GREEN: `MobileMenu` (`'use client'`).
- [ ] 3.4 RED→GREEN: `Footer` (nombre correcto; sin teléfono fuera de `site.ts`).
- [ ] 3.5 Axe en las tres variantes; REFACTOR.
- [ ] 3.6 CIERRE (`gitleaks dir apps/web/src/content apps/web/src/components/layout`).

## PR 4: Inicio A (~390)

- [ ] 4.1 RED→GREEN: `highlightJson.ts` + `CodeWindow` (solo `--color-green` y `--color-code-string`).
- [ ] 4.2 RED→GREEN: `Hero` (eyebrow, `h1`, lead, 2 CTAs, tarjeta `GET /api/v1/profile` rotulada como ejemplo).
- [ ] 4.3 RED→GREEN: `Contributions` («Lo que aporto») y `StackSection` (4 columnas; AWS en «Aprendiendo» con «aprendiendo, aplicado en este proyecto»; sin cifras). Contenido en `home.ts`/`stack.ts`.
- [ ] 4.4 Kafka siempre con «Kafka en local / SQS en producción» (test de bloque de texto).
- [ ] 4.5 CIERRE (`gitleaks dir apps/web/src/features/home apps/web/src/content`).

## PR 5: Inicio B y página `/` (~330)

- [ ] 5.1 RED→GREEN: `ProjectsSection` (`#proyectos`), `ArchitectureSection` (`#como`; chips `/api/docs` y `/api/health`, nunca `/api-docs`, `/status`, `#como`), `CtaBand`, `projects.ts`.
- [ ] 5.2 RED: `app/page.test.tsx` ampliado (orden de secciones, anclas `#proyectos`/`#stack`/`#como`, un `h1`, sin botón Word/«Agendar», axe). GREEN: componer `app/page.tsx` (síncrona, sin API).
- [ ] 5.3 CIERRE (`gitleaks dir apps/web/app apps/web/src/features/home`).

## PR 6: Experiencia (~330)

- [ ] 6.1 RED→GREEN: `experience.ts` y `TimelineItem`/`Timeline` (5 ítems).
- [ ] 6.2 RED→GREEN: `EducationSection`; `app/experiencia/page.tsx` + test (nav idéntica a Inicio, `aria-current`, `h1` único, axe).
- [ ] 6.3 CIERRE (`gitleaks dir apps/web/app/experiencia apps/web/src/features/experience`).

## PR 7: `lib/api` (~390)

- [ ] 7.1 Confirmar con el cambio de auth el contrato provisional de `me` (`email`, `role`, `company`, `name`, `availability`) y de CV/`logout`; registrar en `apply-progress`. Puerto fijo (design §6): `requestMagicLink`, `verifyToken(token)`, `getMe`, `getCvLink`, `logout`, `call`; `refresh` es interno de `http`.
- [ ] 7.2 `types.ts`, `port.ts`, `errors.ts` (tipos; sin test propio salvo mapeo de errores).
- [ ] 7.3 RED→GREEN: `mock/` determinista (sin `Math.random` ni timers; `mock-token`; sesión en `sessionStorage`; `admin/visits` → 403; placeholders `[dato de ejemplo]`; `MOCK_MARKER = '__WEB_CV_MOCK__'` en la respuesta de `getMe`).
- [ ] 7.4 RED→GREEN: `http.ts` (`fetch` relativo a `/api`, `credentials: 'same-origin'`, `buildInit` único, refresh single-flight interno con test «un solo refresh» de la spec (un `POST /api/auth/refresh`, dos `GET /api/v1/me` → `unauthorized`), mapeo 401/403/410/429/5xx/red, cualquier 2xx de `magic-link` = enviado) con `fetch` fake.
- [ ] 7.5 RED→GREEN: `index.ts` `loadGateway` por `NEXT_PUBLIC_API_MODE` (cacheado, `import()` en rama eliminable). Test: selección mock/http.
- [ ] 7.6 Verificar que Turbopack elimina la rama mock con `NEXT_PUBLIC_API_MODE=http` (`rg __WEB_CV_MOCK__` en `out/`); si no, plan B con alias de módulo (design §6) y avisar.
- [ ] 7.7 CIERRE (`gitleaks dir apps/web/src/lib`).

## PR 8: `/acceso/` (~400)

- [ ] 8.1 RED→GREEN: `loginReducer` (`editing→submitting→sent|error`; eventos SUBMIT/SUCCEEDED/FAILED/RESET).
- [ ] 8.2 RED→GREEN: `FormField` y `LoginForm` (labels, `autocomplete`, `aria-describedby`, `role="alert"`, email inválido no llama al gateway, `trim` y omisión de opcionales).
- [ ] 8.3 RED→GREEN: `LoginContainer` (`'use client'`, `gatewayLoader` por prop, fake en tests, sin `jest.mock`); estado `sent` idéntico ante respuestas distintas, `role="status"`, reintento solo ante error de red.
- [ ] 8.4 RED→GREEN: `StepsPanel`; controles «Simular: abrir el enlace» y «Reiniciar demo» bajo `process.env.NEXT_PUBLIC_API_MODE === 'mock'` (test con ambos modos).
- [ ] 8.5 `app/acceso/page.tsx` + test (axe en cada estado).
- [ ] 8.6 CIERRE; si excede 400, mover `StepsPanel` a PR 9 (re-dividir).

## PR 9: `/acceso/verificar/` (~260)

- [ ] 9.0 **Bloqueo:** resolver Q1 (`?token=` vs `#token=`) con la usuaria antes de escribir `useMagicLinkToken`.
- [ ] 9.1 RED→GREEN: `useMagicLinkToken.ts` (captura en inicializador de `useState`, luego `history.replaceState`; `location.search` queda vacío; token en memoria). Único archivo que lee el token.
- [ ] 9.2 RED→GREEN: `verifyReducer` y `VerifyView` (sin token → inválido con enlace a `/acceso/`).
- [ ] 9.3 RED→GREEN: `VerifyContainer` (`'use client'`, `<Suspense>`, sin auto-consumo, `verifyToken` una vez al confirmar, estado «done» con enlace a `/reclutador/`).
- [ ] 9.4 `app/acceso/verificar/page.tsx` + test + axe; `noindex` vía metadata (se verifica en PR 12).
- [ ] 9.5 CIERRE (`gitleaks dir apps/web/app/acceso apps/web/src/features/login`).

## PR 10: `/reclutador/` (~390)

- [ ] 10.1 Fuentes fijas (design §8): «Disponibilidad» = `me.availability` de la misma llamada `getMe()` del guard (sin petición extra); CV = `getCvLink()` al hacer clic.
- [ ] 10.2 RED→GREEN: `greeting.ts` (3 prioridades con `trim`).
- [ ] 10.3 RED→GREEN: `useRecruiterSession` (`getMe()` al montar; `checking→authorized|redirecting|error`; `unauthorized` → `router.replace('/acceso/')`; red/server → error con «Reintentar», sin redirección). El refresh ya lo cubre 7.4.
- [ ] 10.4 RED→GREEN: `CvCard` (solo «Descargar PDF», URL firmada al clic), `ContactCard`, `DetailsCard` (valores solo de la API).
- [ ] 10.5 RED→GREEN: `RecruiterZone` (`'use client'`, «Verificando sesión» con `role="status"`/`aria-busy`, 3 tarjetas exactas, logout) y `app/reclutador/page.tsx`.
- [ ] 10.6 CIERRE (`gitleaks dir apps/web/app/reclutador apps/web/src/features/recruiter`).

## PR 11: Playground (~280)

- [ ] 11.1 RED→GREEN: `endpoints.ts` (allowlist tipada de 5 GET) y `call()` rechaza fuera de la lista.
- [ ] 11.2 RED→GREEN: `EndpointButton` (`aria-pressed`), `ResponseViewer` (`<pre aria-live="polite">`, método/ruta/estado/JSON).
- [ ] 11.3 RED→GREEN: `ApiPlayground` (primer endpoint al autorizar, cambio de selección, `admin/visits` → 403 para RECRUITER); integrar en `RecruiterZone`.
- [ ] 11.4 CIERRE (`gitleaks dir apps/web/src/features/recruiter/playground`).

## PR 12: Cierre del sitio (~380)

- [ ] 12.1 Resolver NO VERIFICADO: CSP `style-src 'self'` sin `'unsafe-inline'` (probar en navegador; documentar si falla).
- [ ] 12.2 RED→GREEN: `sitemap.ts` (exactamente `/`, `/experiencia/`, `/acceso/`; sin `/reclutador/` ni `/acceso/verificar/`), `robots.ts` (referencia el sitemap, sin `Disallow` de rutas `noindex`), `noindex` en las dos rutas privadas, metadata y `<title>` propio por página.
- [ ] 12.3 RED→GREEN: `not-found.tsx` (enlace a `/`, un `h1`, axe).
- [ ] 12.4 RED→GREEN: `content-guard.test.ts` (design §9, 5 condiciones, con caso de infracción sobre temporal); test de `"use client"` permitido solo en menú, login/verificación, reclutador y playground; test de config (`output`, `trailingSlash`, `images.unoptimized`; sin `rewrites`/`redirects`/`headers`).
- [ ] 12.5 RED→GREEN: `scripts/check-out.js` CJS con `findViolations(outDir)` (+ `.test.js` con fixtures temporales: rutas, `404.html`, `robots.txt`, `sitemap.xml`, `_next/static` con hash, sin Google Fonts, sin `__WEB_CV_MOCK__` ni «Simular: abrir el enlace»/«Reiniciar demo», sin `.pdf`/`.docx`); script `check:out` y `build` = `next build && npm run check:out`; build con `NEXT_PUBLIC_API_MODE=mock` falla a propósito.
- [ ] 12.6 `apps/web/docs/delivery-contract.md` + test (cadenas obligatorias incl. `s3:ListBucket`, 403 no mapeado, sin IDs de 12 dígitos ni llaves, rutas documentadas == generadas); `apps/web/README.md` («Por qué esta tecnología», enlaza el contrato).
- [ ] 12.7 Verificación final de criterios de éxito de la propuesta (build completo, 5 rutas + `404.html`, axe, contraste, guardas, cobertura ≥ 80 %); Lighthouse móvil queda manual.
- [ ] 12.8 CIERRE (`gitleaks dir apps/web/scripts apps/web/README.md apps/web/docs`).

## Notas de apply

- Reversión: `git revert` del merge en orden inverso (12 → 1). Revertir PR 1 elimina el workspace y regenera el lockfile.
- Este archivo supera el tope de 530 palabras de la skill: lo exigen 12 PRs con pares RED/GREEN.

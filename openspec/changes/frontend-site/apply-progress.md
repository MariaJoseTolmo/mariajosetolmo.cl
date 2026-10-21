# Apply progress: frontend-site

> Registro versionado de la evidencia de TDD estricto (RED → GREEN) por unidad de trabajo.
> Reconstruido el 2026-10-21 desde los informes de cierre de cada lote de `sdd-apply`, porque la copia en Engram (`sdd/frontend-site/apply-progress`) se sobrescribió en la revisión 13 y perdió las tablas de las unidades 1–12.
> RED = test escrito primero y ejecutado en falla (módulo inexistente, aserción o mutación). GREEN = mismo archivo pasando tras la implementación.

## Resumen

| PR | Unidades | PR GitHub | Tests web al cerrar | Revisión de contexto fresco |
|----|----------|-----------|---------------------|-----------------------------|
| A | 1 + 2 | #10 | 73 (100% líneas) | Sin críticos; 4 warnings corregidos con test previo |
| B | 3 + 4 | #11 | 159 | Sin críticos; 3 warnings + 7 sugerencias |
| C | 5 + 6 | #12 | 313 | Sin críticos; 3 warnings + 6 sugerencias |
| D | 7 + 8 | #13 | 511 | Sin críticos; 3 warnings + 5 sugerencias |
| E | 9 + 10 | #14 | 688 | Sin críticos; 5 warnings + 5 sugerencias (probado en Chrome real) |
| F | 11 + 12 | #15 | 1.024+ | Sin críticos; 2 warnings + 6 sugerencias (CSP probada en Chrome real) |

Todos los PR se mergearon con `quality` y `secrets` en verde (checks requeridos en `main`).

## PR A (unidades 1–2)

| Comportamiento | RED | GREEN |
|---|---|---|
| Smoke page (`app/page.test.tsx`) | `Cannot find module './layout'` | 3 tests; skip-link primero: 1 falla → pasa |
| Contraste de tokens (`contrast.test.ts`) | ENOENT `tokens.css` | 5, incl. "token degradado nombra el par" |
| Sin colores en duro (`no-raw-colors.test.ts`) | `Cannot find '../test/rawColors'` | 7 → 31 tras ampliar a `app/`, `.ts`, nombres y `oklch()` |
| Átomos (Button, LinkButton, Eyebrow, SkipLink) | 4 suites sin módulo | 16 tests con axe |
| Globals (`globals.test.ts`) | ENOENT `globals.css` | 3; luego reglas de enlace `:where()` (falla "Received string: a") |
| `serve-out.js` | `Cannot find './serve-out'` | 6 → 16 (redirect `//`, CR/LF 400, error de stream 500, 405) |
| Config del repo (`repo-config.test.js`) | 4 fallas con cambios revertidos | 4 |
| Helper axe | — | prueba que detecta `image-alt` |

## PR B (unidades 3–4)

| Comportamiento | RED | GREEN |
|---|---|---|
| `site.test.ts` | módulo inexistente | 4 |
| `SiteHeader`, `isCurrentRoute` | módulo inexistente | nav idéntica, `aria-current`, 3 variantes, axe |
| `MobileMenu` | módulo inexistente | 10 (aria-expanded/controls, Escape, foco) |
| `Footer` | módulo inexistente | 4 |
| `highlightJson`, `CodeWindow`, `SectionHeading` | módulo inexistente | 6 + 5 + 3 |
| `Hero`, `Contributions`, `StackSection`, `home.test` | módulo inexistente | 5 + 4 + 7 + 3 |
| Página `/` | 5 de 10 fallan | 10 |
| Correcciones de revisión: guard Kafka por contenido, foco al elegir enlace, breakpoint 900 px, nombre estático "Menú", matchMedia, `overflow-wrap`, tap 44 px, allowlist de Client Components | cada una con test previo en falla (o mutación: "KAFKA" agregado a `stack.ts`, archivo `'use client'` temporal) | 159 |

## PR C (unidades 5–6)

| Comportamiento | RED | GREEN |
|---|---|---|
| Contenido proyectos/arquitectura + guard | `Cannot find module './projects'`, 4 fallas | 22 |
| Guard `/status`, `/api-docs`, Word, agendar | falla con `zz.ts` temporal | 11 |
| `ProjectsSection`, `ArchitectureSection`, `CtaBand` | 3 módulos inexistentes | 15 |
| Página `/` (orden, anclas, chips) | 5 fallas | 41 |
| Guard de breakpoints | falla con `max-width: 760px` temporal | 16 |
| Experiencia (contenido, Callout, Timeline, Education, página) | 6 módulos inexistentes | 109 |
| Correcciones de revisión: `role="list"`, empresa en h2, copy AWS, flechas CSS, eyebrow, padding, enlace externo, guard recursivo | 18 fallas antes de corregir | 313 |

## PR D (unidades 7–8)

| Comportamiento | RED | GREEN |
|---|---|---|
| `errors` | módulo inexistente | 15 |
| Adaptador mock | módulo inexistente | 10 |
| Adaptador http (refresh único compartido) | módulo inexistente; mutación `??=` → `=` falla | 35 |
| `loadGateway` | módulo inexistente | 4 |
| `api-mode-config` (mock filtrado al build) | 3 fallas | 4 |
| `FormField` + CSS | módulo inexistente | 7 + 3 |
| `loginReducer`, `validateEmail`, `content/login` | módulo inexistente; mutación de `validateEmail` 6 fallas | 13 + 11 + 3 |
| `StepsPanel`, `LoginForm`, `SentView`, `LoginContainer`, página | módulos inexistentes | 9 + 15 + 6 + 17 + 6 |
| Correcciones de revisión: privacidad, `readBody`, foco y live region, timeout, `no-store`, doble envío, ✓ oculto, paso 3, fetch-guard | 10 + 9 fallas; mutaciones (guard de envío 2 fallas, fetch en `validateEmail` 1 falla) | 511 |

## PR E (unidades 9–10)

| Comportamiento | RED | GREEN |
|---|---|---|
| `useMagicLinkToken`, `verifyReducer` | 2 suites sin módulo; mutación de `setToken` falla en StrictMode | 25 |
| `VerifyView`, `VerifyContainer`, página verificar | 3 suites sin módulo | 47 + 22 |
| `greeting`, `safeUrl`, `useRecruiterSession`, tarjetas, `SessionBar` | 8 suites sin módulo | 30 |
| `RecruiterZone`, página reclutador | 2 suites sin módulo | 22 + 3 |
| `token-guard` | mutación con `location.search` falla | 2 |
| Correcciones de revisión: `hashchange`, doble confirmación, foco en estados ocupados, live regions, `https:` only, guards de descarga/logout | 23 fallas en 6 suites; mutaciones (`addEventListener` 6, cleanup 3, `inFlight` 1, guards 1 c/u) | 688 |

## PR F (unidades 11–12)

| Comportamiento | RED | GREEN |
|---|---|---|
| `role="list"` en header, menú, stack | 3 fallas | 9 |
| Allowlist del playground | módulo inexistente, luego 10 fallas | 97 en `lib/api` |
| `EndpointButton`, `ResponseViewer`, `ApiPlayground` | 3 suites sin módulo; mutaciones (in-flight 2, mounted 1, aria-pressed 2) | 30 |
| Integración `RecruiterZone` | 4 fallas | pasa |
| sitemap, robots, metadata, 404 | suites sin módulo | pasa |
| Guard de dinero/teléfono/documentos | 2 fallas (falso positivo de timestamp, `5MM`) → 6 fallas al endurecer | 279 |
| `check-out` | módulo inexistente; mutaciones (documento 3, noindex 1, marcador 1) | 31 → 34 con CLI sin `--doc` |
| `prune-out` | módulo inexistente | 3 |
| Contrato de entrega | 29 fallas (doc inexistente) | 36 |
| Validación al salir del campo | 4 fallas | 26 en `LoginForm` |

## Lote de correcciones de verificación (2026-10-21)

Ver `verify-report.md`. Las correcciones con código se registran abajo cuando se apliquen.

### Correcciones (rama `docs/frontend-verify-fixes`)

Suite web al cerrar: 87 suites / 1175 tests en verde (antes 1062). Cobertura global: Stmts 99,85 · Branch 99,18 · Funcs 99,4 · Lines 100 (antes Branch 98,36). `Hero.tsx`: ramas 50 % → 100 %.

| Ítem | RED | GREEN |
|------|-----|-------|
| W2 guarda de fechas de disponibilidad (`contentRules.availabilityMatches`) + SUGGESTION 3 (valores del mock fuera de `src/content`) | 94 fallas en `content-guard.test.ts` (regla inexistente: positivos, negativos y barrido de archivos) | 395 pasan; los negativos incluyen ISO, versiones, años sueltos y "Enlace no disponible"; el contenido actual pasa |
| W3 `RecruiterZone` con el adaptador `http` real sobre `fetch` falso (`GET /me` 401 → `POST /api/auth/refresh` 200 → `GET /me` 200 → vista autorizada) | No aplica: prueba de integración sobre comportamiento ya implementado; pasó desde la primera ejecución. Cubre el hueco PARTIAL "Refresh recupera la sesión" a nivel de página | pasa, con orden de llamadas y sin redirección |
| W8 `Hero.tsx` ramas de CTA ausentes | Cobertura de ramas 50 % (verify-report) | 2 tests (sin primary, sin secondary) → 100 % de ramas. Son pruebas de cobertura; no se tocó código |
| S1 `check-out` exige un `.woff2` en `_next/static/` | 2 fallas (`self-hosted fonts`) | 99 pasan en `scripts/`; build real: `check-out: out OK` con 16 `.woff2` |
| S5 README menciona `prune-out.js` | 1 falla (`README covers prune-out.js`) | pasa |
| S4 `out/_not-found/` documentado como interno de Next | 1 falla en `delivery-contract.test.js` | pasa. No se poda: `404.html` y el router del cliente (chunk) referencian `/_not-found`, así que se documenta |
| S6 "http(s)" → "https" (nota de tasks y nombre del test) | n/a (texto) | `rg 'http\(s\)'` sin resultados en tasks y tests |
| W9 comentario sobre `toHaveClass` en `Button`/`LinkButton` | n/a (comentario) | sin cambios de comportamiento |
| W1, W4, W5, W7 (spec, tasks, design) | n/a (documentación) | spec, 6 CIERRE marcados, design reconciliado, decisión de fuentes cerrada |

Verificación final: `lint` (`--max-warnings 0`), `lint:boundaries`, `format:check`, `typecheck`, `test`, `test:cov`, `test:e2e` con exit 0; build en copia de trabajo con `check-out: out OK`; `scan-secrets.sh` exit 0; `gitleaks git` sin hallazgos.

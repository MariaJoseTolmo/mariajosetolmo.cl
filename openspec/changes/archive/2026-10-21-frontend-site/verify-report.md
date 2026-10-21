# Informe de verificación: frontend-site

## Re-verificación (2026-10-21)

**Base**: rama `docs/frontend-verify-fixes`, cambios sin commitear sobre `main` @ `991364d` (14 archivos: 11 en `apps/web`, 3 en `openspec/`). **Modo**: Strict TDD (`npm test`).
**Veredicto**: **PASS WITH WARNINGS**. 0 CRITICAL, 3 WARNING, 5 SUGGESTION. Se puede archivar.

### Gates (todos en una copia de trabajo `cp -Rc` en el scratchpad; el `next dev` de :3001, PID 85017, y el `.next`/`out` del repo no se tocaron)

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | exit 0 (`--max-warnings 0`) |
| `npm run lint:boundaries` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0. api 2 suites / 8 tests. **web 87 suites / 1175 tests** (antes 1062), 0 fallos, 0 skipped |
| `npm run test:cov` | exit 0. web: Stmts 99.85 · **Branch 99.18** (antes 98.36) · Funcs 99.4 · Lines 100. `Hero.tsx` 100 % en ramas; `http.ts` 100 %. Bajo 100 % en ramas solo quedan `SiteHeader.tsx` 90 (L19), `highlightJson.ts` 83.33 (L22), `ApiPlayground.tsx` 88.88 (L24) |
| `npm run test:e2e` | exit 0 (solo api, 2 suites / 5 tests; web no tiene e2e por diseño) |
| `npm run build` | exit 0: `next build` → `prune-out.js` → `check-out: out OK`. 16 `.woff2` en `_next/static/`; carpetas `acceso/`, `experiencia/`, `reclutador/`, `_not-found/`, `_next/`; 0 coincidencias de mock / Google Fonts / `mock-token` en `out/` |
| `bash spikes/web-functions/scripts/scan-secrets.sh` | `RESULT: clean`, exit 0 |
| `gitleaks git --no-banner --redact` | 52 commits, `no leaks found` |

### Evidencia TDD (`apply-progress.md`)

`openspec/changes/frontend-site/apply-progress.md` (versionado; Engram `sdd/frontend-site/apply-progress` rev 14 apunta a él) trae una tabla RED → GREEN por PR (A–F, unidades 1–12) más el lote de correcciones. RED se describe como módulo inexistente, aserciones en falla o mutaciones concretas.

| Chequeo | Resultado | Detalle |
|---------|-----------|---------|
| Evidencia TDD reportada | ✅ | 12/12 unidades (6 tablas por PR) + lote de correcciones |
| Tests nombrados existen | ✅ | 45/45 archivos de test citados existen (comprobado con `fd`) |
| GREEN confirmado | ✅ | 1175/1175 pasan ahora. Conteos muestreados: `contrast` 5, `prune-out` 3, `serve-out` 16, `errors` 15, `greeting` 4, `Footer` 4 coinciden; `site.test` tiene 5 (decía 4, creció después) |
| RED/mutaciones reproducibles | ✅ | 6/6 mutaciones muestreadas fallan los tests (ver abajo) |
| Triangulación | ✅ | `it.each` con positivos y negativos (p. ej. 8 fechas detectadas / 9 ignoradas en `availabilityMatches`) |
| Safety net / formato de la plantilla | ⚠️ | Sin columnas TRIANGULATE / SAFETY NET / REFACTOR; reconstruida a posteriori desde los informes de cierre; RED no se puede contrastar con el historial (los commits juntan test y código) |

Mutaciones ejecutadas en la copia (cada archivo se restauró después):

| # | Mutación | Test | Resultado |
|---|----------|------|-----------|
| M1 | `http.ts`: `refreshing ??=` → `refreshing =` (PR D) | `http.test.ts` | 1 falla |
| M2 | `check-out.js`: sin el chequeo de `.woff2` (S1) | `check-out.test.js` | 2 fallan |
| M3 | `check-out.js`: sin `noindex` en páginas privadas (PR F) | `check-out.test.js` | 1 falla |
| M4 | `contentRules.ts`: quitar el patrón `disponib… desde/inicio/a partir` (W2) | `content-guard.test.ts` | 1 falla |
| M5 | `RecruiterZone.tsx`: leer `window.location.search` (PR E) | `token-guard.test.ts` | 1 falla |
| M6 | `http.ts`: tras el refresh devolver la primera respuesta en vez de reintentar (W3) | `RecruiterZone.test.tsx -t "real http adapter"` | 1 falla |

Conclusión: la evidencia cumple el requisito de strict-tdd-verify. El CRITICAL queda resuelto. La forma reconstruida y sin columnas de safety net queda como WARNING de proceso, no bloqueante.

### Estado de los hallazgos anteriores

| Hallazgo | Estado | Evidencia |
|----------|--------|-----------|
| CRITICAL 1: falta evidencia TDD | **Resuelto** | `apply-progress.md` + Engram rev 14; muestreo y mutaciones arriba. Queda N2 (formato) |
| W1: spec vs. código en controles del mock | **Resuelto** (spec corregida) | `specs/web-recruiter-access/spec.md` › "Visibles en mock" describe un control por estado. Queda N1 (las cláusulas MUST NOT nuevas no tienen aserción) |
| W2: guarda sin fechas de disponibilidad | **Resuelto** | `contentRules.availabilityMatches` + `content-guard.test.ts > %s has no availability date` sobre `app/` y `src/`; M4 la rompe |
| W3: refresh solo a nivel de adaptador | **Resuelto** | `RecruiterZone.test.tsx > RecruiterZone with the real http adapter > recovers the session…` (orden `GET /me` → `POST refresh` → `GET /me`, sin redirección); M6 la rompe |
| W4: CIERRE sin marcar en tasks | **Resuelto** | 7.7, 8.6, 9.5, 10.6, 11.4, 12.8 en `[x]` con PR |
| W5: design desalineado | **Resuelto** | §2 (árbol, `playground-endpoints.ts`), §4 (scripts `build`/`prune-out`/`preview`), §8 (`role="status"`), §9 (`period: string`), §13/§15 (6 PRs), pregunta abierta #2 `[x]`, fila #9 de §16 corregida y ordenada |
| W6: tamaño de PRs vs. estimación | **Resuelto (aceptado y documentado)** | design §13/§15: `size:exception` decidido por la usuaria, tamaños reales registrados. La etiqueta sigue sin existir en el repo (informativo) |
| W7: decisión de fuentes abierta | **Resuelto** | design §4 + tarea 2.1: se queda `next/font/google`, plan B `next/font/local` documentado; `check-out` exige `.woff2` |
| W8: ramas de `Hero.tsx` al 50 % | **Resuelto** | 100 % en ramas. Ver S-N3 sobre cómo se testea |
| W9: aserciones sobre clases CSS | **Abierto (mitigado)** | `Button.test.tsx` / `LinkButton.test.tsx` siguen con `toHaveClass`; ahora tienen un comentario que lo justifica. Sigue siendo WARNING según strict-tdd-verify |
| S1: `.woff2` en `check-out` | **Resuelto** | `check-out.js` + 2 tests; build real con 16 `.woff2`; M2 lo rompe |
| S2: test de 44 px en el menú móvil | **Abierto** | sin cambios |
| S3: valores de disponibilidad fuera de `src/` | **Resuelto** | `content-guard.test.ts > mock availability placeholders` (los 3 valores de `MOCK_ME.availability` no aparecen en `src/content`) + la guarda de fechas sobre todo `src/` |
| S4: `out/_not-found/` | **Resuelto** (documentado) | `delivery-contract.md` › Artefacto + test `documents out/_not-found/ as a Next internal…` |
| S5: README sin `prune-out.js` | **Resuelto** | README + test `covers prune-out.js` |
| S6: "http(s)" → "https" | **Resuelto** | `rg 'http\(s\)'` sin resultados en tasks, `src`, `app` y `scripts` |
| S7: aclarar §8 sobre sesión expirada | **Resuelto** | design §8: logout → `/`; guardia (`unauthorized`) → `/acceso/` |
| S8: `app/**` en `collectCoverageFrom` | **Abierto** | sin cambios |

Regresiones: ninguna.

### Matriz de la spec (cambios respecto del informe original)

| Escenario | Antes | Ahora |
|-----------|-------|-------|
| Guardas de contenido › Sin cifras de renta (fechas) | PARTIAL | PASS (`content-guard.test.ts`, `availabilityMatches`) |
| Guard de sesión › Refresh recupera la sesión | PARTIAL | PASS (`RecruiterZone.test.tsx`, adaptador http real) |
| Tres tarjetas › Disponibilidad viene de la API | PARTIAL | PASS (`mock availability placeholders` + `RecruiterZone > shows the availability…`) |
| Controles del mock › Visibles en mock (texto nuevo) | PARTIAL | PARTIAL: las afirmaciones positivas están cubiertas (`SentView.test.tsx`, `VerifyView.test.tsx`); las nuevas cláusulas MUST NOT cruzadas no |
| Menú móvil (cláusula 44 px) | PARTIAL | PARTIAL (sin cambios) |

Resumen: **70/71 escenarios PASS, 1 PARTIAL, 0 FAIL**; requisitos 25 PASS / 2 PARTIAL (Menú móvil por los 44 px, Controles del mock por N1).

### Hallazgos vigentes

**CRITICAL**: ninguno.

**WARNING**
1. **N1 (nuevo):** "Visibles en mock" ahora exige que "Reiniciar demo" MUST NOT exista en "sent" y que "Simular: abrir el enlace" MUST NOT exista en "done" (modo mock). Ningún test lo afirma: `SentView.test.tsx` no busca "Reiniciar demo" y `VerifyView.test.tsx` no busca "Simular" en `done`. Hoy se cumple por construcción. Faltan dos `queryByText(...)).toBeNull()` en modo mock.
2. **N2 (residual del CRITICAL):** la evidencia TDD se reconstruyó a posteriori, por PR y no por tarea, sin columnas TRIANGULATE / SAFETY NET / REFACTOR; RED no se puede contrastar con git. El muestreo (45/45 archivos, 6/6 mutaciones) la respalda. Para próximos cambios, guardar la tabla en cada lote de apply.
3. **W9 (abierto, mitigado):** aserciones `toHaveClass` en `Button.test.tsx` y `LinkButton.test.tsx`, ahora justificadas con un comentario.

**SUGGESTION**
1. S2: fijar con un test el alto táctil de 44 px del botón y los enlaces del menú móvil.
2. S8: considerar `app/**` en `collectCoverageFrom`.
3. **S-N3 (nuevo):** `Hero.test.tsx` cubre las ramas reasignando `home.hero.ctas` del módulo compartido con `as unknown as` (se restaura en `afterEach`). Funciona, pero acopla el test al objeto de contenido. Es más limpio tipar `ctas` como tupla y quitar las ramas muertas, o pasar los CTA por props.
4. **S-N4 (nuevo):** quitar el patrón `disponib…` de `availabilityMatches` solo rompe 1 test (M4); los positivos se solapan entre patrones. Conviene que cada patrón tenga su propio caso positivo exclusivo.
5. Etiqueta `size:exception` en el repo para futuros PRs (hoy solo en los cuerpos).

### Veredicto

**PASS WITH WARNINGS**: 0 CRITICAL, 3 WARNING, 5 SUGGESTION. El CRITICAL de proceso está resuelto, 8 de 9 WARNING y 6 de 8 SUGGESTION están cerrados, y no hay regresiones. Ninguno de los WARNING vigentes bloquea `sdd-archive`; N1 son dos aserciones que se pueden agregar antes del commit o en un cambio aparte.

---

# Informe original (2026-10-21, `main` @ `991364d`)

**Cambio**: `frontend-site` · **Proyecto**: web_cv · **Fecha**: 2026-10-21
**Modo**: Strict TDD (`openspec/config.yaml`: `strict_tdd: true`, runner `npm test`)
**Base verificada**: `main` @ `991364d` (merge del PR #15), árbol limpio. PRs #10–#15 (A–F) mergeados con `quality` y `secrets` en verde.
**Veredicto**: **FAIL (proceso)**: 1 CRITICAL de proceso, sin defectos de código. En el código, el resultado sería PASS WITH WARNINGS.

---

## 1. Completitud de tareas

| Métrica | Valor |
|---------|-------|
| Tareas de unidad (1.1–12.8) | 74 |
| Completas `[x]` | 68 |
| Sin marcar | 6: 7.7, 8.6, 9.5, 10.6, 11.4, 12.8 (todas CIERRE) |
| Plantilla CIERRE C1–C6 | sin marcar (es una plantilla, no se marca) |
| Preguntas abiertas Q1/Q2 | resueltas `[x]` |

Las 6 tareas CIERRE sin marcar las cerró el orquestador: revisiones de contexto fresco, commits, PRs #10–#15 mergeados y CI verde (comprobado con `gh pr checks`: `quality:pass secrets:pass` en los 6). En cada nota de apply quedó registrado el `gitleaks dir`. El problema es solo que `tasks.md` no se actualizó (WARNING).

## 2. Ejecución (evidencia en runtime)

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | exit 0 (`--max-warnings 0`) |
| `npm run lint:boundaries` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run typecheck` | exit 0 (`next typegen && tsc --noEmit`, en copia de trabajo) |
| `npm test` | exit 0. api: 2 suites / 8 tests. **web: 87 suites / 1062 tests, 0 fallos, 0 skipped** |
| `npm run test:cov` | exit 0. web: **Stmts 99.85 · Branch 98.36 · Funcs 99.4 · Lines 100** (umbral global 80, `jest.config.js`) |
| `npm run test:e2e` | exit 0. Solo api (2 suites / 5 tests). `apps/web` no tiene e2e (design §4: "No hay `test:e2e`") |
| `npm run build` (copia en el scratchpad, porque `next dev` ocupaba 127.0.0.1:3001) | exit 0. `next build` → `prune-out.js` → `check-out: out OK` |
| `NEXT_PUBLIC_API_MODE=mock npm run build` (copia) | **exit 1 a propósito**: `check-out: 8 violation(s)` (`__WEB_CV_MOCK__`, `mock-token`, "Simular…", "Reiniciar demo" en chunks) |
| `bash spikes/web-functions/scripts/scan-secrets.sh` | `RESULT: clean`, exit 0 |
| `gitleaks git --no-banner --redact` | 52 commits, `no leaks found` |

Inspección de `out/` (build http):
- HTML: `index.html`, `experiencia/`, `acceso/`, `acceso/verificar/`, `reclutador/` + `404.html` (más `_not-found/index.html`, interno de Next).
- `sitemap.xml`: exactamente `https://mariajosetolmo.cl/`, `/experiencia/`, `/acceso/`.
- `robots.txt`: `Allow: /` + `Sitemap: https://mariajosetolmo.cl/sitemap.xml`, sin `Disallow`.
- `noindex, nofollow` en `reclutador/` y `acceso/verificar/`; `404.html` con `noindex`; las públicas no lo llevan.
- `lang="es"` y `<title>` propio en las 6 páginas.
- `rg` de `__WEB_CV_MOCK__|Simular: abrir el enlace|Reiniciar demo|fonts.googleapis.com|fonts.gstatic.com|mock-token|dato de ejemplo` en `out/`: 0 coincidencias.
- 16 `.woff2` en `out/_next/static/`. No hay `.pdf` ni `.docx`.

La copia de trabajo se borró al terminar. El servidor `next dev` (PID 85017, :3001) no se tocó.

## 3. Matriz de cumplimiento de la spec

Leyenda: PASS = test que cubre el escenario y pasó en esta ejecución (o chequeo de build ejecutado). PARTIAL = cubierto en parte. MANUAL = fuera de la automatización.

### web-public-pages (12 requisitos, 26 escenarios)

| Requisito | Escenario | Evidencia | Resultado |
|-----------|-----------|-----------|-----------|
| Rutas públicas exportadas | El build produce una página por ruta | build + `scripts/check-out.js` (REQUIRED_FILES); `check-out.test.js > it.each missing …` | PASS |
| | La 404 permite volver | `app/not-found.test.tsx > offers a way back to the home page` | PASS |
| Navegación compartida | Nav igual en Inicio y Experiencia | `SiteHeader.test.tsx > renders an identical nav regardless of the current page`; `app/experiencia/page.test.tsx > uses the same shared nav as the home page` | PASS |
| | La ruta actual se marca | `SiteHeader.test.tsx > marks only the current route with aria-current="page"`; `experiencia/page.test.tsx > marks only Experiencia…` | PASS |
| Menú móvil accesible | Abrir y cerrar con teclado | `MobileMenu.test.tsx > closes on Escape and returns focus to the button` | PASS |
| | aria-controls resuelve | `MobileMenu.test.tsx > aria-controls points to an element that exists in the DOM` | PASS |
| | (cláusula 44 px) | Solo evidencia estática: `--tap-44` en `MobileMenu.module.css` y `SiteHeader.module.css`; ningún test lo fija (sí hay uno para el footer) | PARTIAL |
| Skip link y foco visible | El skip link es el primer foco | `SkipLink.test.tsx > receives the first focus on Tab…`; `app/page.test.tsx > renders the skip link as the first element of the body` | PASS |
| | Existe el destino | `page.test.tsx`/`experiencia`/`acceso`/`not-found` `> … main#contenido`; `globals.test.ts > draws a visible focus ring` | PASS |
| Tokens como única fuente | No hay colores literales | `no-raw-colors.test.ts > scans both src and app and finds none` | PASS |
| | Los tokens existen | `contrast.test.ts > defines the 16 design colors plus white` | PASS |
| Contraste | Todos los pares cumplen | `contrast.test.ts > all pairs meet their WCAG threshold` | PASS |
| | Un token degradado rompe | `contrast.test.ts > names the offending pair when a token is degraded` | PASS |
| Accesibilidad por página | jest-axe sin violaciones | `axe` en `app/page`, `experiencia`, `not-found`, `acceso`, `acceso/verificar`, `reclutador` + estados (`LoginContainer it.each form/error/sent`, `VerifyContainer it.each`, `RecruiterZone it.each checking/error/authorized`) | PASS |
| | Un solo h1 | `> renders a single h1` en cada página; `lang`/`title`: `app/page.test.tsx > declares lang="es"`, `app/metadata.test.ts > gives every page its own title` + build | PASS |
| Fuentes autoalojadas | El output no referencia Google Fonts | `check-out.test.js > it.each fonts.*` + build (`check-out` OK) + `rg` en `out/` | PASS |
| | Fuentes servidas desde el build | Inspección del build: 16 `.woff2` (sin chequeo automático) | PASS (build) |
| Contenido honesto | Kafka siempre con SQS | `app/page.test.tsx > never mentions Kafka without SQS…`; `experiencia/page.test.tsx > never mentions Kafka without SQS…`; `projects.test.ts` | PASS |
| | Chips a rutas reales | `app/page.test.tsx > links the architecture chips to the real endpoints`; `home.test.ts > links the chips…` | PASS |
| | AWS sin inflar | `home.test.ts > presents AWS as something being learned…` | PASS |
| | Pie con nombre correcto | `Footer.test.tsx > shows the owner name and role` | PASS |
| Guardas de contenido | Sin archivos de CV | `content-guard.test.ts > ships no PDF, Word or ODT document under apps/web` | PASS |
| | Sin cifras de renta | `content-guard.test.ts > %s has no salary or money wording` (incluye `mock/fixtures.ts`). **Falta** el patrón de "fechas de disponibilidad" que exige la spec (`src/test/contentRules.ts` solo tiene dinero y teléfono) | PARTIAL |
| | La guarda detecta una infracción | `content-guard.test.ts > the rules do catch violations` (it.each) + `finds a document dropped in a temp tree…` | PASS |
| Inventario de secciones | Anclas de la nav existen | `app/page.test.tsx > it.each(['proyectos','stack','como'])`; `> orders header, hero, …` | PASS |
| | Línea de tiempo completa | `experiencia/page.test.tsx > has the timeline with 5 items…` | PASS |
| Peso del cliente | Límite de Client Components | `src/test/client-components.test.ts > only the allowed files declare "use client"` (5 archivos) | PASS |

### web-recruiter-access (10 requisitos, 31 escenarios)

| Requisito | Escenario | Evidencia | Resultado |
|-----------|-----------|-----------|-----------|
| Formulario de login | Email inválido no envía | `LoginForm.test.tsx > rejects an invalid email…`; `LoginContainer.test.tsx > does not call the gateway for an invalid email` | PASS |
| | Validación al salir del campo | `LoginForm.test.tsx > LoginForm validation on blur` (9 tests: error, sin mover foco, vacío sin error, revalida al tipear, mismo nodo alert, axe) | PASS |
| | Envío con opcionales vacíos | `LoginForm.test.tsx > sends only the email when the optionals are empty` | PASS |
| | Envío con todos los campos | `LoginForm.test.tsx > sends email, company and name when all are filled` | PASS |
| Estado "enviado" idéntico | Respuestas distintas, misma UI | `LoginContainer.test.tsx > renders the same sent HTML for %s (anti-enumeration)` (4 casos) + `http.test.ts > it.each([200,202,204]) treats %i as sent` | PASS |
| | Estado sent accesible | `LoginContainer.test.tsx > keeps a persistent polite live region…` + axe `sent` | PASS |
| Puerto ApiGateway | Componentes sin fetch directo | `src/test/fetch-guard.test.ts > only lib/api/http.ts calls fetch()` | PASS |
| | Selección por variable de entorno | `src/lib/api/index.test.ts > selects the mock/http adapter…` | PASS |
| Verificación del magic link | Token en el fragmento, capturado y borrado | `useMagicLinkToken.test.tsx > captures the token from the fragment and clears the fragment` | PASS |
| | Estado neutral en el primer render | `useMagicLinkToken.test.tsx > is pending during the first (server) render`; `VerifyContainer.test.tsx > prerenders the neutral state…` | PASS |
| | Sin auto-consumo | `VerifyContainer.test.tsx > captures the fragment token, clears the URL and does not consume it` | PASS |
| | Confirmación explícita | `VerifyContainer.test.tsx > verifies once with the captured token on explicit confirmation` | PASS |
| | Sin token | `VerifyContainer.test.tsx > shows the invalid link without a token and never calls the API` | PASS |
| | Token en la query se ignora | `useMagicLinkToken.test.tsx > ignores ?token= in the query string`; `VerifyContainer.test.tsx > ignores ?token=…`; `token-guard.test.ts` | PASS |
| Guard de sesión | Estado de verificación | `RecruiterZone.test.tsx > shows "Verificando sesión" and no protected content while checking` | PASS |
| | Un solo refresh | `http.test.ts > refreshes exactly once and then reports unauthorized` | PASS |
| | Refresh recupera la sesión | `http.test.ts > recovers the session when the retry succeeds`: solo a nivel de adaptador; ningún test renderiza la página con el adaptador `http` | PARTIAL |
| | Sin sesión | `RecruiterZone.test.tsx > redirects to /acceso/ when there is no session…`; `useRecruiterSession.test.tsx > redirects…` | PASS |
| | Error de red no cierra la sesión | `RecruiterZone.test.tsx > does not redirect on a network error: offers "Reintentar"…` | PASS |
| Tres tarjetas y saludo | Tres tarjetas exactas | `RecruiterZone.test.tsx > shows exactly the three cards and the playground, without Word or scheduling` | PASS |
| | Solo descarga PDF | `CvCard.test.tsx > offers only "Descargar PDF"` | PASS |
| | Disponibilidad viene de la API | `RecruiterZone.test.tsx > shows the availability that getMe returned, with no extra request`. No hay aserción de que "src/ no lo contiene" | PARTIAL |
| | Saludo por prioridad | `greeting.test.ts` (4 tests) + `RecruiterZone.test.tsx > greets by company / by name` | PASS |
| API Playground | Cinco endpoints con aria-pressed | `ApiPlayground.test.tsx > renders five endpoint buttons…, exactly one pressed` | PASS |
| | Cambio de selección | `ApiPlayground.test.tsx > switches the selection and shows the new response` | PASS |
| | 403 en admin | `ApiPlayground.test.tsx > shows 403 for admin/visits as a response…`; `app/reclutador/page.test.tsx > plays the API with the mock gateway: 200 first, 403…` | PASS |
| Controles exclusivos del mock | Visibles en mock | La spec pide **ambos** controles en "sent" **y** en "done". El código muestra "Simular" solo en sent (`SentView.test.tsx`, `LoginContainer.test.tsx > offers "Simular…" in mock mode only`) y "Reiniciar demo" solo en done (`VerifyView.test.tsx > offers "Reiniciar demo" in the done state…`, `> never shows "Reiniciar demo" outside the done state`). La desviación está anotada en tasks (apply D), pero la spec no se actualizó | PARTIAL |
| | Ausentes en http | `SentView.test.tsx`, `VerifyView.test.tsx`, `LoginContainer.test.tsx` (modo http) + `check-out` sobre el build | PASS |
| El mock no llega a producción | Build http limpio | build http → `check-out: out OK` + `rg` en `out/` = 0 | PASS |
| | Detección de fuga | `check-out.test.js > it.each forbidden markers` + **build real en modo mock: exit 1, 8 violaciones nombrando los chunks** | PASS |
| Sin datos personales | Fixtures falsos | `mock/index.test.ts > returns a placeholder profile that carries the marker`; `content-guard.test.ts > scans the mock fixtures too` | PASS |

### web-delivery-contract (5 requisitos, 14 escenarios)

| Requisito | Escenario | Evidencia | Resultado |
|-----------|-----------|-----------|-----------|
| Config de export | Config correcta | `src/test/next-config.test.ts > exports static files with trailing slashes and unoptimized images` | PASS |
| | Sin características de servidor | `next-config.test.ts > it.each(rewrites, redirects, headers)` | PASS |
| Estructura de out/ por script | Build completo pasa | `npm run build` (copia): `check-out: out OK`, exit 0; `check-out.test.js > exits 0 on a clean export`; `repo-config.test.js > chains the export check after the build` | PASS |
| | Falta una ruta | `check-out.test.js > it.each missing …` + `> exits 1 and names the offending file` | PASS |
| Documento para infra | Existe y está enlazado | `delivery-contract.test.js > exists in apps/web/docs and is linked from the README` | PASS |
| | Cubre los cinco puntos | `delivery-contract.test.js > it.each([...required strings])` | PASS |
| | El 403 no se mapea | `delivery-contract.test.js > says explicitly that 403 is not mapped, and never maps it` | PASS |
| | Sin datos sensibles | `delivery-contract.test.js > carries no account IDs, keys or secrets` | PASS |
| El contrato coincide con el build | Rutas documentadas == generadas | `check-out.js checkContract` (corre en cada build) + `delivery-contract.test.js > documents exactly the routes the app folder generates` | PASS |
| | Assets con hash | `check-out.test.js > requires content hashes in the file names of chunks` + build | PASS |
| | Ruta no documentada | `check-out.test.js > fails when the documented routes differ from the generated ones` | PASS |
| Metadatos de descubrimiento | Sitemap sin rutas privadas | `app/sitemap.test.ts` (3 tests) + `out/sitemap.xml` inspeccionado | PASS |
| | robots.txt no oculta el noindex | `app/robots.test.ts > never disallows a path…` + `out/robots.txt` | PASS |
| | noindex en rutas privadas | `app/metadata.test.ts > marks the two private pages noindex`; `check-out.test.js > requires noindex on the two private pages`; `out/*.html` inspeccionado | PASS |

### Resumen

| Nivel | PASS | FAIL | PARTIAL | MANUAL |
|-------|------|------|---------|--------|
| Escenarios (71) | 67 | 0 | 4 | 0 |
| Requisitos (27) | 22 | 0 | 5 | 0 |
| Criterios de éxito de la propuesta | 6 | 0 | 0 | 1 (Lighthouse móvil: Perf ≥ 95, A11y 100, BP/SEO ≥ 95, LCP < 2,5 s, CLS < 0,1) |

Requisitos PARTIAL: Menú móvil (44 px sin test), Guardas de contenido (sin patrón de fechas), Guard de sesión (refresh a nivel de página), Tres tarjetas (aserción de "no está en src/"), Controles del mock (spec vs. código).
Otro ítem verificado a mano (fuera de la spec): CSP `style-src 'self'` sin `'unsafe-inline'` (tarea 12.1, Chrome headless, documentado en el contrato).

## 4. Cumplimiento de TDD (strict-tdd-verify)

| Chequeo | Resultado | Detalle |
|---------|-----------|---------|
| Evidencia TDD reportada | ❌ | `sdd/frontend-site/apply-progress` (obs #687, rev 13) dice "Rev 12 content retained", pero **solo contiene el delta de la rev 13** (validación on-blur). No hay tabla "TDD Cycle Evidence" de las 12 unidades: se perdió en el upsert |
| Todas las tareas tienen tests | ✅ | Cada componente, hook, reducer y script tiene su `.test.*` junto al código (87 suites) |
| RED confirmado (tests existen) | ⚠️ | Los archivos existen, pero RED no se puede comprobar: los commits juntan test y código (C5) y el artefacto de evidencia no está |
| GREEN confirmado | ✅ | 1062/1062 pasan en esta ejecución |
| Triangulación | ✅ | Uso intensivo de `it.each` y casos positivos/negativos (p. ej. guardas con "the rules do catch violations") |
| Safety net en archivos modificados | ➖ | No verificable sin la tabla |

Rev 13: la única unidad con evidencia narrativa tiene RED (4 tests fallando) → GREEN 26/26, y se comprueba (bloque `LoginForm validation on blur` en verde).

### Distribución por capa

| Capa | Tests | Archivos | Herramienta |
|------|-------|----------|-------------|
| Unit (sin render) | 696 | 42 | jest |
| Integración (RTL `render`/`renderHook`/`renderToString`) | 366 | 45 | jest + RTL + user-event + jest-axe |
| E2E (web) | 0 | 0 | no aplica (fuera de alcance: no hay Playwright, design §4) |
| **Total web** | **1062** | **87** | |

Verificación de nivel "build" fuera de Jest: `check-out.js` en cada `npm run build` (también en el CI).

### Cobertura de archivos cambiados (`collectCoverageFrom`: `src/{lib,features,components}`)

Global: 99.85 / 98.36 / 99.4 / 100 (umbral 80) ✅. Todo lo que no aparece abajo está al 100 % en las 4 métricas.

| Archivo | Line % | Branch % | Sin cubrir | Rating |
|---------|--------|----------|------------|--------|
| `src/features/home/Hero.tsx` | 100 | **50** | ramas L18–21 (`primary`/`secondary` ausentes) | ⚠️ Bajo en ramas |
| `src/components/ui/highlightJson.ts` | 100 | 83.33 | rama L22 | ⚠️ Aceptable |
| `src/components/layout/SiteHeader.tsx` | 100 | 90 | rama L19 | ⚠️ Aceptable |
| `src/features/recruiter/playground/ApiPlayground.tsx` | 100 | 88.88 | rama L24 | ⚠️ Aceptable |
| `src/lib/api/http.ts` | 100 | 98.36 | rama L58 | ✅ |
| `src/features/recruiter/RecruiterZone.tsx` | 100 | 100 | funcs 91.66 | ✅ |

`app/**` y `src/content/**` quedan fuera de `collectCoverageFrom` (por diseño), aunque se ejercitan en los tests de página y de contenido.

### Calidad de aserciones

| Archivo | Línea | Aserción | Problema | Severidad |
|---------|-------|----------|----------|-----------|
| `src/components/ui/Button.test.tsx` | 22–23, 29–30 | `toHaveClass('outline')`, `toHaveClass('size52')`… | Acoplado a nombres de clases CSS | WARNING |
| `src/components/ui/LinkButton.test.tsx` | (4 usos) | `toHaveClass(...)` | Igual | WARNING |

No hay tautologías. Todos los bucles con `expect` (SiteHeader, experiencia, globals, StepsPanel) van precedidos de una aserción de longitud > 0, así que no hay *ghost loops*. Los `jest.mock` (4 archivos, solo `next/navigation`) no superan el doble de las aserciones.
**Calidad de aserciones**: 0 CRITICAL, 2 WARNING.

### Métricas de calidad
- **Linter**: ✅ 0 errores, 0 warnings
- **Type checker**: ✅ 0 errores

## 5. Coherencia con el design

| Decisión | ¿Se sigue? | Notas |
|----------|------------|-------|
| §16 #1 skip link `#contenido` | ✅ | |
| §16 #2 puerto (6 métodos, refresh interno single-flight) | ✅ | `http.test.ts > shares one in-flight refresh…` |
| §16 #3 `check-out.js` CJS encadenado en `build` | ✅ | `build` = `next build && node scripts/prune-out.js && npm run check:out`. `prune-out.js` no figura en el design |
| §16 #4 marcador `__WEB_CV_MOCK__` | ✅ | |
| §16 #5 contrato en `apps/web/docs/` | ✅ | |
| §16 #6 solo 404 → `/404.html`, 403 nunca | ✅ | |
| §16 #7 Disponibilidad = `getMe().availability` | ✅ | `getMe` se llama una vez |
| §16 #9 token en `#token=` | ✅ | Solo `useMagicLinkToken.ts` lee `location.hash` (rg + `token-guard.test.ts`); sin `useSearchParams` ni `Suspense` |
| Logout → `/` (§8, 2026-10-21) | ✅ | `RecruiterZone.tsx:114 router.replace('/')`; guard/descarga/playground sin sesión → `/acceso/` (como pide la spec) |
| Breakpoint de header 900 px (§5) | ✅ | Solo `SiteHeader.module.css` y `MobileMenu.module.css`; `header-breakpoint.test.ts`, `breakpoints.test.ts` |
| 6 PRs con `size:exception` | ⚠️ | Los cuerpos de los PRs declaran `size:exception`, pero no hay etiqueta (el repo no la tiene). Tamaño real sin lockfile ≈ +1,8k a +3k por PR, frente a ~600–790 estimadas (PR A +9175/−3307 con lockfile) |
| `safeUrl` solo https | ✅ | `isNavigableUrl` acepta solo `https:` y rechaza `http:`. La nota de tasks (PR 10) y el nombre del test dicen "http(s)" |
| Allowlist del playground | ✅ (ubicación desviada) | `src/lib/api/playground-endpoints.ts`, validada en runtime por los dos adaptadores (registrado en tasks, nota F) |
| Fuentes `next/font/google` | ⚠️ | Se cumple la spec (no hay Google en `out/`), pero el build offline sin caché falla. Tarea 2.1: "pendiente de decisión de la usuaria" sobre `next/font/local`, sin cerrar |

Partes de `design.md` que no reflejan el código final:
- §2: el árbol todavía muestra `features/recruiter/playground/endpoints.ts`.
- §8: `ResponseViewer` como `<pre aria-live>`. El código usa una región `role="status"` persistente.
- §9: `period: {start,end}`. En el código es una etiqueta de texto.
- §4: el script `build` y `preview`/`serve-out.js` no figuran.
- §13 y §15: siguen con el plan de 12 PRs y la decisión pendiente.
- "Preguntas abiertas #2" sigue `[ ]`.
- §16: la fila #9 tiene 4 celdas en una tabla de 5.

## 6. Seguridad (muestreo)

| Chequeo | Resultado |
|---------|-----------|
| `fetch(` solo en `src/lib/api/http.ts` | ✅ (`http.ts:109`; `fetch-guard.test.ts`) |
| Token solo desde `location.hash` | ✅ (`useMagicLinkToken.ts:44`; `location.search` no se lee) |
| Allowlist del playground | ✅ (`http.ts:205`, `mock/index.ts:44`; fuera de la lista → `unexpected` sin fetch) |
| `safeUrl` solo https | ✅ (rechaza `http:`, `javascript:`, `data:`) |
| Secretos | ✅ `scan-secrets.sh` clean; `gitleaks git` sin hallazgos (52 commits) |
| Mock fuera de producción | ✅ build http limpio; build mock bloqueado por `check-out` |

## 7. Hallazgos

### CRITICAL
1. **Falta la evidencia TDD en `apply-progress` (proceso, no código).** La obs #687 (rev 13) dice ser acumulativa ("Rev 12 content retained"), pero solo trae el delta de la rev 13. No existe la tabla "TDD Cycle Evidence" de las unidades 1–12, que strict-tdd-verify exige. Se resuelve sin tocar código: reconstruir y volver a guardar `sdd/frontend-site/apply-progress` con la evidencia por unidad (desde el historial de sesiones o los PRs), o que la usuaria acepte de forma explícita una excepción registrada.

### WARNING
1. Spec vs. código en "Controles exclusivos del mock › Visibles en mock": la spec pide los dos controles en sent y en done, y el código pone uno en cada estado. Hay que actualizar la spec (o el código).
2. La guarda de contenido no cubre "fechas de disponibilidad" (`src/test/contentRules.ts`), aunque la spec lo exige.
3. "Refresh recupera la sesión" solo se prueba a nivel de adaptador. Falta un test que renderice la zona con `createHttpGateway` y un `fetch` fake.
4. `tasks.md`: los 6 CIERRE (7.7, 8.6, 9.5, 10.6, 11.4, 12.8) siguen sin marcar aunque el orquestador los cerró.
5. `design.md` no está reconciliado con el código final (lista en §5).
6. El tamaño real de los PRs quedó entre 2,5 y 4 veces lo estimado. `size:exception` figura en los cuerpos, sin etiqueta.
7. Decisión de fuentes sin cerrar: `next/font/google` impide el build offline (tarea 2.1).
8. Ramas sin cubrir en `Hero.tsx` (50 %).
9. Aserciones sobre clases CSS en `Button.test.tsx` y `LinkButton.test.tsx`.

### SUGGESTION
1. Agregar a `check-out.js` un chequeo de que hay al menos un `.woff2` (hoy solo se verificó a mano).
2. Fijar con un test el alto táctil de 44 px del botón y los enlaces del menú móvil.
3. En "Disponibilidad", afirmar que el valor de prueba no aparece en `src/` fuera de los tests.
4. Podar o documentar `out/_not-found/index.html` (página de error duplicada accesible en `/_not-found/`).
5. README de `apps/web`: "next build + check:out" omite `prune-out.js`.
6. Unificar la redacción "http(s)" → "https" en la nota de tasks (PR 10) y en el nombre del test de `RecruiterZone`.
7. Aclarar en design §8 que "sesión expirada termina en `/`" aplica solo al flujo de logout.
8. Considerar incluir `app/**` en `collectCoverageFrom`.

## 8. Veredicto

**FAIL (proceso)**: 1 CRITICAL que no es de código (falta la evidencia TDD en `apply-progress`), 9 WARNING y 8 SUGGESTION.
El código cumple: 67/71 escenarios PASS, 4 PARTIAL, 0 FAIL; todos los comandos en verde; cobertura 98–100 %; build y `check-out` OK; seguridad limpia. Restaurando la evidencia (o aceptando la excepción) y atendiendo los WARNING de documentación (1, 4 y 5), el cambio queda listo para `sdd-archive`.

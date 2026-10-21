# web-public-pages

## Purpose

Capacidad nueva. Define qué debe ser verdad en `apps/web` para las páginas públicas (Inicio, Experiencia, 404), la navegación compartida, los tokens de diseño, la accesibilidad y las guardas de contenido. Referencia visual: `Diseño/html/`.

Origen: change `frontend-site` (archivado el 2026-10-21, ver `openspec/changes/archive/2026-10-21-frontend-site/archive-report.md`).

## Requirements

### Requirement: Rutas públicas exportadas

El build MUST generar en `apps/web/out/` un `index.html` por cada ruta `/`, `/experiencia/`, `/acceso/`, `/acceso/verificar/` y `/reclutador/`, además de `404.html` en la raíz. La página 404 MUST existir como ruta `not-found` y MUST ofrecer un enlace de vuelta a `/`.

#### Scenario: El build produce una página por ruta

- GIVEN el código de `apps/web` en estado limpio
- WHEN se ejecuta `npm run build -w apps/web`
- THEN existen `out/index.html`, `out/experiencia/index.html`, `out/acceso/index.html`, `out/acceso/verificar/index.html`, `out/reclutador/index.html` y `out/404.html`

#### Scenario: La página 404 permite volver

- GIVEN la página `not-found` renderizada con RTL
- WHEN se consulta el enlace principal
- THEN existe un enlace con `href="/"` accesible por nombre

### Requirement: Navegación compartida idéntica

Todas las páginas públicas MUST usar el mismo componente `SiteHeader` con exactamente estos ítems, en este orden: "Experiencia" (`/experiencia/`), "Proyectos" (`/#proyectos`), "Stack" (`/#stack`), "Cómo está hecha" (`/#como`) y "Acceso reclutadores" (`/acceso/`). El ítem de la ruta actual MUST llevar `aria-current="page"` y los demás MUST NOT llevarlo. La variante mínima (login) y la de sesión (reclutador) MAY reducir los ítems pero MUST conservar el logo enlazado a `/`.

#### Scenario: La nav es igual en Inicio y Experiencia

- GIVEN `Inicio` y `Experiencia` renderizadas por separado
- WHEN se extraen los textos y `href` de los enlaces de la nav principal
- THEN ambas listas son idénticas y tienen los cinco ítems en el orden definido

#### Scenario: La ruta actual se marca

- GIVEN la ruta `/experiencia/`
- WHEN se renderiza `SiteHeader`
- THEN solo el enlace "Experiencia" tiene `aria-current="page"`

### Requirement: Menú móvil accesible

`SiteHeader` MUST ofrecer un botón de menú con `aria-expanded` (reflejando el estado) y `aria-controls` apuntando al id del panel de navegación. Presionar Escape con el menú abierto MUST cerrarlo y devolver el foco al botón. El botón y los enlaces MUST tener alto táctil mínimo de 44 px. Este es uno de los pocos Client Components permitidos.

#### Scenario: Abrir y cerrar con teclado

- GIVEN el menú cerrado (`aria-expanded="false"`)
- WHEN se activa el botón y luego se presiona Escape
- THEN `aria-expanded` pasa a `"true"` y después a `"false"`, y `document.activeElement` es el botón

#### Scenario: aria-controls resuelve

- GIVEN `SiteHeader` renderizado
- WHEN se lee `aria-controls` del botón
- THEN existe en el DOM un elemento con ese id

### Requirement: Enlace para saltar al contenido y foco visible

Cada página MUST incluir como primer elemento enfocable un enlace "Saltar al contenido" hacia `#contenido`, y el `<main>` MUST tener `id="contenido"`. Todos los elementos interactivos MUST mostrar un indicador de foco visible definido por CSS (`:focus-visible`).

#### Scenario: El skip link es el primer foco

- GIVEN cualquier página pública renderizada
- WHEN se presiona Tab una vez
- THEN el foco está en el enlace "Saltar al contenido" con `href="#contenido"`

#### Scenario: Existe el destino

- GIVEN cualquier página pública
- WHEN se consulta `#contenido`
- THEN existe exactamente un elemento `main` con ese id

### Requirement: Tokens de diseño como única fuente de color

Los valores de color, tipografía y radios MUST definirse en `src/styles/tokens.css` como custom properties con los valores de `exploration.md` §3.2. Los `.module.css`, `globals.css` y los componentes TSX MUST NOT contener literales de color (`#rgb`, `#rrggbb`, `rgb()`, `hsl()`) fuera de `tokens.css`; los colores MUST consumirse con `var(--color-*)`. El resaltado JSON de `CodeWindow` MUST usar los tokens `--color-green` y `--color-code-string`.

#### Scenario: No hay colores literales fuera de tokens

- GIVEN todos los `*.css` y `*.tsx` bajo `apps/web/src` salvo `styles/tokens.css`
- WHEN un test (o regla de lint) busca patrones de color literal
- THEN el número de coincidencias es 0

#### Scenario: Los tokens existen

- GIVEN `tokens.css`
- WHEN se parsean sus custom properties
- THEN están definidos los 16 tokens `--color-*` de la tabla de la exploración

### Requirement: Contraste de pares de tokens

Un test unitario MUST calcular la razón de contraste WCAG de los pares de tokens usados y fallar si el texto queda bajo 4.5:1 o los elementos de UI (bordes de input, botón secundario) bajo 3:1. Como mínimo MUST cubrir: blanco sobre `--color-accent`; `--color-accent` sobre `--color-bg`; `--color-muted` sobre `--color-bg`; `--color-ink-2` sobre `--color-surface`; `--color-on-dark`, `--color-on-dark-2` y `--color-on-dark-muted` sobre `--color-ink`; `--color-green` sobre `--color-ink`; `--color-border-strong` sobre `--color-surface` (UI, 3:1). Los valores MUST leerse de `tokens.css`, no duplicarse en el test.

#### Scenario: Todos los pares cumplen

- GIVEN los pares listados leídos de `tokens.css`
- WHEN corre el test de contraste
- THEN cada par de texto es >= 4.5 y cada par de UI es >= 3

#### Scenario: Un token degradado rompe el build

- GIVEN `--color-accent` cambiado a un valor que da 4.4:1 sobre `--color-bg`
- WHEN corre `npm test -w apps/web`
- THEN el test de contraste falla y nombra el par infractor

### Requirement: Accesibilidad automática por página

Cada página (`Inicio`, `Experiencia`, `404`) y cada estado del login y de la zona reclutador MUST pasar `jest-axe` con 0 violaciones. Cada página MUST tener un único `h1`, `lang="es"` en `<html>` y un `<title>` propio.

#### Scenario: jest-axe sin violaciones

- GIVEN cada página pública renderizada con RTL
- WHEN se ejecuta `axe(container)`
- THEN `toHaveNoViolations()` se cumple

#### Scenario: Un solo h1

- GIVEN cualquier página renderizada
- WHEN se cuentan los elementos `h1`
- THEN el conteo es 1

### Requirement: Fuentes autoalojadas

Las fuentes IBM Plex Sans (400/600/700) e IBM Plex Mono (400/500) MUST cargarse con `next/font` (`google` o `local`) y MUST NOT solicitarse a terceros en tiempo de ejecución. Ningún archivo bajo `out/` MUST contener la cadena `fonts.googleapis.com` ni `fonts.gstatic.com`.

#### Scenario: El output no referencia Google Fonts

- GIVEN `out/` generado por `next build`
- WHEN se busca `fonts.googleapis.com` y `fonts.gstatic.com` en todos los `.html`, `.css` y `.js`
- THEN no hay coincidencias

#### Scenario: Las fuentes se sirven desde el propio build

- GIVEN `out/_next/static/`
- WHEN se listan los archivos `.woff2`
- THEN hay al menos uno

### Requirement: Contenido honesto y consistente

El contenido MUST vivir en módulos TS tipados bajo `src/content/`. La copia MUST respetar:

- Donde aparezca Kafka, el texto MUST decir "Kafka en local / SQS en producción".
- AWS MUST presentarse como "aprendiendo, aplicado en este proyecto", sin nivel avanzado ni en producción.
- Los chips de la sección "Cómo está hecha" MUST enlazar `/api/docs` y `/api/health` (no `/api-docs`, `/status` ni `#como`).
- El pie MUST mostrar "María José Tolmo Tolmo".
- Los nombres de empleadores (Accenture, Kabeli, Amecs) y "Banco Itaú" MAY aparecer (excepción registrada en el brief).
- El Inicio y la zona reclutador MUST NOT mostrar un botón de descarga Word ni una tarjeta "Agendar entrevista".

#### Scenario: Kafka siempre acompañado de SQS

- GIVEN el HTML renderizado de todas las páginas públicas
- WHEN aparece la palabra "Kafka"
- THEN el mismo bloque de texto contiene "Kafka en local / SQS en producción"

#### Scenario: Los chips apuntan a rutas reales

- GIVEN la sección "Cómo está hecha"
- WHEN se leen los enlaces de los chips
- THEN existen enlaces con `href="/api/docs"` y `href="/api/health"`, y ninguno con `/api-docs` ni `/status`

#### Scenario: AWS sin inflar

- GIVEN el contenido de `src/content/` y el HTML renderizado
- WHEN se busca la mención de AWS en el stack
- THEN aparece en la categoría "Aprendiendo" con el texto "aprendiendo, aplicado en este proyecto"

#### Scenario: Pie con el nombre correcto

- GIVEN `Footer` renderizado
- WHEN se consulta su texto
- THEN contiene "María José Tolmo Tolmo"

### Requirement: Guardas de contenido

Un test de guardas MUST fallar si bajo `apps/web` (excluyendo `node_modules`, `.next` y `out`) existe cualquier archivo `.pdf` o `.docx`, o si algún archivo de código o contenido incluye cifras de renta o disponibilidad concretas (patrones monetarios como `CLP`, `$` seguido de dígitos, `\d+\.?\d*\s?(millones|MM)` y fechas de disponibilidad). Los datos de renta, disponibilidad y CV MUST llegar únicamente por la API; el mock MUST usar placeholders explícitos (por ejemplo "Dato de ejemplo").

#### Scenario: Sin archivos de CV

- GIVEN el árbol de `apps/web`
- WHEN el test recorre los archivos
- THEN no hay archivos `.pdf` ni `.docx`

#### Scenario: Sin cifras de renta

- GIVEN `src/**` y los fixtures del mock
- WHEN el test aplica los patrones prohibidos
- THEN hay 0 coincidencias y los valores del mock son placeholders

#### Scenario: La guarda detecta una infracción

- GIVEN un archivo temporal `src/content/x.ts` con una cifra de renta
- WHEN corre el test de guardas
- THEN el test falla señalando ese archivo

### Requirement: Inventario de secciones del Inicio y Experiencia

`Inicio` MUST contener, en orden: hero (eyebrow, h1, lead, dos CTAs, tarjeta con `GET /api/v1/profile`), "Lo que aporto", "Stack" (4 columnas), "Proyectos", "Cómo está hecha", banda CTA y pie. `Experiencia` MUST contener línea de tiempo de 5 ítems, Formación y banda CTA. La tarjeta del hero MUST estar rotulada como ejemplo o coincidir con el contrato real de la API. Cada sección MUST tener el id de ancla usado por la nav (`proyectos`, `stack`, `como`).

#### Scenario: Anclas de la nav existen

- GIVEN `Inicio` renderizada
- WHEN se buscan `#proyectos`, `#stack` y `#como`
- THEN los tres elementos existen

#### Scenario: Línea de tiempo completa

- GIVEN `Experiencia` renderizada
- WHEN se cuentan los ítems de la línea de tiempo
- THEN son 5

### Requirement: Peso del cliente

Solo el menú móvil, el login/verificación, la zona reclutador y el playground MUST ser Client Components (`"use client"`); las páginas públicas MUST ser síncronas. Inicio y Experiencia MUST NOT depender de la API para renderizar.

#### Scenario: Límite de Client Components

- GIVEN los archivos bajo `apps/web/src` con la directiva `"use client"`
- WHEN un test los lista
- THEN pertenecen únicamente al menú móvil, al login/verificación, a la zona reclutador y al playground

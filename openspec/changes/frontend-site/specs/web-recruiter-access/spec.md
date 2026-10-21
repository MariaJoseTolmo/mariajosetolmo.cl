# Especificación delta: web-recruiter-access

Capacidad NUEVA. Define el acceso de reclutadores en `apps/web`: login con magic link, verificación, zona reclutador, puerto `ApiGateway` y modo mock. Los endpoints reales los entrega el cambio de auth; aquí se fija el comportamiento del cliente.

## ADDED Requirements

### Requirement: Formulario de login

`/acceso/` MUST mostrar un formulario con los campos `email` (obligatorio, validado como correo), `empresa` (opcional) y `nombre` (opcional), cada uno con `<label>` asociado. Un `email` vacío o inválido MUST mostrar un error accesible (`role="alert"` o `aria-describedby`) y MUST NOT llamar al gateway. Un envío válido MUST llamar a `ApiGateway.requestMagicLink({ email, company?, name? })`, omitiendo los opcionales vacíos.

#### Scenario: Email inválido no envía

- GIVEN el formulario vacío
- WHEN la usuaria escribe "no-es-correo" y envía
- THEN aparece un mensaje de error y `requestMagicLink` no fue invocado

#### Scenario: Validación al salir del campo

- GIVEN el campo `email` con un valor no vacío e inválido
- WHEN la usuaria sale del campo (blur)
- THEN el sistema MUST mostrar el mismo mensaje de error "inválido" que al enviar, con `aria-invalid="true"` y `aria-describedby` apuntando al mensaje
- AND el sistema MUST NOT mover el foco
- AND un `email` vacío al salir del campo MUST NOT mostrar el error "vacío" (solo se reporta al enviar)
- AND mientras el error esté visible, el sistema MUST revalidar en cada cambio y MUST quitar el error en cuanto el valor sea válido, sin esperar otro blur
- AND el sistema SHOULD anunciar el error solo cuando aparece por primera vez, no en cada tecla

#### Scenario: Envío con opcionales vacíos

- GIVEN `email` válido y `empresa`/`nombre` vacíos
- WHEN se envía
- THEN `requestMagicLink` recibe solo `{ email }`

#### Scenario: Envío con todos los campos

- GIVEN `email`, `empresa` y `nombre` completos
- WHEN se envía
- THEN `requestMagicLink` recibe `{ email, company, name }`

### Requirement: Estado "enviado" idéntico

Tras el envío MUST mostrarse siempre el mismo estado "sent" (mismo texto y estructura) sin importar si el correo existe, si el gateway respondió éxito o si falló con un error no accionable para la usuaria (excepto errores de red, que MUST permitir reintentar). La UI MUST NOT revelar si el correo está registrado.

#### Scenario: Respuestas distintas, misma UI

- GIVEN un gateway que resuelve con éxito y otro que responde 202 con cuerpo distinto
- WHEN se envía el formulario en cada caso
- THEN el HTML del estado "sent" es idéntico en ambos

#### Scenario: Estado sent accesible

- GIVEN el estado "sent" renderizado
- WHEN se ejecuta `axe`
- THEN hay 0 violaciones y el mensaje se anuncia con `role="status"` o `aria-live`

### Requirement: Puerto ApiGateway con dos adaptadores

El acceso a la API MUST pasar por el puerto `ApiGateway` (TypeScript, `src/lib/api/`), con adaptadores `http` y `mock`. `NEXT_PUBLIC_API_MODE` (`http` | `mock`) MUST decidir el adaptador en build. Los componentes MUST depender del puerto, no de `fetch` directo. El puerto MUST cubrir exactamente: `requestMagicLink`, `verifyToken`, `getMe`, `getCvLink`, `logout` y `call` (consultas del playground). La renovación de sesión (`POST /api/auth/refresh`) MUST NOT formar parte del puerto: es responsabilidad interna del adaptador `http`, que MUST compartir una sola petición de refresh entre llamadas concurrentes. El adaptador `http` MUST usar rutas relativas (same-origin) con `credentials: 'same-origin'`.

#### Scenario: Componentes sin fetch directo

- GIVEN los archivos bajo `apps/web/app`, `src/components` y `src/features`
- WHEN un test o regla de lint busca `fetch(`
- THEN no hay coincidencias fuera de `src/lib/api/http`

#### Scenario: Selección por variable de entorno

- GIVEN `NEXT_PUBLIC_API_MODE=mock`
- WHEN se crea el gateway
- THEN es una instancia del adaptador mock; con `http` es la del adaptador http

### Requirement: Página de verificación del magic link

`/acceso/verificar/` MUST leer el token únicamente del fragmento de la URL (`window.location.hash`, formato `#token=<token>`) y MUST NOT leerlo de la query string. Como el fragmento solo existe en el cliente, la lectura MUST ocurrir tras el montaje; en el primer render (y en el HTML prerenderizado) MUST mostrarse un estado neutral ("Cargando…") hasta la hidratación, sin mostrar aún el estado de enlace inválido. Justificación: el fragmento nunca llega a CloudFront, a sus logs ni a la cabecera `Referer`. Justo después de capturar el token, MUST eliminarlo de la URL con `history.replaceState` (vaciando el fragmento) sin recargar. MUST NOT consumir el token automáticamente: solo tras presionar "Confirmar ingreso" se invoca `ApiGateway.verifyToken(token)`. Si no hay token en el fragmento, MUST mostrar un estado de enlace inválido con enlace a `/acceso/`. Tras éxito MUST mostrar el estado "done" con enlace a `/reclutador/`. Para leer el token MUST NOT requerirse `useSearchParams` ni `<Suspense>`.

#### Scenario: Token en el fragmento, capturado y borrado

- GIVEN la URL `/acceso/verificar/#token=abc`
- WHEN la página monta
- THEN el token `abc` queda disponible en memoria y `window.location.hash` queda vacío (la URL pasa a `/acceso/verificar/`)

#### Scenario: Estado neutral en el primer render

- GIVEN la página aún no hidratada
- WHEN se renderiza por primera vez
- THEN se muestra un estado neutral y no el estado de enlace inválido

#### Scenario: Sin auto-consumo

- GIVEN la página montada con un token
- WHEN transcurre el montaje y los efectos, sin interacción
- THEN `verifyToken` no fue invocado

#### Scenario: Confirmación explícita

- GIVEN la página con un token en memoria
- WHEN se hace clic en "Confirmar ingreso"
- THEN `verifyToken` se invoca una vez con ese token y se muestra el estado "done" con enlace a `/reclutador/`

#### Scenario: Sin token

- GIVEN la URL `/acceso/verificar/` sin fragmento
- WHEN la página monta
- THEN se muestra el estado de enlace inválido con enlace a `/acceso/` y `verifyToken` no se invoca

#### Scenario: Token en la query string se ignora

- GIVEN la URL `/acceso/verificar/?token=abc` sin fragmento
- WHEN la página monta
- THEN el token NO se lee, se muestra el estado de enlace inválido y `verifyToken` no se invoca

### Requirement: Guard de sesión en la zona reclutador

`/reclutador/` MUST llamar a `ApiGateway.getMe()` (`GET /api/v1/me`) al montar y MUST mostrar el estado "Verificando sesión" (con `role="status"`) hasta resolver; durante ese estado MUST NOT renderizar el contenido protegido. Ante 401, el adaptador `http` MUST intentar una única vez `POST /api/auth/refresh` y repetir `GET /api/v1/me`; si vuelve a fallar, `getMe` MUST resolver con el error `unauthorized` y la página MUST redirigir a `/acceso/`. Con 200 MUST renderizar la zona. Un error de red o de servidor MUST NOT redirigir: MUST mostrar un error con opción de reintentar.

#### Scenario: Estado de verificación

- GIVEN `getMe` pendiente
- WHEN se renderiza `/reclutador/`
- THEN se ve "Verificando sesión" y no existen las tarjetas

#### Scenario: Un solo refresh

- GIVEN un `fetch` fake donde `GET /api/v1/me` responde siempre 401 y `POST /api/auth/refresh` responde 200
- WHEN el adaptador `http` ejecuta `getMe()`
- THEN `fetch` recibe exactamente un `POST /api/auth/refresh` y dos `GET /api/v1/me`, y el resultado es el error `unauthorized`

#### Scenario: Refresh recupera la sesión

- GIVEN un `fetch` fake donde `GET /api/v1/me` responde 401 y, tras el refresh, 200
- WHEN se renderiza la página con el adaptador `http`
- THEN se muestra la zona reclutador y no hay redirección

#### Scenario: Sin sesión

- GIVEN un gateway cuyo `getMe` resuelve con el error `unauthorized`
- WHEN se renderiza la página
- THEN se llama al router con `/acceso/`

#### Scenario: Error de red no cierra la sesión

- GIVEN un gateway cuyo `getMe` resuelve con el error `network`
- WHEN se renderiza la página
- THEN no hay redirección y existe un botón "Reintentar"

### Requirement: Tres tarjetas y saludo

La zona reclutador MUST mostrar exactamente tres tarjetas: "CV completo", "Contacto directo" y "Disponibilidad". "CV completo" MUST ofrecer solo la acción "Descargar PDF" (sin Word). "Disponibilidad" MUST mostrar el campo `availability` de la respuesta de `getMe()` (nunca embebido en el repo) y MUST NOT hacer una petición adicional. La zona MUST NOT incluir una tarjeta "Agendar entrevista" ni la acción "Proponer horario". El saludo MUST seguir esta prioridad: con empresa, "Gracias por tu interés, equipo de {empresa}"; si no, con nombre, "Gracias por tu interés, {nombre}"; si no, "Gracias por tu interés".

#### Scenario: Tres tarjetas exactas

- GIVEN la zona renderizada con sesión válida
- WHEN se listan los encabezados de tarjeta
- THEN son "CV completo", "Contacto directo" y "Disponibilidad", y no existen "Agendar" ni "Word"

#### Scenario: Solo descarga PDF

- GIVEN la tarjeta "CV completo"
- WHEN se listan sus acciones
- THEN hay una sola, "Descargar PDF", y ninguna con texto "Word" o ".docx"

#### Scenario: Disponibilidad viene de la API

- GIVEN `getMe` que devuelve un `availability` de prueba
- WHEN se renderiza la tarjeta
- THEN muestra ese valor y el código fuente de `src/` no lo contiene

#### Scenario: Saludo por prioridad

- GIVEN perfiles `{company:"Acme", name:"Ana"}`, `{name:"Ana"}` y `{}`
- WHEN se renderiza el saludo en cada caso
- THEN los textos son "Gracias por tu interés, equipo de Acme", "Gracias por tu interés, Ana" y "Gracias por tu interés"

### Requirement: API Playground

La zona MUST incluir un playground con cinco endpoints: `/api/v1/profile`, `/api/v1/experience?limit=2`, `/api/v1/skills?level=advanced`, `/api/v1/me` y `/api/v1/admin/visits`. Cada botón de endpoint MUST exponer `aria-pressed` (true solo en el seleccionado). Seleccionar un endpoint MUST mostrar su respuesta en un bloque de código. `/api/v1/admin/visits` MUST mostrar un 403 cuando el rol es RECRUITER.

#### Scenario: Cinco endpoints con aria-pressed

- GIVEN el playground renderizado
- WHEN se cuentan los botones de endpoint
- THEN son 5 y exactamente uno tiene `aria-pressed="true"`

#### Scenario: Cambio de selección

- GIVEN el endpoint por defecto seleccionado
- WHEN se hace clic en `/api/v1/skills?level=advanced`
- THEN ese botón pasa a `aria-pressed="true"`, el anterior a `"false"` y el bloque muestra su respuesta

#### Scenario: 403 en admin

- GIVEN un usuario con rol RECRUITER
- WHEN se selecciona `/api/v1/admin/visits`
- THEN el bloque muestra estado 403

### Requirement: Controles exclusivos del mock

Los controles "Simular: abrir el enlace" y "Reiniciar demo" MUST existir solo con `NEXT_PUBLIC_API_MODE=mock`. Con `http` los controles MUST NOT estar en el DOM ni en el código del bundle.

#### Scenario: Visibles en mock

- GIVEN `NEXT_PUBLIC_API_MODE=mock`
- WHEN se renderiza el estado "sent" del login
- THEN el control "Simular: abrir el enlace" MUST existir
- AND "Reiniciar demo" MUST NOT existir en ese estado
- WHEN se renderiza el estado "done" de la verificación
- THEN el control "Reiniciar demo" MUST existir
- AND "Simular: abrir el enlace" MUST NOT existir en ese estado

#### Scenario: Ausentes en http

- GIVEN `NEXT_PUBLIC_API_MODE=http`
- WHEN se renderizan los estados "sent" y "done"
- THEN "Simular: abrir el enlace" y "Reiniciar demo" MUST NOT existir en el DOM ni en el build

### Requirement: El mock no llega a producción

El build con `NEXT_PUBLIC_API_MODE=http` MUST NOT incluir código ni datos del adaptador mock en `out/`. El adaptador mock MUST exportar el marcador único `__WEB_CV_MOCK__` e incluirlo en un dato que use en tiempo de ejecución (la respuesta de `getMe`), para que el minificador no lo elimine. El script `check:out` (ver `web-delivery-contract`) MUST fallar si encuentra en `out/**/*.js` o `out/**/*.html` la cadena `__WEB_CV_MOCK__` o las cadenas "Simular: abrir el enlace" y "Reiniciar demo".

#### Scenario: Build http limpio

- GIVEN `NEXT_PUBLIC_API_MODE=http npm run build -w apps/web`
- WHEN el test recorre `out/**/*.js` y `out/**/*.html`
- THEN no hay coincidencias de los marcadores del mock

#### Scenario: Detección de fuga

- GIVEN un build con el mock importado estáticamente por error
- WHEN corre el test
- THEN falla indicando el archivo con el marcador

### Requirement: Sin datos personales en el cliente

Disponibilidad, renta y la URL del CV MUST obtenerse siempre de la API; el mock MUST usar datos falsos claramente marcados. El módulo `http` MUST aislar en un solo lugar cualquier cabecera específica del origen (por ejemplo `x-amz-content-sha256` si aplica el Plan B).

#### Scenario: Fixtures falsos

- GIVEN los fixtures del adaptador mock
- WHEN se inspeccionan
- THEN usan valores placeholder (por ejemplo "Dato de ejemplo") y pasan el test de guardas de `web-public-pages`

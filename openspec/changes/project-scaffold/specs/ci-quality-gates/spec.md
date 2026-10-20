# Especificación delta: ci-quality-gates

Capacidad nueva. Define el workflow de CI, sus permisos y pines, el escaneo de secretos, Dependabot, los checks requeridos y la activación de strict TDD.

## ADDED Requirements

### Requirement: Disparadores del workflow

`.github/workflows/ci.yml` MUST dispararse con `pull_request` y con `push` a `main`. El workflow MUST NOT usar `pull_request_target`.

#### Scenario: Triggers correctos
- GIVEN `.github/workflows/ci.yml`
- WHEN se inspecta la clave `on`
- THEN contiene `pull_request` y `push` con rama `main`
- AND no contiene `pull_request_target` en ninguna parte del archivo

### Requirement: Permisos mínimos

El workflow MUST declarar `permissions: contents: read` a nivel de workflow. Ningún job MAY ampliar permisos salvo justificación documentada.

#### Scenario: Permisos de solo lectura
- GIVEN `ci.yml`
- WHEN se lee el bloque `permissions` de nivel raíz
- THEN es exactamente `contents: read`

### Requirement: Acciones fijadas por SHA

Cada `uses:` de una acción de terceros o de GitHub MUST referenciar un commit SHA completo de 40 caracteres seguido de un comentario con la versión (por ejemplo `# v7.0.1`). Los tags móviles (`@v4`, `@main`) MUST NOT usarse.

#### Scenario: Todos los `uses` pineados
- GIVEN `ci.yml`
- WHEN se evalúa cada línea `uses:` con la expresión `@[0-9a-f]{40}\s+#\s+v\d`
- THEN todas las líneas coinciden

### Requirement: Job `quality`

El job `quality` MUST usar `actions/setup-node` con `node-version-file: .nvmrc` y `cache: npm`, instalar con `npm ci` y ejecutar, en este orden de intención: ESLint, `prettier --check`, typecheck (`tsc --noEmit`), tests unitarios y tests e2e. Cualquier paso fallido MUST hacer fallar el job.

#### Scenario: Código válido
- GIVEN un PR sin errores de lint, formato, tipos ni tests
- WHEN corre el workflow
- THEN el job `quality` termina en éxito

#### Scenario: Error de lint bloquea
- GIVEN un PR con un import prohibido entre capas
- WHEN corre el workflow
- THEN el job `quality` falla en el paso de lint

#### Scenario: Caché npm activa
- GIVEN una segunda ejecución del workflow sin cambios en el lockfile
- WHEN `actions/setup-node` restaura la caché
- THEN el log reporta un cache hit de npm

### Requirement: Job `secrets`

El job `secrets` MUST descargar el binario gitleaks CLI v8.30.1, verificar su checksum SHA-256 antes de ejecutarlo y escanear el historial completo (`actions/checkout` con `fetch-depth: 0`). El job MUST NOT depender de `gitleaks-action`. Un hallazgo MUST hacer fallar el job.

#### Scenario: Checksum inválido
- GIVEN un binario descargado cuyo SHA-256 no coincide con el esperado
- WHEN el job verifica el checksum
- THEN el job falla antes de ejecutar gitleaks

#### Scenario: Secreto en el historial
- GIVEN un commit anterior en el historial con un secreto detectable
- WHEN corre el job `secrets`
- THEN el job falla y reporta el hallazgo

#### Scenario: Historial limpio
- GIVEN un repo sin secretos
- WHEN corre el job `secrets`
- THEN el job termina en éxito tras escanear todo el historial

### Requirement: Dependabot

`.github/dependabot.yml` MUST configurar los ecosistemas `npm` y `github-actions` con frecuencia semanal. Para `typescript` MUST ignorar las actualizaciones de versión major 7 (`update-types: version-update:semver-major`).

#### Scenario: Configuración de ecosistemas
- GIVEN `.github/dependabot.yml`
- WHEN se lee la lista `updates`
- THEN contiene `package-ecosystem: npm` y `package-ecosystem: github-actions`

#### Scenario: TypeScript 7 bloqueado
- GIVEN la entrada `npm`
- WHEN se inspecta la sección `ignore`
- THEN existe una regla para `typescript` que ignora major

### Requirement: Checks requeridos en `protect-main`

Los checks `quality` y `secrets` MUST estar configurados como requeridos en el ruleset `protect-main`. Debe hacerse después de que el workflow exista en `main`, mediante paso manual documentado o `gh api` con confirmación previa de la usuaria. Antes de revertir el PR de CI, los checks MUST retirarse del ruleset.

#### Scenario: Checks requeridos activos
- GIVEN el ruleset `protect-main` actualizado
- WHEN se consulta con `gh api repos/{owner}/{repo}/rulesets`
- THEN la regla `required_status_checks` incluye `quality` y `secrets`

#### Scenario: Merge bloqueado
- GIVEN un PR con `quality` en rojo
- WHEN se intenta hacer merge
- THEN GitHub bloquea el merge

### Requirement: Strict TDD activado

Al final del cambio, `openspec/config.yaml` MUST tener `strict_tdd: true` (y `tdd: true` en `apply`), comandos reales de test y build, `linter: eslint`, `type_checker: tsc --strict`, `formatter: prettier`, y MUST eliminar `strict_tdd_note`. Se MUST re-ejecutar `sdd-init` para actualizar `sdd-init/web_cv`.

#### Scenario: Configuración final
- GIVEN el PR 3 aplicado
- WHEN se lee `openspec/config.yaml`
- THEN `strict_tdd` es `true`
- AND `test_command` no está vacío
- AND `strict_tdd_note` no existe

#### Scenario: Orden de activación
- GIVEN `npm test` y `npm run test:e2e` en verde en CI
- WHEN se activa `strict_tdd`
- THEN la activación ocurre en el último PR del plan, no antes

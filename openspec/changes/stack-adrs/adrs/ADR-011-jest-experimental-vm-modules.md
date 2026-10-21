# ADR-011: Jest con `--experimental-vm-modules` para NestJS 12

| Campo | Valor |
|---|---|
| Estado | Aceptada |
| Fecha | 2026-10-20 |
| Relación con el CV | Jest en producción; el flag es la decisión nueva |

## Decisión

`apps/api` se mantiene en CommonJS con Jest 30 + ts-jest. Los scripts `test`, `test:cov` y `test:e2e` ejecutan `NODE_OPTIONS=--experimental-vm-modules jest`. Build, dev y runtime no usan el flag.

## Contexto y problema

Nest 12 publica sus paquetes solo como ESM (`@nestjs/core` declara `"type": "module"`). Una app CommonJS los carga con `require(esm)`, pero Jest necesita `vm.SourceTextModule` para hacerlo, y eso solo existe con el flag. Sin él, los tests no cargan Nest. La guía de migración indica que Jest funciona en Node 24.9+ o que se migre a Vitest.

## Alternativas consideradas

| Opción | Pros | Contras |
|---|---|---|
| **Jest + flag solo en scripts de test** | Jest está en el CV; ts-jest verifica tipos; cambio acotado a 3 scripts | Flag experimental de Node |
| Vitest + ESM (default de Nest 12) | Camino por defecto del framework | Fuera del CV (otro ADR); requiere `unplugin-swc` para metadata de decoradores; sin type-check en tests; imports `.js` y `nodenext` |
| Quedarse en Nest 11 | Evitaría el flag: los paquetes de Nest 11 no declaran `"type": "module"` (CommonJS; metadatos de `@nestjs/core@11.1.0` en npm). Evaluada con la usuaria en la compuerta de smoke test del 2026-10-20 (tarea 1.1 de project-scaffold) y **rechazada por empezar un proyecto nuevo en una versión mayor anterior** | Versión anterior en un proyecto nuevo; migración pendiente |
| Ruta fija a `node_modules/jest/bin/jest.js` | Sin `NODE_OPTIONS` | Se rompe si npm no eleva `jest` a la raíz |

## Consecuencias

- **Positivas:** se conserva el runner que domino; los tests verifican tipos; no se migra el proyecto a ESM.
- **Negativas:** dependencia de una API experimental de Node; Node fijado a `>=24.15.0 <25`.
- **Riesgos:** si Node o Jest cambian el comportamiento del flag, la contingencia es Vitest con su propio ADR. Si `apps/web` (`next/jest`) también necesita el flag: NO VERIFICADO.

## Relación con mi experiencia

Uso Jest en producción. El ADR no justifica Jest, sino el flag: es una decisión de compatibilidad tomada tras un smoke test, para no cambiar de herramienta por un detalle de empaquetado.

## Fuentes

- https://docs.nestjs.com/migration-guide
- https://docs.nestjs.com/migration-guide (verificado 2026-10-20: núcleo en ESM; una app CommonJS puede migrar a v12 sin pasar a ESM; Jest carga los paquetes ESM solo en Node 24.9+)
- https://registry.npmjs.org/@nestjs/core/latest
- https://registry.npmjs.org/@nestjs/core/11.1.0 (sin `"type": "module"`)
- `openspec/changes/project-scaffold/design.md` (decisión D1b y compuerta de smoke test)

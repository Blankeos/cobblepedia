# AGENTS.md

This file is the execution guide for AI agents working on Cobblepedia.

Primary product brief lives in `PRD.md`. Read it before coding.

## 1) Mission

Build a keyboard-first Cobblemon encyclopedia with a command-palette-first UX.

Core user flow to protect at all times:

1. Open site.
2. Press Cmd+K / Ctrl+K.
3. Ask compact queries (`lucario egg group`, `lucario moves`, `lucario spawn`, `lucario evolution`, `moves trickroom`).
4. Read quickview instantly.
5. Press Enter to navigate to Pokemon detail page.

## 2) Non-negotiables

- Do not hardcode Pokemon data in UI components.
- Do not scrape third-party websites as source of truth for data.
- Use official Cobblemon GitLab repository content as canonical source.
- Keep keyboard interaction first-class; mouse is secondary.
- Keep files in kebab-case unless framework-generated naming requires otherwise.

## 3) Source of Truth Paths (Cobblemon upstream)

Repository:

- `https://gitlab.com/cable-mc/cobblemon`

Required upstream paths:

- Species:
  - `common/src/main/resources/data/cobblemon/species/generation*/**/*.json`
- Spawns:
  - `common/src/main/resources/data/cobblemon/spawn_pool_world/*.json`
- Spawn presets:
  - `common/src/main/resources/data/cobblemon/spawn_detail_presets/*.json`
- Spawn rarity config:
  - `common/src/main/resources/data/cobblemon/spawning/best-spawner-config.json`
- Biome tags:
  - `common/src/main/resources/data/cobblemon/tags/worldgen/biome/*.json`
- Move metadata/text (zipped):
  - `common/src/main/resources/data/cobblemon/showdown.zip`
  - includes `data/moves.js`, `data/learnsets.js`, `data/text/moves.js`

## 4) Build Strategy (one-shot)

Prefer one cohesive implementation stream over large phased work.

Execution order:

1. Implement data generator + schemas.
2. Generate artifacts under `src/data/generated`.
3. Build query parser + search index usage.
4. Build command palette + hotkeys.
5. Build Pokemon page sections.
6. Validate acceptance queries and keyboard flow.

## 5) Tech and Component Guidance

Current app stack is Vike + Solid.

Palette/hotkey guidance:

- Hotkeys: use `bagon-hooks` (`useHotkeys` pattern from `devreference1/src/components/layouts/horizontal/horizontal-layout.context.tsx`).
- Command UI: use `cmdk-solid` with reusable command primitives.
- Reference implementation: `devreference1/src/components/ui/command.tsx`.

Do not copy full `devreference1` boilerplate blindly. Extract only required patterns/components.

## 6) Data Contract Requirements

Generated artifacts must include:

- metadata (upstream SHA and timestamp)
- lightweight searchable Pokemon index
- per-Pokemon detail payloads
- move -> learner index
- query-ready search docs

Generator must handle:

- moves prefixes (`level`, `egg`, `tm`, `tutor`, `legacy`, `special`, `form_change`)
- evolution variants and requirement variants
- spawn `weightMultiplier` and `weightMultipliers`
- spawn presets merge
- spawn aspect tokens in `pokemon` field

Unknown/unsupported fields should not silently disappear. Preserve raw where possible.

## 7) Query Parser Contract

Must support intents:

- Pokemon + facet:
  - egg group
  - moves
  - spawn
  - evolution
- move learners:
  - `moves <move-id-or-name>`

Required synonym mapping:

- `evolve`, `evolution`, `evo` -> evolution
- `move`, `moves` -> moves
- `egg group`, `egg groups` -> egg-group

Resolution order:

1. facet-first move intent
2. Pokemon+facet
3. Pokemon overview
4. fuzzy fallback

## 8) UX and Interaction Rules

- Cmd+K (Meta+K) and Ctrl+K both open palette.
- Escape always closes palette.
- Arrow keys navigate result list.
- Enter executes selected result.
- Enter on Pokemon result routes to `/pokemon/:slug`.
- Palette should remain useful with keyboard only.

## 9) Styling Rules

- Keep UI compact and intentional.
- Favor neutral, clean visual hierarchy over decorative noise.
- Prioritize readability and scan speed.
- Keep copy practical and concise.
- Do not mirror prompt adjectives as literal UI marketing copy.
- **Use Tailwind CSS classes only** - never create custom BEM-style CSS classes (e.g., `.pokemon-card`, `.stat-value`).
- Compose styles using Tailwind utility classes with the `cn()` helper.
- Keep custom CSS in `app.css` limited to: CSS variables, animations, and scrollbar utilities only.

### Tailwind CSS Setup

The project uses Tailwind CSS v4 with the following setup:

- Base configuration in `src/styles/app.css` with custom theme tokens and animations
- Kobalte UI components for accessible primitives (Dialog, etc.)
- Custom animations: `flyUpAndScale`, `fadeIn`, `flyUp`, etc.
- Utility classes defined via `@utility` in `app.css`

### Component Patterns

- Use `cn()` utility from `@/utils/cn` (combines clsx + tailwind-merge)
- Copy shadcn patterns from `devreference1/src/components/ui/` when needed
- Dialog components use Kobalte for accessibility and animations
- Command palette uses `cmdk-solid` wrapped in Dialog for proper animations

### Animation Guidelines

- Subtle, purposeful animations only (inspired by better-auth.com)
- Use existing animation tokens from `app.css`:
  - `--animate-flyUpAndScale` for dialogs
  - `--animate-fadeIn`/`--animate-fadeOut` for overlays
- Respect `prefers-reduced-motion` media query

## 10) Quality Bar

Must pass before completion:

- Type check (`bun run check`)
- Lint (`bun run lint`)
- Manual keyboard validation of all required queries

Acceptance query checklist:

- `lucario egg group`
- `lucario moves`
- `lucario spawn`
- `lucario evolve`
- `lucario evolution`
- `moves trickroom`

## 11) Browser QA Requirement

When validating UX interactions, use:

- `agent-browser --headed`

Validate:

- hotkey open/close
- keyboard navigation
- quickview correctness
- Enter navigation behavior

## 12) Backend/API Notes

Prefer static generated data for core encyclopedia features.

If API endpoints are added:

- keep them deterministic and read-only for data browsing
- follow existing server module structure
- avoid introducing unnecessary runtime coupling to upstream GitLab during request handling

## 13) Common Mistakes to Avoid

- Parsing only top-level species and ignoring `forms`.
- Treating numeric move prefix as unknown (it means level-up).
- Ignoring spawn presets when rendering spawn requirements.
- Dropping `anticondition` context from spawn rows.
- Shipping full heavy dataset eagerly to client.
- Forgetting Ctrl+K parity with Cmd+K.

## 14) Definition of Done

Done means all are true:

- PRD acceptance criteria pass.
- Data generation is reproducible and source-anchored.
- Keyboard-first UX works end-to-end.
- Pokemon page has moves, egg groups, spawns, evolution data.
- Lint and type checks pass.

## 15) Icon Management (iconmate)

Use `iconmate --help` to explore available commands.

### Recommended workflow for SolidJS components:

1. **Search** for icons: `iconmate iconify search <term>` (e.g., `iconmate iconify search arrow`)
2. **Add** with SolidJS preset: `iconmate add --preset=solid --folder src/assets/icons --name <Name> --icon <set:icon>`
   - Example: `iconmate add --preset=solid --folder src/assets/icons --name ArrowRight --icon lucide:arrow-right`

The `--preset=solid` flag generates proper SolidJS TSX components that work with the codebase. The command will:
- Generate a `.tsx` component file
- Automatically add the export to `src/assets/icons/index.ts`

For detailed help on a specific subcommand, run `iconmate <command> --help` (e.g., `iconmate iconify --help`).

## 16) Model Preview and Artwork Data

Model previews are required to be runtime-fetched (not stored in this repo).

- Cobblemon model source for previews:
  - `https://gitlab.com/cable-mc/cobblemon-assets/-/tree/master/blockbench/pokemon`
- Do not commit upstream model payloads (`.geo.json`, `.bbmodel`, texture PNGs) into this codebase.
- Render previews with `three.js`.
- Resolve and fetch assets dynamically for the currently viewed Pokemon.

PokeAPI sprite/art requirements:

- Use PokeAPI v1beta2 GraphQL endpoint: `https://graphql.pokeapi.co/v1beta2`
- Use `fetch` directly for GraphQL POST requests. Do **not** add a full GraphQL client dependency.
- Docs/explorer: `https://graphql.pokeapi.co/v1beta2/console/`
- Preferred art sprite path in response JSON:
  - `pokemon[0].pokemonsprites[0].sprites.other["official-artwork"].front_default`
- Recommended fallback order when artwork is missing:
  1. `sprites.other.home.front_default`
  2. `sprites.front_default`

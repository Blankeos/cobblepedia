# Cobblepedia PRD

Status: Draft -> Build-ready
Owner: Cobblepedia
Last updated: 2026-02-21
Product type: Keyboard-first Cobblemon encyclopedia

## 1) Product Intent

Build a fast, keyboard-first Cobblemon encyclopedia that recreates the practical utility of cobbledex.info while making lookup flow feel closer to a command launcher.

The core interaction is:

1. Open site.
2. Press Cmd+K (also Ctrl+K for non-mac keyboards).
3. Type natural shorthand like `lucario egg group`, `lucario moves`, `lucario spawn`, `lucario evolution`, `moves trickroom`.
4. See an immediate compact quickview.
5. Press Enter to navigate to the full Pokemon page.

This product should optimize for speed of thought: minimal pointer usage, low visual noise, high information density, predictable keyboard behavior.

## 2) Problem Statement

Current Cobblemon data is distributed across game-source JSON and bundled battle data. It is rich but not directly ergonomic for rapid lookup. Users should not need to navigate multiple pages or parse broad tables to answer focused questions.

Primary problem to solve:

- Convert upstream source-of-truth game data into an indexed, queryable, compact web UX optimized for keyboard execution.

## 3) Scope

### In Scope (must have)

- Global command palette with `Cmd+K` / `Ctrl+K`.
- Query understanding for:
  - `pokemon egg group`
  - `pokemon moves`
  - `pokemon spawn`
  - `pokemon evolve` / `pokemon evolution`
  - `moves <move-name>` => list Pokemon that can learn the move
- Quickview presentation in palette.
- Enter to navigate from palette to full Pokemon page.
- Full Pokemon page with viewable details (moves, egg groups, spawn data, evolution family, core profile data).
- Static data generation pipeline from official Cobblemon GitLab repository.

### Out of Scope (for first release)

- Team builder.
- Competitive calculators.
- Multi-language UI.
- Player accounts/sync.
- Real-time API dependency for core data.

## 4) User Outcomes

Primary outcomes:

- Users can answer common Cobblemon questions in under 5 seconds.
- Users can keep hands on keyboard for most queries.
- Users can jump from quick answer to full page without context switching.

## 5) Success Metrics

Product metrics:

- 95% of tested queries return expected facet in first result list.
- Median time from Cmd+K to answer-visible under 1200 ms on warm session.
- Cmd+K open latency under 100 ms.
- Query update latency under 50 ms after keystroke (warm index).

Quality metrics:

- Zero blocking parse failures on current upstream data snapshot.
- Deterministic build artifacts from same upstream commit SHA.

## 6) Research Findings and Source Mapping

### 6.1 Upstream repository

Source repository:

- `https://gitlab.com/cable-mc/cobblemon`

Verified key directories/files:

- Species data:
  - `common/src/main/resources/data/cobblemon/species/generation*/**/*.json`
- World spawn pools:
  - `common/src/main/resources/data/cobblemon/spawn_pool_world/*.json`
- Spawn presets:
  - `common/src/main/resources/data/cobblemon/spawn_detail_presets/*.json`
- Spawn rarity/bucket config:
  - `common/src/main/resources/data/cobblemon/spawning/best-spawner-config.json`
- Biome tag expansion:
  - `common/src/main/resources/data/cobblemon/tags/worldgen/biome/*.json`
- Battle/move datasets packaged zip:
  - `common/src/main/resources/data/cobblemon/showdown.zip`
  - Contains:
    - `data/moves.js`
    - `data/learnsets.js`
    - `data/pokedex.js`
    - `data/text/moves.js`

### 6.2 Observed data scale (current snapshot)

- Species files: 1025
- Species marked `implemented: true`: 851
- Spawn files: 824
- Spawn entries total: 2852
- Unique move IDs referenced by species movesets: 826

### 6.3 Notable schema details that affect implementation

- Species `moves` entries are prefixed strings:
  - numeric level (`1:tackle`, `40:trickroom`)
  - `egg:*`, `tm:*`, `tutor:*`, `legacy:*`, `special:*`, `form_change:*`
- Evolution objects can use multiple variants and requirement variants.
- Spawn entries can include either `weightMultiplier` (object) or `weightMultipliers` (array).
- Spawn conditions include many optional keys (`biomes`, `timeRange`, `canSeeSky`, `structures`, lure fields, etc).
- Spawn `pokemon` may include aspect tokens after species id (example: `poltchageist matcha_authenticity=artisan`).

## 7) Target UX

### 7.1 Command palette behavior

Invocation:

- Global hotkey:
  - `meta+k` on mac
  - `ctrl+k` on other platforms
- Escape closes.
- Enter executes selected action.
- Arrow keys navigate result rows.
- Tab cycles focus between result list and facet chips when present.

Interaction goals:

- Palette opens centered with no route change.
- First useful result appears as user types.
- Quickview content updates instantly with selection.

### 7.2 Query intents (required)

Intent resolution must support both Pokemon-first and facet-first patterns.

Examples:

- `lucario egg group`
  - intent: pokemon-facet
  - target: Lucario
  - facet: egg-group
- `lucario moves`
  - intent: pokemon-facet
  - facet: moves
- `lucario spawn`
  - intent: pokemon-facet
  - facet: spawn
- `lucario evolve`
  - intent: pokemon-facet
  - facet: evolution
- `moves trickroom`
  - intent: move-learners
  - move: trickroom

Synonyms required:

- `evolve`, `evolution`, `evo` => `evolution`
- `egg group`, `egg groups` => `egg-group`
- `move`, `moves` => `moves`

### 7.3 Quickview content requirements

When selected result is Pokemon overview:

- Name, national dex number, types
- Abilities
- Egg groups
- Evolution summary (pre + next)
- Spawn summary (bucket + top biome tags/time hints)

When selected result is Pokemon moves facet:

- Tabs/chips: All, Level Up, Egg, TM, Tutor
- Search within move list
- Counts per category

When selected result is spawn facet:

- Spawn rows with:
  - bucket
  - level range
  - position type
  - biome tags
  - time/weather/light constraints
  - any multipliers

When selected result is evolution facet:

- Full family chain graph/list
- Evolution method per edge
- Requirements rendered in readable format

When selected result is move-learners intent:

- Move header with normalized name
- List of Pokemon that learn move
- Optional badges showing method(s): level/tm/egg/tutor/etc

### 7.4 Enter key behavior

- If selected item maps to Pokemon, Enter navigates to `/pokemon/:slug`.
- If selected item is move-learners list row and a Pokemon row is active, Enter navigates to that Pokemon page.
- If selected item is move-only header, Enter may navigate to optional `/moves/:id` route (nice-to-have, not required).

## 8) Information Architecture

### 8.1 Routes

- `/` Home + command entry surface.
- `/pokemon/:slug` Full Pokemon details page.

Optional future:

- `/moves/:moveId` dedicated move detail page.

### 8.2 Core entities

- `PokemonRecord`
- `PokemonFormRecord`
- `SpawnEntryRecord`
- `EvolutionEdge`
- `MoveRecord`
- `MoveLearnerIndex`
- `SearchDocument`

## 9) Data Pipeline Requirements

### 9.1 High-level requirement

Data must be generated statically from upstream Cobblemon source code and committed/generated locally for deterministic runtime behavior.

### 9.2 Pipeline script

Create script:

- `scripts/generate-cobblemon-data.ts`

Responsibilities:

1. Resolve upstream snapshot (local clone path or clone/update cache).
2. Parse species files.
3. Parse spawn pool files.
4. Parse and merge spawn presets into spawn entries.
5. Parse biome tag files for friendly expansion support.
6. Parse `showdown.zip` for move metadata/text.
7. Build derived indexes.
8. Emit typed JSON artifacts under `src/data/generated/`.

### 9.3 Output artifacts

Required outputs:

- `src/data/generated/meta.json`
  - upstream URL
  - branch
  - commit SHA
  - generation timestamp
- `src/data/generated/pokemon-list.json`
  - lightweight list for search/ranking
- `src/data/generated/pokemon-by-slug/<slug>.json`
  - full per-Pokemon payload
- `src/data/generated/move-learners.json`
  - move -> learners index
- `src/data/generated/search-index.json`
  - normalized docs for palette search

### 9.4 Parsing rules

Species normalization:

- Normalize slug from species file base name or lowercased name.
- Preserve display name from `name` field.
- Keep forms embedded; optionally flatten into separate searchable aliases.

Moves normalization:

- Parse move strings into:
  - `sourceType` (`level`, `egg`, `tm`, `tutor`, `legacy`, `special`, `form_change`)
  - `sourceValue` (level number if level source)
  - `moveId`
- Resolve move display names from `showdown.zip:data/text/moves.js`.

Evolution normalization:

- Preserve edge list exactly.
- Build bidirectional family graph:
  - `preEvolution`
  - `evolutions[]`
- Render requirement variants as readable strings.

Spawn normalization:

- For each spawn entry, merge referenced `presets` conditions.
- Support both `weightMultiplier` and `weightMultipliers`.
- Preserve `condition` and `anticondition` separately.
- Parse `pokemon` with aspects:
  - `basePokemonId`
  - `aspectTokens[]`

### 9.5 Validation rules

Must fail generation with clear error when:

- Referenced preset is missing.
- Species file missing required fields (`name`, `nationalPokedexNumber`).
- Move id in species moves not resolvable in move map.

Should warn (not fail) when:

- Spawn references unknown biome tag namespace from optional mods.
- Species marked `implemented: false` appears in search index (unless explicitly allowed).

## 10) Query Parser Spec

### 10.1 Normalization

Apply in order:

1. trim and lowercase
2. collapse spaces
3. remove punctuation except hyphen
4. tokenize by whitespace

### 10.2 Intent inference priority

1. Facet-first move learners (`moves <x>`)
2. Pokemon + explicit facet
3. Pokemon-only query (overview)
4. Generic fuzzy search fallback

### 10.3 Pokemon entity matching

Match against:

- canonical species name
- slug
- aliases (form names, punctuation variants)

Scoring signals:

- exact equals
- prefix equals
- token containment
- fuzzy distance

### 10.4 Facet extraction

Facet keywords map:

- `egg`, `egg group`, `egg groups` -> egg-group
- `move`, `moves` -> moves
- `spawn`, `spawns` -> spawn
- `evolve`, `evolution`, `evo` -> evolution

### 10.5 Disambiguation behavior

If multiple Pokemon high-score ties:

- show top results list
- preview first
- allow arrow navigation

If facet present but Pokemon absent:

- for `moves <term>` run move-learners intent
- otherwise fallback to generic search and suggest examples

## 11) Search and Ranking

### 11.1 Result types

- `pokemon-overview`
- `pokemon-facet`
- `move-learners`

### 11.2 Ranking formula (v1)

Weighted additive scoring:

- exact Pokemon name match: +100
- prefix match: +60
- contains token: +25
- exact facet match: +20
- move exact id/name match: +90
- popularity boost (optional, static): +0 to +10

Tie-breakers:

1. exactness score
2. implemented species first
3. lower national dex number

## 12) Frontend Technical Requirements

### 12.1 Stack constraints

- Vike + SolidJS app (existing repo baseline).
- Keep SSR-compatible routes.
- Keep keyboard interactions reliable across SSR hydration boundary.

### 12.2 Command palette implementation

Required:

- Hotkey hooks via `bagon-hooks` (reference usage in `devreference1/src/components/layouts/horizontal/horizontal-layout.context.tsx`).
- Command UI using `cmdk-solid` and reusable command components (reference `devreference1/src/components/ui/command.tsx`).

### 12.3 Styling direction

Visual requirements:

- Compact, refined, neutral-modern visual language.
- High contrast readability with restrained decoration.
- Dense but calm spacing.

Copy requirements:

- Keep labels practical and concise.
- Do not mirror prompt adjectives directly into marketing-style UI copy.

### 12.4 Data loading strategy

To keep initial load fast:

- Load minimal `search-index.json` on first palette open.
- Lazy-load per-Pokemon detail payload when needed.
- Cache fetched/generated JSON in memory for session.

## 13) Pokemon Detail Page Requirements

The full page for `/pokemon/:slug` must show:

- Header: name, dex number, type(s), sprite/image placeholder strategy.
- Core stats block.
- Abilities and hidden ability labels.
- Egg groups and breeding fields.
- Moves table with tabs:
  - All
  - Level Up
  - Egg
  - TM
  - Tutor
- Spawn table/list with readable condition tags.
- Evolution family section with methods and requirements.

## 14) Accessibility and Keyboard Requirements

Must-have:

- Palette uses dialog semantics and focus trap.
- Arrow navigation announced correctly with active state.
- Enter and Escape behavior predictable.
- All actions accessible without pointer.
- Respect reduced-motion preference.

## 15) Performance Budgets

- Initial route JS target: under 250 KB gzip (excluding lazy detail payloads).
- Palette open -> first paint: under 100 ms.
- Query keystroke -> result update: under 50 ms (warm cache).
- Pokemon detail route transition: under 300 ms on local data.

## 16) Analytics (lightweight)

Track anonymous events (if analytics added):

- palette_open
- query_submitted
- query_intent_resolved
- result_selected
- pokemon_page_opened

No personal data collection needed.

## 17) QA Plan

### 17.1 Functional acceptance criteria (hard requirements)

1. User opens site and presses Cmd+K.
   - Expected: palette opens and input is focused.

2. User types `lucario egg group`.
   - Expected: quickview shows Lucario egg groups (`field`, `human_like` rendered human-friendly).

3. User types `lucario moves`.
   - Expected: moves quickview appears with tabs All/Level Up/Egg/TM/Tutor and searchable list.

4. User types `lucario spawn`.
   - Expected: spawn entries with bucket/levels/conditions are shown.

5. User types `lucario evolve`.
   - Expected: full evolution family with Riolu -> Lucario method and requirements.

6. User types `moves trickroom`.
   - Expected: list of Pokemon that can learn Trick Room appears.

7. User presses Enter on Lucario result.
   - Expected: navigates to `/pokemon/lucario` with complete details.

### 17.2 Browser QA workflow

Use `agent-browser --headed` for reproducible manual checks:

- hotkey behavior
- keyboard navigation
- visible quickview correctness
- route navigation on Enter

## 18) One-shot Delivery Plan (single implementation stream)

This build should be delivered in one cohesive pass, not split into large phases.

Execution checklist:

1. Add dependencies for hotkeys and command UI.
2. Create typed data schemas for generated artifacts.
3. Implement generator script and validation.
4. Generate first snapshot and commit artifacts.
5. Build search/query engine over generated index.
6. Build command palette shell + hotkeys.
7. Implement quickview renderers per intent.
8. Wire Enter navigation.
9. Build `/pokemon/:slug` page sections.
10. Add move-learners query path.
11. Add loading/empty/error states.
12. Run lint/check/manual keyboard QA.

## 19) Risks and Mitigations

Risk: Upstream schema drift.

- Mitigation: strict schema validation + clear generator errors + snapshot metadata.

Risk: Large data payload in client.

- Mitigation: split summary index from detail docs and lazy-load details.

Risk: Complex evolution requirement variants render poorly.

- Mitigation: central formatter map by requirement variant with fallback raw JSON view for unknown variants.

Risk: Spawn condition readability is low.

- Mitigation: transform tags and ranges into compact chips; preserve raw detail toggle in page view.

## 20) Definition of Done

Project is done for v1 when:

- All 7 functional acceptance criteria pass.
- Data generation runs cleanly from current upstream snapshot.
- Command palette is fully keyboard-operable.
- Pokemon page exposes moves, egg groups, spawn, evolution, and core details.
- Lint/typecheck pass.

## 21) Appendix: Required Human-readable Formatters

### 21.1 Move source formatter

- numeric prefix -> `Level <n>`
- `egg` -> `Egg`
- `tm` -> `TM`
- `tutor` -> `Tutor`
- `legacy` -> `Legacy`
- `special` -> `Special`
- `form_change` -> `Form Change`

### 21.2 Evolution requirement formatter map (minimum)

Must support readable text for observed variants:

- `level`
- `friendship`
- `time_range`
- `held_item`
- `has_move`
- `has_move_type`
- `biome`
- `weather`
- `moon_phase`
- `party_member`
- `defeat`
- `use_move`
- `structure`
- `stat_compare`
- `stat_equal`
- `properties`
- `property_range`
- `blocks_traveled`
- `advancement`
- `damage_taken`
- `recoil`
- `battle_critical_hits`

Unknown variants must not crash UI; show safe fallback text.

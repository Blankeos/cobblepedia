# Data Sources

Use these as canonical sources for generated Pokemon/move/spawn data.

## Local dev references

Local reference repositories for development and data inspection:

- `.tmp-blockbench/`
  - Local checkout of Blockbench.
  - Use for model tooling and format behavior reference when preview/model workflows need it.
- `.tmp-cobblemon/`
  - Local checkout of Cobblemon upstream repository.
  - Use for validating canonical source files and paths.

### Cobbleverse release-locked source (MRPack-first)

- Primary package: `.tmp-cobbleverse/COBBLEVERSE 1.7.3.mrpack`
- Resolve addon dependencies from `modrinth.index.json` (`files[]` download URLs + hashes).
- Include nested override archives in the MRPack (`overrides/datapacks/**/*.zip`, relevant `overrides/mods/**/*.jar`).
- Critical datapack in this snapshot: `overrides/datapacks/COBBLEVERSE-DP-v27.zip`
- Treat older addon `.tmp-*` mirrors as optional debug artifacts, not canonical generation inputs.
- Bootstrap helper: `scripts/clone-local-sources.sh` clones `.tmp-cobblemon` and downloads the pinned MRPack snapshot.

## Cobblemon upstream

- Repository: `https://gitlab.com/cable-mc/cobblemon`
- Required paths:
  - Species: `common/src/main/resources/data/cobblemon/species/generation*/**/*.json`
  - Species feature assignments: `common/src/main/resources/data/cobblemon/species_feature_assignments/*.json`
  - Pokemon interactions: `common/src/main/resources/data/cobblemon/pokemon_interactions/*.json`
  - Mechanics config (slowpoke tails): `common/src/main/resources/data/cobblemon/mechanics/slowpoke_tails.json`
  - Spawns: `common/src/main/resources/data/cobblemon/spawn_pool_world/*.json`
  - Spawn presets: `common/src/main/resources/data/cobblemon/spawn_detail_presets/*.json`
  - Spawn rarity config: `common/src/main/resources/data/cobblemon/spawning/best-spawner-config.json`
  - Biome tags: `common/src/main/resources/data/cobblemon/tags/worldgen/biome/*.json`
  - Move metadata/text (zip): `common/src/main/resources/data/cobblemon/showdown.zip`
    - Includes: `data/moves.js`, `data/learnsets.js`, `data/text/moves.js`

- Interaction data note:
  - Not all interactable drops are declared in `pokemon_interactions/*.json`.
  - Shearing interactions for `sheared` species (for example Mareep/Wooloo/Dubwool) are implemented in code at
    `common/src/main/kotlin/com/cobblemon/mod/common/entity/pokemon/PokemonEntity.kt`.
  - Slowpoke shearing uses species feature assignment (`slowpoke_tail_regrowth`) plus the mechanics config above.

## Cobblemon item assets

- Primary repository (item icon pack): `https://gitlab.com/cable-mc/cobblemon-assets/-/tree/master/items`
- Primary raw base:
  - `https://gitlab.com/cable-mc/cobblemon-assets/-/raw/master/items/{subpath}.png`
- Fallback source for item models that point at Cobblemon block textures:
  - `https://gitlab.com/cable-mc/cobblemon/-/raw/main/common/src/main/resources/assets/cobblemon/textures/{subpath}.png`

## Model previews and assets

- Model previews are runtime-fetched and must not be committed to this repo.
- Cobblemon model source: `https://gitlab.com/cable-mc/cobblemon-assets/-/tree/master/blockbench/pokemon`
- Do not commit upstream model payloads (`.geo.json`, `.bbmodel`, texture PNGs).
- Resolve/fetch model assets dynamically for the currently viewed Pokemon.

## Minecraft item assets

- Repository: `https://github.com/PixiGeko/Minecraft-default-assets`
- Raw item texture base:
  - `https://raw.githubusercontent.com/PixiGeko/Minecraft-default-assets/latest/assets/minecraft/textures/item/{item-id}.png`
- Raw block texture base (fallback for block-backed items like wool):
  - `https://raw.githubusercontent.com/PixiGeko/Minecraft-default-assets/latest/assets/minecraft/textures/block/{item-id}.png`
- Use this source for `minecraft:` namespace item icons (for example: feather, string) when no Cobblemon `assetPath` is available.
- Do not clone/vendor this repository into Cobblepedia.

## Artwork and sprites (PokeAPI sprites repo)

- The dev of this codebase calls "artwork" as the high-fidelity art of pokemon from PokeAPI and "small sprites" as the little versions of pokemon sprites.
- Do not use PokeAPI GraphQL for artwork/sprites.
- Use direct raw URLs from `https://github.com/PokeAPI/sprites`.
- Do not clone/vendor `PokeAPI/sprites` into this repo.
- For forms, build deterministic local `form -> pokeapi-id` mapping from bulk CSV (`pokemon.csv`, `pokemon_forms.csv`) during generation.
- Avoid per-Pokemon API lookups for form resolution.
- Preferred artwork URL:
  - `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{pokemon-id}.png`
- Small sprite URL:
  - `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{pokemon-id}.png`
- Artwork fallback order:
  1. `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/{pokemon-id}.png`
  2. `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{pokemon-id}.png`

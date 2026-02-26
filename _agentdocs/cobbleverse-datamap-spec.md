# Cobbleverse Data Map Spec

Status: Draft
Last updated: 2026-02-26
Scope: Data coverage and provenance requirements for Cobbleverse Pokemon support

## 1) Purpose

Define what must be true for Cobblepedia to map Cobbleverse Pokemon data reliably, with source traceability per species.

This spec is intentionally about requirements (what), not implementation steps (how).

## 2) Source Policy (Required)

- Do not use Lumyverse wiki tables as source-of-truth.
- Use upstream code/data repositories as source-of-truth.
- Use Modrinth collection/project pages only for discovery and dependency inventory.
- Every mapped species must be traceable to concrete source files.

### 2.1 Generated data location policy (Required)

- Generated data artifacts must be emitted under `public/data/generated/**`.
- App/runtime code must not import generated data modules from `src/**`.
- Generated artifacts are consumed as static public assets only.

### 2.2 Main source map (MRPack-first decision)

- [x] Cobblemon base (canonical upstream)
  - Local generation source root: `.tmp-cobblemon/common/src/main/resources/data/cobblemon/**`
  - Current generator default root: `scripts/generate-cobblemon-data.ts` -> `.tmp-cobblemon` (override: `COBBLEMON_REPO_PATH`)
  - Remote code/data repo: `https://gitlab.com/cable-mc/cobblemon`
  - Remote asset tree: `https://gitlab.com/cable-mc/cobblemon-assets/-/tree/master?ref_type=heads`
  - Remote Pokemon asset raw base: `https://gitlab.com/cable-mc/cobblemon-assets/-/raw/master/blockbench/pokemon/{subpath}`

- [x] Cobbleverse addon layer (release-locked source)
  - Primary local source package: `.tmp-cobbleverse/COBBLEVERSE 1.7.3.mrpack`
  - Treat `modrinth.index.json` as dependency lockfile (project files + URLs + hashes)
  - Required addon inputs are the union of:
    - nested override archives in MRPack (`overrides/datapacks/**/*.zip`, relevant `overrides/mods/**/*.jar`)
    - artifacts referenced by `modrinth.index.json > files[] > downloads[]` (hash-verified)
  - Critical datapack in this snapshot: `overrides/datapacks/COBBLEVERSE-DP-v27.zip`

- [ ] Local `.tmp-*` references (optional, non-canonical)
  - Examples: legacy addon snapshot folders previously used for exploration.
  - Use for ad-hoc exploration/debugging only.
  - Generation correctness must not depend on these mirrors being present.

### 2.3 Source resolution and provenance contract (Required)

- Build must resolve addon artifacts from the MRPack lockfile (`modrinth.index.json`) and verify hashes before use.
- Build must fail if a required artifact cannot be fetched/read or hash verification fails.
- For each consumed addon artifact, retain source metadata in coverage/provenance output:
  - MRPack path (`files[].path` or `overrides/...` path)
  - Download URL used
  - Hash (`sha1` at minimum)
  - Archive-internal source file paths used for species evidence
- For asset URL provenance:
  - Prefer upstream git raw URL when an official upstream repo path is known.
  - Otherwise use Modrinth CDN file URL + archive-internal path as the deterministic source reference.

### 2.4 Cobbleverse addon asset publication policy (Required)

- Species coverage/provenance generation is allowed without publishing addon binary assets.
- If redistribution rights for addon model/animation/texture files are unclear, addon media URLs may be left `null`.
- In that case, provenance must still include deterministic evidence (`download URL`, `hash`, `archive-internal path`) so the source is auditable.
- Base Cobblemon media URLs are unaffected and should continue to resolve from official upstream asset sources.

### 2.5 Generation profile toggle (Required)

- Data generation must support a deterministic profile switch.
- Required profiles:
  - `base` (default): generate from Cobblemon base source only (`.tmp-cobblemon`).
  - `cobbleverse`: generate from base + Cobbleverse addon layer resolved from MRPack + lockfile artifacts.
- `base` profile must not require any Cobbleverse source files or network fetches.
- `cobbleverse` profile must fail fast if required MRPack/lockfile artifacts cannot be resolved or verified.
- For rights-sensitive addon media, `cobbleverse` profile may emit `null` media URLs while still emitting full provenance evidence.

## 3) Findings Snapshot (Current)

### 3.1 Base Cobblemon snapshot

From `public/data/generated/meta.json`:

- Species total: `1025`
- Implemented in base Cobblemon: `851`
- Base gap: `174`

### 3.2 AllTheMons x Mega Showdown (ATMxMSD) snapshot

Local repo snapshot (`.tmp-atmxmsd`):

- `data/cobblemon/species/**/*.json`: `4`
- `data/cobblemon/species_additions/**/*.json`: `203`
- Unique species targets across species/species_additions: `202`
- Spawn files total: `173`
  - `data/cobblemon/spawn_pool_world`: `66`
  - `data/legendary_spawns_atm/spawn_pool_world`: `82`
  - `data/paradox_spawns_atm/spawn_pool_world`: `17`
  - `data/ultra_beast_spawns_atm/spawn_pool_world`: `8`
- Model/resource breadth:
  - `.geo.json` models: `163`
  - animation json: `158`
  - posers: `159`
  - resolvers: `165`
  - pokemon texture png: `391`

Coverage impact against base gap (`174`), using conservative "implemented flip" signal:

- Base-unimplemented species targeted by ATMxMSD species data: `138`
- Explicit implemented flips by ATMxMSD: `101`
  - includes boolean `true` and string `"true"`
- Remaining after base + ATMxMSD explicit flips: `73`

### 3.3 Cobblemon Mega Showdown (MSD) snapshot

Local repo snapshot (`.tmp-mega-showdown`):

- `common/src/main/resources/data/cobblemon/species/**/*.json`: `24`
- `common/src/main/resources/data/cobblemon/species_additions/**/*.json`: `58`
- `common/src/main/resources/data/cobblemon/spawn_pool_world/**/*.json`: `21`

Coverage impact against base gap (`174`), same conservative signal:

- Explicit implemented flips by MSD: `62`
- Overlap with ATMxMSD flips: `9`
- MSD-only flips: `53`

### 3.4 Combined coverage (base + ATMxMSD + MSD)

- Combined explicit implemented flips: `154`
- Projected implemented total: `1005 / 1025`
- Remaining unresolved: `20`

Unresolved species (`20`):

- `audino`
- `beautifly`
- `cascoon`
- `celesteela`
- `cherubi`
- `diancie`
- `dustox`
- `eternatus`
- `ironboulder`
- `ironhands`
- `ironjugulis`
- `kyurem`
- `palpitoad`
- `pheromosa`
- `seismitoad`
- `silcoon`
- `tinglu`
- `tympole`
- `virizion`
- `wurmple`

### 3.5 Decision check: do we still need Mega Showdown if ATMxMSD exists?

Using the current conservative signal (`implemented === true` or `"true"` on species/species_additions targets that are base-unimplemented):

- Base gap starts at: `174`
- ATMxMSD alone closes: `101` -> `73` remain
- MSD closes: `62`, with overlap `9` vs ATMxMSD
- MSD unique closes: `53`
- ATMxMSD + MSD combined unresolved: `20`

Current conclusion:

- At this pre-MRPack stage, including the local Mega Showdown snapshot was required to reduce unresolved coverage.
- ATMxMSD alone is not enough yet for deterministic near-parity coverage accounting.
- If we later prove ATMxMSD contains equivalent implementation evidence for those `53` MSD-only flips, this decision can be revisited.

### 3.6 GlitchDex snapshot

Local pack snapshot (`.tmp-glitchdex`):

- `data/cobblemon/species/**/*.json`: `4`
- `data/cobblemon/species_additions/**/*.json`: `0`
- `data/cobblemon/spawn_pool_world/**/*.json`: `4`
- Bedrock assets:
  - `.geo.json` models: `4`
  - animation json: `4`
  - posers: `4`
  - species bedrock json: `4`
  - pokemon texture png: `8`

Coverage impact against base gap (`174`), same conservative signal:

- Explicit implemented flips by GlitchDex: `0`
- Base-gap species targeted by GlitchDex species data: `0`
- Current contribution to unresolved reduction: `0`

Current conclusion:

- Keep GlitchDex as optional/source-discovery input, not as a current base-gap closer.
- The four GlitchDex species in this snapshot (`croagunk`, `toxicroak`, `capsakid`, `scovillain`) are already base-implemented in the current Cobblemon snapshot.

### 3.7 Batch-1 downloaded addon intake (current local snapshots)

Additional local packs inspected:

- `.tmp-jewel-pokemon`
  - `species`: `3`, `species_additions`: `0`, `spawn_pool_world`: `1`
  - Conservative explicit base-gap flips: `1` (`diancie`)
- `.tmp-pokemans`
  - `species`: `7`, `species_additions`: `22`, `spawn_pool_world`: `29`
  - Conservative explicit base-gap flips: `3` (`arceus`, `groudon`, `kyogre`)
  - Unresolved touches without explicit flip: `eternatus`, `kyurem`
- `.tmp-cavs-cobblemons`
  - `species`: `17`, `species_additions`: `0`, `spawn_pool_world`: `11`
  - Conservative explicit base-gap flips: `0`
  - Unresolved touches without explicit flip: `tinglu`, `virizion` (species+spawn+asset evidence)
- `.tmp-mysticmons`
  - `species`: `17`, `species_additions`: `2`, `spawn_pool_world`: `59`
  - Conservative explicit base-gap flips: `1` (`yveltal`)
  - Unresolved touch without explicit flip: `pheromosa` (spawn+asset evidence)
- `.tmp-tdmon`
  - `species`: `11`, `species_additions`: `0`, `spawn_pool_world`: `8`
  - Conservative explicit base-gap flips: `0`
  - Unresolved asset references observed: `tympole`, `palpitoad`, `seismitoad`
- `.tmp-planeta-cobblemon`
  - No `data/cobblemon/**` in snapshot (assets-only)
  - Unresolved asset references observed: `audino`, `celesteela`, `ironboulder`, `ironhands`, `ironjugulis`, `tinglu`, `virizion`

Conservative combined impact with Batch-1:

- Base + ATMxMSD + MSD unresolved: `20`
- Base + ATMxMSD + MSD + Batch-1 unresolved: `19`
- Net new unresolved closure from Batch-1: `+1` (`diancie` via `.tmp-jewel-pokemon`)

Updated unresolved species after Base + ATMxMSD + MSD + Batch-1 (`19`):

- `audino`
- `beautifly`
- `cascoon`
- `celesteela`
- `cherubi`
- `dustox`
- `eternatus`
- `ironboulder`
- `ironhands`
- `ironjugulis`
- `kyurem`
- `palpitoad`
- `pheromosa`
- `seismitoad`
- `silcoon`
- `tinglu`
- `tympole`
- `virizion`
- `wurmple`

### 3.8 Decision check update: Mega Showdown necessity after Batch-1

Against Base + ATMxMSD + Batch-1 (conservative explicit signal):

- ATMxMSD + Batch-1 unresolved: `69` (improved from `73` with ATMxMSD alone)
- Mega Showdown still provides `50` unique base-gap explicit flips not supplied by ATMxMSD + Batch-1
- Conclusion: keep Mega Showdown as a required source for current deterministic coverage goals

Signal caveat from Batch-1:

- Multiple packs appear to omit `implemented: true` while still shipping species/spawn/asset data.
- The conservative signal intentionally avoids auto-promoting these to implemented, so unresolved counts are likely upper bounds until a richer deterministic rule is defined.
- Sensitivity check against current snapshot:
  - `explicit` only -> unresolved `19`
  - `explicit OR ((species/species_additions) + spawn + asset)` -> unresolved `15`
  - `explicit OR (spawn + asset)` -> unresolved `12`

### 3.9 Entire Cobbleverse modpack intake (MRPack snapshot)

Local package inspected:

- `.tmp-cobbleverse/COBBLEVERSE 1.7.3.mrpack`

Key finding:

- The decisive source is nested datapack `overrides/datapacks/COBBLEVERSE-DP-v27.zip`.
- This datapack contains:
  - `data/*/species/**/*.json`: `8`
  - `data/*/species_additions/**/*.json`: `238`
  - `data/*/spawn_pool_world/**/*.json`: `1024`
  - Conservative explicit implemented flips on base gap: `170`

Impact against prior baseline (Base + ATMxMSD + MSD + Batch-1 + Batch-2):

- Prior unresolved (`explicit`): `19`
- Net new explicit flips contributed for unresolved list: all `19`
- Unresolved after adding MRPack datapack evidence (`explicit`): `0`

Species newly closed by MRPack datapack (`19`):

- `audino`
- `beautifly`
- `cascoon`
- `celesteela`
- `cherubi`
- `dustox`
- `eternatus`
- `ironboulder`
- `ironhands`
- `ironjugulis`
- `kyurem`
- `palpitoad`
- `pheromosa`
- `seismitoad`
- `silcoon`
- `tinglu`
- `tympole`
- `virizion`
- `wurmple`

Source-composition note:

- ATMxMSD + `COBBLEVERSE-DP-v27` alone is still not full closure (`34` unresolved in this snapshot).
- With current source set including MSD, unresolved is `0`.

## 4) Coverage Checklist (Live)

- [x] Cobblemon (`851 / 1025`) -> `174` left
- [x] ATMxMSD explicit implemented flips (`101 / 174`) -> `73` left
- [x] + Mega Showdown explicit implemented flips (`+53` unique) -> `20` left
- [x] + Batch-1 downloaded pack explicit flips (`+1` net) -> `19` left
- [x] + Entire modpack datapack (`COBBLEVERSE-DP-v27`) explicit flips (`+19` net) -> `0` left
- [ ] Define deterministic non-flag implementation rule for packs missing `implemented: true`
- [x] Identify remaining source mods for unresolved set from Cobbleverse dependency snapshot
- [x] Reach `1025 / 1025` explicit coverage with current source snapshot

## 5) Required Data Classification

Each species must be assigned exactly one status for coverage accounting:

- `base-implemented`
- `addon-implemented` (not base-implemented, but implemented by one or more Cobbleverse mods)
- `addon-touched-not-implemented` (patched/mentioned but not proven implemented)
- `unresolved`

The classification rule must be deterministic and documented.

## 6) Required Provenance Contract (Per Species)

Each Pokemon detail payload must include provenance metadata:

- `isBaseCobblemonImplemented: boolean`
- `isCobbleverseProvided: boolean`
- `providedByMods: string[]`
- `provenanceEvidence: { mod: string; files: string[]; urls: string[] }[]`
- `provenanceStatus: "base-implemented" | "addon-implemented" | "addon-touched-not-implemented" | "unresolved"`

Unknown or unsupported fields must not be silently dropped from raw source payloads.

## 7) Required UI Contract (Pokemon Page)

For `/pokemon/:slug`:

- If species is not base Cobblemon implemented and is addon-provided, show a visible provenance label.
- Label must state that data is not from base Cobblemon and identify contributing Cobbleverse mod(s).
- If source is unresolved, show an explicit unresolved/source-pending message.

Minimum content requirement:

- "Not in base Cobblemon"
- "Added by Cobbleverse mod(s): <mod list>"

## 8) Required Reporting Artifact

A deterministic coverage report artifact must exist and be generated with data build output.

Minimum required report fields:

- `speciesTotal`
- `baseImplemented`
- `addonImplemented`
- `addonTouchedNotImplemented`
- `unresolved`
- `unresolvedSpecies[]`
- source snapshot metadata (repo URLs + commit SHAs/version IDs)

## 9) Acceptance Criteria

- Coverage checklist numbers are reproducible from source repos.
- Every species has provenance metadata and one classification status.
- Pokemon page provenance label is shown for non-base species.
- Build output includes coverage report artifact.
- For Cobbleverse parity mode: unresolved must be `0`, or build must fail with unresolved list.

## 10) Discovery Inputs to Continue

Current status for this snapshot:

- With the current required source set, unresolved is `0` under the conservative explicit signal.
- This section applies to future Cobbleverse updates and source snapshot drift.

For future updates:

- Re-inspect Cobbleverse dependency inventory from Modrinth project/versions and refreshed MRPack lockfiles.
- Prioritize species-providing datapacks/resourcepacks that can introduce or override implementation evidence.
- If unresolved reappears, map each unresolved species to exact upstream file evidence in those dependencies.

Reference discovery source:

- Cobbleverse Modrinth collection: `https://modrinth.com/collection/vgKtV1Ao`

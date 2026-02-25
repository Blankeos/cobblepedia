import { spawnSync } from "node:child_process"
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import JSZip from "jszip"
import type {
  AbilityIndex,
  AbilitySlot,
  BiomeTagIndex,
  CompetitiveStatSpread,
  EvolutionEdgeRecord,
  ItemIndex,
  MetaRecord,
  MoveLearnersIndex,
  MoveSourceType,
  ParsedMove,
  PokemonDetailRecord,
  PokemonDexNavItem,
  PokemonDropData,
  PokemonFormRecord,
  PokemonFormSpriteIndex,
  PokemonInteractionIndex,
  PokemonInteractionRecord,
  PokemonListItem,
  PokemonTypeEntryRecord,
  RideableMonRecord,
  SearchDocument,
  SmogonMovesetRecord,
  SmogonMovesetsByPokemonRecord,
  SpawnEntryRecord,
} from "../src/data/cobblemon-types"
import {
  canonicalId,
  formatAbilityId,
  formatEvolutionRequiredContext,
  formatEvolutionRequirement,
  normalizeSearchText,
  parseLevelRange,
  parsePokemonRef,
  titleCaseFromId,
} from "../src/data/formatters"
import { getMoveLearnerShardId } from "../src/data/move-learner-sharding"
import { parseRideableSummary } from "../src/data/rideable"

const PROJECT_ROOT = path.resolve(import.meta.dir, "..")
const DEFAULT_UPSTREAM_ROOT = path.resolve(PROJECT_ROOT, ".tmp-cobblemon")
const UPSTREAM_ROOT = path.resolve(
  process.argv[2] ?? process.env.COBBLEMON_REPO_PATH ?? DEFAULT_UPSTREAM_ROOT
)

const UPSTREAM_URL = "https://gitlab.com/cable-mc/cobblemon"
const COBBLEMON_ASSETS_PROJECT_ID = "cable-mc%2Fcobblemon-assets"
const COBBLEMON_ASSETS_REF = "master"
const COBBLEMON_ASSETS_ITEMS_ROOT = "items"
const ITEM_ASSET_PATH_OVERRIDES: Record<string, string> = {
  saccharine_sapling:
    "https://gitlab.com/cable-mc/cobblemon/-/raw/main/common/src/main/resources/assets/cobblemon/textures/block/wood/saccharine_sapling.png",
}
const POKEAPI_POKEMON_CSV_URL =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv"
const POKEAPI_POKEMON_FORMS_CSV_URL =
  "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_forms.csv"
const SMOGON_SETS_GEN9_URL = "https://pkmn.github.io/smogon/data/sets/gen9.json"
const SMOGON_SETS_FORMAT_ID = "gen9"
const SMOGON_SETS_FORMAT_LABEL = "Smogon Gen 9"
const KNOWN_MOVE_PREFIXES = new Set(["egg", "tm", "tutor", "legacy", "special", "form_change"])
const INTERACTION_ITEM_CONDITION_ALIASES: Record<string, string> = {
  "#c:tools/brushes": "minecraft:brush",
  "#c:tools/shear": "minecraft:shears",
  "#c:fertilizers": "minecraft:bone_meal",
}
const INTERACTION_GROUPING_ITEM_ALIASES: Record<string, string> = {
  brush: "minecraft:brush",
  shears: "minecraft:shears",
  bone_meal: "minecraft:bone_meal",
  bucket: "minecraft:bucket",
  glass_bottle: "minecraft:glass_bottle",
  milking: "minecraft:bucket",
}
const EVOLUTION_FORM_REGION_ALIASES: Record<string, string> = {
  alola: "alola",
  alolan: "alola",
  galar: "galar",
  galarian: "galar",
  hisui: "hisui",
  hisuian: "hisui",
  paldea: "paldea",
  paldean: "paldea",
  kanto: "kanto",
  kantonian: "kanto",
  johto: "johto",
  johtonian: "johto",
  hoenn: "hoenn",
  hoennian: "hoenn",
  sinnoh: "sinnoh",
  sinnohan: "sinnoh",
  unova: "unova",
  unovan: "unova",
}

const FORM_SUFFIX_ALIASES: Record<string, string[]> = {
  f: ["female"],
  m: ["male"],
  dusk: ["owntempo"],
  duskmane: ["dusk"],
  dawnwings: ["dawn"],
  noiceface: ["noice"],
  partner: ["starter"],
  galar: ["galarstandard"],
  paldeacombat: ["paldeacombatbreed"],
  paldeablaze: ["paldeablazebreed"],
  paldeaaqua: ["paldeaaquabreed"],
  blue: ["blueplumage"],
  yellow: ["yellowplumage"],
  white: ["whiteplumage"],
  wellspring: ["wellspringmask"],
  hearthflame: ["hearthflamemask"],
  cornerstone: ["cornerstonemask"],
  wellspringtera: ["wellspringmask"],
  hearthflametera: ["hearthflamemask"],
  cornerstonetera: ["cornerstonemask"],
  bond: ["battlebond"],
  "10c": ["10powerconstruct"],
  "50c": ["50powerconstruct"],
  meteor: ["redmeteor"],
  four: ["familyoffour"],
}

const ALCREMIE_FLAVOR_SUFFIXES = [
  "vanillacream",
  "rubycream",
  "matchacream",
  "mintcream",
  "lemoncream",
  "saltedcream",
  "rubyswirl",
  "caramelswirl",
  "rainbowswirl",
]

const SPECIES_ROOT = path.join(UPSTREAM_ROOT, "common/src/main/resources/data/cobblemon/species")
const SPAWN_POOL_ROOT = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/spawn_pool_world"
)
const SPAWN_PRESET_ROOT = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/spawn_detail_presets"
)
const BIOME_TAG_ROOT = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/tags/worldgen/biome"
)
const POKEMON_INTERACTIONS_ROOT = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/pokemon_interactions"
)
const SPECIES_FEATURE_ASSIGNMENTS_ROOT = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/species_feature_assignments"
)
const SLOWPOKE_TAILS_MECHANIC_PATH = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/mechanics/slowpoke_tails.json"
)
const SHOWDOWN_ZIP_PATH = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/showdown.zip"
)
const SPAWNER_CONFIG_PATH = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/spawning/best-spawner-config.json"
)
const EN_US_LANG_PATH = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/assets/cobblemon/lang/en_us.json"
)

const GENERATED_ROOT = path.join(PROJECT_ROOT, "src/data/generated")
const GENERATED_BY_SLUG_ROOT = path.join(GENERATED_ROOT, "pokemon-by-slug")
const GENERATED_MOVE_LEARNER_SHARDS_ROOT = path.join(GENERATED_ROOT, "move-learners-shards")
const GENERATED_SMOGON_MOVESETS_BY_SLUG_ROOT = path.join(GENERATED_ROOT, "smogon-movesets-by-slug")
const PUBLIC_GENERATED_ROOT = path.join(PROJECT_ROOT, "public/data/generated")
const PUBLIC_GENERATED_BY_SLUG_ROOT = path.join(PUBLIC_GENERATED_ROOT, "pokemon-by-slug")
const PUBLIC_MOVE_LEARNER_SHARDS_ROOT = path.join(PUBLIC_GENERATED_ROOT, "move-learners-shards")
const PUBLIC_SMOGON_MOVESETS_BY_SLUG_ROOT = path.join(
  PUBLIC_GENERATED_ROOT,
  "smogon-movesets-by-slug"
)

type RawSpeciesFile = {
  slug: string
  filePath: string
  data: Record<string, unknown>
}

type DirectedEvolutionEdge = {
  fromSlug: string
  fromFormSlug: string | null
  fromFormName: string | null
  toSlug: string
  toAspectTokens: string[]
  method: string
  requirementText: string[]
}

type ResolvedEvolutionFamilyEdge = PokemonDetailRecord["evolutionFamily"]["edges"][number] & {
  sourceFormSlug: string | null
}

type EvolutionFamilyNodeCandidate = {
  nodeId: string
  slug: string
  name: string
  dexNumber: number
  formSlug: string | null
  formName: string | null
  tokens: Set<string>
}

type SpawnWarnings = {
  unknownBiomeNamespaces: Set<string>
}

type ShowdownData = {
  moveNames: Map<string, string>
  moves: Map<
    string,
    {
      name: string
      type: string | null
      category: string | null
      basePower: number | null
      accuracy: number | null
      alwaysHits: boolean
      shortDescription: string | null
      description: string | null
    }
  >
  abilities: Map<
    string,
    {
      name: string
      shortDescription: string | null
      description: string | null
    }
  >
  learnsetCount: number
}

type MoveLearnerBuildEntry = {
  methods: Set<MoveSourceType>
  levelUpLevels: Set<number>
  baseAvailable: boolean
  forms: Map<string, string>
}

type MoveLearnersBuildMap = Map<string, Map<string, MoveLearnerBuildEntry>>

type GitLabTreeEntry = {
  path: string
  type: "tree" | "blob"
}

type PokeapiPokemonCsvRow = {
  id: number
  identifier: string
  speciesId: number
}

type PokeapiFormCsvRow = {
  identifier: string
  pokemonId: number
}

type PokeapiFormLookupEntry = {
  pokemonId: number
  pokemonIdentifier: string
  speciesId: number
}

type PokeapiFormLookup = {
  formIdentifierToPokemon: Map<string, PokeapiFormLookupEntry>
  formIdentifiersBySpeciesId: Map<number, string[]>
  defaultPokemonIdentifierBySpeciesId: Map<number, string>
}

type PokeapiSpeciesFormCandidate = {
  formIdentifier: string
  pokemonId: number
  pokemonIdentifier: string
  fullCanonical: string
  suffixCanonical: string
}

type SmogonSetsPayload = Record<string, unknown>

type RawSmogonSet = {
  moves?: unknown
  ability?: unknown
  item?: unknown
  nature?: unknown
  evs?: unknown
  ivs?: unknown
  teratypes?: unknown
}

type SmogonMovesetEntry = {
  entryName: string
  canonicalEntryId: string
  sets: SmogonMovesetRecord[]
}

await main()

async function main() {
  await validateInputPaths()

  const rawSpecies = await loadRawSpeciesFiles()
  const speciesLookup = buildSpeciesLookup(rawSpecies)

  const showdownData = await loadShowdownData()
  const spawnPresets = await loadSpawnPresets()
  const biomeTagMap = await loadBiomeTagMap()
  const biomeTagIndex = buildBiomeTagIndex(biomeTagMap)
  const bucketWeights = await loadBucketWeights()

  const spawnWarnings: SpawnWarnings = {
    unknownBiomeNamespaces: new Set<string>(),
  }

  const spawnBySlug = await loadSpawnEntriesBySlug({
    speciesLookup,
    spawnPresets,
    bucketWeights,
    biomeTagMap,
    warnings: spawnWarnings,
  })

  const moveLearnersBuild: MoveLearnersBuildMap = new Map()

  const detailsBySlug = new Map<string, PokemonDetailRecord>()
  for (const speciesFile of rawSpecies) {
    const detail = buildPokemonDetailRecord({
      speciesFile,
      speciesLookup,
      moveNames: showdownData.moveNames,
      moveEntries: showdownData.moves,
      spawnEntries: spawnBySlug.get(speciesFile.slug) ?? [],
      moveLearnersBuild,
    })

    detailsBySlug.set(speciesFile.slug, detail)
  }

  const evolutionFamilies = buildEvolutionFamilies(detailsBySlug)
  for (const [slug, family] of evolutionFamilies) {
    const detail = detailsBySlug.get(slug)
    if (!detail) {
      continue
    }

    detail.evolutionFamily = family
  }

  const pokemonList = buildPokemonList(detailsBySlug)
  const pokemonDexNav = buildPokemonDexNav(pokemonList)
  const pokemonTypeEntries = buildPokemonTypeEntries(detailsBySlug)
  const moveLearners = buildMoveLearnersIndex(detailsBySlug, moveLearnersBuild, showdownData.moves)
  const moveLearnerShards = buildMoveLearnerShards(moveLearners)
  const abilityIndex = buildAbilityIndex(detailsBySlug, showdownData.abilities)
  const pokemonInteractionIndex = await loadPokemonInteractionIndex(detailsBySlug)
  const baseItemIndex = await loadItemIndex()
  const itemIndex = augmentItemIndex(baseItemIndex, detailsBySlug, pokemonInteractionIndex)
  const rideableMons = buildRideableMons(detailsBySlug)
  const pokemonFormSpriteIndex = await buildPokemonFormSpriteIndex(detailsBySlug)
  const smogonMovesetsBySlug = await buildSmogonMovesetsBySlug(detailsBySlug)
  const searchIndex = buildSearchIndex(pokemonList, moveLearners)

  if (searchIndex.some((doc) => doc.resultType === "pokemon-overview" && !doc.implemented)) {
    console.warn("[warn] Search index includes species marked implemented=false")
  }

  for (const namespace of Array.from(spawnWarnings.unknownBiomeNamespaces).sort()) {
    console.warn(`[warn] Spawn biome tag references optional namespace: ${namespace}`)
  }

  const upstreamBranch = gitValue(["rev-parse", "--abbrev-ref", "HEAD"])
  const upstreamCommitSha = gitValue(["rev-parse", "HEAD"])
  const generatedAt = new Date().toISOString()

  const meta: MetaRecord = {
    upstreamUrl: UPSTREAM_URL,
    branch: upstreamBranch,
    commitSha: upstreamCommitSha,
    generatedAt,
    speciesCount: pokemonList.length,
    implementedSpeciesCount: pokemonList.filter((pokemon) => pokemon.implemented).length,
    spawnEntryCount: Array.from(detailsBySlug.values()).reduce((sum, detail) => {
      return sum + detail.spawnEntries.length
    }, 0),
    moveCount: showdownData.moveNames.size,
    itemCount: Object.keys(itemIndex).length,
  }

  await writeArtifacts({
    meta,
    pokemonList,
    pokemonDexNav,
    pokemonTypeEntries,
    moveLearnerShards,
    abilityIndex,
    biomeTagIndex,
    itemIndex,
    pokemonInteractionIndex,
    rideableMons,
    pokemonFormSpriteIndex,
    smogonMovesetsBySlug,
    searchIndex,
    detailsBySlug,
  })

  console.log("Generated Cobblepedia data artifacts")
  console.log(`- Upstream: ${UPSTREAM_ROOT}`)
  console.log(`- Species: ${meta.speciesCount} (${meta.implementedSpeciesCount} implemented)`)
  console.log(`- Spawn entries: ${meta.spawnEntryCount}`)
  console.log(`- Move map size: ${meta.moveCount}`)
  console.log(`- Item entries: ${meta.itemCount}`)
  console.log(`- Form sprite mappings: ${Object.keys(pokemonFormSpriteIndex).length}`)
  console.log(`- Smogon moveset shards: ${smogonMovesetsBySlug.size}`)
  console.log(`- Learnset entries parsed: ${showdownData.learnsetCount}`)
}

async function validateInputPaths() {
  const requiredPaths = [
    SPECIES_ROOT,
    SPAWN_POOL_ROOT,
    SPAWN_PRESET_ROOT,
    BIOME_TAG_ROOT,
    POKEMON_INTERACTIONS_ROOT,
    SHOWDOWN_ZIP_PATH,
    SPAWNER_CONFIG_PATH,
    EN_US_LANG_PATH,
  ]

  for (const requiredPath of requiredPaths) {
    const exists = await pathExists(requiredPath)
    if (!exists) {
      throw new Error(`Required Cobblemon source path is missing: ${requiredPath}`)
    }
  }
}

async function loadRawSpeciesFiles(): Promise<RawSpeciesFile[]> {
  const speciesFiles = (await collectJsonFiles(SPECIES_ROOT)).filter((filePath) => {
    return /generation\d+/i.test(filePath)
  })

  const rawSpecies: RawSpeciesFile[] = []
  for (const filePath of speciesFiles) {
    const data = await readJson(filePath)
    const slug = path.basename(filePath, ".json").toLowerCase()

    if (typeof data.name !== "string" || data.name.trim() === "") {
      throw new Error(`Species file missing required field \`name\`: ${filePath}`)
    }

    if (typeof data.nationalPokedexNumber !== "number") {
      throw new Error(`Species file missing required field \`nationalPokedexNumber\`: ${filePath}`)
    }

    rawSpecies.push({
      slug,
      filePath,
      data,
    })
  }

  rawSpecies.sort((left, right) => {
    const leftDex = Number(left.data.nationalPokedexNumber)
    const rightDex = Number(right.data.nationalPokedexNumber)
    if (leftDex !== rightDex) {
      return leftDex - rightDex
    }

    return left.slug.localeCompare(right.slug)
  })

  return rawSpecies
}

function buildSpeciesLookup(rawSpecies: RawSpeciesFile[]): Map<string, string> {
  const map = new Map<string, string>()

  for (const species of rawSpecies) {
    const name = String(species.data.name)
    map.set(canonicalId(species.slug), species.slug)
    map.set(canonicalId(name), species.slug)

    const forms = Array.isArray(species.data.forms)
      ? (species.data.forms as Array<Record<string, unknown>>)
      : []
    for (const form of forms) {
      if (typeof form.name !== "string") {
        continue
      }

      map.set(canonicalId(`${name} ${form.name}`), species.slug)
      map.set(canonicalId(form.name), species.slug)
    }
  }

  return map
}

async function loadShowdownData(): Promise<ShowdownData> {
  const zipBuffer = await readFile(SHOWDOWN_ZIP_PATH)
  const zip = await JSZip.loadAsync(new Uint8Array(zipBuffer))

  const movesCode = await readZipEntryAsText(zip, "data/moves.js")
  const movesTextCode = await readZipEntryAsText(zip, "data/text/moves.js")
  const abilitiesCode = await readZipEntryAsText(zip, "data/abilities.js")
  const abilitiesTextCode = await readZipEntryAsText(zip, "data/text/abilities.js")
  const learnsetsCode = await readZipEntryAsText(zip, "data/learnsets.js")

  const movesModule = evaluateCommonJsModule(movesCode)
  const movesTextModule = evaluateCommonJsModule(movesTextCode)
  const abilitiesModule = evaluateCommonJsModule(abilitiesCode)
  const abilitiesTextModule = evaluateCommonJsModule(abilitiesTextCode)
  const learnsetsModule = evaluateCommonJsModule(learnsetsCode)

  const moves = getNamedExport(movesModule, "Moves")
  const movesText = getNamedExport(movesTextModule, "MovesText")
  const abilities = getNamedExport(abilitiesModule, "Abilities")
  const abilitiesText = getNamedExport(abilitiesTextModule, "AbilitiesText")
  const learnsets = getNamedExport(learnsetsModule, "Learnsets")

  const moveNames = new Map<string, string>()
  const moveEntries = new Map<
    string,
    {
      name: string
      type: string | null
      category: string | null
      basePower: number | null
      accuracy: number | null
      alwaysHits: boolean
      shortDescription: string | null
      description: string | null
    }
  >()

  for (const [moveId, moveData] of Object.entries(moves)) {
    const textEntry = isRecord(movesText[moveId]) ? movesText[moveId] : null
    const moveEntry = isRecord(moveData) ? moveData : null

    const textName = textEntry && typeof textEntry.name === "string" ? textEntry.name : null
    const moveName = moveEntry && typeof moveEntry.name === "string" ? moveEntry.name : null
    const resolvedName = textName ?? moveName ?? titleCaseFromId(moveId)

    const moveType =
      moveEntry && typeof moveEntry.type === "string" ? canonicalId(moveEntry.type) : null
    const moveCategory =
      moveEntry && typeof moveEntry.category === "string" ? canonicalId(moveEntry.category) : null
    const basePower =
      moveEntry && typeof moveEntry.basePower === "number" && Number.isFinite(moveEntry.basePower)
        ? moveEntry.basePower
        : null

    const accuracyRaw = moveEntry?.accuracy
    const accuracy =
      typeof accuracyRaw === "number" && Number.isFinite(accuracyRaw) ? accuracyRaw : null
    const alwaysHits = accuracyRaw === true

    moveNames.set(moveId, resolvedName)
    moveEntries.set(moveId, {
      name: resolvedName,
      type: moveType,
      category: moveCategory,
      basePower,
      accuracy,
      alwaysHits,
      shortDescription: typeof textEntry?.shortDesc === "string" ? textEntry.shortDesc : null,
      description: typeof textEntry?.desc === "string" ? textEntry.desc : null,
    })
  }

  const abilityEntries = new Map<
    string,
    {
      name: string
      shortDescription: string | null
      description: string | null
    }
  >()
  const abilityIds = new Set([...Object.keys(abilities), ...Object.keys(abilitiesText)])

  for (const abilityId of abilityIds) {
    const abilityEntry = isRecord(abilities[abilityId]) ? abilities[abilityId] : null
    const textEntry = isRecord(abilitiesText[abilityId]) ? abilitiesText[abilityId] : null

    const abilityName =
      (typeof textEntry?.name === "string" ? textEntry.name : null) ??
      (typeof abilityEntry?.name === "string" ? abilityEntry.name : null) ??
      titleCaseFromId(abilityId)

    abilityEntries.set(abilityId, {
      name: abilityName,
      shortDescription: typeof textEntry?.shortDesc === "string" ? textEntry.shortDesc : null,
      description: typeof textEntry?.desc === "string" ? textEntry.desc : null,
    })
  }

  return {
    moveNames,
    moves: moveEntries,
    abilities: abilityEntries,
    learnsetCount: Object.keys(learnsets).length,
  }
}

async function loadItemIndex(): Promise<ItemIndex> {
  const lang = await readJson(EN_US_LANG_PATH)
  let itemAssetPathById = new Map<string, string>()

  try {
    itemAssetPathById = await loadItemAssetPathById()
  } catch (error) {
    console.warn("[warn] Failed to load Cobblemon item sprite paths from GitLab assets", error)
  }

  const nameByItemId = new Map<string, string>()
  const descriptionByItemId = new Map<string, Map<number, string>>()

  for (const [rawKey, rawValue] of Object.entries(lang)) {
    if (typeof rawValue !== "string") {
      continue
    }

    const value = rawValue.trim()
    if (!value) {
      continue
    }

    const nameMatch = rawKey.match(/^item\.cobblemon\.([a-z0-9_]+)$/)
    if (nameMatch) {
      const itemId = nameMatch[1]
      if (itemId) {
        nameByItemId.set(itemId, value)
      }
      continue
    }

    const tooltipMatch = rawKey.match(/^item\.cobblemon\.([a-z0-9_]+)\.tooltip(?:_(\d+))?$/)
    if (tooltipMatch) {
      const itemId = tooltipMatch[1]
      if (!itemId) {
        continue
      }

      const index = tooltipMatch[2] ? Number.parseInt(tooltipMatch[2], 10) : 1
      if (!Number.isFinite(index) || index <= 0) {
        continue
      }

      if (!descriptionByItemId.has(itemId)) {
        descriptionByItemId.set(itemId, new Map<number, string>())
      }

      descriptionByItemId.get(itemId)?.set(index, value)
      continue
    }

    const descriptionMatch = rawKey.match(/^item\.cobblemon\.([a-z0-9_]+)\.(desc|description)$/)
    if (!descriptionMatch) {
      continue
    }

    const itemId = descriptionMatch[1]
    if (!itemId) {
      continue
    }

    if (!descriptionByItemId.has(itemId)) {
      descriptionByItemId.set(itemId, new Map<number, string>())
    }

    descriptionByItemId.get(itemId)?.set(1, value)
  }

  const allItemIds = new Set<string>([...nameByItemId.keys(), ...descriptionByItemId.keys()])
  const sortedItemIds = Array.from(allItemIds).sort((left, right) => left.localeCompare(right))
  const itemIndex: ItemIndex = {}

  for (const itemId of sortedItemIds) {
    const name = nameByItemId.get(itemId) ?? titleCaseFromId(itemId)
    const descriptionMap = descriptionByItemId.get(itemId)

    const descriptionLines = descriptionMap
      ? Array.from(descriptionMap.entries())
          .sort(([left], [right]) => left - right)
          .map(([, line]) => line)
          .filter((line, index, list) => list.indexOf(line) === index)
      : []

    itemIndex[itemId] = {
      itemId,
      name,
      description: descriptionLines.length > 0 ? descriptionLines.join(" ") : null,
      descriptionLines,
      assetPath: itemAssetPathById.get(itemId) ?? ITEM_ASSET_PATH_OVERRIDES[itemId] ?? null,
    }
  }

  return itemIndex
}

async function loadItemAssetPathById(): Promise<Map<string, string>> {
  const treeEntries = await listGitLabTreeEntries(COBBLEMON_ASSETS_ITEMS_ROOT, {
    recursive: true,
    perPage: 200,
  })

  const bestPathByItemId = new Map<string, string>()

  for (const treeEntry of treeEntries) {
    if (treeEntry.type !== "blob") {
      continue
    }

    const normalizedPath = treeEntry.path.trim().toLowerCase()
    if (!normalizedPath.endsWith(".png")) {
      continue
    }

    const fileName = normalizedPath.split("/").at(-1) ?? ""
    const itemId = fileName.replace(/\.png$/u, "")
    if (!/^[a-z0-9_]+$/u.test(itemId)) {
      continue
    }

    const existingPath = bestPathByItemId.get(itemId)
    if (!existingPath || isPreferredItemAssetPath(normalizedPath, existingPath)) {
      bestPathByItemId.set(itemId, normalizedPath)
    }
  }

  return bestPathByItemId
}

function isPreferredItemAssetPath(nextPath: string, currentPath: string): boolean {
  if (nextPath.length !== currentPath.length) {
    return nextPath.length < currentPath.length
  }

  return nextPath.localeCompare(currentPath) < 0
}

async function listGitLabTreeEntries(
  treePath: string,
  options?: {
    recursive?: boolean
    perPage?: number
  }
): Promise<GitLabTreeEntry[]> {
  const entries: GitLabTreeEntry[] = []
  const perPage = Math.min(Math.max(options?.perPage ?? 100, 1), 200)
  const recursive = options?.recursive ? "&recursive=true" : ""

  let page = 1
  while (true) {
    const url = `https://gitlab.com/api/v4/projects/${COBBLEMON_ASSETS_PROJECT_ID}/repository/tree?path=${encodeURIComponent(
      treePath
    )}&ref=${COBBLEMON_ASSETS_REF}&per_page=${perPage}&page=${page}${recursive}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `GitLab assets tree lookup failed with status ${response.status} for ${treePath}`
      )
    }

    const chunk = (await response.json()) as GitLabTreeEntry[]
    entries.push(...chunk)

    const nextPageRaw = response.headers.get("x-next-page")
    if (!nextPageRaw) {
      break
    }

    const nextPage = Number.parseInt(nextPageRaw, 10)
    if (!Number.isFinite(nextPage) || nextPage <= page) {
      break
    }

    page = nextPage
  }

  return entries
}

async function loadSpawnPresets(): Promise<Map<string, Record<string, unknown>>> {
  const presetFiles = await collectJsonFiles(SPAWN_PRESET_ROOT)
  const presets = new Map<string, Record<string, unknown>>()

  for (const filePath of presetFiles) {
    const presetName = path.basename(filePath, ".json")
    presets.set(presetName, await readJson(filePath))
  }

  return presets
}

async function loadBiomeTagMap(): Promise<Map<string, string[]>> {
  const biomeFiles = await collectJsonFiles(BIOME_TAG_ROOT)
  const map = new Map<string, string[]>()

  for (const filePath of biomeFiles) {
    const relativeTagPath = path.relative(BIOME_TAG_ROOT, filePath).replace(/\\/g, "/")
    const tagId = `#cobblemon:${relativeTagPath.replace(/\.json$/i, "")}`
    const data = await readJson(filePath)
    const values = Array.isArray(data.values) ? data.values : []

    const normalized = values
      .map((value) => {
        if (typeof value === "string") {
          return value
        }

        if (isRecord(value) && typeof value.id === "string") {
          return value.id
        }

        return null
      })
      .filter((value): value is string => value !== null)

    map.set(tagId, normalized)
  }

  return map
}

function buildBiomeTagIndex(biomeTagMap: Map<string, string[]>): BiomeTagIndex {
  const index: BiomeTagIndex = {}
  const sortedEntries = Array.from(biomeTagMap.entries()).sort(([left], [right]) => {
    return left.localeCompare(right)
  })

  for (const [tagId, locations] of sortedEntries) {
    const dedupedLocations: string[] = []
    const seenLocations = new Set<string>()

    for (const location of locations) {
      const normalizedLocation = location.trim()
      if (!normalizedLocation || seenLocations.has(normalizedLocation)) {
        continue
      }

      seenLocations.add(normalizedLocation)
      dedupedLocations.push(normalizedLocation)
    }

    index[tagId] = dedupedLocations
  }

  return index
}

async function loadBucketWeights(): Promise<Map<string, number>> {
  const data = await readJson(SPAWNER_CONFIG_PATH)
  const buckets = Array.isArray(data.buckets) ? data.buckets : []
  const weights = new Map<string, number>()

  for (const bucket of buckets) {
    if (!isRecord(bucket)) {
      continue
    }

    if (typeof bucket.name !== "string" || typeof bucket.weight !== "number") {
      continue
    }

    weights.set(bucket.name, bucket.weight)
  }

  return weights
}

async function loadSpawnEntriesBySlug(params: {
  speciesLookup: Map<string, string>
  spawnPresets: Map<string, Record<string, unknown>>
  bucketWeights: Map<string, number>
  biomeTagMap: Map<string, string[]>
  warnings: SpawnWarnings
}): Promise<Map<string, SpawnEntryRecord[]>> {
  const files = await collectJsonFiles(SPAWN_POOL_ROOT)
  const spawnBySlug = new Map<string, SpawnEntryRecord[]>()

  for (const filePath of files) {
    const data = await readJson(filePath)
    const spawns = Array.isArray(data.spawns) ? data.spawns : []

    for (const [spawnIndex, rawSpawn] of spawns.entries()) {
      if (!isRecord(rawSpawn)) {
        continue
      }

      const pokemonRaw = typeof rawSpawn.pokemon === "string" ? rawSpawn.pokemon : ""
      if (!pokemonRaw) {
        continue
      }

      const parsedPokemon = parsePokemonRef(pokemonRaw)
      const slug =
        resolvePokemonSlug(parsedPokemon.baseId, params.speciesLookup) ?? parsedPokemon.baseId

      const mergedCondition = mergePresetBlock(
        rawSpawn,
        "condition",
        params.spawnPresets,
        filePath,
        String(rawSpawn.id ?? "unknown")
      )
      const mergedAnticondition = mergePresetBlock(
        rawSpawn,
        "anticondition",
        params.spawnPresets,
        filePath,
        String(rawSpawn.id ?? "unknown")
      )

      collectBiomeWarnings(mergedCondition, params.warnings)
      collectBiomeWarnings(mergedAnticondition, params.warnings)

      const biomeHints = collectBiomeHints(mergedCondition, params.biomeTagMap)

      const levelText = (() => {
        if (typeof rawSpawn.level === "string") return rawSpawn.level
        if (typeof rawSpawn.level === "number") return String(rawSpawn.level)
        if (typeof rawSpawn.levelRange === "string") return rawSpawn.levelRange
        if (typeof rawSpawn.levelRange === "number") return String(rawSpawn.levelRange)
        return null
      })()

      const levelRange = parseLevelRange(levelText)
      const presets = Array.isArray(rawSpawn.presets)
        ? rawSpawn.presets.map((value) => String(value))
        : []

      const weightMultipliers = parseWeightMultipliers(rawSpawn)

      const entry: SpawnEntryRecord = {
        id:
          typeof rawSpawn.id === "string"
            ? rawSpawn.id
            : `${slug}-${path.basename(filePath, ".json")}-${spawnIndex + 1}`,
        sourceFile: path.basename(filePath),
        pokemon: {
          raw: pokemonRaw,
          slug,
          aspectTokens: parsedPokemon.aspectTokens,
        },
        type: typeof rawSpawn.type === "string" ? rawSpawn.type : "pokemon",
        spawnablePositionType:
          typeof rawSpawn.spawnablePositionType === "string"
            ? rawSpawn.spawnablePositionType
            : "unknown",
        bucket: typeof rawSpawn.bucket === "string" ? rawSpawn.bucket : "unknown",
        bucketWeight:
          typeof rawSpawn.bucket === "string"
            ? (params.bucketWeights.get(rawSpawn.bucket) ?? null)
            : null,
        levelText,
        levelMin: levelRange.min,
        levelMax: levelRange.max,
        weight: typeof rawSpawn.weight === "number" ? rawSpawn.weight : null,
        presets,
        biomeHints,
        condition: mergedCondition,
        anticondition: mergedAnticondition,
        weightMultipliers,
        raw: rawSpawn,
      }

      const list = spawnBySlug.get(slug) ?? []
      list.push(entry)
      spawnBySlug.set(slug, list)
    }
  }

  for (const entries of spawnBySlug.values()) {
    entries.sort((left, right) => left.id.localeCompare(right.id))
  }

  return spawnBySlug
}

function buildPokemonDetailRecord(params: {
  speciesFile: RawSpeciesFile
  speciesLookup: Map<string, string>
  moveNames: Map<string, string>
  moveEntries: ShowdownData["moves"]
  spawnEntries: SpawnEntryRecord[]
  moveLearnersBuild: MoveLearnersBuildMap
}): PokemonDetailRecord {
  const { speciesFile } = params
  const raw = speciesFile.data

  const name = String(raw.name)
  const dexNumber = Number(raw.nationalPokedexNumber)
  const implemented = Boolean(raw.implemented)

  const types = [raw.primaryType, raw.secondaryType]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase())

  const abilities = parseAbilityList(raw.abilities)

  const eggGroups = Array.isArray(raw.eggGroups)
    ? raw.eggGroups.filter((group): group is string => typeof group === "string")
    : []

  const labels = Array.isArray(raw.labels)
    ? raw.labels.filter((label): label is string => typeof label === "string")
    : []

  const aspects = Array.isArray(raw.aspects)
    ? raw.aspects.filter((aspect): aspect is string => typeof aspect === "string")
    : []

  const aliases = new Set<string>()
  aliases.add(normalizeSearchText(name))
  aliases.add(normalizeSearchText(speciesFile.slug))

  const baseMoves = parseMoveList(raw.moves, {
    moveNames: params.moveNames,
    moveEntries: params.moveEntries,
    sourceLabel: speciesFile.slug,
    fromForm: null,
    fromFormSlug: null,
  })
  addMovesToLearnerIndex(params.moveLearnersBuild, speciesFile.slug, baseMoves)

  const forms = parseForms(raw.forms, {
    speciesSlug: speciesFile.slug,
    speciesName: name,
    moveNames: params.moveNames,
    moveEntries: params.moveEntries,
    speciesLookup: params.speciesLookup,
    aliasSet: aliases,
    moveLearnersBuild: params.moveLearnersBuild,
  })

  const preEvolution =
    typeof raw.preEvolution === "string"
      ? toPokemonRef(raw.preEvolution, params.speciesLookup)
      : null

  const evolutions = parseEvolutionEdges(raw.evolutions, {
    fromForm: null,
    speciesLookup: params.speciesLookup,
  })

  for (const form of forms) {
    aliases.add(normalizeSearchText(form.name))
    aliases.add(normalizeSearchText(`${name} ${form.name}`))
  }

  const detail: PokemonDetailRecord = {
    slug: speciesFile.slug,
    name,
    dexNumber,
    implemented,
    types,
    abilities,
    eggGroups,
    labels,
    aspects,
    aliases: Array.from(aliases).filter(Boolean).sort(),
    maleRatio: typeof raw.maleRatio === "number" ? raw.maleRatio : null,
    height: typeof raw.height === "number" ? raw.height : null,
    weight: typeof raw.weight === "number" ? raw.weight : null,
    catchRate: typeof raw.catchRate === "number" ? raw.catchRate : null,
    baseExperienceYield:
      typeof raw.baseExperienceYield === "number" ? raw.baseExperienceYield : null,
    baseFriendship: typeof raw.baseFriendship === "number" ? raw.baseFriendship : null,
    eggCycles: typeof raw.eggCycles === "number" ? raw.eggCycles : null,
    baseStats: isRecord(raw.baseStats)
      ? toNumericRecord(raw.baseStats)
      : {
          hp: 0,
          attack: 0,
          defence: 0,
          special_attack: 0,
          special_defence: 0,
          speed: 0,
        },
    evYield: isRecord(raw.evYield) ? toNumericRecord(raw.evYield) : {},
    preEvolution,
    evolutions,
    evolutionFamily: {
      members: [
        {
          nodeId: speciesFile.slug,
          slug: speciesFile.slug,
          name,
          dexNumber,
          formSlug: null,
          formName: null,
        },
      ],
      edges: [],
      roots: [speciesFile.slug],
    },
    moves: [...baseMoves].sort(sortMoves),
    spawnEntries: [...params.spawnEntries],
    forms,
    drops: parseDrops(raw.drops),
    rawSpecies: raw,
  }

  return detail
}

function parseDrops(rawDrops: unknown): PokemonDropData | null {
  if (!isRecord(rawDrops)) {
    return null
  }

  const amount = typeof rawDrops.amount === "number" ? rawDrops.amount : 0
  const entries = Array.isArray(rawDrops.entries) ? rawDrops.entries : []

  const parsedEntries: PokemonDropData["entries"] = []
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.item !== "string") {
      continue
    }

    parsedEntries.push({
      item: entry.item,
      quantityRange: typeof entry.quantityRange === "string" ? entry.quantityRange : undefined,
      percentage: typeof entry.percentage === "number" ? entry.percentage : undefined,
    })
  }

  if (parsedEntries.length === 0) {
    return null
  }

  return { amount, entries: parsedEntries }
}

async function loadPokemonInteractionIndex(
  detailsBySlug: Map<string, PokemonDetailRecord>
): Promise<PokemonInteractionIndex> {
  const interactionFiles = await collectJsonFiles(POKEMON_INTERACTIONS_ROOT)
  const interactions: PokemonInteractionRecord[] = []

  for (const filePath of interactionFiles) {
    const rawData = await readJson(filePath)
    if (!isRecord(rawData)) {
      continue
    }

    const pokemonSlug = path.basename(filePath, ".json").toLowerCase()
    const pokemonDetail = detailsBySlug.get(pokemonSlug)
    if (!pokemonDetail) {
      continue
    }

    const baseRequirements = Array.isArray(rawData.requirements) ? rawData.requirements : []
    const rawInteractions = Array.isArray(rawData.interactions) ? rawData.interactions : []

    for (let index = 0; index < rawInteractions.length; index += 1) {
      const rawInteraction = rawInteractions[index]
      if (!isRecord(rawInteraction)) {
        continue
      }

      const interactionRequirements = Array.isArray(rawInteraction.requirements)
        ? rawInteraction.requirements
        : []
      const { requiredItem, requiredItemCondition } = resolveInteractionRequiredItem({
        baseRequirements,
        interactionRequirements,
        grouping: typeof rawInteraction.grouping === "string" ? rawInteraction.grouping : null,
      })

      const drops = parseInteractionDrops(rawInteraction.effects)
      if (drops.length === 0) {
        continue
      }

      const contextTokens = resolveInteractionContextTokens(
        pokemonSlug,
        baseRequirements,
        interactionRequirements
      )

      const cooldownTicks = parseIntegerValue(rawInteraction.cooldown)

      interactions.push({
        id: `${pokemonSlug}:${index + 1}`,
        pokemonSlug,
        pokemonName: pokemonDetail.name,
        dexNumber: pokemonDetail.dexNumber,
        grouping: typeof rawInteraction.grouping === "string" ? rawInteraction.grouping : "unknown",
        requiredItem,
        requiredItemCondition,
        cooldownTicks,
        cooldownSeconds: cooldownTicks === null ? null : cooldownTicks / 20,
        contextTokens,
        contextLabel: formatInteractionContextLabel(contextTokens),
        drops,
        raw: rawInteraction,
      })
    }
  }

  const speciesFeatureAssignments = await loadSpeciesFeatureAssignmentsBySlug()
  const slowpokeTailsMechanic = await loadSlowpokeTailsMechanicConfig()
  interactions.push(
    ...buildSyntheticShearingInteractions({
      detailsBySlug,
      existingInteractions: interactions,
      speciesFeatureAssignments,
      slowpokeTailsMechanic,
    })
  )

  interactions.sort((left, right) => {
    if (left.dexNumber !== right.dexNumber) {
      return left.dexNumber - right.dexNumber
    }

    return left.id.localeCompare(right.id)
  })

  const byPokemon: PokemonInteractionIndex["byPokemon"] = {}
  const byRequiredItem: PokemonInteractionIndex["byRequiredItem"] = {}
  const byGrantedItem: PokemonInteractionIndex["byGrantedItem"] = {}

  for (const interaction of interactions) {
    if (!byPokemon[interaction.pokemonSlug]) {
      byPokemon[interaction.pokemonSlug] = []
    }
    byPokemon[interaction.pokemonSlug]?.push(interaction)

    if (interaction.requiredItem) {
      const requiredItemKey = toItemKey(interaction.requiredItem)
      if (!byRequiredItem[requiredItemKey]) {
        byRequiredItem[requiredItemKey] = []
      }

      byRequiredItem[requiredItemKey]?.push(interaction)
    }

    for (const drop of interaction.drops) {
      const grantedItemKey = toItemKey(drop.item)
      if (!byGrantedItem[grantedItemKey]) {
        byGrantedItem[grantedItemKey] = []
      }

      byGrantedItem[grantedItemKey]?.push(interaction)
    }
  }

  sortInteractionIndexBuckets(byPokemon)
  sortInteractionIndexBuckets(byRequiredItem)
  sortInteractionIndexBuckets(byGrantedItem)

  return {
    byPokemon,
    byRequiredItem,
    byGrantedItem,
  }
}

type SlowpokeTailsMechanicConfig = {
  canShearSlowpoke: boolean
  regrowthSeconds: number | null
}

async function loadSpeciesFeatureAssignmentsBySlug(): Promise<Map<string, Set<string>>> {
  const assignmentsBySlug = new Map<string, Set<string>>()
  if (!(await pathExists(SPECIES_FEATURE_ASSIGNMENTS_ROOT))) {
    return assignmentsBySlug
  }

  const assignmentFiles = await collectJsonFiles(SPECIES_FEATURE_ASSIGNMENTS_ROOT)
  for (const filePath of assignmentFiles) {
    const rawData = await readJson(filePath)
    const rawFeatures = Array.isArray(rawData.features) ? rawData.features : []
    const features = rawFeatures
      .filter((feature): feature is string => typeof feature === "string")
      .map((feature) => feature.trim().toLowerCase())
      .filter(Boolean)

    if (features.length === 0) {
      continue
    }

    const rawPokemon = Array.isArray(rawData.pokemon) ? rawData.pokemon : []
    for (const pokemonRef of rawPokemon) {
      if (typeof pokemonRef !== "string") {
        continue
      }

      const slug = normalizeSpeciesAssignmentSlug(pokemonRef)
      if (!slug) {
        continue
      }

      const existing = assignmentsBySlug.get(slug)
      if (existing) {
        for (const feature of features) {
          existing.add(feature)
        }
        continue
      }

      assignmentsBySlug.set(slug, new Set(features))
    }
  }

  return assignmentsBySlug
}

function normalizeSpeciesAssignmentSlug(pokemonRef: string): string | null {
  const normalized = pokemonRef.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const firstToken = normalized.split(/\s+/)[0] ?? ""
  const slug = firstToken.trim().toLowerCase()
  return slug.length > 0 ? slug : null
}

async function loadSlowpokeTailsMechanicConfig(): Promise<SlowpokeTailsMechanicConfig> {
  if (!(await pathExists(SLOWPOKE_TAILS_MECHANIC_PATH))) {
    return {
      canShearSlowpoke: true,
      regrowthSeconds: null,
    }
  }

  const rawData = await readJson(SLOWPOKE_TAILS_MECHANIC_PATH)
  return {
    canShearSlowpoke: rawData.canShearSlowpoke !== false,
    regrowthSeconds: parseIntegerValue(rawData.regrowthSeconds),
  }
}

function buildSyntheticShearingInteractions(params: {
  detailsBySlug: Map<string, PokemonDetailRecord>
  existingInteractions: PokemonInteractionRecord[]
  speciesFeatureAssignments: Map<string, Set<string>>
  slowpokeTailsMechanic: SlowpokeTailsMechanicConfig
}): PokemonInteractionRecord[] {
  const synthetic: PokemonInteractionRecord[] = []
  const sortedDetails = Array.from(params.detailsBySlug.values()).sort((left, right) => {
    if (left.dexNumber !== right.dexNumber) {
      return left.dexNumber - right.dexNumber
    }

    return left.slug.localeCompare(right.slug)
  })

  for (const detail of sortedDetails) {
    const featureSet = new Set<string>()

    const rawFeatures = Array.isArray(detail.rawSpecies.features) ? detail.rawSpecies.features : []
    for (const feature of rawFeatures) {
      if (typeof feature === "string") {
        const normalized = feature.trim().toLowerCase()
        if (normalized) {
          featureSet.add(normalized)
        }
      }
    }

    for (const feature of params.speciesFeatureAssignments.get(detail.slug) ?? []) {
      featureSet.add(feature)
    }

    if (featureSet.has("sheared")) {
      const woolDropItem = resolveShearingWoolDrop(detail)
      const hasExisting = hasEquivalentInteraction({
        existingInteractions: [...params.existingInteractions, ...synthetic],
        pokemonSlug: detail.slug,
        requiredItem: "minecraft:shears",
        dropItem: woolDropItem,
      })

      if (!hasExisting) {
        const contextTokens = featureSet.has("color") ? ["color=varies"] : []
        synthetic.push({
          id: `${detail.slug}:auto-shears-wool`,
          pokemonSlug: detail.slug,
          pokemonName: detail.name,
          dexNumber: detail.dexNumber,
          grouping: "cobblemon:shears",
          requiredItem: "minecraft:shears",
          requiredItemCondition: "#c:tools/shear",
          cooldownTicks: null,
          cooldownSeconds: null,
          contextTokens,
          contextLabel: formatInteractionContextLabel(contextTokens),
          drops: [
            {
              item: woolDropItem,
              effectVariant: "drop_item",
              amount: "2-4",
            },
          ],
          raw: {
            source: "species.features[sheared]",
            mechanic: "PokemonEntity.shear",
          },
        })
      }
    }

    if (featureSet.has("slowpoke_tail_regrowth") && params.slowpokeTailsMechanic.canShearSlowpoke) {
      const hasExisting = hasEquivalentInteraction({
        existingInteractions: [...params.existingInteractions, ...synthetic],
        pokemonSlug: detail.slug,
        requiredItem: "minecraft:shears",
        dropItem: "cobblemon:tasty_tail",
      })

      if (!hasExisting) {
        const cooldownSeconds = params.slowpokeTailsMechanic.regrowthSeconds
        synthetic.push({
          id: `${detail.slug}:auto-shears-tail`,
          pokemonSlug: detail.slug,
          pokemonName: detail.name,
          dexNumber: detail.dexNumber,
          grouping: "cobblemon:shears",
          requiredItem: "minecraft:shears",
          requiredItemCondition: "#c:tools/shear",
          cooldownTicks: cooldownSeconds === null ? null : cooldownSeconds * 20,
          cooldownSeconds,
          contextTokens: [],
          contextLabel: null,
          drops: [
            {
              item: "cobblemon:tasty_tail",
              effectVariant: "drop_item",
              amount: "1",
            },
          ],
          raw: {
            source: "species_feature_assignments/slowpoke_tail_regrowth.json",
            mechanic: "SlowpokeTailRegrowthSpeciesFeature.onShear",
          },
        })
      }
    }
  }

  return synthetic
}

function resolveShearingWoolDrop(detail: PokemonDetailRecord): string {
  for (const drop of detail.drops?.entries ?? []) {
    const normalizedItem = drop.item.trim().toLowerCase()
    const dropPath = splitItemReference(normalizedItem).path
    if (dropPath === "wool" || dropPath.endsWith("_wool")) {
      return normalizedItem
    }
  }

  return "minecraft:white_wool"
}

function hasEquivalentInteraction(params: {
  existingInteractions: PokemonInteractionRecord[]
  pokemonSlug: string
  requiredItem: string
  dropItem: string
}): boolean {
  const requiredItemKey = toItemKey(params.requiredItem)
  const dropItemKey = toItemKey(params.dropItem)

  return params.existingInteractions.some((interaction) => {
    if (interaction.pokemonSlug !== params.pokemonSlug) {
      return false
    }

    if (!interaction.requiredItem || toItemKey(interaction.requiredItem) !== requiredItemKey) {
      return false
    }

    return interaction.drops.some((drop) => toItemKey(drop.item) === dropItemKey)
  })
}

function sortInteractionIndexBuckets(index: Record<string, PokemonInteractionRecord[]>) {
  for (const interactions of Object.values(index)) {
    interactions.sort((left, right) => {
      if (left.dexNumber !== right.dexNumber) {
        return left.dexNumber - right.dexNumber
      }

      return left.id.localeCompare(right.id)
    })
  }
}

function resolveInteractionRequiredItem(params: {
  baseRequirements: unknown[]
  interactionRequirements: unknown[]
  grouping: string | null
}): {
  requiredItem: string | null
  requiredItemCondition: string | null
} {
  const interactionItemCondition = extractOwnerHeldItemCondition(params.interactionRequirements)
  const baseItemCondition = extractOwnerHeldItemCondition(params.baseRequirements)
  const itemCondition = interactionItemCondition ?? baseItemCondition

  const requiredItemFromCondition = resolveItemFromInteractionCondition(itemCondition)
  if (requiredItemFromCondition) {
    return {
      requiredItem: requiredItemFromCondition,
      requiredItemCondition: itemCondition,
    }
  }

  if (params.grouping) {
    const groupingPath = splitItemReference(params.grouping).path
    const fallbackByGrouping = INTERACTION_GROUPING_ITEM_ALIASES[groupingPath]
    if (fallbackByGrouping) {
      return {
        requiredItem: fallbackByGrouping,
        requiredItemCondition: itemCondition,
      }
    }
  }

  return {
    requiredItem: null,
    requiredItemCondition: itemCondition,
  }
}

function extractOwnerHeldItemCondition(requirements: unknown[]): string | null {
  for (const requirement of requirements) {
    if (!isRecord(requirement)) {
      continue
    }

    if (requirement.variant !== "owner_held_item") {
      continue
    }

    if (typeof requirement.itemCondition === "string") {
      return requirement.itemCondition.trim().toLowerCase()
    }
  }

  return null
}

function resolveItemFromInteractionCondition(itemCondition: string | null): string | null {
  if (!itemCondition) {
    return null
  }

  const normalized = itemCondition.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (INTERACTION_ITEM_CONDITION_ALIASES[normalized]) {
    return INTERACTION_ITEM_CONDITION_ALIASES[normalized]
  }

  if (normalized.startsWith("#")) {
    return null
  }

  return normalized
}

function parseInteractionDrops(rawEffects: unknown): PokemonInteractionRecord["drops"] {
  if (!Array.isArray(rawEffects)) {
    return []
  }

  const drops: PokemonInteractionRecord["drops"] = []
  const seen = new Set<string>()

  for (const effect of rawEffects) {
    if (!isRecord(effect)) {
      continue
    }

    if (effect.variant !== "drop_item" && effect.variant !== "give_item") {
      continue
    }

    if (typeof effect.item !== "string") {
      continue
    }

    const item = effect.item.trim().toLowerCase()
    if (!item) {
      continue
    }

    const amount = formatInteractionAmount(effect.amount)
    const dedupeKey = `${effect.variant}:${item}:${amount ?? ""}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    drops.push({
      item,
      effectVariant: effect.variant,
      amount,
    })
  }

  return drops
}

function formatInteractionAmount(rawAmount: unknown): string | null {
  if (typeof rawAmount === "number" && Number.isFinite(rawAmount)) {
    return String(rawAmount)
  }

  if (typeof rawAmount === "string") {
    const trimmed = rawAmount.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  return null
}

function resolveInteractionContextTokens(
  pokemonSlug: string,
  baseRequirements: unknown[],
  interactionRequirements: unknown[]
): string[] {
  const rootTargets = extractInteractionPropertyTargets(baseRequirements)
  const interactionTargets = extractInteractionPropertyTargets(interactionRequirements)

  const rootTokens = selectInteractionTargetTokens(pokemonSlug, rootTargets)
  const interactionTokens = selectInteractionTargetTokens(pokemonSlug, interactionTargets)

  return Array.from(new Set([...rootTokens, ...interactionTokens]))
}

function extractInteractionPropertyTargets(requirements: unknown[]): string[] {
  const targets: string[] = []

  for (const requirement of requirements) {
    if (!isRecord(requirement)) {
      continue
    }

    if (requirement.variant !== "properties") {
      continue
    }

    if (typeof requirement.target === "string") {
      const target = requirement.target.trim().toLowerCase()
      if (target) {
        targets.push(target)
      }
    }
  }

  return targets
}

function selectInteractionTargetTokens(pokemonSlug: string, targets: string[]): string[] {
  const parsedTargets = targets.map((target) => parsePokemonRef(target))
  const exactMatch = parsedTargets.find(
    (target) => canonicalId(target.baseId) === canonicalId(pokemonSlug)
  )
  if (exactMatch) {
    return exactMatch.aspectTokens
  }

  return parsedTargets[0]?.aspectTokens ?? []
}

function formatInteractionContextLabel(tokens: string[]): string | null {
  if (tokens.length === 0) {
    return null
  }

  const labels = tokens.map((token) => {
    const normalized = token.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    if (normalized === "gender=female" || normalized === "sex=female") {
      return "Female only"
    }

    if (normalized === "gender=male" || normalized === "sex=male") {
      return "Male only"
    }

    if (normalized.startsWith("form=")) {
      const formId = normalized.slice("form=".length)
      return `Form: ${titleCaseFromId(formId)}`
    }

    const equalsIndex = normalized.indexOf("=")
    if (equalsIndex > 0) {
      const key = normalized.slice(0, equalsIndex)
      const value = normalized.slice(equalsIndex + 1)
      return `${titleCaseFromId(key)}: ${titleCaseFromId(value)}`
    }

    return titleCaseFromId(normalized)
  })

  const dedupedLabels = Array.from(
    new Set(labels.filter((label): label is string => Boolean(label)))
  )
  return dedupedLabels.length > 0 ? dedupedLabels.join(", ") : null
}

function parseIntegerValue(rawValue: unknown): number | null {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return Math.trunc(rawValue)
  }

  if (typeof rawValue === "string") {
    const parsed = Number.parseInt(rawValue.trim(), 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function augmentItemIndex(
  baseItemIndex: ItemIndex,
  detailsBySlug: Map<string, PokemonDetailRecord>,
  interactionIndex: PokemonInteractionIndex
): ItemIndex {
  const itemIndex: ItemIndex = {}

  for (const [key, entry] of Object.entries(baseItemIndex)) {
    const normalizedKey = toItemKey(key)
    itemIndex[normalizedKey] = {
      ...entry,
    }
  }

  const referencedItems = new Set<string>()
  for (const detail of detailsBySlug.values()) {
    if (!detail.drops) {
      continue
    }

    for (const dropEntry of detail.drops.entries) {
      referencedItems.add(dropEntry.item)
    }
  }

  for (const interactionEntries of Object.values(interactionIndex.byPokemon)) {
    for (const interactionEntry of interactionEntries) {
      if (interactionEntry.requiredItem) {
        referencedItems.add(interactionEntry.requiredItem)
      }

      for (const drop of interactionEntry.drops) {
        referencedItems.add(drop.item)
      }
    }
  }

  for (const itemRef of referencedItems) {
    const { namespace, path } = splitItemReference(itemRef)
    const itemKey = toItemKey(path)
    if (!itemKey || itemIndex[itemKey]) {
      continue
    }

    itemIndex[itemKey] = {
      itemId: itemKey,
      namespace,
      resourceId: namespace ? `${namespace}:${itemKey}` : itemKey,
      name: titleCaseFromId(itemKey),
      description: null,
      descriptionLines: [],
      assetPath: null,
    }
  }

  return itemIndex
}

function toItemKey(itemRef: string): string {
  return splitItemReference(itemRef).path
}

function splitItemReference(itemRef: string): { namespace: string | null; path: string } {
  const normalized = itemRef.trim().toLowerCase()
  const separatorIndex = normalized.indexOf(":")

  if (separatorIndex < 0) {
    return {
      namespace: null,
      path: normalized,
    }
  }

  return {
    namespace: normalized.slice(0, separatorIndex) || null,
    path: normalized.slice(separatorIndex + 1),
  }
}

function parseAbilityList(rawAbilities: unknown): PokemonDetailRecord["abilities"] {
  if (!Array.isArray(rawAbilities)) {
    return []
  }

  const parsed: PokemonDetailRecord["abilities"] = []
  const seen = new Set<string>()
  let nextRegularSlot: AbilitySlot = "first"

  for (const rawAbility of rawAbilities) {
    if (typeof rawAbility !== "string") {
      continue
    }

    const normalized = formatAbilityId(rawAbility)
    const slot: AbilitySlot = normalized.hidden ? "hidden" : nextRegularSlot
    if (!normalized.hidden && nextRegularSlot === "first") {
      nextRegularSlot = "second"
    }

    const dedupeKey = `${normalized.id}:${slot}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    parsed.push({
      ...normalized,
      slot,
    })
  }

  return parsed
}

function parseForms(
  rawForms: unknown,
  params: {
    speciesSlug: string
    speciesName: string
    moveNames: Map<string, string>
    moveEntries: ShowdownData["moves"]
    speciesLookup: Map<string, string>
    aliasSet: Set<string>
    moveLearnersBuild: MoveLearnersBuildMap
  }
): PokemonFormRecord[] {
  if (!Array.isArray(rawForms)) {
    return []
  }

  const parsed: PokemonFormRecord[] = []
  for (const [index, rawForm] of rawForms.entries()) {
    if (!isRecord(rawForm)) {
      continue
    }

    const formName = typeof rawForm.name === "string" ? rawForm.name : `Form ${index + 1}`
    const formSlugBase = canonicalId(formName)
    const formSlug = formSlugBase
      ? `${params.speciesSlug}-${formSlugBase}`
      : `${params.speciesSlug}-form-${index + 1}`

    const formTypes = [rawForm.primaryType, rawForm.secondaryType]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((value) => value.toLowerCase())

    const formAbilities = parseAbilityList(rawForm.abilities)

    const formMoves = parseMoveList(rawForm.moves, {
      moveNames: params.moveNames,
      moveEntries: params.moveEntries,
      sourceLabel: `${params.speciesSlug}:${formName}`,
      fromForm: formName,
      fromFormSlug: formSlug,
    })
    addMovesToLearnerIndex(params.moveLearnersBuild, params.speciesSlug, formMoves)

    const formEvolutions = parseEvolutionEdges(rawForm.evolutions, {
      fromForm: formName,
      speciesLookup: params.speciesLookup,
    })

    parsed.push({
      name: formName,
      slug: formSlug,
      aspects: Array.isArray(rawForm.aspects)
        ? rawForm.aspects.filter((aspect): aspect is string => typeof aspect === "string")
        : [],
      labels: Array.isArray(rawForm.labels)
        ? rawForm.labels.filter((label): label is string => typeof label === "string")
        : [],
      types: formTypes,
      maleRatio: typeof rawForm.maleRatio === "number" ? rawForm.maleRatio : null,
      height: typeof rawForm.height === "number" ? rawForm.height : null,
      weight: typeof rawForm.weight === "number" ? rawForm.weight : null,
      catchRate: typeof rawForm.catchRate === "number" ? rawForm.catchRate : null,
      baseExperienceYield:
        typeof rawForm.baseExperienceYield === "number" ? rawForm.baseExperienceYield : null,
      baseFriendship: typeof rawForm.baseFriendship === "number" ? rawForm.baseFriendship : null,
      eggCycles: typeof rawForm.eggCycles === "number" ? rawForm.eggCycles : null,
      baseStats: isRecord(rawForm.baseStats) ? toNumericRecord(rawForm.baseStats) : {},
      evYield: isRecord(rawForm.evYield) ? toNumericRecord(rawForm.evYield) : {},
      battleOnly: Boolean(rawForm.battleOnly),
      abilities: formAbilities,
      moves: formMoves,
      evolutions: formEvolutions,
      raw: rawForm,
    })

    params.aliasSet.add(normalizeSearchText(formName))
    params.aliasSet.add(normalizeSearchText(`${params.speciesName} ${formName}`))
  }

  return parsed
}

function parseMoveList(
  rawMoves: unknown,
  params: {
    moveNames: Map<string, string>
    moveEntries: ShowdownData["moves"]
    sourceLabel: string
    fromForm: string | null
    fromFormSlug: string | null
  }
): ParsedMove[] {
  if (!Array.isArray(rawMoves)) {
    return []
  }

  const seen = new Set<string>()
  const parsed: ParsedMove[] = []

  for (const rawMove of rawMoves) {
    if (typeof rawMove !== "string") {
      continue
    }

    const [prefixRaw, moveIdRaw] = rawMove.split(":")
    if (!prefixRaw || !moveIdRaw) {
      continue
    }

    const moveId = moveIdRaw.trim().toLowerCase()
    const moveName = params.moveNames.get(moveId)
    const moveEntry = params.moveEntries.get(moveId)
    if (!moveName) {
      throw new Error(
        `Move id in species moves is not resolvable in move map: ${moveId} (${params.sourceLabel})`
      )
    }

    const moveType = moveEntry?.type ?? null

    const parsedPrefix = parseMovePrefix(prefixRaw)
    if (!parsedPrefix) {
      throw new Error(`Unsupported move source prefix \`${prefixRaw}\` in ${params.sourceLabel}`)
    }

    const dedupeKey = `${moveId}::${parsedPrefix.sourceType}::${parsedPrefix.sourceValue ?? ""}::${params.fromFormSlug ?? ""}`
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)

    parsed.push({
      raw: rawMove,
      moveId,
      moveName,
      type: moveType,
      sourceType: parsedPrefix.sourceType,
      sourceValue: parsedPrefix.sourceValue,
      fromForm: params.fromForm,
      fromFormSlug: params.fromFormSlug,
    })
  }

  return parsed
}

function parseMovePrefix(prefixRaw: string): {
  sourceType: MoveSourceType
  sourceValue: number | null
} | null {
  if (/^\d+$/.test(prefixRaw)) {
    return {
      sourceType: "level",
      sourceValue: Number.parseInt(prefixRaw, 10),
    }
  }

  if (!KNOWN_MOVE_PREFIXES.has(prefixRaw)) {
    return null
  }

  return {
    sourceType: prefixRaw as MoveSourceType,
    sourceValue: null,
  }
}

function parseEvolutionEdges(
  rawEvolutions: unknown,
  params: {
    fromForm: string | null
    speciesLookup: Map<string, string>
  }
): EvolutionEdgeRecord[] {
  if (!Array.isArray(rawEvolutions)) {
    return []
  }

  const edges: EvolutionEdgeRecord[] = []

  for (const [index, rawEvolution] of rawEvolutions.entries()) {
    if (!isRecord(rawEvolution)) {
      continue
    }

    const resultRaw = typeof rawEvolution.result === "string" ? rawEvolution.result : ""
    const result = resultRaw
      ? toPokemonRef(resultRaw, params.speciesLookup)
      : { raw: "", slug: "unknown", aspectTokens: [] }

    const requirementObjects = Array.isArray(rawEvolution.requirements)
      ? rawEvolution.requirements
      : []

    const variant = typeof rawEvolution.variant === "string" ? rawEvolution.variant : "unknown"
    const requiredContext =
      typeof rawEvolution.requiredContext === "string" ? rawEvolution.requiredContext : null

    const requirements = requirementObjects
      .filter((value): value is Record<string, unknown> => isRecord(value))
      .map((requirement) => {
        return {
          variant: typeof requirement.variant === "string" ? requirement.variant : "unknown",
          text: formatEvolutionRequirement(requirement),
          raw: requirement,
        }
      })

    const requirementText = requirements.map((requirement) => requirement.text)
    if (requiredContext) {
      const requiredContextText = formatEvolutionRequiredContext(variant, requiredContext)
      if (!requirementText.includes(requiredContextText)) {
        requirementText.unshift(requiredContextText)
      }
    }

    edges.push({
      id: typeof rawEvolution.id === "string" ? rawEvolution.id : `evolution-${index + 1}`,
      variant,
      result,
      consumeHeldItem: Boolean(rawEvolution.consumeHeldItem),
      learnableMoves: Array.isArray(rawEvolution.learnableMoves)
        ? rawEvolution.learnableMoves.filter((move): move is string => typeof move === "string")
        : [],
      requirementText,
      requirements,
      requiredContext,
      fromForm: params.fromForm,
      raw: rawEvolution,
    })
  }

  return edges
}

function buildEvolutionFamilies(
  detailsBySlug: Map<string, PokemonDetailRecord>
): Map<string, PokemonDetailRecord["evolutionFamily"]> {
  const adjacency = new Map<string, Set<string>>()
  const directedEdges: DirectedEvolutionEdge[] = []

  function link(a: string, b: string) {
    if (!adjacency.has(a)) {
      adjacency.set(a, new Set<string>())
    }
    if (!adjacency.has(b)) {
      adjacency.set(b, new Set<string>())
    }
    adjacency.get(a)?.add(b)
    adjacency.get(b)?.add(a)
  }

  for (const detail of detailsBySlug.values()) {
    if (!adjacency.has(detail.slug)) {
      adjacency.set(detail.slug, new Set<string>())
    }

    if (detail.preEvolution) {
      link(detail.slug, detail.preEvolution.slug)
    }

    for (const evolution of detail.evolutions) {
      link(detail.slug, evolution.result.slug)
      directedEdges.push({
        fromSlug: detail.slug,
        fromFormSlug: null,
        fromFormName: null,
        toSlug: evolution.result.slug,
        toAspectTokens: evolution.result.aspectTokens,
        method: evolution.variant,
        requirementText: evolution.requirementText,
      })
    }

    for (const form of detail.forms) {
      for (const evolution of form.evolutions) {
        link(detail.slug, evolution.result.slug)
        directedEdges.push({
          fromSlug: detail.slug,
          fromFormSlug: form.slug,
          fromFormName: form.name,
          toSlug: evolution.result.slug,
          toAspectTokens: evolution.result.aspectTokens,
          method: evolution.variant,
          requirementText: evolution.requirementText,
        })
      }
    }
  }

  const familyBySlug = new Map<string, PokemonDetailRecord["evolutionFamily"]>()

  for (const detail of detailsBySlug.values()) {
    const component = walkComponent(detail.slug, adjacency)
    const componentSet = new Set(component)
    const memberByNodeId = new Map<
      string,
      PokemonDetailRecord["evolutionFamily"]["members"][number]
    >()

    for (const slug of component) {
      const memberDetail = detailsBySlug.get(slug)
      if (!memberDetail) {
        continue
      }

      memberByNodeId.set(slug, {
        nodeId: slug,
        slug,
        name: memberDetail.name,
        dexNumber: memberDetail.dexNumber,
        formSlug: null,
        formName: null,
      })
    }

    const componentEdges = directedEdges.filter(
      (edge) => componentSet.has(edge.fromSlug) && componentSet.has(edge.toSlug)
    )

    const resolvedEdges: ResolvedEvolutionFamilyEdge[] = []
    for (const edge of componentEdges) {
      const fromMember = resolveEvolutionFamilyMemberNode({
        detail: detailsBySlug.get(edge.fromSlug) ?? null,
        fallbackSlug: edge.fromSlug,
        preferredFormSlug: edge.fromFormSlug,
        preferredFormName: null,
        aspectTokens: [],
      })
      const toMember = resolveEvolutionFamilyMemberNode({
        detail: detailsBySlug.get(edge.toSlug) ?? null,
        fallbackSlug: edge.toSlug,
        preferredFormSlug: null,
        preferredFormName: edge.toAspectTokens.length === 0 ? (edge.fromFormName ?? null) : null,
        aspectTokens: edge.toAspectTokens,
      })

      memberByNodeId.set(fromMember.nodeId, fromMember)
      memberByNodeId.set(toMember.nodeId, toMember)

      resolvedEdges.push({
        fromNodeId: fromMember.nodeId,
        toNodeId: toMember.nodeId,
        fromSlug: edge.fromSlug,
        toSlug: edge.toSlug,
        method: edge.method,
        requirementText: edge.requirementText,
        sourceFormSlug: edge.fromFormSlug,
      })
    }

    const preferredFormEdges = pruneCrossFormEvolutionRoutes(resolvedEdges, memberByNodeId)
    const edges = dedupeEvolutionEdges(simplifyEvolutionEdges(preferredFormEdges))

    const members = Array.from(memberByNodeId.values()).sort((left, right) => {
      if (left.dexNumber !== right.dexNumber) {
        return left.dexNumber - right.dexNumber
      }

      if (left.slug !== right.slug) {
        return left.slug.localeCompare(right.slug)
      }

      if (!left.formSlug && right.formSlug) {
        return -1
      }

      if (left.formSlug && !right.formSlug) {
        return 1
      }

      if ((left.formName ?? "") !== (right.formName ?? "")) {
        return (left.formName ?? "").localeCompare(right.formName ?? "")
      }

      return left.nodeId.localeCompare(right.nodeId)
    })

    const incomingEdgeMap = new Map<string, number>()
    for (const edge of edges) {
      incomingEdgeMap.set(edge.toNodeId, (incomingEdgeMap.get(edge.toNodeId) ?? 0) + 1)
    }

    const roots = members
      .filter((member) => !incomingEdgeMap.has(member.nodeId))
      .map((member) => member.nodeId)

    const fallbackRoot =
      members.find((member) => member.slug === detail.slug && member.formSlug === null)?.nodeId ??
      detail.slug

    familyBySlug.set(detail.slug, {
      members,
      edges,
      roots: roots.length > 0 ? roots : [fallbackRoot],
    })
  }

  return familyBySlug
}

function resolveEvolutionFamilyMemberNode(params: {
  detail: PokemonDetailRecord | null
  fallbackSlug: string
  preferredFormSlug: string | null
  preferredFormName: string | null
  aspectTokens: string[]
}): PokemonDetailRecord["evolutionFamily"]["members"][number] {
  if (!params.detail) {
    return {
      nodeId: params.fallbackSlug,
      slug: params.fallbackSlug,
      name: titleCaseFromId(params.fallbackSlug),
      dexNumber: 0,
      formSlug: null,
      formName: null,
    }
  }

  const candidates = buildEvolutionFamilyNodeCandidates(params.detail)

  if (params.preferredFormSlug) {
    const byFormSlug = candidates.find(
      (candidate) => candidate.formSlug === params.preferredFormSlug
    )
    if (byFormSlug) {
      return toEvolutionFamilyMember(byFormSlug)
    }
  }

  if (params.preferredFormName) {
    const normalizedName = canonicalId(params.preferredFormName)
    if (normalizedName) {
      const byFormName = candidates.find(
        (candidate) => canonicalId(candidate.formName ?? "") === normalizedName
      )
      if (byFormName) {
        return toEvolutionFamilyMember(byFormName)
      }
    }
  }

  if (params.aspectTokens.length > 0) {
    const resolvedByAspect = resolveNodeCandidateByAspectTokens(candidates, params.aspectTokens)
    if (resolvedByAspect) {
      return toEvolutionFamilyMember(resolvedByAspect)
    }
  }

  return {
    nodeId: params.detail.slug,
    slug: params.detail.slug,
    name: params.detail.name,
    dexNumber: params.detail.dexNumber,
    formSlug: null,
    formName: null,
  }
}

function buildEvolutionFamilyNodeCandidates(
  detail: PokemonDetailRecord
): EvolutionFamilyNodeCandidate[] {
  const baseCandidate: EvolutionFamilyNodeCandidate = {
    nodeId: detail.slug,
    slug: detail.slug,
    name: detail.name,
    dexNumber: detail.dexNumber,
    formSlug: null,
    formName: null,
    tokens: collectEvolutionFamilyMatchTokens([
      detail.slug,
      detail.name,
      ...detail.aspects,
      ...detail.labels,
    ]),
  }

  const formCandidates = detail.forms.map((form) => ({
    nodeId: form.slug,
    slug: detail.slug,
    name: detail.name,
    dexNumber: detail.dexNumber,
    formSlug: form.slug,
    formName: form.name,
    tokens: collectEvolutionFamilyMatchTokens([
      detail.slug,
      detail.name,
      form.slug,
      form.name,
      ...form.aspects,
      ...form.labels,
    ]),
  }))

  return [baseCandidate, ...formCandidates]
}

function resolveNodeCandidateByAspectTokens(
  candidates: EvolutionFamilyNodeCandidate[],
  aspectTokens: string[]
): EvolutionFamilyNodeCandidate | null {
  const tokenGroups = aspectTokens
    .map((aspectToken) => buildEvolutionAspectMatchGroup(aspectToken))
    .filter((group) => group.exact.length > 0 || group.loose.length > 0)

  if (tokenGroups.length === 0) {
    return null
  }

  let bestCandidate: EvolutionFamilyNodeCandidate | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    let score = 0

    for (const group of tokenGroups) {
      const exactMatch = group.exact.some((token) => candidate.tokens.has(token))
      if (exactMatch) {
        score += 14
        continue
      }

      const looseMatches = group.loose.reduce((sum, token) => {
        if (candidate.tokens.has(token)) {
          return sum + 1
        }
        return sum
      }, 0)

      score += looseMatches * 3
    }

    if (candidate.formSlug && score > 0) {
      score += 1
    }

    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  return bestScore > 0 ? bestCandidate : null
}

function buildEvolutionAspectMatchGroup(aspectToken: string): {
  exact: string[]
  loose: string[]
} {
  const exact = new Set<string>()
  const loose = new Set<string>()
  const stopWords = new Set(["form", "mode", "variant"])

  const normalized = canonicalId(aspectToken)
  if (normalized) {
    exact.add(normalized)
    for (const alias of expandEvolutionFamilyTokenAliases(normalized)) {
      exact.add(alias)
    }
  }

  const raw = aspectToken.trim().toLowerCase()
  if (raw.includes("=")) {
    const [keyRaw, valueRaw] = raw.split("=", 2)
    const key = canonicalId(keyRaw ?? "")
    const value = canonicalId(valueRaw ?? "")

    if (value) {
      exact.add(value)
      loose.add(value)
      for (const alias of expandEvolutionFamilyTokenAliases(value)) {
        exact.add(alias)
        loose.add(alias)
      }
    }

    if (key) {
      loose.add(key)
      for (const alias of expandEvolutionFamilyTokenAliases(key)) {
        loose.add(alias)
      }
    }

    if (key && value) {
      const merged = `${key}${value}`
      exact.add(merged)
      for (const alias of expandEvolutionFamilyTokenAliases(merged)) {
        exact.add(alias)
      }
    }
  }

  const parts = raw
    .split(/[^a-z0-9]+/g)
    .map((part) => canonicalId(part))
    .filter(Boolean)

  for (const part of parts) {
    if (stopWords.has(part)) {
      continue
    }

    loose.add(part)
    for (const alias of expandEvolutionFamilyTokenAliases(part)) {
      loose.add(alias)
    }
  }

  return {
    exact: Array.from(exact),
    loose: Array.from(loose),
  }
}

function collectEvolutionFamilyMatchTokens(values: string[]): Set<string> {
  const tokens = new Set<string>()

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue
    }

    const trimmed = rawValue.trim().toLowerCase()
    if (!trimmed) {
      continue
    }

    const canonical = canonicalId(trimmed)
    if (canonical) {
      addEvolutionFamilyToken(tokens, canonical)
    }

    const parts = trimmed
      .split(/[^a-z0-9]+/g)
      .map((part) => canonicalId(part))
      .filter(Boolean)

    for (const part of parts) {
      addEvolutionFamilyToken(tokens, part)
    }

    if (trimmed.includes("=")) {
      const [keyRaw, valueRaw] = trimmed.split("=", 2)
      const key = canonicalId(keyRaw ?? "")
      const value = canonicalId(valueRaw ?? "")
      if (value) {
        addEvolutionFamilyToken(tokens, value)
      }
      if (key && value) {
        addEvolutionFamilyToken(tokens, `${key}${value}`)
      }
    }
  }

  return tokens
}

function addEvolutionFamilyToken(tokenSet: Set<string>, token: string): void {
  if (!token) {
    return
  }

  tokenSet.add(token)

  for (const alias of expandEvolutionFamilyTokenAliases(token)) {
    tokenSet.add(alias)
  }
}

function expandEvolutionFamilyTokenAliases(token: string): string[] {
  const aliases: Record<string, string[]> = {
    alola: ["alolan"],
    alolan: ["alola"],
    galar: ["galarian"],
    galarian: ["galar"],
    hisui: ["hisuian"],
    hisuian: ["hisui"],
    paldea: ["paldean"],
    paldean: ["paldea"],
  }

  return aliases[token] ?? []
}

function toEvolutionFamilyMember(
  candidate: EvolutionFamilyNodeCandidate
): PokemonDetailRecord["evolutionFamily"]["members"][number] {
  return {
    nodeId: candidate.nodeId,
    slug: candidate.slug,
    name: candidate.name,
    dexNumber: candidate.dexNumber,
    formSlug: candidate.formSlug,
    formName: candidate.formName,
  }
}

function pruneCrossFormEvolutionRoutes(
  edges: ResolvedEvolutionFamilyEdge[],
  memberByNodeId: Map<string, PokemonDetailRecord["evolutionFamily"]["members"][number]>
): ResolvedEvolutionFamilyEdge[] {
  if (edges.length <= 1) {
    return edges
  }

  const grouped = new Map<string, ResolvedEvolutionFamilyEdge[]>()
  for (const edge of edges) {
    const key = `${edge.fromNodeId}::${edge.toSlug}::${edge.method}`
    const existing = grouped.get(key)
    if (existing) {
      existing.push(edge)
      continue
    }
    grouped.set(key, [edge])
  }

  const preferred: ResolvedEvolutionFamilyEdge[] = []

  for (const group of grouped.values()) {
    const uniqueTargets = new Set(group.map((edge) => edge.toNodeId))
    if (group.length <= 1 || uniqueTargets.size <= 1) {
      preferred.push(...group)
      continue
    }

    const scored = group.map((edge) => ({
      edge,
      score: scoreEvolutionTargetFormCompatibility(
        memberByNodeId.get(edge.fromNodeId),
        memberByNodeId.get(edge.toNodeId)
      ),
    }))

    const bestScore = Math.max(...scored.map((entry) => entry.score))
    const best = scored.filter((entry) => entry.score === bestScore)

    if (best.length === scored.length) {
      preferred.push(...group)
      continue
    }

    preferred.push(...best.map((entry) => entry.edge))
  }

  return preferred
}

function scoreEvolutionTargetFormCompatibility(
  sourceMember: PokemonDetailRecord["evolutionFamily"]["members"][number] | undefined,
  targetMember: PokemonDetailRecord["evolutionFamily"]["members"][number] | undefined
): number {
  if (!sourceMember || !targetMember) {
    return 0
  }

  const sourceRegions = collectEvolutionMemberRegionTokens(sourceMember)
  const targetRegions = collectEvolutionMemberRegionTokens(targetMember)

  if (sourceRegions.size === 0) {
    return targetRegions.size === 0 ? 3 : 1
  }

  let overlap = 0
  for (const region of sourceRegions) {
    if (targetRegions.has(region)) {
      overlap += 1
    }
  }

  if (overlap > 0) {
    return 6 + overlap
  }

  return targetRegions.size === 0 ? 2 : 0
}

function collectEvolutionMemberRegionTokens(
  member: PokemonDetailRecord["evolutionFamily"]["members"][number]
): Set<string> {
  if (!member.formSlug && !member.formName) {
    return new Set<string>()
  }

  const tokens = new Set<string>()
  const values = [member.formSlug ?? "", member.formName ?? ""]

  for (const rawValue of values) {
    const trimmed = rawValue.trim().toLowerCase()
    if (!trimmed) {
      continue
    }

    const canonical = canonicalId(trimmed)
    if (canonical) {
      for (const [alias, region] of Object.entries(EVOLUTION_FORM_REGION_ALIASES)) {
        if (canonical.includes(alias)) {
          tokens.add(region)
        }
      }
    }

    const parts = trimmed
      .split(/[^a-z0-9]+/g)
      .map((part) => canonicalId(part))
      .filter(Boolean)

    for (const part of parts) {
      const region = EVOLUTION_FORM_REGION_ALIASES[part]
      if (region) {
        tokens.add(region)
      }
    }
  }

  return tokens
}

function simplifyEvolutionEdges(
  edges: ResolvedEvolutionFamilyEdge[]
): PokemonDetailRecord["evolutionFamily"]["edges"] {
  if (edges.length <= 1) {
    return edges.map((edge) => ({
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      fromSlug: edge.fromSlug,
      toSlug: edge.toSlug,
      method: edge.method,
      requirementText: edge.requirementText,
    }))
  }

  const routeKey = (edge: ResolvedEvolutionFamilyEdge) =>
    `${edge.fromNodeId}::${edge.toNodeId}::${edge.method}`

  const hasBaseEdgeByRoute = new Set<string>()
  for (const edge of edges) {
    if (!edge.sourceFormSlug) {
      hasBaseEdgeByRoute.add(routeKey(edge))
    }
  }

  const filteredBySource = edges.filter((edge) => {
    if (!edge.sourceFormSlug) {
      return true
    }

    return !hasBaseEdgeByRoute.has(routeKey(edge))
  })

  const grouped = new Map<string, ResolvedEvolutionFamilyEdge[]>()
  for (const edge of filteredBySource) {
    const key = routeKey(edge)
    const existing = grouped.get(key)
    if (existing) {
      existing.push(edge)
      continue
    }
    grouped.set(key, [edge])
  }

  const simplified: PokemonDetailRecord["evolutionFamily"]["edges"] = []

  for (const group of grouped.values()) {
    const requirementSets = group.map((edge) => toNormalizedRequirementSet(edge.requirementText))

    for (const [index, edge] of group.entries()) {
      const currentRequirements = requirementSets[index]
      const isRedundant = group.some((_, candidateIndex) => {
        if (candidateIndex === index) {
          return false
        }

        const candidateRequirements = requirementSets[candidateIndex]
        return isStrictRequirementSubset(candidateRequirements, currentRequirements)
      })

      if (isRedundant) {
        continue
      }

      simplified.push({
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        fromSlug: edge.fromSlug,
        toSlug: edge.toSlug,
        method: edge.method,
        requirementText: edge.requirementText,
      })
    }
  }

  return simplified
}

function toNormalizedRequirementSet(requirements: string[]): Set<string> {
  return new Set(
    requirements
      .map((requirement) => requirement.trim().toLowerCase().replace(/\s+/g, " "))
      .filter(Boolean)
  )
}

function isStrictRequirementSubset(subset: Set<string>, superset: Set<string>): boolean {
  if (subset.size >= superset.size) {
    return false
  }

  for (const token of subset) {
    if (!superset.has(token)) {
      return false
    }
  }

  return true
}

function buildPokemonList(detailsBySlug: Map<string, PokemonDetailRecord>): PokemonListItem[] {
  return Array.from(detailsBySlug.values())
    .sort((left, right) => {
      if (left.dexNumber !== right.dexNumber) {
        return left.dexNumber - right.dexNumber
      }

      return left.slug.localeCompare(right.slug)
    })
    .map((detail) => {
      return {
        slug: detail.slug,
        name: detail.name,
        dexNumber: detail.dexNumber,
        implemented: detail.implemented,
        types: detail.types,
        aliases: detail.aliases,
        eggGroups: detail.eggGroups,
      }
    })
}

function buildPokemonDexNav(pokemonList: PokemonListItem[]): PokemonDexNavItem[] {
  return pokemonList.map((pokemon) => {
    return {
      slug: pokemon.slug,
      name: pokemon.name,
      dexNumber: pokemon.dexNumber,
    }
  })
}

function buildPokemonTypeEntries(
  detailsBySlug: Map<string, PokemonDetailRecord>
): PokemonTypeEntryRecord[] {
  const entries: PokemonTypeEntryRecord[] = []

  for (const detail of detailsBySlug.values()) {
    entries.push({
      id: detail.slug,
      slug: detail.slug,
      formSlug: null,
      formName: null,
      name: detail.name,
      dexNumber: detail.dexNumber,
      implemented: detail.implemented,
      types: detail.types,
    })

    for (const form of detail.forms) {
      entries.push({
        id: `${detail.slug}::${form.slug}`,
        slug: detail.slug,
        formSlug: form.slug,
        formName: form.name,
        name: `${detail.name} (${form.name})`,
        dexNumber: detail.dexNumber,
        implemented: detail.implemented,
        types: form.types.length > 0 ? form.types : detail.types,
      })
    }
  }

  return entries.sort((left, right) => {
    if (left.dexNumber !== right.dexNumber) {
      return left.dexNumber - right.dexNumber
    }

    if (left.slug !== right.slug) {
      return left.slug.localeCompare(right.slug)
    }

    if (!left.formName && right.formName) {
      return -1
    }

    if (left.formName && !right.formName) {
      return 1
    }

    return (left.formName ?? "").localeCompare(right.formName ?? "")
  })
}

async function buildPokemonFormSpriteIndex(
  detailsBySlug: Map<string, PokemonDetailRecord>
): Promise<PokemonFormSpriteIndex> {
  let pokeapiLookup: PokeapiFormLookup
  try {
    pokeapiLookup = await loadPokeapiFormLookup()
  } catch (error) {
    console.warn(`[warn] Failed to load PokeAPI CSV form lookup: ${String(error)}`)
    return {}
  }

  const index: PokemonFormSpriteIndex = {}
  const sortedDetails = Array.from(detailsBySlug.values()).sort((left, right) => {
    return left.slug.localeCompare(right.slug)
  })

  for (const detail of sortedDetails) {
    if (detail.forms.length === 0) {
      continue
    }

    const baseCanonical = canonicalId(detail.slug)
    if (!baseCanonical) {
      continue
    }

    const availableFormIdentifiers = Array.from(
      new Set(pokeapiLookup.formIdentifiersBySpeciesId.get(detail.dexNumber) ?? [])
    )
    if (availableFormIdentifiers.length === 0) {
      continue
    }

    const defaultIdentifier = pokeapiLookup.defaultPokemonIdentifierBySpeciesId.get(
      detail.dexNumber
    )
    const defaultIdentifierCanonical = defaultIdentifier ? canonicalId(defaultIdentifier) : null

    const speciesCandidates = availableFormIdentifiers
      .map((formIdentifier) => {
        const lookupEntry = pokeapiLookup.formIdentifierToPokemon.get(formIdentifier)
        if (!lookupEntry) {
          return null
        }

        const fullCanonical = canonicalId(formIdentifier)
        if (!fullCanonical) {
          return null
        }

        return {
          formIdentifier,
          pokemonId: lookupEntry.pokemonId,
          pokemonIdentifier: lookupEntry.pokemonIdentifier,
          fullCanonical,
          suffixCanonical: fullCanonical.startsWith(baseCanonical)
            ? fullCanonical.slice(baseCanonical.length)
            : fullCanonical,
        }
      })
      .filter((candidate): candidate is PokeapiSpeciesFormCandidate => candidate !== null)

    if (speciesCandidates.length === 0) {
      continue
    }

    for (const form of detail.forms) {
      const matchedCandidate = resolvePokeapiFormCandidate({
        baseSlug: detail.slug,
        formSlug: form.slug,
        formName: form.name,
        baseCanonical,
        defaultIdentifierCanonical,
        candidates: speciesCandidates,
      })
      if (!matchedCandidate) {
        continue
      }

      const slugKey = buildFormSpriteSlugLookupKey(detail.slug, form.slug)
      if (slugKey) {
        index[slugKey] = {
          pokemonId: matchedCandidate.pokemonId,
          pokemonIdentifier: matchedCandidate.pokemonIdentifier,
        }
      }

      const nameKey = buildFormSpriteNameLookupKey(detail.slug, form.name)
      if (nameKey) {
        index[nameKey] = {
          pokemonId: matchedCandidate.pokemonId,
          pokemonIdentifier: matchedCandidate.pokemonIdentifier,
        }
      }
    }
  }

  return index
}

async function loadPokeapiFormLookup(): Promise<PokeapiFormLookup> {
  const [pokemonRows, formRows] = await Promise.all([
    fetchPokeapiPokemonCsvRows(),
    fetchPokeapiFormCsvRows(),
  ])

  const pokemonById = new Map<number, PokeapiPokemonCsvRow>()
  const pokemonBySpeciesId = new Map<number, PokeapiPokemonCsvRow[]>()
  const formIdentifierToPokemon = new Map<string, PokeapiFormLookupEntry>()
  const formIdentifiersBySpeciesId = new Map<number, Set<string>>()

  const addFormIdentifier = (
    speciesId: number,
    formIdentifier: string,
    pokemonRow: PokeapiPokemonCsvRow
  ) => {
    const normalizedIdentifier = normalizePokeapiIdentifier(formIdentifier)
    if (!normalizedIdentifier) {
      return
    }

    formIdentifierToPokemon.set(normalizedIdentifier, {
      pokemonId: pokemonRow.id,
      pokemonIdentifier: pokemonRow.identifier,
      speciesId,
    })

    if (!formIdentifiersBySpeciesId.has(speciesId)) {
      formIdentifiersBySpeciesId.set(speciesId, new Set())
    }

    formIdentifiersBySpeciesId.get(speciesId)?.add(normalizedIdentifier)
  }

  for (const pokemonRow of pokemonRows) {
    pokemonById.set(pokemonRow.id, pokemonRow)

    if (!pokemonBySpeciesId.has(pokemonRow.speciesId)) {
      pokemonBySpeciesId.set(pokemonRow.speciesId, [])
    }
    pokemonBySpeciesId.get(pokemonRow.speciesId)?.push(pokemonRow)

    addFormIdentifier(pokemonRow.speciesId, pokemonRow.identifier, pokemonRow)
  }

  for (const formRow of formRows) {
    const pokemonRow = pokemonById.get(formRow.pokemonId)
    if (!pokemonRow) {
      continue
    }

    addFormIdentifier(pokemonRow.speciesId, formRow.identifier, pokemonRow)
  }

  const defaultPokemonIdentifierBySpeciesId = new Map<number, string>()
  for (const [speciesId, rows] of pokemonBySpeciesId.entries()) {
    rows.sort((left, right) => left.id - right.id)

    const primary = rows.find((row) => row.id === speciesId) ?? rows[0]
    if (!primary) {
      continue
    }

    defaultPokemonIdentifierBySpeciesId.set(speciesId, primary.identifier)
  }

  const sortedFormIdentifiersBySpeciesId = new Map<number, string[]>()
  for (const [speciesId, identifiers] of formIdentifiersBySpeciesId.entries()) {
    sortedFormIdentifiersBySpeciesId.set(
      speciesId,
      Array.from(identifiers.values()).sort((left, right) => left.localeCompare(right))
    )
  }

  return {
    formIdentifierToPokemon,
    formIdentifiersBySpeciesId: sortedFormIdentifiersBySpeciesId,
    defaultPokemonIdentifierBySpeciesId,
  }
}

async function fetchPokeapiPokemonCsvRows(): Promise<PokeapiPokemonCsvRow[]> {
  const csvText = await fetchCsvText(POKEAPI_POKEMON_CSV_URL)
  const rows = parseCsvRows(csvText)
  const parsed: PokeapiPokemonCsvRow[] = []

  for (const row of rows.slice(1)) {
    const id = parseInteger(row[0])
    const identifier = normalizePokeapiIdentifier(row[1])
    const speciesId = parseInteger(row[2])
    if (id === null || speciesId === null || !identifier) {
      continue
    }

    parsed.push({
      id,
      identifier,
      speciesId,
    })
  }

  return parsed
}

async function fetchPokeapiFormCsvRows(): Promise<PokeapiFormCsvRow[]> {
  const csvText = await fetchCsvText(POKEAPI_POKEMON_FORMS_CSV_URL)
  const rows = parseCsvRows(csvText)
  const parsed: PokeapiFormCsvRow[] = []

  for (const row of rows.slice(1)) {
    const identifier = normalizePokeapiIdentifier(row[1])
    const pokemonId = parseInteger(row[3])
    if (pokemonId === null || !identifier) {
      continue
    }

    parsed.push({
      identifier,
      pokemonId,
    })
  }

  return parsed
}

function resolvePokeapiFormCandidate(params: {
  baseSlug: string
  formSlug: string
  formName: string
  baseCanonical: string
  defaultIdentifierCanonical: string | null
  candidates: PokeapiSpeciesFormCandidate[]
}): PokeapiSpeciesFormCandidate | null {
  const formSlugCanonical = canonicalId(params.formSlug)
  const formSlugSuffixCanonical = extractCanonicalFormSuffix(params.baseSlug, params.formSlug)
  const suffixCandidates = buildCanonicalFormSuffixCandidates({
    baseSlug: params.baseSlug,
    formSlug: params.formSlug,
    formName: params.formName,
    baseCanonical: params.baseCanonical,
    defaultIdentifierCanonical: params.defaultIdentifierCanonical,
  })

  const fullCandidates = new Set<string>()
  if (formSlugCanonical) {
    fullCandidates.add(formSlugCanonical)
  }

  for (const suffixCandidate of suffixCandidates) {
    fullCandidates.add(`${params.baseCanonical}${suffixCandidate}`)
    if (params.defaultIdentifierCanonical) {
      fullCandidates.add(`${params.defaultIdentifierCanonical}${suffixCandidate}`)
    }
  }

  const matches = params.candidates.filter((candidate) => {
    if (fullCandidates.has(candidate.fullCanonical)) {
      return true
    }

    return suffixCandidates.has(candidate.suffixCanonical)
  })

  if (matches.length === 0) {
    return null
  }

  if (matches.length === 1) {
    return matches[0]
  }

  const scoredMatches = matches
    .map((candidate) => {
      let score = 0

      if (formSlugCanonical && candidate.fullCanonical === formSlugCanonical) {
        score += 1000
      }

      if (formSlugSuffixCanonical && candidate.suffixCanonical === formSlugSuffixCanonical) {
        score += 400
      }

      if (fullCandidates.has(candidate.fullCanonical)) {
        score += 240
      }

      if (suffixCandidates.has(candidate.suffixCanonical)) {
        score += 160
      }

      if (
        params.defaultIdentifierCanonical &&
        candidate.fullCanonical.startsWith(params.defaultIdentifierCanonical)
      ) {
        score += 80
      }

      return {
        candidate,
        score,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.candidate.pokemonId !== right.candidate.pokemonId) {
        return left.candidate.pokemonId - right.candidate.pokemonId
      }

      return left.candidate.formIdentifier.localeCompare(right.candidate.formIdentifier)
    })

  return scoredMatches[0]?.candidate ?? null
}

function buildCanonicalFormSuffixCandidates(params: {
  baseSlug: string
  formSlug: string
  formName: string
  baseCanonical: string
  defaultIdentifierCanonical: string | null
}): Set<string> {
  const values = new Set<string>()

  const addCanonical = (value: string | null | undefined) => {
    if (typeof value !== "string") {
      return
    }

    const normalized = canonicalId(value)
    if (!normalized) {
      return
    }

    values.add(normalized)
  }

  const formSlugSuffixRaw = extractFormSlugSuffix(params.baseSlug, params.formSlug)
  const formNameNormalized = normalizePokeapiIdentifier(params.formName)
  const formSlugSuffixNormalized = normalizePokeapiIdentifier(formSlugSuffixRaw)

  addCanonical(formSlugSuffixRaw)
  addCanonical(formSlugSuffixNormalized)
  addCanonical(params.formName)
  addCanonical(formNameNormalized)

  const snapshot = Array.from(values.values())

  for (const value of snapshot) {
    for (const alias of FORM_SUFFIX_ALIASES[value] ?? []) {
      addCanonical(alias)
    }
  }

  if (values.has("gmax")) {
    const defaultSuffix = params.defaultIdentifierCanonical?.startsWith(params.baseCanonical)
      ? params.defaultIdentifierCanonical.slice(params.baseCanonical.length)
      : ""

    if (defaultSuffix) {
      addCanonical(`${defaultSuffix}gmax`)
    }
  }

  if (params.baseCanonical === "alcremie") {
    for (const flavorSuffix of ALCREMIE_FLAVOR_SUFFIXES) {
      if (values.has(flavorSuffix)) {
        addCanonical(`${flavorSuffix}strawberrysweet`)
      }
    }
  }

  const trimmedFormName = params.formName.trim()
  if (params.baseCanonical === "unown" && trimmedFormName === "!") {
    addCanonical("exclamation")
  }

  if (params.baseCanonical === "unown" && trimmedFormName === "?") {
    addCanonical("question")
  }

  return values
}

function buildFormSpriteSlugLookupKey(baseSlug: string, formSlug: string): string | null {
  const normalizedBaseSlug = canonicalId(baseSlug)
  const normalizedFormSlug = canonicalId(formSlug)

  if (!normalizedBaseSlug || !normalizedFormSlug) {
    return null
  }

  return `${normalizedBaseSlug}::${normalizedFormSlug}`
}

function buildFormSpriteNameLookupKey(baseSlug: string, formName: string): string | null {
  const normalizedBaseSlug = canonicalId(baseSlug)
  const normalizedFormName = canonicalId(formName)

  if (!normalizedBaseSlug || !normalizedFormName) {
    return null
  }

  return `${normalizedBaseSlug}::name:${normalizedFormName}`
}

function extractFormSlugSuffix(baseSlug: string, formSlug: string): string {
  if (formSlug.startsWith(`${baseSlug}-`)) {
    return formSlug.slice(baseSlug.length + 1)
  }

  return formSlug
}

function extractCanonicalFormSuffix(baseSlug: string, formSlug: string): string {
  const baseCanonical = canonicalId(baseSlug)
  const formCanonical = canonicalId(formSlug)

  if (!formCanonical) {
    return ""
  }

  if (baseCanonical && formCanonical.startsWith(baseCanonical)) {
    return formCanonical.slice(baseCanonical.length)
  }

  return formCanonical
}

function normalizePokeapiIdentifier(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function parseCsvRows(csvText: string): string[][] {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(",").map((cell) => cell.trim()))
}

function parseInteger(rawValue: string | undefined): number | null {
  if (typeof rawValue !== "string") {
    return null
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

async function fetchCsvText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`CSV fetch failed with status ${response.status}: ${url}`)
  }

  return response.text()
}

function buildMoveLearnersIndex(
  detailsBySlug: Map<string, PokemonDetailRecord>,
  moveLearnersBuild: MoveLearnersBuildMap,
  moveMap: ShowdownData["moves"]
): MoveLearnersIndex {
  const entries = Array.from(moveLearnersBuild.entries()).sort(([leftMove], [rightMove]) => {
    return leftMove.localeCompare(rightMove)
  })

  const index: MoveLearnersIndex = {}

  for (const [moveId, learnersMap] of entries) {
    const learners = Array.from(learnersMap.entries())
      .map(([slug, learnerBuild]) => {
        const detail = detailsBySlug.get(slug)
        if (!detail) {
          return null
        }

        return {
          slug,
          name: detail.name,
          dexNumber: detail.dexNumber,
          methods: Array.from(learnerBuild.methods).sort((left, right) =>
            left.localeCompare(right)
          ),
          eggGroups: [...detail.eggGroups].sort((left, right) => left.localeCompare(right)),
          levelUpLevels: Array.from(learnerBuild.levelUpLevels).sort((left, right) => left - right),
          baseAvailable: learnerBuild.baseAvailable,
          forms: Array.from(learnerBuild.forms.entries())
            .map(([formSlug, formName]) => ({
              name: formName,
              slug: formSlug,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        }
      })
      .filter((learner): learner is NonNullable<typeof learner> => learner !== null)
      .sort((left, right) => {
        if (left.dexNumber !== right.dexNumber) {
          return left.dexNumber - right.dexNumber
        }

        return left.slug.localeCompare(right.slug)
      })

    const moveName =
      learners.length > 0
        ? (findMoveNameFromDetails(moveId, learners[0].slug, detailsBySlug) ??
          titleCaseFromId(moveId))
        : titleCaseFromId(moveId)
    const moveInfo = moveMap.get(moveId)

    index[moveId] = {
      moveId,
      moveName: moveInfo?.name ?? moveName,
      type: moveInfo?.type ?? null,
      category: moveInfo?.category ?? null,
      basePower: moveInfo?.basePower ?? null,
      accuracy: moveInfo?.accuracy ?? null,
      alwaysHits: moveInfo?.alwaysHits ?? false,
      shortDescription: moveInfo?.shortDescription ?? null,
      description: moveInfo?.description ?? null,
      learners,
    }
  }

  return index
}

function buildMoveLearnerShards(moveLearners: MoveLearnersIndex): Map<string, MoveLearnersIndex> {
  const shardMap = new Map<string, MoveLearnersIndex>()
  const sortedEntries = Object.entries(moveLearners).sort(([leftMoveId], [rightMoveId]) => {
    return leftMoveId.localeCompare(rightMoveId)
  })

  for (const [moveId, moveEntry] of sortedEntries) {
    const shardId = getMoveLearnerShardId(moveId)

    if (!shardMap.has(shardId)) {
      shardMap.set(shardId, {})
    }

    const shard = shardMap.get(shardId)
    if (!shard) {
      continue
    }

    shard[moveId] = moveEntry
  }

  return new Map(
    Array.from(shardMap.entries()).sort(([leftShardId], [rightShardId]) => {
      return leftShardId.localeCompare(rightShardId)
    })
  )
}

function buildAbilityIndex(
  detailsBySlug: Map<string, PokemonDetailRecord>,
  abilityMap: ShowdownData["abilities"]
): AbilityIndex {
  const byAbility = new Map<
    string,
    Map<
      string,
      {
        slug: string
        name: string
        dexNumber: number
        baseSlots: Set<AbilitySlot>
        formSlots: Map<
          string,
          {
            formName: string
            slots: Set<AbilitySlot>
          }
        >
      }
    >
  >()

  const registerAbility = (
    detail: PokemonDetailRecord,
    ability: {
      id: string
      hidden: boolean
      slot: AbilitySlot
    },
    form: {
      name: string
      slug: string
    } | null
  ) => {
    if (!ability.id) {
      return
    }

    if (!byAbility.has(ability.id)) {
      byAbility.set(ability.id, new Map())
    }

    const pokemonMap = byAbility.get(ability.id)
    if (!pokemonMap) {
      return
    }

    const existing = pokemonMap.get(detail.slug)
    if (existing) {
      if (form) {
        if (!existing.formSlots.has(form.slug)) {
          existing.formSlots.set(form.slug, {
            formName: form.name,
            slots: new Set<AbilitySlot>(),
          })
        }
        existing.formSlots.get(form.slug)?.slots.add(ability.slot)
      } else {
        existing.baseSlots.add(ability.slot)
      }
      return
    }

    const baseSlots = new Set<AbilitySlot>()
    const formSlots = new Map<
      string,
      {
        formName: string
        slots: Set<AbilitySlot>
      }
    >()
    if (form) {
      formSlots.set(form.slug, {
        formName: form.name,
        slots: new Set<AbilitySlot>([ability.slot]),
      })
    } else {
      baseSlots.add(ability.slot)
    }

    pokemonMap.set(detail.slug, {
      slug: detail.slug,
      name: detail.name,
      dexNumber: detail.dexNumber,
      baseSlots,
      formSlots,
    })
  }

  for (const detail of detailsBySlug.values()) {
    for (const ability of detail.abilities) {
      registerAbility(detail, ability, null)
    }

    for (const form of detail.forms) {
      for (const ability of form.abilities) {
        registerAbility(detail, ability, {
          name: form.name,
          slug: form.slug,
        })
      }
    }
  }

  const index: AbilityIndex = {}

  for (const [abilityId, pokemonMap] of Array.from(byAbility.entries()).sort(([left], [right]) => {
    return left.localeCompare(right)
  })) {
    const abilityInfo = abilityMap.get(abilityId)
    const pokemon = Array.from(pokemonMap.values())
      .map((entry) => {
        const slots = sortAbilitySlots(Array.from(entry.baseSlots))
        const formSlots = Array.from(entry.formSlots.entries())
          .map(([formSlug, formEntry]) => ({
            formName: formEntry.formName,
            formSlug,
            slots: sortAbilitySlots(Array.from(formEntry.slots)),
          }))
          .sort((left, right) => left.formName.localeCompare(right.formName))

        return {
          slug: entry.slug,
          name: entry.name,
          dexNumber: entry.dexNumber,
          hidden:
            slots.includes("hidden") || formSlots.some((form) => form.slots.includes("hidden")),
          slots,
          formSlots,
        }
      })
      .sort((left, right) => {
        if (left.dexNumber !== right.dexNumber) {
          return left.dexNumber - right.dexNumber
        }

        return left.slug.localeCompare(right.slug)
      })

    index[abilityId] = {
      abilityId,
      name: abilityInfo?.name ?? titleCaseFromId(abilityId),
      shortDescription: abilityInfo?.shortDescription ?? null,
      description: abilityInfo?.description ?? null,
      pokemon,
    }
  }

  return index
}

function sortAbilitySlots(slots: AbilitySlot[]): AbilitySlot[] {
  const order: AbilitySlot[] = ["first", "second", "hidden"]
  return Array.from(new Set(slots)).sort(
    (left, right) => order.indexOf(left) - order.indexOf(right)
  )
}

function buildRideableMons(detailsBySlug: Map<string, PokemonDetailRecord>): RideableMonRecord[] {
  return Array.from(detailsBySlug.values())
    .filter((detail) => detail.implemented)
    .map((detail) => {
      const summary = parseRideableSummary(detail.rawSpecies.riding)
      if (!summary) {
        return null
      }

      return {
        slug: detail.slug,
        name: detail.name,
        dexNumber: detail.dexNumber,
        implemented: detail.implemented,
        types: detail.types,
        seatCount: summary.seatCount,
        categories: summary.categories,
        classes: summary.classes,
        behaviours: summary.behaviours,
      }
    })
    .filter((entry): entry is RideableMonRecord => entry !== null)
    .sort((left, right) => {
      if (left.dexNumber !== right.dexNumber) {
        return left.dexNumber - right.dexNumber
      }

      return left.slug.localeCompare(right.slug)
    })
}

async function buildSmogonMovesetsBySlug(
  detailsBySlug: Map<string, PokemonDetailRecord>
): Promise<Map<string, SmogonMovesetsByPokemonRecord>> {
  const payload = await fetchSmogonSetsPayload()
  const smogonLookup = payload
    ? buildSmogonSetsLookup(payload)
    : new Map<string, SmogonMovesetEntry>()

  const shards = new Map<string, SmogonMovesetsByPokemonRecord>()
  const sortedDetails = Array.from(detailsBySlug.values()).sort((left, right) => {
    if (left.dexNumber !== right.dexNumber) {
      return left.dexNumber - right.dexNumber
    }

    return left.slug.localeCompare(right.slug)
  })

  for (const detail of sortedDetails) {
    const defaultEntry = resolveSmogonMovesetEntry(
      buildSmogonSpeciesCandidates(detail),
      smogonLookup
    )
    const usedEntryIds = new Set<string>()
    if (defaultEntry) {
      usedEntryIds.add(defaultEntry.canonicalEntryId)
    }

    const formEntries: Record<string, SmogonMovesetsByPokemonRecord["formEntries"][string]> = {}

    for (const form of detail.forms) {
      const formEntry = resolveSmogonMovesetEntry(
        buildSmogonFormCandidates(detail, form),
        smogonLookup,
        usedEntryIds
      )
      if (!formEntry) {
        continue
      }

      usedEntryIds.add(formEntry.canonicalEntryId)
      formEntries[form.slug] = {
        entryName: formEntry.entryName,
        sets: formEntry.sets,
      }
    }

    shards.set(detail.slug, {
      slug: detail.slug,
      name: detail.name,
      formatId: SMOGON_SETS_FORMAT_ID,
      formatLabel: SMOGON_SETS_FORMAT_LABEL,
      sourceUrl: SMOGON_SETS_GEN9_URL,
      defaultEntryName: defaultEntry?.entryName ?? null,
      defaultSets: defaultEntry?.sets ?? [],
      formEntries,
    })
  }

  return shards
}

async function fetchSmogonSetsPayload(): Promise<SmogonSetsPayload | null> {
  try {
    const response = await fetch(SMOGON_SETS_GEN9_URL)
    if (!response.ok) {
      throw new Error(`request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as unknown
    if (!isRecord(payload)) {
      return null
    }

    return payload as SmogonSetsPayload
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.warn(`[warn] Unable to fetch Smogon gen9 sets: ${message}`)
    return null
  }
}

function buildSmogonSetsLookup(payload: SmogonSetsPayload): Map<string, SmogonMovesetEntry> {
  const lookup = new Map<string, SmogonMovesetEntry>()

  const entries = Object.entries(payload).sort(([leftName], [rightName]) => {
    return leftName.localeCompare(rightName)
  })

  for (const [entryName, rawSets] of entries) {
    const canonicalEntryId = canonicalId(entryName)
    if (!canonicalEntryId || lookup.has(canonicalEntryId)) {
      continue
    }

    const sets = normalizeSmogonSets(rawSets)
    if (sets.length === 0) {
      continue
    }

    lookup.set(canonicalEntryId, {
      entryName,
      canonicalEntryId,
      sets,
    })
  }

  return lookup
}

function normalizeSmogonSets(value: unknown): SmogonMovesetRecord[] {
  if (!isRecord(value)) {
    return []
  }

  // gen9.json has structure: Pokemon -> tier -> setName -> setData
  // We need to extract sets from all tiers
  const results: SmogonMovesetRecord[] = []

  for (const [tierName, tierData] of Object.entries(value)) {
    if (!isRecord(tierData)) {
      continue
    }

    const tierSets = extractTierSets(tierName, tierData)
    results.push(...tierSets)
  }

  // Sort by tier priority (OU first, then UU, RU, etc.) then by set name
  const tierPriority: Record<string, number> = {
    ou: 0,
    uubl: 1,
    uu: 2,
    rubl: 3,
    ru: 4,
    nubl: 5,
    nu: 6,
    publ: 7,
    pu: 8,
    zu: 9,
    nfe: 10,
  }

  results.sort((left, right) => {
    const leftPriority = tierPriority[left.tier.toLowerCase()] ?? 100
    const rightPriority = tierPriority[right.tier.toLowerCase()] ?? 100
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }
    return left.name.localeCompare(right.name)
  })

  return results
}

function extractTierSets(
  tierName: string,
  tierData: Record<string, unknown>
): SmogonMovesetRecord[] {
  const results: SmogonMovesetRecord[] = []

  for (const [setName, rawSetValue] of Object.entries(tierData)) {
    if (!isRecord(rawSetValue)) {
      continue
    }

    const rawSet = rawSetValue as RawSmogonSet
    const moves = normalizeSmogonMoveSlots(rawSet.moves)
    const ability = typeof rawSet.ability === "string" ? rawSet.ability.trim() : null
    const item = typeof rawSet.item === "string" ? rawSet.item.trim() : null
    const natures = normalizeSmogonStringList(rawSet.nature)
    const teraTypes = normalizeSmogonStringList(rawSet.teratypes)
    const evs = normalizeSmogonStatSpread(rawSet.evs)
    const ivs = normalizeSmogonStatSpread(rawSet.ivs)

    const hasUsefulData =
      moves.length > 0 ||
      ability !== null ||
      item !== null ||
      natures.length > 0 ||
      teraTypes.length > 0 ||
      Object.keys(evs).length > 0 ||
      Object.keys(ivs).length > 0

    if (!hasUsefulData) {
      continue
    }

    results.push({
      name: setName,
      tier: tierName.toUpperCase(),
      ability,
      item,
      natures,
      teraTypes,
      moves,
      evs,
      ivs,
    })
  }

  return results
}

function normalizeSmogonMoveSlots(value: unknown): string[][] {
  if (!Array.isArray(value)) {
    return []
  }

  const slots: string[][] = []

  for (const slotValue of value) {
    if (typeof slotValue === "string") {
      const moveName = slotValue.trim()
      if (moveName) {
        slots.push([moveName])
      }
      continue
    }

    if (!Array.isArray(slotValue)) {
      continue
    }

    const options = slotValue
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0)

    if (options.length > 0) {
      slots.push(Array.from(new Set(options)))
    }
  }

  return slots
}

function normalizeSmogonStringList(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = value.trim()
    return normalized ? [normalized] : []
  }

  if (!Array.isArray(value)) {
    return []
  }

  const values = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)

  return Array.from(new Set(values))
}

function normalizeSmogonStatSpread(value: unknown): CompetitiveStatSpread {
  if (!isRecord(value)) {
    return {}
  }

  const stats = ["hp", "atk", "def", "spa", "spd", "spe"] as const
  const spread: CompetitiveStatSpread = {}

  for (const statKey of stats) {
    const rawStat = value[statKey]
    if (typeof rawStat !== "number" || !Number.isFinite(rawStat)) {
      continue
    }

    spread[statKey] = Math.trunc(rawStat)
  }

  return spread
}

function resolveSmogonMovesetEntry(
  candidates: string[],
  lookup: Map<string, SmogonMovesetEntry>,
  excludedCanonicalIds: Set<string> = new Set()
): SmogonMovesetEntry | null {
  for (const candidate of candidates) {
    const candidateId = canonicalId(candidate)
    if (!candidateId || excludedCanonicalIds.has(candidateId)) {
      continue
    }

    const entry = lookup.get(candidateId)
    if (entry) {
      return entry
    }
  }

  return null
}

function buildSmogonSpeciesCandidates(detail: PokemonDetailRecord): string[] {
  return dedupeSmogonCandidates([detail.name, detail.slug, normalizePokeapiIdentifier(detail.name)])
}

function buildSmogonFormCandidates(detail: PokemonDetailRecord, form: PokemonFormRecord): string[] {
  const baseNameNormalized = normalizePokeapiIdentifier(detail.name)
  const formNameNormalized = normalizePokeapiIdentifier(form.name)
  const formSlugSuffix = extractFormSlugSuffix(detail.slug, form.slug)
  const suffixCandidates = buildCanonicalFormSuffixCandidates({
    baseSlug: detail.slug,
    formSlug: form.slug,
    formName: form.name,
    baseCanonical: canonicalId(detail.slug),
    defaultIdentifierCanonical: baseNameNormalized ? canonicalId(baseNameNormalized) : null,
  })

  const candidates: string[] = [
    form.slug,
    `${detail.name}-${form.name}`,
    `${detail.name} ${form.name}`,
    `${detail.slug}-${form.name}`,
    `${detail.slug}-${formSlugSuffix}`,
    `${detail.name}-${formSlugSuffix}`,
  ]

  if (baseNameNormalized) {
    candidates.push(`${baseNameNormalized}-${formNameNormalized}`)
    candidates.push(`${baseNameNormalized}-${formSlugSuffix}`)
  }

  for (const suffix of suffixCandidates) {
    candidates.push(`${detail.name}-${suffix}`)
    candidates.push(`${detail.slug}-${suffix}`)

    if (baseNameNormalized) {
      candidates.push(`${baseNameNormalized}-${suffix}`)
    }
  }

  for (const aspect of form.aspects) {
    const normalizedAspect = normalizePokeapiIdentifier(aspect)
    candidates.push(`${detail.name}-${aspect}`)
    candidates.push(`${detail.slug}-${aspect}`)

    if (normalizedAspect) {
      candidates.push(`${detail.name}-${normalizedAspect}`)
      candidates.push(`${detail.slug}-${normalizedAspect}`)
      if (baseNameNormalized) {
        candidates.push(`${baseNameNormalized}-${normalizedAspect}`)
      }
    }
  }

  return dedupeSmogonCandidates(candidates)
}

function dedupeSmogonCandidates(values: string[]): string[] {
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const rawValue of values) {
    const normalizedValue = rawValue.trim()
    const canonicalValue = canonicalId(normalizedValue)
    if (!normalizedValue || !canonicalValue || seen.has(canonicalValue)) {
      continue
    }

    seen.add(canonicalValue)
    deduped.push(normalizedValue)
  }

  return deduped
}

function buildSearchIndex(
  pokemonList: PokemonListItem[],
  moveLearners: MoveLearnersIndex
): SearchDocument[] {
  const docs: SearchDocument[] = []

  const facets: Array<"egg-group" | "moves" | "spawn" | "evolution"> = [
    "egg-group",
    "moves",
    "spawn",
    "evolution",
  ]

  for (const pokemon of pokemonList) {
    if (!pokemon.implemented) {
      continue
    }

    const baseTokens = buildTokens([pokemon.name, pokemon.slug, ...pokemon.aliases])

    docs.push({
      id: `pokemon-overview:${pokemon.slug}`,
      resultType: "pokemon-overview",
      name: pokemon.name,
      normalizedName: normalizeSearchText(pokemon.name),
      tokens: baseTokens,
      aliases: pokemon.aliases,
      slug: pokemon.slug,
      moveId: null,
      facet: null,
      implemented: pokemon.implemented,
      dexNumber: pokemon.dexNumber,
      learnerCount: null,
    })

    for (const facet of facets) {
      docs.push({
        id: `pokemon-facet:${facet}:${pokemon.slug}`,
        resultType: "pokemon-facet",
        name: `${pokemon.name} ${facet.replace("-", " ")}`,
        normalizedName: normalizeSearchText(`${pokemon.name} ${facet.replace("-", " ")}`),
        tokens: buildTokens([pokemon.name, pokemon.slug, facet]),
        aliases: pokemon.aliases,
        slug: pokemon.slug,
        moveId: null,
        facet,
        implemented: pokemon.implemented,
        dexNumber: pokemon.dexNumber,
        learnerCount: null,
      })
    }
  }

  for (const entry of Object.values(moveLearners)) {
    docs.push({
      id: `move:${entry.moveId}`,
      resultType: "move-learners",
      name: entry.moveName,
      normalizedName: normalizeSearchText(entry.moveName),
      tokens: buildTokens([
        entry.moveId,
        entry.moveName,
        entry.type ?? "",
        entry.category ?? "",
        entry.shortDescription ?? "",
      ]),
      aliases: [normalizeSearchText(entry.moveId), normalizeSearchText(entry.moveName)],
      slug: null,
      moveId: entry.moveId,
      facet: null,
      implemented: true,
      dexNumber: null,
      learnerCount: entry.learners.length,
    })
  }

  docs.sort((left, right) => left.id.localeCompare(right.id))
  return docs
}

async function writeArtifacts(params: {
  meta: MetaRecord
  pokemonList: PokemonListItem[]
  pokemonDexNav: PokemonDexNavItem[]
  pokemonTypeEntries: PokemonTypeEntryRecord[]
  moveLearnerShards: Map<string, MoveLearnersIndex>
  abilityIndex: AbilityIndex
  biomeTagIndex: BiomeTagIndex
  itemIndex: ItemIndex
  pokemonInteractionIndex: PokemonInteractionIndex
  rideableMons: RideableMonRecord[]
  pokemonFormSpriteIndex: PokemonFormSpriteIndex
  smogonMovesetsBySlug: Map<string, SmogonMovesetsByPokemonRecord>
  searchIndex: SearchDocument[]
  detailsBySlug: Map<string, PokemonDetailRecord>
}) {
  await rm(GENERATED_ROOT, { recursive: true, force: true })
  await mkdir(GENERATED_BY_SLUG_ROOT, { recursive: true })
  await mkdir(GENERATED_MOVE_LEARNER_SHARDS_ROOT, { recursive: true })
  await mkdir(GENERATED_SMOGON_MOVESETS_BY_SLUG_ROOT, { recursive: true })

  await rm(PUBLIC_GENERATED_ROOT, { recursive: true, force: true })
  await mkdir(PUBLIC_GENERATED_BY_SLUG_ROOT, { recursive: true })
  await mkdir(PUBLIC_MOVE_LEARNER_SHARDS_ROOT, { recursive: true })
  await mkdir(PUBLIC_SMOGON_MOVESETS_BY_SLUG_ROOT, { recursive: true })

  const writeSharedArtifact = async (fileName: string, data: unknown) => {
    await writeJsonFile(path.join(GENERATED_ROOT, fileName), data)
    await writeJsonFile(path.join(PUBLIC_GENERATED_ROOT, fileName), data)
  }

  await writeSharedArtifact("meta.json", params.meta)
  await writeSharedArtifact("pokemon-list.json", params.pokemonList)
  await writeSharedArtifact("pokemon-dex-nav.json", params.pokemonDexNav)
  await writeSharedArtifact("pokemon-type-entries.json", params.pokemonTypeEntries)
  await writeSharedArtifact("ability-index.json", params.abilityIndex)
  await writeSharedArtifact("biome-tag-index.json", params.biomeTagIndex)
  await writeSharedArtifact("item-index.json", params.itemIndex)
  await writeSharedArtifact("pokemon-interaction-index.json", params.pokemonInteractionIndex)
  await writeSharedArtifact("rideable-mons.json", params.rideableMons)
  await writeSharedArtifact("pokemon-form-sprite-index.json", params.pokemonFormSpriteIndex)
  await writeSharedArtifact("search-index.json", params.searchIndex)

  for (const [shardId, shardData] of params.moveLearnerShards) {
    const shardFileName = `${shardId}.json`
    await writeJsonFile(path.join(GENERATED_MOVE_LEARNER_SHARDS_ROOT, shardFileName), shardData)
    await writeJsonFile(path.join(PUBLIC_MOVE_LEARNER_SHARDS_ROOT, shardFileName), shardData)
  }

  for (const [slug, smogonMovesets] of params.smogonMovesetsBySlug) {
    const fileName = `${slug}.json`
    await writeJsonFile(path.join(GENERATED_SMOGON_MOVESETS_BY_SLUG_ROOT, fileName), smogonMovesets)
    await writeJsonFile(path.join(PUBLIC_SMOGON_MOVESETS_BY_SLUG_ROOT, fileName), smogonMovesets)
  }

  const sortedDetails = Array.from(params.detailsBySlug.entries()).sort(([left], [right]) => {
    return left.localeCompare(right)
  })

  for (const [slug, detail] of sortedDetails) {
    await writeJsonFile(path.join(GENERATED_BY_SLUG_ROOT, `${slug}.json`), detail)
    await writeJsonFile(path.join(PUBLIC_GENERATED_BY_SLUG_ROOT, `${slug}.json`), detail)
  }
}

function evaluateCommonJsModule(code: string): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> }
  const require = () => {
    throw new Error("Dynamic require is not supported while parsing showdown modules")
  }

  const evaluator = new Function("module", "exports", "require", code)
  evaluator(module, module.exports, require)

  return module.exports
}

function getNamedExport(
  moduleExports: Record<string, unknown>,
  exportName: string
): Record<string, unknown> {
  const value = moduleExports[exportName]
  if (!isRecord(value)) {
    throw new Error(`Expected showdown module export \`${exportName}\` to be an object`)
  }

  return value
}

function parseWeightMultipliers(
  spawn: Record<string, unknown>
): SpawnEntryRecord["weightMultipliers"] {
  const multipliers: SpawnEntryRecord["weightMultipliers"] = []

  const pushMultiplier = (value: unknown) => {
    if (!isRecord(value)) {
      return
    }

    if (typeof value.multiplier !== "number") {
      return
    }

    multipliers.push({
      multiplier: value.multiplier,
      condition: isRecord(value.condition) ? value.condition : null,
    })
  }

  pushMultiplier(spawn.weightMultiplier)
  if (Array.isArray(spawn.weightMultipliers)) {
    for (const value of spawn.weightMultipliers) {
      pushMultiplier(value)
    }
  }

  return multipliers
}

function mergePresetBlock(
  spawn: Record<string, unknown>,
  key: "condition" | "anticondition",
  presets: Map<string, Record<string, unknown>>,
  filePath: string,
  spawnId: string
): Record<string, unknown> | null {
  let merged: Record<string, unknown> | null = null

  const presetNames = Array.isArray(spawn.presets) ? spawn.presets : []
  for (const presetName of presetNames) {
    if (typeof presetName !== "string") {
      continue
    }

    const preset = presets.get(presetName)
    if (!preset) {
      throw new Error(
        `Referenced spawn preset is missing: ${presetName} (spawn ${spawnId} in ${filePath})`
      )
    }

    const presetBlock = isRecord(preset[key]) ? (preset[key] as Record<string, unknown>) : null
    merged = mergeRecords(merged, presetBlock)
  }

  const spawnBlock = isRecord(spawn[key]) ? (spawn[key] as Record<string, unknown>) : null
  return mergeRecords(merged, spawnBlock)
}

function mergeRecords(
  left: Record<string, unknown> | null,
  right: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!left && !right) {
    return null
  }

  return mergeUnknown(left ?? {}, right ?? {}) as Record<string, unknown>
}

function mergeUnknown(left: unknown, right: unknown): unknown {
  if (Array.isArray(left) && Array.isArray(right)) {
    const values = [...left, ...right]
    const seen = new Set<string>()
    const deduped: unknown[] = []

    for (const value of values) {
      const key = JSON.stringify(value)
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      deduped.push(value)
    }

    return deduped
  }

  if (isRecord(left) && isRecord(right)) {
    const result: Record<string, unknown> = { ...left }
    for (const [key, value] of Object.entries(right)) {
      if (!(key in result)) {
        result[key] = value
        continue
      }

      result[key] = mergeUnknown(result[key], value)
    }

    return result
  }

  return right
}

function collectBiomeWarnings(condition: Record<string, unknown> | null, warnings: SpawnWarnings) {
  if (!condition || !Array.isArray(condition.biomes)) {
    return
  }

  for (const biomeValue of condition.biomes) {
    if (typeof biomeValue !== "string") {
      continue
    }

    if (!biomeValue.startsWith("#")) {
      continue
    }

    const [namespace] = biomeValue.slice(1).split(":")
    if (!namespace || namespace === "cobblemon" || namespace === "minecraft" || namespace === "c") {
      continue
    }

    warnings.unknownBiomeNamespaces.add(namespace)
  }
}

function collectBiomeHints(
  condition: Record<string, unknown> | null,
  biomeTagMap: Map<string, string[]>
): string[] {
  if (!condition || !Array.isArray(condition.biomes)) {
    return []
  }

  const hints = new Set<string>()

  for (const biomeValue of condition.biomes) {
    if (typeof biomeValue !== "string") {
      continue
    }

    if (biomeValue.startsWith("#")) {
      hints.add(titleCaseFromId(biomeValue.replace(/^#/, "")))

      const expansion = biomeTagMap.get(biomeValue) ?? []
      for (const expandedValue of expansion.slice(0, 2)) {
        hints.add(titleCaseFromId(expandedValue.replace(/^#/, "")))
      }
      continue
    }

    hints.add(titleCaseFromId(biomeValue))
  }

  return Array.from(hints).slice(0, 6)
}

function toPokemonRef(raw: string, speciesLookup: Map<string, string>) {
  const parsed = parsePokemonRef(raw)
  const slug = resolvePokemonSlug(parsed.baseId, speciesLookup) ?? parsed.baseId.toLowerCase()

  return {
    raw,
    slug,
    aspectTokens: parsed.aspectTokens,
  }
}

function resolvePokemonSlug(baseId: string, speciesLookup: Map<string, string>): string | null {
  const normalized = canonicalId(baseId)
  return speciesLookup.get(normalized) ?? null
}

function addMovesToLearnerIndex(
  moveLearnersBuild: MoveLearnersBuildMap,
  slug: string,
  moves: ParsedMove[]
) {
  for (const move of moves) {
    if (!moveLearnersBuild.has(move.moveId)) {
      moveLearnersBuild.set(move.moveId, new Map<string, MoveLearnerBuildEntry>())
    }

    const learnersMap = moveLearnersBuild.get(move.moveId)
    if (!learnersMap) {
      continue
    }

    if (!learnersMap.has(slug)) {
      learnersMap.set(slug, {
        methods: new Set<MoveSourceType>(),
        levelUpLevels: new Set<number>(),
        baseAvailable: false,
        forms: new Map<string, string>(),
      })
    }

    const learnerBuild = learnersMap.get(slug)
    if (!learnerBuild) {
      continue
    }

    learnerBuild.methods.add(move.sourceType)

    if (move.sourceType === "level" && typeof move.sourceValue === "number") {
      learnerBuild.levelUpLevels.add(move.sourceValue)
    }

    if (move.fromFormSlug && move.fromForm) {
      learnerBuild.forms.set(move.fromFormSlug, move.fromForm)
    } else {
      learnerBuild.baseAvailable = true
    }
  }
}

function sortMoves(left: ParsedMove, right: ParsedMove): number {
  if (left.moveName !== right.moveName) {
    return left.moveName.localeCompare(right.moveName)
  }

  if (left.sourceType !== right.sourceType) {
    return left.sourceType.localeCompare(right.sourceType)
  }

  return (left.sourceValue ?? 0) - (right.sourceValue ?? 0)
}

function dedupeEvolutionEdges(
  edges: PokemonDetailRecord["evolutionFamily"]["edges"]
): PokemonDetailRecord["evolutionFamily"]["edges"] {
  const map = new Map<string, PokemonDetailRecord["evolutionFamily"]["edges"][number]>()

  for (const edge of edges) {
    const key = `${edge.fromNodeId}::${edge.toNodeId}::${edge.method}::${edge.requirementText.join("|")}`
    if (!map.has(key)) {
      map.set(key, edge)
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (left.fromNodeId !== right.fromNodeId) {
      return left.fromNodeId.localeCompare(right.fromNodeId)
    }
    if (left.toNodeId !== right.toNodeId) {
      return left.toNodeId.localeCompare(right.toNodeId)
    }
    return left.method.localeCompare(right.method)
  })
}

function walkComponent(startSlug: string, adjacency: Map<string, Set<string>>): string[] {
  const visited = new Set<string>()
  const queue = [startSlug]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) {
      continue
    }

    visited.add(current)
    const neighbors = adjacency.get(current)
    if (!neighbors) {
      continue
    }

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor)
      }
    }
  }

  return Array.from(visited)
}

function findMoveNameFromDetails(
  moveId: string,
  learnerSlug: string,
  detailsBySlug: Map<string, PokemonDetailRecord>
): string | null {
  const detail = detailsBySlug.get(learnerSlug)
  if (!detail) {
    return null
  }

  const entry = detail.moves.find((move) => move.moveId === moveId)
  return entry?.moveName ?? null
}

function buildTokens(values: string[]): string[] {
  const tokens = new Set<string>()

  for (const value of values) {
    const normalized = normalizeSearchText(value)
    if (!normalized) {
      continue
    }

    for (const token of normalized.split(" ").filter(Boolean)) {
      tokens.add(token)
    }
  }

  return Array.from(tokens)
}

function toNumericRecord(record: Record<string, unknown>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "number") {
      result[key] = value
    }
  }

  return result
}

async function readZipEntryAsText(zip: JSZip, entryPath: string): Promise<string> {
  const entry = zip.file(entryPath)
  if (!entry) {
    throw new Error(`Missing required showdown entry: ${entryPath}`)
  }

  return entry.async("text")
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

async function collectJsonFiles(rootDir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(rootDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath)
    }
  }

  return files
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, "utf8")
  const parsed = JSON.parse(content) as unknown

  if (!isRecord(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`)
  }

  return parsed
}

async function writeJsonFile(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function gitValue(args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: UPSTREAM_ROOT,
    encoding: "utf8",
  })

  if (result.status !== 0) {
    return "unknown"
  }

  return result.stdout.trim() || "unknown"
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

import { spawnSync } from "node:child_process"
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import JSZip from "jszip"
import type {
  AbilityIndex,
  EvolutionEdgeRecord,
  MetaRecord,
  MoveLearnersIndex,
  MoveSourceType,
  ParsedMove,
  PokemonDetailRecord,
  PokemonDexNavItem,
  PokemonFormRecord,
  PokemonListItem,
  SearchDocument,
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

const PROJECT_ROOT = path.resolve(import.meta.dir, "..")
const DEFAULT_UPSTREAM_ROOT = path.resolve(PROJECT_ROOT, ".tmp-cobblemon")
const UPSTREAM_ROOT = path.resolve(
  process.argv[2] ?? process.env.COBBLEMON_REPO_PATH ?? DEFAULT_UPSTREAM_ROOT
)

const UPSTREAM_URL = "https://gitlab.com/cable-mc/cobblemon"
const KNOWN_MOVE_PREFIXES = new Set(["egg", "tm", "tutor", "legacy", "special", "form_change"])

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
const SHOWDOWN_ZIP_PATH = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/showdown.zip"
)
const SPAWNER_CONFIG_PATH = path.join(
  UPSTREAM_ROOT,
  "common/src/main/resources/data/cobblemon/spawning/best-spawner-config.json"
)

const GENERATED_ROOT = path.join(PROJECT_ROOT, "src/data/generated")
const GENERATED_BY_SLUG_ROOT = path.join(GENERATED_ROOT, "pokemon-by-slug")

type RawSpeciesFile = {
  slug: string
  filePath: string
  data: Record<string, unknown>
}

type DirectedEvolutionEdge = {
  fromSlug: string
  toSlug: string
  method: string
  requirementText: string[]
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

await main()

async function main() {
  await validateInputPaths()

  const rawSpecies = await loadRawSpeciesFiles()
  const speciesLookup = buildSpeciesLookup(rawSpecies)

  const showdownData = await loadShowdownData()
  const spawnPresets = await loadSpawnPresets()
  const biomeTagMap = await loadBiomeTagMap()
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

  const moveLearnersBuild = new Map<string, Map<string, Set<MoveSourceType>>>()

  const detailsBySlug = new Map<string, PokemonDetailRecord>()
  for (const speciesFile of rawSpecies) {
    const detail = buildPokemonDetailRecord({
      speciesFile,
      speciesLookup,
      moveNames: showdownData.moveNames,
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
  const moveLearners = buildMoveLearnersIndex(detailsBySlug, moveLearnersBuild, showdownData.moves)
  const abilityIndex = buildAbilityIndex(detailsBySlug, showdownData.abilities)
  const searchIndex = buildSearchIndex(pokemonList, moveLearners)

  if (searchIndex.some((doc) => doc.resultType === "pokemon-overview" && !doc.implemented)) {
    console.warn("[warn] Search index includes species marked implemented=false")
  }

  for (const namespace of Array.from(spawnWarnings.unknownBiomeNamespaces).sort()) {
    console.warn(`[warn] Spawn biome tag references optional namespace: ${namespace}`)
  }

  const meta: MetaRecord = {
    upstreamUrl: UPSTREAM_URL,
    branch: gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    commitSha: gitValue(["rev-parse", "HEAD"]),
    generatedAt: new Date().toISOString(),
    speciesCount: pokemonList.length,
    implementedSpeciesCount: pokemonList.filter((pokemon) => pokemon.implemented).length,
    spawnEntryCount: Array.from(detailsBySlug.values()).reduce((sum, detail) => {
      return sum + detail.spawnEntries.length
    }, 0),
    moveCount: showdownData.moveNames.size,
  }

  await writeArtifacts({
    meta,
    pokemonList,
    pokemonDexNav,
    moveLearners,
    abilityIndex,
    searchIndex,
    detailsBySlug,
  })

  console.log("Generated Cobblepedia data artifacts")
  console.log(`- Upstream: ${UPSTREAM_ROOT}`)
  console.log(`- Species: ${meta.speciesCount} (${meta.implementedSpeciesCount} implemented)`)
  console.log(`- Spawn entries: ${meta.spawnEntryCount}`)
  console.log(`- Move map size: ${meta.moveCount}`)
  console.log(`- Learnset entries parsed: ${showdownData.learnsetCount}`)
}

async function validateInputPaths() {
  const requiredPaths = [
    SPECIES_ROOT,
    SPAWN_POOL_ROOT,
    SPAWN_PRESET_ROOT,
    BIOME_TAG_ROOT,
    SHOWDOWN_ZIP_PATH,
    SPAWNER_CONFIG_PATH,
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

    moveNames.set(moveId, resolvedName)
    moveEntries.set(moveId, {
      name: resolvedName,
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
    const tagId = `#cobblemon:${path.basename(filePath, ".json")}`
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
  spawnEntries: SpawnEntryRecord[]
  moveLearnersBuild: Map<string, Map<string, Set<MoveSourceType>>>
}): PokemonDetailRecord {
  const { speciesFile } = params
  const raw = speciesFile.data

  const name = String(raw.name)
  const dexNumber = Number(raw.nationalPokedexNumber)
  const implemented = Boolean(raw.implemented)

  const types = [raw.primaryType, raw.secondaryType]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase())

  const abilities = Array.isArray(raw.abilities)
    ? raw.abilities
        .map((ability) => (typeof ability === "string" ? formatAbilityId(ability) : null))
        .filter((ability): ability is ReturnType<typeof formatAbilityId> => ability !== null)
    : []

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
    sourceLabel: speciesFile.slug,
    fromForm: null,
  })
  addMovesToLearnerIndex(params.moveLearnersBuild, speciesFile.slug, baseMoves)

  const forms = parseForms(raw.forms, {
    speciesSlug: speciesFile.slug,
    speciesName: name,
    moveNames: params.moveNames,
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
          slug: speciesFile.slug,
          name,
          dexNumber,
        },
      ],
      edges: [],
      roots: [speciesFile.slug],
    },
    moves: [...baseMoves].sort(sortMoves),
    spawnEntries: [...params.spawnEntries],
    forms,
    rawSpecies: raw,
  }

  return detail
}

function parseForms(
  rawForms: unknown,
  params: {
    speciesSlug: string
    speciesName: string
    moveNames: Map<string, string>
    speciesLookup: Map<string, string>
    aliasSet: Set<string>
    moveLearnersBuild: Map<string, Map<string, Set<MoveSourceType>>>
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

    const formAbilities = Array.isArray(rawForm.abilities)
      ? rawForm.abilities
          .map((ability) => (typeof ability === "string" ? formatAbilityId(ability) : null))
          .filter((ability): ability is ReturnType<typeof formatAbilityId> => ability !== null)
      : []

    const formMoves = parseMoveList(rawForm.moves, {
      moveNames: params.moveNames,
      sourceLabel: `${params.speciesSlug}:${formName}`,
      fromForm: formName,
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
      types: formTypes,
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
    sourceLabel: string
    fromForm: string | null
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
    if (!moveName) {
      throw new Error(
        `Move id in species moves is not resolvable in move map: ${moveId} (${params.sourceLabel})`
      )
    }

    const parsedPrefix = parseMovePrefix(prefixRaw)
    if (!parsedPrefix) {
      throw new Error(`Unsupported move source prefix \`${prefixRaw}\` in ${params.sourceLabel}`)
    }

    const dedupeKey = `${moveId}::${parsedPrefix.sourceType}::${parsedPrefix.sourceValue ?? ""}::${params.fromForm ?? ""}`
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)

    parsed.push({
      raw: rawMove,
      moveId,
      moveName,
      sourceType: parsedPrefix.sourceType,
      sourceValue: parsedPrefix.sourceValue,
      fromForm: params.fromForm,
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
        toSlug: evolution.result.slug,
        method: evolution.variant,
        requirementText: evolution.requirementText,
      })
    }

    for (const form of detail.forms) {
      for (const evolution of form.evolutions) {
        link(detail.slug, evolution.result.slug)
        directedEdges.push({
          fromSlug: detail.slug,
          toSlug: evolution.result.slug,
          method: evolution.variant,
          requirementText: evolution.requirementText,
        })
      }
    }
  }

  const familyBySlug = new Map<string, PokemonDetailRecord["evolutionFamily"]>()

  for (const detail of detailsBySlug.values()) {
    const component = walkComponent(detail.slug, adjacency)
    const members = component
      .map((slug) => detailsBySlug.get(slug))
      .filter((member): member is PokemonDetailRecord => Boolean(member))
      .map((member) => ({
        slug: member.slug,
        name: member.name,
        dexNumber: member.dexNumber,
      }))
      .sort((left, right) => {
        if (left.dexNumber !== right.dexNumber) {
          return left.dexNumber - right.dexNumber
        }

        return left.slug.localeCompare(right.slug)
      })

    const componentSet = new Set(component)
    const edges = dedupeEvolutionEdges(
      directedEdges.filter(
        (edge) => componentSet.has(edge.fromSlug) && componentSet.has(edge.toSlug)
      )
    )

    const incomingEdgeMap = new Map<string, number>()
    for (const edge of edges) {
      incomingEdgeMap.set(edge.toSlug, (incomingEdgeMap.get(edge.toSlug) ?? 0) + 1)
    }

    const roots = members
      .filter((member) => !incomingEdgeMap.has(member.slug))
      .map((member) => member.slug)

    familyBySlug.set(detail.slug, {
      members,
      edges,
      roots: roots.length > 0 ? roots : [detail.slug],
    })
  }

  return familyBySlug
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
  return pokemonList
    .filter((pokemon) => pokemon.implemented)
    .map((pokemon) => {
      return {
        slug: pokemon.slug,
        name: pokemon.name,
        dexNumber: pokemon.dexNumber,
      }
    })
}

function buildMoveLearnersIndex(
  detailsBySlug: Map<string, PokemonDetailRecord>,
  moveLearnersBuild: Map<string, Map<string, Set<MoveSourceType>>>,
  moveMap: ShowdownData["moves"]
): MoveLearnersIndex {
  const entries = Array.from(moveLearnersBuild.entries()).sort(([leftMove], [rightMove]) => {
    return leftMove.localeCompare(rightMove)
  })

  const index: MoveLearnersIndex = {}

  for (const [moveId, learnersMap] of entries) {
    const learners = Array.from(learnersMap.entries())
      .map(([slug, methods]) => {
        const detail = detailsBySlug.get(slug)
        if (!detail) {
          return null
        }

        return {
          slug,
          name: detail.name,
          dexNumber: detail.dexNumber,
          methods: Array.from(methods).sort((left, right) => left.localeCompare(right)),
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
      shortDescription: moveInfo?.shortDescription ?? null,
      description: moveInfo?.description ?? null,
      learners,
    }
  }

  return index
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
        hidden: boolean
      }
    >
  >()

  const registerAbility = (
    detail: PokemonDetailRecord,
    ability: {
      id: string
      hidden: boolean
    }
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
      existing.hidden = existing.hidden && ability.hidden
      return
    }

    pokemonMap.set(detail.slug, {
      slug: detail.slug,
      name: detail.name,
      dexNumber: detail.dexNumber,
      hidden: ability.hidden,
    })
  }

  for (const detail of detailsBySlug.values()) {
    for (const ability of detail.abilities) {
      registerAbility(detail, ability)
    }

    for (const form of detail.forms) {
      for (const ability of form.abilities) {
        registerAbility(detail, ability)
      }
    }
  }

  const index: AbilityIndex = {}

  for (const [abilityId, pokemonMap] of Array.from(byAbility.entries()).sort(([left], [right]) => {
    return left.localeCompare(right)
  })) {
    const abilityInfo = abilityMap.get(abilityId)
    const pokemon = Array.from(pokemonMap.values()).sort((left, right) => {
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
      tokens: buildTokens([entry.moveId, entry.moveName]),
      aliases: [normalizeSearchText(entry.moveId)],
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
  moveLearners: MoveLearnersIndex
  abilityIndex: AbilityIndex
  searchIndex: SearchDocument[]
  detailsBySlug: Map<string, PokemonDetailRecord>
}) {
  await rm(GENERATED_ROOT, { recursive: true, force: true })
  await mkdir(GENERATED_BY_SLUG_ROOT, { recursive: true })

  await writeJsonFile(path.join(GENERATED_ROOT, "meta.json"), params.meta)
  await writeJsonFile(path.join(GENERATED_ROOT, "pokemon-list.json"), params.pokemonList)
  await writeJsonFile(path.join(GENERATED_ROOT, "pokemon-dex-nav.json"), params.pokemonDexNav)
  await writeJsonFile(path.join(GENERATED_ROOT, "move-learners.json"), params.moveLearners)
  await writeJsonFile(path.join(GENERATED_ROOT, "ability-index.json"), params.abilityIndex)
  await writeJsonFile(path.join(GENERATED_ROOT, "search-index.json"), params.searchIndex)

  const sortedDetails = Array.from(params.detailsBySlug.entries()).sort(([left], [right]) => {
    return left.localeCompare(right)
  })

  for (const [slug, detail] of sortedDetails) {
    await writeJsonFile(path.join(GENERATED_BY_SLUG_ROOT, `${slug}.json`), detail)
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
  moveLearnersBuild: Map<string, Map<string, Set<MoveSourceType>>>,
  slug: string,
  moves: ParsedMove[]
) {
  for (const move of moves) {
    if (!moveLearnersBuild.has(move.moveId)) {
      moveLearnersBuild.set(move.moveId, new Map<string, Set<MoveSourceType>>())
    }

    const learnersMap = moveLearnersBuild.get(move.moveId)
    if (!learnersMap) {
      continue
    }

    if (!learnersMap.has(slug)) {
      learnersMap.set(slug, new Set<MoveSourceType>())
    }

    learnersMap.get(slug)?.add(move.sourceType)
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

function dedupeEvolutionEdges(edges: DirectedEvolutionEdge[]) {
  const map = new Map<string, DirectedEvolutionEdge>()

  for (const edge of edges) {
    const key = `${edge.fromSlug}::${edge.toSlug}::${edge.method}::${edge.requirementText.join("|")}`
    if (!map.has(key)) {
      map.set(key, edge)
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (left.fromSlug !== right.fromSlug) {
      return left.fromSlug.localeCompare(right.fromSlug)
    }
    if (left.toSlug !== right.toSlug) {
      return left.toSlug.localeCompare(right.toSlug)
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

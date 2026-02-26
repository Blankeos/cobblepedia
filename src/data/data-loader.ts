import type {
  AbilityIndex,
  BiomeTagIndex,
  ItemIndex,
  MetaRecord,
  MoveLearnerEntryRecord,
  PokemonDetailRecord,
  PokemonDexNavItem,
  PokemonDexNeighbors,
  PokemonFormSpriteIndex,
  PokemonInteractionIndex,
  PokemonListItem,
  PokemonTypeEntryRecord,
  RideableMonRecord,
  SearchDocument,
  SmogonMovesetsByPokemonRecord,
} from "@/data/cobblemon-types"
import { canonicalId } from "@/data/formatters"
import { getMoveLearnerShardId } from "@/data/move-learner-sharding"
import { honoClient } from "@/lib/hono-client"

let searchIndexPromise: Promise<SearchDocument[]> | null = null
let pokemonListPromise: Promise<PokemonListItem[]> | null = null
let pokemonDexNavPromise: Promise<PokemonDexNavItem[]> | null = null
let pokemonTypeEntriesPromise: Promise<PokemonTypeEntryRecord[]> | null = null
let abilityIndexPromise: Promise<AbilityIndex> | null = null
let biomeTagIndexPromise: Promise<BiomeTagIndex> | null = null
let itemIndexPromise: Promise<ItemIndex> | null = null
let pokemonInteractionIndexPromise: Promise<PokemonInteractionIndex> | null = null
let pokemonFormSpriteIndexPromise: Promise<PokemonFormSpriteIndex> | null = null
let rideableMonsPromise: Promise<RideableMonRecord[]> | null = null
let metaPromise: Promise<MetaRecord> | null = null
let publicGeneratedVersionPromise: Promise<string | null> | null = null

const moveLearnerEntryPromises = new Map<string, Promise<MoveLearnerEntryRecord | null>>()
const moveLearnerShardPromises = new Map<string, Promise<Record<string, MoveLearnerEntryRecord>>>()
const pokemonDetailPromises = new Map<string, Promise<PokemonDetailRecord | null>>()
const smogonMovesetsPromises = new Map<string, Promise<SmogonMovesetsByPokemonRecord | null>>()
const pokemonDexNeighborsPromises = new Map<string, Promise<PokemonDexNeighbors>>()
const serverGeneratedJsonPromises = new Map<string, Promise<unknown>>()

type GeneratedJsonLoadOptions = {
  withVersion?: boolean
}

const publicDataBasePath = (() => {
  const basePath = import.meta.env.BASE_URL ?? "/"
  const normalizedBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
  return `${normalizedBasePath}/data/generated`
})()

const GENERATED_JSON_FETCH_TIMEOUT_MS = 15000

export function loadSearchIndex(): Promise<SearchDocument[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = loadGeneratedJson<SearchDocument[]>("search-index.json")
  }

  return searchIndexPromise
}

export function loadPokemonList(): Promise<PokemonListItem[]> {
  if (!pokemonListPromise) {
    pokemonListPromise = loadGeneratedJson<PokemonListItem[]>("pokemon-list.json")
  }

  return pokemonListPromise
}

export function loadPokemonDexNav(): Promise<PokemonDexNavItem[]> {
  if (!pokemonDexNavPromise) {
    pokemonDexNavPromise = loadGeneratedJson<PokemonDexNavItem[]>("pokemon-dex-nav.json").catch(
      async () => {
        const pokemonList = await loadPokemonList()
        return pokemonList.map((pokemon) => ({
          slug: pokemon.slug,
          name: pokemon.name,
          dexNumber: pokemon.dexNumber,
        }))
      }
    )
  }

  return pokemonDexNavPromise
}

export function loadPokemonDexNeighbors(
  currentSlug: string,
  dexNumber: number
): Promise<PokemonDexNeighbors> {
  const normalizedSlug = currentSlug.trim().toLowerCase()
  const normalizedDexNumber = Number.isFinite(dexNumber) ? Math.trunc(dexNumber) : Number.NaN

  if (!normalizedSlug || !Number.isFinite(normalizedDexNumber) || normalizedDexNumber <= 0) {
    return Promise.resolve({
      previous: null,
      next: null,
    })
  }

  const cacheKey = `${normalizedSlug}:${normalizedDexNumber}`
  const existingPromise = pokemonDexNeighborsPromises.get(cacheKey)
  if (existingPromise) {
    return existingPromise
  }

  const promise = resolvePokemonDexNeighbors(normalizedSlug, normalizedDexNumber).catch(
    async () => {
      const pokemonDexNav = await loadPokemonDexNav().catch(() => [])
      return resolveDexNeighbors(pokemonDexNav, normalizedSlug, normalizedDexNumber)
    }
  )

  pokemonDexNeighborsPromises.set(cacheKey, promise)
  return promise
}

export function loadPokemonTypeEntries(): Promise<PokemonTypeEntryRecord[]> {
  if (!pokemonTypeEntriesPromise) {
    pokemonTypeEntriesPromise = loadGeneratedJson<PokemonTypeEntryRecord[]>(
      "pokemon-type-entries.json"
    )
  }

  return pokemonTypeEntriesPromise
}

export function loadAbilityIndex(): Promise<AbilityIndex> {
  if (!abilityIndexPromise) {
    abilityIndexPromise = loadGeneratedJson<AbilityIndex>("ability-index.json")
  }

  return abilityIndexPromise
}

export function loadBiomeTagIndex(): Promise<BiomeTagIndex> {
  if (!biomeTagIndexPromise) {
    biomeTagIndexPromise = loadGeneratedJson<BiomeTagIndex>("biome-tag-index.json").catch(
      () => ({})
    )
  }

  return biomeTagIndexPromise
}

export function loadItemIndex(): Promise<ItemIndex> {
  if (!itemIndexPromise) {
    itemIndexPromise = loadGeneratedJson<ItemIndex>("item-index.json")
  }

  return itemIndexPromise
}

export function loadPokemonInteractionIndex(): Promise<PokemonInteractionIndex> {
  if (!pokemonInteractionIndexPromise) {
    pokemonInteractionIndexPromise = loadGeneratedJson<PokemonInteractionIndex>(
      "pokemon-interaction-index.json"
    ).catch(() => ({
      byPokemon: {},
      byRequiredItem: {},
      byGrantedItem: {},
    }))
  }

  return pokemonInteractionIndexPromise
}

export function loadPokemonFormSpriteIndex(): Promise<PokemonFormSpriteIndex> {
  if (!pokemonFormSpriteIndexPromise) {
    pokemonFormSpriteIndexPromise = loadGeneratedJson<PokemonFormSpriteIndex>(
      "pokemon-form-sprite-index.json"
    ).catch(() => ({}))
  }

  return pokemonFormSpriteIndexPromise
}

export function loadRideableMons(): Promise<RideableMonRecord[]> {
  if (!rideableMonsPromise) {
    rideableMonsPromise = loadGeneratedJson<RideableMonRecord[]>("rideable-mons.json")
  }

  return rideableMonsPromise
}

export function loadMeta(): Promise<MetaRecord> {
  if (!metaPromise) {
    metaPromise = loadGeneratedJson<MetaRecord>("meta.json", { withVersion: false })
  }

  return metaPromise
}

export function loadMoveLearnerEntry(moveId: string): Promise<MoveLearnerEntryRecord | null> {
  const normalizedMoveId = canonicalId(moveId)
  if (!normalizedMoveId) {
    return Promise.resolve(null)
  }

  const existingPromise = moveLearnerEntryPromises.get(normalizedMoveId)
  if (existingPromise) {
    return existingPromise
  }

  const promise = loadMoveLearnerShard(getMoveLearnerShardId(normalizedMoveId))
    .then((shard) => shard[normalizedMoveId] ?? null)
    .catch(() => null)

  moveLearnerEntryPromises.set(normalizedMoveId, promise)
  return promise
}

export function loadPokemonDetail(slug: string): Promise<PokemonDetailRecord | null> {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) {
    return Promise.resolve(null)
  }

  const existingPromise = pokemonDetailPromises.get(normalizedSlug)
  if (existingPromise) {
    return existingPromise
  }

  const promise = loadGeneratedJson<PokemonDetailRecord>(
    `pokemon-by-slug/${normalizedSlug}.json`
  ).catch(() => null)

  pokemonDetailPromises.set(normalizedSlug, promise)
  return promise
}

export function loadSmogonMovesetsBySlug(
  slug: string
): Promise<SmogonMovesetsByPokemonRecord | null> {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!normalizedSlug) {
    return Promise.resolve(null)
  }

  const existingPromise = smogonMovesetsPromises.get(normalizedSlug)
  if (existingPromise) {
    return existingPromise
  }

  const promise = loadGeneratedJson<SmogonMovesetsByPokemonRecord>(
    `smogon-movesets-by-slug/${normalizedSlug}.json`
  ).catch(() => null)

  smogonMovesetsPromises.set(normalizedSlug, promise)
  return promise
}

function loadMoveLearnerShard(shardId: string): Promise<Record<string, MoveLearnerEntryRecord>> {
  const existingPromise = moveLearnerShardPromises.get(shardId)
  if (existingPromise) {
    return existingPromise
  }

  const promise = loadGeneratedJson<Record<string, MoveLearnerEntryRecord>>(
    `move-learners-shards/${shardId}.json`
  ).catch(() => ({}))

  moveLearnerShardPromises.set(shardId, promise)
  return promise
}

async function resolvePokemonDexNeighbors(
  currentSlug: string,
  dexNumber: number
): Promise<PokemonDexNeighbors> {
  if (import.meta.env.SSR) {
    const pokemonDexNav = await loadPokemonDexNav().catch(() => [])
    return resolveDexNeighbors(pokemonDexNav, currentSlug, dexNumber)
  }

  const response = await honoClient.pokemon["dex-neighbors"].$get({
    query: {
      slug: currentSlug,
      dexNumber: String(dexNumber),
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load pokemon dex neighbors: ${response.status}`)
  }

  const payload = (await response.json()) as {
    previous?: unknown
    next?: unknown
  }

  return {
    previous: isPokemonDexNavItem(payload.previous) ? payload.previous : null,
    next: isPokemonDexNavItem(payload.next) ? payload.next : null,
  }
}

function resolveDexNeighbors(
  pokemonDexNav: PokemonDexNavItem[],
  currentSlug: string,
  dexNumber: number
): PokemonDexNeighbors {
  if (!currentSlug || pokemonDexNav.length === 0) {
    return {
      previous: null,
      next: null,
    }
  }

  const slugIndex = pokemonDexNav.findIndex((pokemon) => pokemon.slug === currentSlug)
  const fallbackDexIndex =
    slugIndex < 0 ? pokemonDexNav.findIndex((pokemon) => pokemon.dexNumber === dexNumber) : -1
  const index = slugIndex >= 0 ? slugIndex : fallbackDexIndex

  if (index < 0) {
    return {
      previous: null,
      next: null,
    }
  }

  return {
    previous: pokemonDexNav[index - 1] ?? null,
    next: pokemonDexNav[index + 1] ?? null,
  }
}

function isPokemonDexNavItem(value: unknown): value is PokemonDexNavItem {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<PokemonDexNavItem>
  return (
    typeof candidate.slug === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.dexNumber === "number"
  )
}

function loadGeneratedJson<T>(
  relativePath: string,
  options: GeneratedJsonLoadOptions = {}
): Promise<T> {
  if (import.meta.env.SSR) {
    return loadServerGeneratedJson(relativePath)
  }

  return fetchPublicGeneratedJson<T>(relativePath, options)
}

function loadServerGeneratedJson<T>(relativePath: string): Promise<T> {
  const existingPromise = serverGeneratedJsonPromises.get(relativePath)
  if (existingPromise) {
    return existingPromise as Promise<T>
  }

  const promise = readServerGeneratedJson<T>(relativePath)
  serverGeneratedJsonPromises.set(relativePath, promise as Promise<unknown>)
  return promise
}

async function readServerGeneratedJson<T>(relativePath: string): Promise<T> {
  const fsPromisesSpecifier = "node:fs/promises"
  const pathSpecifier = "node:path"
  const urlSpecifier = "node:url"

  const [{ readFile }, pathModule, urlModule] = await Promise.all([
    import(/* @vite-ignore */ fsPromisesSpecifier) as Promise<typeof import("node:fs/promises")>,
    import(/* @vite-ignore */ pathSpecifier) as Promise<typeof import("node:path")>,
    import(/* @vite-ignore */ urlSpecifier) as Promise<typeof import("node:url")>,
  ])

  const roots = discoverServerDataRoots(pathModule, urlModule)
  const candidateBasePaths = buildGeneratedDataBasePaths(pathModule, roots)

  for (const basePath of candidateBasePaths) {
    const filePath = pathModule.join(basePath, relativePath)
    try {
      const source = await readFile(filePath, "utf8")
      return JSON.parse(source) as T
    } catch {}
  }

  throw new Error(`Generated data file not found: ${relativePath}`)
}

function discoverServerDataRoots(
  pathModule: typeof import("node:path"),
  urlModule: typeof import("node:url")
): string[] {
  const roots = new Set<string>()

  const pushRoot = (value: string | undefined | null) => {
    if (!value) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    roots.add(trimmed)
  }

  pushRoot(process.cwd())
  pushRoot(process.env.PWD)
  pushRoot(process.env.INIT_CWD)
  pushRoot(typeof process.argv[1] === "string" ? pathModule.dirname(process.argv[1]) : null)

  try {
    pushRoot(pathModule.dirname(urlModule.fileURLToPath(import.meta.url)))
  } catch {}

  return Array.from(roots)
}

function buildGeneratedDataBasePaths(
  pathModule: typeof import("node:path"),
  roots: string[]
): string[] {
  const candidateBasePaths = new Set<string>()

  const addAncestorPaths = (root: string) => {
    let current = pathModule.resolve(root)

    for (let depth = 0; depth < 8; depth += 1) {
      candidateBasePaths.add(pathModule.join(current, "public", "data", "generated"))
      candidateBasePaths.add(pathModule.join(current, "dist", "client", "data", "generated"))
      candidateBasePaths.add(pathModule.join(current, "dist", "server", "data", "generated"))
      candidateBasePaths.add(pathModule.join(current, "data", "generated"))

      const parent = pathModule.dirname(current)
      if (parent === current) {
        break
      }

      current = parent
    }
  }

  for (const root of roots) {
    addAncestorPaths(root)
  }

  return Array.from(candidateBasePaths)
}

async function fetchPublicGeneratedJson<T>(
  relativePath: string,
  options: GeneratedJsonLoadOptions = {}
): Promise<T> {
  const withVersion = options.withVersion ?? true
  const cacheMode: RequestCache = withVersion ? "force-cache" : "no-store"
  const version = withVersion ? await loadPublicGeneratedVersion() : null
  const cacheBuster = version ? `?v=${encodeURIComponent(version)}` : ""

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort()
  }, GENERATED_JSON_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(`${publicDataBasePath}/${relativePath}${cacheBuster}`, {
      cache: cacheMode,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`Failed to load generated data: ${relativePath} (${response.status})`)
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Timed out loading generated data: ${relativePath}`)
    }

    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

function loadPublicGeneratedVersion(): Promise<string | null> {
  if (!publicGeneratedVersionPromise) {
    publicGeneratedVersionPromise = fetchPublicGeneratedJson<MetaRecord>("meta.json", {
      withVersion: false,
    })
      .then((meta) => {
        const generatedAt = meta.generatedAt?.trim()
        if (generatedAt) {
          return generatedAt
        }

        const commitSha = meta.commitSha?.trim()
        return commitSha ? commitSha.slice(0, 12) : null
      })
      .catch(() => null)
  }

  return publicGeneratedVersionPromise
}

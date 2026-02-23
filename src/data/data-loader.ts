import type {
  AbilityIndex,
  ItemIndex,
  MetaRecord,
  MoveLearnerEntryRecord,
  PokemonDetailRecord,
  PokemonDexNavItem,
  PokemonFormSpriteIndex,
  PokemonListItem,
  PokemonTypeEntryRecord,
  RideableMonRecord,
  SearchDocument,
} from "@/data/cobblemon-types"
import { canonicalId } from "@/data/formatters"
import { getMoveLearnerShardId } from "@/data/move-learner-sharding"

let searchIndexPromise: Promise<SearchDocument[]> | null = null
let pokemonListPromise: Promise<PokemonListItem[]> | null = null
let pokemonDexNavPromise: Promise<PokemonDexNavItem[]> | null = null
let pokemonTypeEntriesPromise: Promise<PokemonTypeEntryRecord[]> | null = null
let abilityIndexPromise: Promise<AbilityIndex> | null = null
let itemIndexPromise: Promise<ItemIndex> | null = null
let pokemonFormSpriteIndexPromise: Promise<PokemonFormSpriteIndex> | null = null
let rideableMonsPromise: Promise<RideableMonRecord[]> | null = null
let metaPromise: Promise<MetaRecord> | null = null
let publicGeneratedVersionPromise: Promise<string | null> | null = null

const moveLearnerEntryPromises = new Map<string, Promise<MoveLearnerEntryRecord | null>>()
const moveLearnerShardPromises = new Map<string, Promise<Record<string, MoveLearnerEntryRecord>>>()
const pokemonDetailPromises = new Map<string, Promise<PokemonDetailRecord | null>>()
const serverGeneratedJsonPromises = new Map<string, Promise<unknown>>()

type GeneratedJsonLoadOptions = {
  withVersion?: boolean
}

const publicDataBasePath = (() => {
  const basePath = import.meta.env.BASE_URL ?? "/"
  const normalizedBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
  return `${normalizedBasePath}/data/generated`
})()

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
        return pokemonList
          .filter((pokemon) => pokemon.implemented)
          .map((pokemon) => ({
            slug: pokemon.slug,
            name: pokemon.name,
            dexNumber: pokemon.dexNumber,
          }))
      }
    )
  }

  return pokemonDexNavPromise
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

export function loadItemIndex(): Promise<ItemIndex> {
  if (!itemIndexPromise) {
    itemIndexPromise = loadGeneratedJson<ItemIndex>("item-index.json")
  }

  return itemIndexPromise
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

  const [{ readFile }, pathModule] = await Promise.all([
    import(/* @vite-ignore */ fsPromisesSpecifier) as Promise<typeof import("node:fs/promises")>,
    import(/* @vite-ignore */ pathSpecifier) as Promise<typeof import("node:path")>,
  ])

  const candidateBasePaths = [
    pathModule.join(process.cwd(), "public", "data", "generated"),
    pathModule.join(process.cwd(), "dist", "client", "data", "generated"),
    pathModule.join(process.cwd(), "dist", "server", "data", "generated"),
    pathModule.join(process.cwd(), "src", "data", "generated"),
  ]

  for (const basePath of candidateBasePaths) {
    const filePath = pathModule.join(basePath, relativePath)
    try {
      const source = await readFile(filePath, "utf8")
      return JSON.parse(source) as T
    } catch {}
  }

  throw new Error(`Generated data file not found: ${relativePath}`)
}

async function fetchPublicGeneratedJson<T>(
  relativePath: string,
  options: GeneratedJsonLoadOptions = {}
): Promise<T> {
  const withVersion = options.withVersion ?? true
  const version = withVersion ? await loadPublicGeneratedVersion() : null
  const cacheBuster = version ? `?v=${encodeURIComponent(version)}` : ""

  const response = await fetch(`${publicDataBasePath}/${relativePath}${cacheBuster}`, {
    cache: "force-cache",
  })
  if (!response.ok) {
    throw new Error(`Failed to load generated data: ${relativePath} (${response.status})`)
  }

  return (await response.json()) as T
}

function loadPublicGeneratedVersion(): Promise<string | null> {
  if (!publicGeneratedVersionPromise) {
    publicGeneratedVersionPromise = fetchPublicGeneratedJson<MetaRecord>("meta.json", {
      withVersion: false,
    })
      .then((meta) => {
        const commitSha = meta.commitSha?.trim()
        return commitSha ? commitSha.slice(0, 12) : null
      })
      .catch(() => null)
  }

  return publicGeneratedVersionPromise
}

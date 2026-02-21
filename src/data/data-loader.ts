import type {
  MetaRecord,
  MoveLearnersIndex,
  PokemonDetailRecord,
  PokemonListItem,
  SearchDocument,
} from "@/data/cobblemon-types"

let searchIndexPromise: Promise<SearchDocument[]> | null = null
let pokemonListPromise: Promise<PokemonListItem[]> | null = null
let moveLearnersPromise: Promise<MoveLearnersIndex> | null = null
let metaPromise: Promise<MetaRecord> | null = null

const pokemonDetailModules = import.meta.glob<{ default: PokemonDetailRecord }>(
  "./generated/pokemon-by-slug/*.json"
)
const pokemonDetailPromises = new Map<string, Promise<PokemonDetailRecord | null>>()

export function loadSearchIndex(): Promise<SearchDocument[]> {
  if (!searchIndexPromise) {
    searchIndexPromise = import("./generated/search-index.json").then(
      (module) => module.default as SearchDocument[]
    )
  }

  return searchIndexPromise
}

export function loadPokemonList(): Promise<PokemonListItem[]> {
  if (!pokemonListPromise) {
    pokemonListPromise = import("./generated/pokemon-list.json").then(
      (module) => module.default as PokemonListItem[]
    )
  }

  return pokemonListPromise
}

export function loadMoveLearners(): Promise<MoveLearnersIndex> {
  if (!moveLearnersPromise) {
    moveLearnersPromise = import("./generated/move-learners.json").then(
      (module) => module.default as MoveLearnersIndex
    )
  }

  return moveLearnersPromise
}

export function loadMeta(): Promise<MetaRecord> {
  if (!metaPromise) {
    metaPromise = import("./generated/meta.json").then((module) => module.default as MetaRecord)
  }

  return metaPromise
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

  const key = `./generated/pokemon-by-slug/${normalizedSlug}.json`
  const importer = pokemonDetailModules[key]
  if (!importer) {
    const notFoundPromise = Promise.resolve(null)
    pokemonDetailPromises.set(normalizedSlug, notFoundPromise)
    return notFoundPromise
  }

  const promise = importer()
    .then((module) => module.default)
    .catch(() => null)

  pokemonDetailPromises.set(normalizedSlug, promise)
  return promise
}

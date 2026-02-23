import type {
  AbilityIndex,
  ItemIndex,
  MetaRecord,
  MoveLearnersIndex,
  PokemonDetailRecord,
  PokemonDexNavItem,
  PokemonListItem,
  PokemonTypeEntryRecord,
  RideableMonRecord,
  SearchDocument,
} from "@/data/cobblemon-types"

let searchIndexPromise: Promise<SearchDocument[]> | null = null
let pokemonListPromise: Promise<PokemonListItem[]> | null = null
let pokemonDexNavPromise: Promise<PokemonDexNavItem[]> | null = null
let pokemonTypeEntriesPromise: Promise<PokemonTypeEntryRecord[]> | null = null
let moveLearnersPromise: Promise<MoveLearnersIndex> | null = null
let abilityIndexPromise: Promise<AbilityIndex> | null = null
let itemIndexPromise: Promise<ItemIndex> | null = null
let rideableMonsPromise: Promise<RideableMonRecord[]> | null = null
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

export function loadPokemonDexNav(): Promise<PokemonDexNavItem[]> {
  if (!pokemonDexNavPromise) {
    pokemonDexNavPromise = import("./generated/pokemon-dex-nav.json")
      .then((module) => module.default as PokemonDexNavItem[])
      .catch(async () => {
        const pokemonList = await loadPokemonList()
        return pokemonList
          .filter((pokemon) => pokemon.implemented)
          .map((pokemon) => ({
            slug: pokemon.slug,
            name: pokemon.name,
            dexNumber: pokemon.dexNumber,
          }))
      })
  }

  return pokemonDexNavPromise
}

export function loadPokemonTypeEntries(): Promise<PokemonTypeEntryRecord[]> {
  if (!pokemonTypeEntriesPromise) {
    pokemonTypeEntriesPromise = import("./generated/pokemon-type-entries.json").then(
      (module) => module.default as PokemonTypeEntryRecord[]
    )
  }

  return pokemonTypeEntriesPromise
}

export function loadMoveLearners(): Promise<MoveLearnersIndex> {
  if (!moveLearnersPromise) {
    moveLearnersPromise = import("./generated/move-learners.json").then(
      (module) => module.default as MoveLearnersIndex
    )
  }

  return moveLearnersPromise
}

export function loadAbilityIndex(): Promise<AbilityIndex> {
  if (!abilityIndexPromise) {
    abilityIndexPromise = import("./generated/ability-index.json").then(
      (module) => module.default as AbilityIndex
    )
  }

  return abilityIndexPromise
}

export function loadItemIndex(): Promise<ItemIndex> {
  if (!itemIndexPromise) {
    itemIndexPromise = import("./generated/item-index.json").then(
      (module) => module.default as ItemIndex
    )
  }

  return itemIndexPromise
}

export function loadRideableMons(): Promise<RideableMonRecord[]> {
  if (!rideableMonsPromise) {
    rideableMonsPromise = import("./generated/rideable-mons.json").then(
      (module) => module.default as RideableMonRecord[]
    )
  }

  return rideableMonsPromise
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

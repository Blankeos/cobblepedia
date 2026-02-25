import { Hono } from "hono"
import type { PokemonDexNavItem, PokemonListItem } from "@/data/cobblemon-types"

let pokemonDexNavIndex: PokemonDexNavIndex | null = null
let indexPromise: Promise<PokemonDexNavIndex> | null = null

type PokemonDexNeighborsResponse = {
  current: PokemonDexNavItem | null
  previous: PokemonDexNavItem | null
  next: PokemonDexNavItem | null
}

type PokemonDexNavIndex = {
  items: PokemonDexNavItem[]
  bySlug: Map<string, number>
  byDexNumber: Map<number, number>
}

const generatedJsonLoaders: Record<string, () => Promise<{ default?: unknown }>> = {
  "pokemon-dex-nav.json": () => import("@/data/generated/pokemon-dex-nav.json"),
  "pokemon-list.json": () => import("@/data/generated/pokemon-list.json"),
}

async function loadPokemonDexNavIndex(): Promise<PokemonDexNavIndex> {
  if (pokemonDexNavIndex) {
    return pokemonDexNavIndex
  }

  if (indexPromise) {
    return indexPromise
  }

  indexPromise = (async () => {
    const pokemonDexNavArtifact = await loadGeneratedJson("pokemon-dex-nav.json")
    const pokemonListArtifact = await loadGeneratedJson("pokemon-list.json")

    const index = buildPokemonDexNavIndex(
      resolvePokemonDexNavItems(pokemonDexNavArtifact, pokemonListArtifact)
    )
    pokemonDexNavIndex = index
    return index
  })()

  return indexPromise
}

async function loadGeneratedJson(relativePath: string): Promise<unknown> {
  const loadModule = generatedJsonLoaders[relativePath]
  if (!loadModule) {
    return null
  }

  try {
    const dataModule = await loadModule()
    return dataModule.default ?? dataModule
  } catch {
    return null
  }
}

export const pokemonController = new Hono().get("/dex-neighbors", async (c) => {
  const dexNumberRaw = c.req.query("dexNumber")
  const dexNumber = Number.parseInt(String(dexNumberRaw ?? ""), 10)
  const slug = String(c.req.query("slug") ?? "")
    .trim()
    .toLowerCase()

  if (!Number.isFinite(dexNumber) || dexNumber <= 0) {
    return c.json({ error: "Expected a numeric dexNumber query parameter." }, 400)
  }

  const navIndex = await loadPokemonDexNavIndex()

  if (navIndex.items.length === 0) {
    return c.json({ error: "Pokemon dex navigation data is unavailable." }, 503)
  }

  const index = resolvePokemonDexIndex(navIndex, slug, dexNumber)
  c.header("cache-control", "public, max-age=7200") // 2 hrs
  return c.json(toNeighborsResponse(navIndex.items, index))
})

function buildPokemonDexNavIndex(items: PokemonDexNavItem[]): PokemonDexNavIndex {
  const bySlug = new Map<string, number>()
  const byDexNumber = new Map<number, number>()

  for (const [index, pokemon] of items.entries()) {
    if (!bySlug.has(pokemon.slug)) {
      bySlug.set(pokemon.slug, index)
    }

    if (!byDexNumber.has(pokemon.dexNumber)) {
      byDexNumber.set(pokemon.dexNumber, index)
    }
  }

  return {
    items,
    bySlug,
    byDexNumber,
  }
}

function resolvePokemonDexNavItems(
  pokemonDexNavRaw: unknown,
  pokemonListRaw: unknown
): PokemonDexNavItem[] {
  const fromDexNav = toPokemonDexNavItems(pokemonDexNavRaw)
  if (fromDexNav.length > 0) {
    return fromDexNav
  }

  const fromPokemonList = toPokemonListItems(pokemonListRaw).map((pokemon) => ({
    slug: pokemon.slug,
    name: pokemon.name,
    dexNumber: pokemon.dexNumber,
  }))

  return fromPokemonList
}

function resolvePokemonDexIndex(
  navIndex: PokemonDexNavIndex,
  slug: string,
  dexNumber: number
): number | null {
  if (slug) {
    const slugIndex = navIndex.bySlug.get(slug)
    if (slugIndex !== undefined) {
      return slugIndex
    }
  }

  const dexIndex = navIndex.byDexNumber.get(dexNumber)
  return dexIndex ?? null
}

function toNeighborsResponse(
  pokemonDexNav: PokemonDexNavItem[],
  index: number | null
): PokemonDexNeighborsResponse {
  if (index === null || index < 0 || index >= pokemonDexNav.length) {
    return {
      current: null,
      previous: null,
      next: null,
    }
  }

  return {
    current: pokemonDexNav[index] ?? null,
    previous: pokemonDexNav[index - 1] ?? null,
    next: pokemonDexNav[index + 1] ?? null,
  }
}

function toPokemonDexNavItems(value: unknown): PokemonDexNavItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => normalizePokemonDexNavItem(entry))
    .filter((entry): entry is PokemonDexNavItem => entry !== null)
}

function toPokemonListItems(value: unknown): PokemonListItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => normalizePokemonListItem(entry))
    .filter((entry): entry is PokemonListItem => entry !== null)
}

function normalizePokemonDexNavItem(value: unknown): PokemonDexNavItem | null {
  if (!isRecord(value)) {
    return null
  }

  const slug = normalizeNonEmptyString(value.slug)
  const name = normalizeNonEmptyString(value.name)
  const dexNumber = normalizePositiveInteger(value.dexNumber)

  if (!slug || !name || dexNumber === null) {
    return null
  }

  return {
    slug,
    name,
    dexNumber,
  }
}

function normalizePokemonListItem(value: unknown): PokemonListItem | null {
  if (!isRecord(value)) {
    return null
  }

  const slug = normalizeNonEmptyString(value.slug)
  const name = normalizeNonEmptyString(value.name)
  const dexNumber = normalizePositiveInteger(value.dexNumber)

  if (!slug || !name || dexNumber === null) {
    return null
  }

  return {
    slug,
    name,
    dexNumber,
    implemented: Boolean(value.implemented),
    types: Array.isArray(value.types)
      ? value.types.filter((type): type is string => typeof type === "string")
      : [],
    aliases: Array.isArray(value.aliases)
      ? value.aliases.filter((alias): alias is string => typeof alias === "string")
      : [],
    eggGroups: Array.isArray(value.eggGroups)
      ? value.eggGroups.filter((group): group is string => typeof group === "string")
      : [],
  }
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  const normalized = Math.trunc(value)
  return normalized > 0 ? normalized : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

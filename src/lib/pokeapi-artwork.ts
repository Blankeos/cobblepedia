import type { PokemonFormSpriteIndexEntry } from "@/data/cobblemon-types"
import { loadPokemonFormSpriteIndex } from "@/data/data-loader"

const OFFICIAL_ARTWORK_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork"
const HOME_ARTWORK_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home"
const FRONT_SPRITE_ROOT = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon"

export type ResolvePokemonArtworkParams = {
  dexNumber: number
  baseSlug: string
  formSlug?: string | null
  formName?: string | null
  shiny?: boolean
}

export type ResolvedPokemonArtwork = {
  urls: string[]
  pokemonId: number
  pokemonName: string | null
  matchedForm: boolean
}

const artworkResolutionCache = new Map<string, Promise<ResolvedPokemonArtwork>>()

export function getPokemonOfficialArtworkUrl(
  dexNumber: number,
  shiny = false,
  _formSlug: string | null = null
): string | null {
  const normalizedDexNumber = normalizeDexNumber(dexNumber)
  if (normalizedDexNumber === null) {
    return null
  }

  return buildOfficialArtworkUrl(normalizedDexNumber, shiny)
}

export async function resolvePokemonArtworkUrls(
  params: ResolvePokemonArtworkParams
): Promise<ResolvedPokemonArtwork> {
  const normalizedDexNumber = normalizeDexNumber(params.dexNumber)
  if (normalizedDexNumber === null) {
    return {
      urls: [],
      pokemonId: 0,
      pokemonName: null,
      matchedForm: false,
    }
  }

  const cacheKey = [
    normalizedDexNumber,
    canonicalizeKeyPart(params.baseSlug),
    canonicalizeKeyPart(params.formSlug),
    canonicalizeKeyPart(params.formName),
    params.shiny ? "1" : "0",
  ].join("|")

  const cached = artworkResolutionCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const promise = resolveArtworkForParams(params, normalizedDexNumber)
  artworkResolutionCache.set(cacheKey, promise)
  return promise
}

async function resolveArtworkForParams(
  params: ResolvePokemonArtworkParams,
  fallbackPokemonId: number
): Promise<ResolvedPokemonArtwork> {
  const shiny = Boolean(params.shiny)
  const formEntry = await resolveFormSpriteEntry(params)

  if (!formEntry) {
    return createArtworkResult(fallbackPokemonId, null, false, shiny)
  }

  const mappedPokemonId = normalizeDexNumber(formEntry.pokemonId)
  if (mappedPokemonId === null) {
    return createArtworkResult(fallbackPokemonId, null, false, shiny)
  }

  return createArtworkResult(mappedPokemonId, formEntry.pokemonIdentifier, true, shiny)
}

async function resolveFormSpriteEntry(
  params: ResolvePokemonArtworkParams
): Promise<PokemonFormSpriteIndexEntry | null> {
  const slugKey = buildFormSlugLookupKey(params.baseSlug, params.formSlug)
  const nameKey = buildFormNameLookupKey(params.baseSlug, params.formName)

  if (!slugKey && !nameKey) {
    return null
  }

  const formSpriteIndex = await loadPokemonFormSpriteIndex()

  if (slugKey && formSpriteIndex[slugKey]) {
    return formSpriteIndex[slugKey]
  }

  if (nameKey && formSpriteIndex[nameKey]) {
    return formSpriteIndex[nameKey]
  }

  return null
}

function createArtworkResult(
  pokemonId: number,
  pokemonName: string | null,
  matchedForm: boolean,
  shiny: boolean
): ResolvedPokemonArtwork {
  const urls = uniqueStrings([
    buildOfficialArtworkUrl(pokemonId, shiny),
    buildHomeArtworkUrl(pokemonId, shiny),
    buildFrontSpriteUrl(pokemonId, shiny),
  ])

  return {
    urls,
    pokemonId,
    pokemonName,
    matchedForm,
  }
}

function buildOfficialArtworkUrl(pokemonId: number, shiny: boolean): string {
  return `${OFFICIAL_ARTWORK_ROOT}/${shiny ? "shiny/" : ""}${pokemonId}.png`
}

function buildHomeArtworkUrl(pokemonId: number, shiny: boolean): string {
  return `${HOME_ARTWORK_ROOT}/${shiny ? "shiny/" : ""}${pokemonId}.png`
}

function buildFrontSpriteUrl(pokemonId: number, shiny: boolean): string {
  return `${FRONT_SPRITE_ROOT}/${shiny ? "shiny/" : ""}${pokemonId}.png`
}

function normalizeDexNumber(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return Math.trunc(value)
}

function buildFormSlugLookupKey(
  baseSlug: string,
  formSlug: string | null | undefined
): string | null {
  const normalizedBaseSlug = canonicalizeKeyPart(baseSlug)
  const normalizedFormSlug = canonicalizeKeyPart(formSlug)

  if (!normalizedBaseSlug || !normalizedFormSlug) {
    return null
  }

  return `${normalizedBaseSlug}::${normalizedFormSlug}`
}

function buildFormNameLookupKey(
  baseSlug: string,
  formName: string | null | undefined
): string | null {
  const normalizedBaseSlug = canonicalizeKeyPart(baseSlug)
  const normalizedFormName = canonicalizeKeyPart(formName)

  if (!normalizedBaseSlug || !normalizedFormName) {
    return null
  }

  return `${normalizedBaseSlug}::name:${normalizedFormName}`
}

function canonicalizeKeyPart(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }

  return result
}

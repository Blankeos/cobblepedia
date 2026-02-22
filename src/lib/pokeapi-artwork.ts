const OFFICIAL_ARTWORK_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork"
const HOME_ARTWORK_ROOT =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home"
const FRONT_SPRITE_ROOT = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon"
const POKEAPI_GRAPHQL_ENDPOINT = "https://graphql.pokeapi.co/v1beta2"

const SPECIES_FORMS_QUERY = `
  query ResolveSpeciesForms($dexNumber: Int!) {
    pokemon(where: { id: { _eq: $dexNumber } }, limit: 1) {
      pokemonspecy {
        pokemons(order_by: [{ is_default: desc }, { id: asc }]) {
          id
          name
          is_default
          pokemonforms(limit: 1) {
            form_name
          }
        }
      }
    }
  }
`

type PokemonFormCandidate = {
  id: number
  name: string
  isDefault: boolean
  formName: string
}

type SpeciesFormsResponse = {
  data?: {
    pokemon?: Array<{
      pokemonspecy?: {
        pokemons?: Array<{
          id: number
          name: string
          is_default: boolean
          pokemonforms?: Array<{
            form_name?: string | null
          }>
        }>
      }
    }>
  }
  errors?: Array<{
    message?: string
  }>
}

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

const speciesFormsCache = new Map<number, Promise<PokemonFormCandidate[] | null>>()
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
    normalizeIdentifier(params.baseSlug),
    normalizeIdentifier(params.formSlug),
    normalizeIdentifier(params.formName),
    params.shiny ? "1" : "0",
  ].join("|")

  const cached = artworkResolutionCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const promise = resolvePokemonArtworkUrlsUncached({
    ...params,
    dexNumber: normalizedDexNumber,
  })
  artworkResolutionCache.set(cacheKey, promise)
  return promise
}

async function resolvePokemonArtworkUrlsUncached(
  params: ResolvePokemonArtworkParams
): Promise<ResolvedPokemonArtwork> {
  const dexNumber = normalizeDexNumber(params.dexNumber)
  if (dexNumber === null) {
    return {
      urls: [],
      pokemonId: 0,
      pokemonName: null,
      matchedForm: false,
    }
  }

  const shiny = Boolean(params.shiny)
  const hasFormRequest = Boolean(
    normalizeIdentifier(params.formSlug) || normalizeIdentifier(params.formName)
  )

  if (!hasFormRequest) {
    return createArtworkResult(dexNumber, null, false, shiny)
  }

  const speciesForms = await loadSpeciesFormCandidates(dexNumber)
  if (!speciesForms || speciesForms.length === 0) {
    return createArtworkResult(dexNumber, null, false, shiny)
  }

  const basePokemonName =
    speciesForms.find((candidate) => candidate.isDefault)?.name ??
    speciesForms[0]?.name ??
    params.baseSlug

  const targets = buildFormTargets({
    baseSlug: params.baseSlug,
    formSlug: params.formSlug ?? null,
    formName: params.formName ?? null,
  })

  const matched = pickBestFormCandidate(speciesForms, targets, basePokemonName)
  if (!matched) {
    return createArtworkResult(dexNumber, null, false, shiny)
  }

  return createArtworkResult(matched.id, matched.name, true, shiny)
}

async function loadSpeciesFormCandidates(
  dexNumber: number
): Promise<PokemonFormCandidate[] | null> {
  const normalizedDexNumber = normalizeDexNumber(dexNumber)
  if (normalizedDexNumber === null) {
    return null
  }

  const cached = speciesFormsCache.get(normalizedDexNumber)
  if (cached) {
    return cached
  }

  const request = (async () => {
    try {
      const response = await fetch(POKEAPI_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: SPECIES_FORMS_QUERY,
          variables: {
            dexNumber: normalizedDexNumber,
          },
        }),
        cache: "force-cache",
      })

      if (!response.ok) {
        return null
      }

      const payload = (await response.json()) as SpeciesFormsResponse
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        return null
      }

      const forms = payload.data?.pokemon?.[0]?.pokemonspecy?.pokemons ?? []
      if (forms.length === 0) {
        return null
      }

      return forms
        .filter((form) => Number.isFinite(form.id) && form.id > 0 && typeof form.name === "string")
        .map((form) => ({
          id: Math.trunc(form.id),
          name: form.name,
          isDefault: Boolean(form.is_default),
          formName: form.pokemonforms?.[0]?.form_name?.trim() ?? "",
        }))
    } catch {
      return null
    }
  })()

  speciesFormsCache.set(normalizedDexNumber, request)
  return request
}

function buildFormTargets(params: {
  baseSlug: string
  formSlug: string | null
  formName: string | null
}): string[] {
  const normalizedBaseSlug = normalizeIdentifier(params.baseSlug)
  const normalizedFormSlug = normalizeIdentifier(params.formSlug)
  const normalizedFormName = normalizeIdentifier(params.formName)

  const targets = new Set<string>()

  addTargetWithVariants(targets, normalizedFormName)
  addTargetWithVariants(targets, normalizedFormSlug)

  const formSlugTail = stripBasePrefix(normalizedFormSlug, normalizedBaseSlug)
  addTargetWithVariants(targets, formSlugTail)

  if (normalizedBaseSlug && normalizedFormName) {
    addTargetWithVariants(targets, `${normalizedBaseSlug}-${normalizedFormName}`)
  }

  return [...targets]
}

function addTargetWithVariants(targets: Set<string>, value: string): void {
  if (!value) {
    return
  }

  const normalized = normalizeIdentifier(value)
  if (!normalized) {
    return
  }

  const variants = [
    normalized,
    normalized.replace(/mega([xyz])/g, "mega-$1"),
    normalized.replace(/lowkey/g, "low-key"),
    normalized.replace(/dawnwings/g, "dawn-wings"),
    normalized.replace(/duskmane/g, "dusk-mane"),
    normalized.replace(/noiceface/g, "noice-face"),
    normalized.replace(/rapidstrike/g, "rapid-strike"),
    normalized.replace(/galarzen/g, "galar-zen"),
    normalized.replace(/galarzen/g, "zen-galar"),
    normalized.replace(/paldeacombat/g, "paldea-combat-breed"),
    normalized.replace(/paldeablaze/g, "paldea-blaze-breed"),
    normalized.replace(/paldeaaqua/g, "paldea-aqua-breed"),
  ]

  for (const variant of variants) {
    const nextValue = normalizeIdentifier(variant)
    if (nextValue) {
      targets.add(nextValue)
    }
  }
}

function pickBestFormCandidate(
  candidates: PokemonFormCandidate[],
  targets: string[],
  basePokemonName: string
): PokemonFormCandidate | null {
  if (targets.length === 0) {
    return null
  }

  const normalizedBasePokemonName = normalizeIdentifier(basePokemonName)
  let bestCandidate: PokemonFormCandidate | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    if (candidate.isDefault) {
      continue
    }

    const score = scoreFormCandidate(candidate, targets, normalizedBasePokemonName)
    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  return bestScore >= 32 ? bestCandidate : null
}

function scoreFormCandidate(
  candidate: PokemonFormCandidate,
  targets: string[],
  normalizedBasePokemonName: string
): number {
  const name = normalizeIdentifier(candidate.name)
  const formName = normalizeIdentifier(candidate.formName)
  const nameTail = stripBasePrefix(name, normalizedBasePokemonName)

  const variants = [name, formName, nameTail].filter((value): value is string => value.length > 0)

  let bestScore = 0
  for (const target of targets) {
    for (const variant of variants) {
      const nextScore = scoreVariantMatch(target, variant)
      if (nextScore > bestScore) {
        bestScore = nextScore
      }
    }
  }

  return bestScore
}

function scoreVariantMatch(target: string, candidate: string): number {
  if (!target || !candidate) {
    return 0
  }

  if (target === candidate) {
    return 120
  }

  if (candidate.startsWith(`${target}-`) || target.startsWith(`${candidate}-`)) {
    return 94
  }

  const targetTokens = target.split("-").filter(Boolean)
  const candidateTokens = candidate.split("-").filter(Boolean)
  if (targetTokens.length === 0 || candidateTokens.length === 0) {
    return 0
  }

  const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length
  if (overlap === 0) {
    return 0
  }

  if (overlap === targetTokens.length && overlap === candidateTokens.length) {
    return 88
  }

  if (overlap === targetTokens.length) {
    return 74
  }

  if (overlap >= 2) {
    return 56
  }

  return 32
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

function normalizeIdentifier(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function stripBasePrefix(value: string, base: string): string {
  if (!value || !base) {
    return value
  }

  if (value === base) {
    return ""
  }

  if (value.startsWith(`${base}-`)) {
    return value.slice(base.length + 1)
  }

  return value
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

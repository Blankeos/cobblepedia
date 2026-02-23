export const PIKALYTICS_FORMAT_CODE = "gen9vgc2026regf"
export const PIKALYTICS_RATING = "1760"
export const PIKALYTICS_FORMAT_LABEL = "VGC 2026 Regulation Set F (1760+)"

const PIKALYTICS_BASE_URL = "https://www.pikalytics.com"
const SMOGON_BASE_URL = "https://www.smogon.com"
const PIKALYTICS_DATA_DATE_PATTERN = /\*\*Data Date\*\*:\s*([0-9]{4}-[0-9]{2})/i

let pikalyticsContextPromise: Promise<PikalyticsContext | null> | null = null

const pikalyticsSnapshotPromises = new Map<string, Promise<CompetitiveSnapshot | null>>()

type PikalyticsContext = {
  dataDate: string
  formatCode: string
  rating: string
}

export type CompetitiveDistributionEntry = {
  label: string
  percent: number
}

export type CompetitiveSpreadEntry = {
  nature: string
  evSpread: string
  percent: number
}

export type CompetitiveSnapshot = {
  name: string | null
  ranking: number | null
  viability: string | null
  usagePercent: number | null
  rawCount: number | null
  topMoves: CompetitiveDistributionEntry[]
  topItems: CompetitiveDistributionEntry[]
  topAbilities: CompetitiveDistributionEntry[]
  topSpread: CompetitiveSpreadEntry | null
}

export type CompetitiveReferenceData = {
  smogonUrl: string
  pikalyticsUrl: string
  pikalyticsFormatLabel: string
  pikalyticsDataDate: string | null
  snapshot: CompetitiveSnapshot | null
}

export type CompetitiveFormHint = {
  slug: string
  name: string
  battleOnly: boolean
  aspects: string[]
}

const FORM_TOKEN_ALIASES: Record<string, string> = {
  alolan: "alola",
  galarian: "galar",
  hisuian: "hisui",
  paldean: "paldea",
  megax: "mega-x",
  megay: "mega-y",
}

type PikalyticsRawDistributionEntry = {
  move?: unknown
  item?: unknown
  ability?: unknown
  nature?: unknown
  ev?: unknown
  percent?: unknown
}

type PikalyticsRawPayload = {
  name?: unknown
  ranking?: unknown
  viability?: unknown
  percent?: unknown
  raw_count?: unknown
  moves?: unknown
  items?: unknown
  abilities?: unknown
  spreads?: unknown
}

export function buildSmogonDexUrl(slug: string): string {
  const normalizedSlug = slug.trim().toLowerCase()
  return `${SMOGON_BASE_URL}/dex/sv/pokemon/${encodeURIComponent(normalizedSlug)}/`
}

export function buildPikalyticsDexUrl(pokemonId: string): string {
  return `${PIKALYTICS_BASE_URL}/pokedex/${PIKALYTICS_FORMAT_CODE}/${encodeURIComponent(pokemonId)}`
}

export async function loadCompetitiveReferenceData(params: {
  slug: string
  name: string
  selectedForm?: CompetitiveFormHint | null
}): Promise<CompetitiveReferenceData> {
  const baseSlug = params.slug.trim().toLowerCase()
  const selectedForm = params.selectedForm ?? null
  const candidateIds = collectPokemonIds(baseSlug, params.name, selectedForm)
  const fallbackPikalyticsId = resolveFallbackPikalyticsId(baseSlug, params.name, selectedForm)

  const snapshot = await loadPikalyticsSnapshot(candidateIds)
  const linkedPokemonId = snapshot?.name ?? fallbackPikalyticsId

  const context = await getPikalyticsContext()

  return {
    smogonUrl: buildSmogonDexUrl(baseSlug),
    pikalyticsUrl: buildPikalyticsDexUrl(linkedPokemonId),
    pikalyticsFormatLabel: PIKALYTICS_FORMAT_LABEL,
    pikalyticsDataDate: context?.dataDate ?? null,
    snapshot,
  }
}

async function loadPikalyticsSnapshot(candidateIds: string[]): Promise<CompetitiveSnapshot | null> {
  const context = await getPikalyticsContext()
  if (!context) {
    return null
  }

  for (const candidateId of candidateIds) {
    const cacheKey = `${context.dataDate}:${context.formatCode}:${context.rating}:${candidateId}`
    const existingPromise = pikalyticsSnapshotPromises.get(cacheKey)
    if (existingPromise) {
      const cachedSnapshot = await existingPromise
      if (cachedSnapshot) {
        return cachedSnapshot
      }

      continue
    }

    const snapshotPromise = fetchPikalyticsSnapshot(context, candidateId)
    pikalyticsSnapshotPromises.set(cacheKey, snapshotPromise)

    const snapshot = await snapshotPromise
    if (snapshot) {
      return snapshot
    }
  }

  return null
}

async function getPikalyticsContext(): Promise<PikalyticsContext | null> {
  if (!pikalyticsContextPromise) {
    pikalyticsContextPromise = resolvePikalyticsContext().catch(() => null)
  }

  return pikalyticsContextPromise
}

async function resolvePikalyticsContext(): Promise<PikalyticsContext | null> {
  const indexUrl = `${PIKALYTICS_BASE_URL}/ai/pokedex/${PIKALYTICS_FORMAT_CODE}`
  const response = await fetch(indexUrl)
  if (!response.ok) {
    return null
  }

  const markdown = await response.text()
  const match = markdown.match(PIKALYTICS_DATA_DATE_PATTERN)
  if (!match?.[1]) {
    return null
  }

  return {
    dataDate: match[1],
    formatCode: PIKALYTICS_FORMAT_CODE,
    rating: PIKALYTICS_RATING,
  }
}

async function fetchPikalyticsSnapshot(
  context: PikalyticsContext,
  pokemonId: string
): Promise<CompetitiveSnapshot | null> {
  const endpoint = `${PIKALYTICS_BASE_URL}/api/pl/${context.dataDate}/${context.formatCode}-${context.rating}/${encodeURIComponent(pokemonId)}`
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    return null
  }

  const text = await response.text()
  const trimmedText = text.trim()
  if (!trimmedText) {
    return null
  }

  let parsedPayload: unknown

  try {
    parsedPayload = JSON.parse(trimmedText)
  } catch {
    return null
  }

  return normalizePikalyticsSnapshot(parsedPayload)
}

function normalizePikalyticsSnapshot(payload: unknown): CompetitiveSnapshot | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const record = payload as PikalyticsRawPayload

  const topMoves = normalizeDistribution(record.moves, "move", 4)
  const topItems = normalizeDistribution(record.items, "item", 3)
  const topAbilities = normalizeDistribution(record.abilities, "ability", 3)
  const topSpread = normalizeTopSpread(record.spreads)

  if (
    topMoves.length === 0 &&
    topItems.length === 0 &&
    topAbilities.length === 0 &&
    topSpread === null
  ) {
    return null
  }

  return {
    name: readOptionalString(record.name),
    ranking: readOptionalInteger(record.ranking),
    viability: readOptionalString(record.viability),
    usagePercent: readOptionalPercent(record.percent),
    rawCount: readOptionalInteger(record.raw_count),
    topMoves,
    topItems,
    topAbilities,
    topSpread,
  }
}

function normalizeDistribution(
  value: unknown,
  key: "move" | "item" | "ability",
  limit: number
): CompetitiveDistributionEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const rows: CompetitiveDistributionEntry[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue
    }

    const record = entry as PikalyticsRawDistributionEntry
    const labelValue = record[key]
    const label = typeof labelValue === "string" ? labelValue.trim() : ""
    if (!label || label.toLowerCase() === "other") {
      continue
    }

    const percent = readOptionalPercent(record.percent)
    if (percent === null) {
      continue
    }

    rows.push({
      label,
      percent,
    })
  }

  rows.sort((left, right) => right.percent - left.percent)
  return rows.slice(0, limit)
}

function normalizeTopSpread(value: unknown): CompetitiveSpreadEntry | null {
  if (!Array.isArray(value)) {
    return null
  }

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue
    }

    const record = entry as PikalyticsRawDistributionEntry
    const nature = typeof record.nature === "string" ? record.nature.trim() : ""
    const evSpread = typeof record.ev === "string" ? record.ev.trim() : ""
    const percent = readOptionalPercent(record.percent)

    if (!nature || !evSpread || percent === null) {
      continue
    }

    return {
      nature,
      evSpread,
      percent,
    }
  }

  return null
}

function collectPokemonIds(
  baseSlug: string,
  baseName: string,
  selectedForm: CompetitiveFormHint | null
): string[] {
  const candidateMap = new Map<string, string>()

  const addCandidate = (value: string | null | undefined) => {
    if (!value) {
      return
    }

    const normalized = value.trim()
    if (!normalized) {
      return
    }

    const dedupeKey = normalized.toLowerCase()
    if (!candidateMap.has(dedupeKey)) {
      candidateMap.set(dedupeKey, normalized)
    }
  }

  const addBaseCandidates = () => {
    addCandidate(baseSlug)
    addCandidate(baseName)
    addCandidate(toSlugLike(baseName))
  }

  const addFormCandidates = () => {
    if (!selectedForm) {
      return
    }

    for (const candidate of buildFormCandidateIds(baseSlug, baseName, selectedForm)) {
      addCandidate(candidate)
    }
  }

  if (selectedForm && !selectedForm.battleOnly) {
    addFormCandidates()
    addBaseCandidates()
  } else {
    addBaseCandidates()
    addFormCandidates()
  }

  return Array.from(candidateMap.values())
}

function resolveFallbackPikalyticsId(
  baseSlug: string,
  baseName: string,
  selectedForm: CompetitiveFormHint | null
): string {
  const baseFallback = baseName.trim() || baseSlug

  if (!selectedForm || selectedForm.battleOnly) {
    return baseFallback
  }

  const formCandidates = buildFormCandidateIds(baseSlug, baseName, selectedForm)
  return formCandidates[0] ?? baseFallback
}

function buildFormCandidateIds(
  baseSlug: string,
  baseName: string,
  form: CompetitiveFormHint
): string[] {
  const candidates: string[] = []

  const pushCandidate = (value: string | null | undefined) => {
    if (!value) {
      return
    }

    const normalized = value.trim()
    if (!normalized) {
      return
    }

    candidates.push(normalized)
    const aliasApplied = applyFormTokenAliases(normalized)
    if (aliasApplied !== normalized) {
      candidates.push(aliasApplied)
    }
  }

  const formSlug = form.slug.trim().toLowerCase()
  const baseNameSlug = toSlugLike(baseName)
  const formNameSlug = toSlugLike(form.name)

  pushCandidate(formSlug)

  if (formNameSlug) {
    pushCandidate(`${baseSlug}-${formNameSlug}`)

    if (baseNameSlug) {
      pushCandidate(`${baseNameSlug}-${formNameSlug}`)
    }
  }

  for (const aspect of form.aspects) {
    const normalizedAspect = normalizeAspectToken(aspect)
    if (!normalizedAspect) {
      continue
    }

    pushCandidate(`${baseSlug}-${normalizedAspect}`)

    if (baseNameSlug) {
      pushCandidate(`${baseNameSlug}-${normalizedAspect}`)
    }
  }

  return candidates
}

function toSlugLike(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-")
}

function normalizeAspectToken(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, "-")
  if (!normalized) {
    return null
  }

  return applyFormTokenAliases(normalized)
}

function applyFormTokenAliases(value: string): string {
  const tokens = value
    .trim()
    .toLowerCase()
    .split("-")
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return value
  }

  return tokens.map((token) => FORM_TOKEN_ALIASES[token] ?? token).join("-")
}

function readOptionalPercent(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function readOptionalInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export type QueryFacet = "egg-group" | "moves" | "spawn" | "evolution"

export type MoveSourceType = "level" | "egg" | "tm" | "tutor" | "legacy" | "special" | "form_change"

export type SearchResultType = "pokemon-overview" | "pokemon-facet" | "move-learners"

export type MetaRecord = {
  upstreamUrl: string
  branch: string
  commitSha: string
  generatedAt: string
  speciesCount: number
  implementedSpeciesCount: number
  spawnEntryCount: number
  moveCount: number
}

export type PokemonAbility = {
  id: string
  label: string
  hidden: boolean
}

export type PokemonRef = {
  raw: string
  slug: string
  aspectTokens: string[]
}

export type ParsedMove = {
  raw: string
  moveId: string
  moveName: string
  sourceType: MoveSourceType
  sourceValue: number | null
  fromForm: string | null
}

export type EvolutionRequirementRecord = {
  variant: string
  text: string
  raw: Record<string, unknown>
}

export type EvolutionEdgeRecord = {
  id: string
  variant: string
  result: PokemonRef
  consumeHeldItem: boolean
  learnableMoves: string[]
  requirementText: string[]
  requirements: EvolutionRequirementRecord[]
  requiredContext: string | null
  fromForm: string | null
  raw: Record<string, unknown>
}

export type SpawnWeightMultiplierRecord = {
  multiplier: number
  condition: Record<string, unknown> | null
}

export type SpawnEntryRecord = {
  id: string
  sourceFile: string
  pokemon: PokemonRef
  type: string
  spawnablePositionType: string
  bucket: string
  bucketWeight: number | null
  levelText: string | null
  levelMin: number | null
  levelMax: number | null
  weight: number | null
  presets: string[]
  biomeHints: string[]
  condition: Record<string, unknown> | null
  anticondition: Record<string, unknown> | null
  weightMultipliers: SpawnWeightMultiplierRecord[]
  raw: Record<string, unknown>
}

export type EvolutionFamilyMemberRecord = {
  slug: string
  name: string
  dexNumber: number
}

export type EvolutionFamilyEdgeRecord = {
  fromSlug: string
  toSlug: string
  method: string
  requirementText: string[]
}

export type EvolutionFamilyRecord = {
  members: EvolutionFamilyMemberRecord[]
  edges: EvolutionFamilyEdgeRecord[]
  roots: string[]
}

export type PokemonFormRecord = {
  name: string
  slug: string
  aspects: string[]
  types: string[]
  abilities: PokemonAbility[]
  moves: ParsedMove[]
  evolutions: EvolutionEdgeRecord[]
  raw: Record<string, unknown>
}

export type PokemonDetailRecord = {
  slug: string
  name: string
  dexNumber: number
  implemented: boolean
  types: string[]
  abilities: PokemonAbility[]
  eggGroups: string[]
  labels: string[]
  aspects: string[]
  aliases: string[]
  maleRatio: number | null
  height: number | null
  weight: number | null
  catchRate: number | null
  baseExperienceYield: number | null
  baseFriendship: number | null
  eggCycles: number | null
  baseStats: Record<string, number>
  evYield: Record<string, number>
  preEvolution: PokemonRef | null
  evolutions: EvolutionEdgeRecord[]
  evolutionFamily: EvolutionFamilyRecord
  moves: ParsedMove[]
  spawnEntries: SpawnEntryRecord[]
  forms: PokemonFormRecord[]
  rawSpecies: Record<string, unknown>
}

export type PokemonListItem = {
  slug: string
  name: string
  dexNumber: number
  implemented: boolean
  types: string[]
  aliases: string[]
  eggGroups: string[]
}

export type PokemonDexNavItem = {
  slug: string
  name: string
  dexNumber: number
}

export type MoveLearnerRecord = {
  slug: string
  name: string
  dexNumber: number
  methods: MoveSourceType[]
}

export type MoveLearnerEntryRecord = {
  moveId: string
  moveName: string
  shortDescription: string | null
  description: string | null
  learners: MoveLearnerRecord[]
}

export type MoveLearnersIndex = Record<string, MoveLearnerEntryRecord>

export type AbilityPokemonRecord = {
  slug: string
  name: string
  dexNumber: number
  hidden: boolean
}

export type AbilityEntryRecord = {
  abilityId: string
  name: string
  shortDescription: string | null
  description: string | null
  pokemon: AbilityPokemonRecord[]
}

export type AbilityIndex = Record<string, AbilityEntryRecord>

export type SearchDocument = {
  id: string
  resultType: SearchResultType
  name: string
  normalizedName: string
  tokens: string[]
  aliases: string[]
  slug: string | null
  moveId: string | null
  facet: QueryFacet | null
  implemented: boolean
  dexNumber: number | null
  learnerCount: number | null
}

export type PaletteResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  slug: string | null
  moveId: string | null
  facet: QueryFacet | null
  score: number
}

export type ResolvedIntent =
  | "move-learners"
  | "pokemon-facet"
  | "pokemon-overview"
  | "fuzzy-fallback"

export type QueryResolution = {
  intent: ResolvedIntent
  normalizedQuery: string
  results: PaletteResult[]
}

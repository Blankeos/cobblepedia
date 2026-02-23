import { Index } from "flexsearch"
import type {
  AbilityIndex,
  ItemIndex,
  MoveLearnersIndex,
  PaletteResult,
  PokemonListItem,
  PokemonTypeEntryRecord,
} from "@/data/cobblemon-types"
import {
  canonicalId,
  formatEggGroup,
  normalizeSearchText,
  titleCaseFromId,
} from "@/data/formatters"

type PaletteSearchEntityType =
  | "pokemon"
  | "pokemon-form"
  | "move"
  | "ability"
  | "item"
  | "type"
  | "egg-group"

type PaletteSearchDoc = {
  id: string
  entityType: PaletteSearchEntityType
  title: string
  normalizedTitle: string
  canonicalTitle: string
  aliases: string[]
  canonicalAliases: string[]
  searchText: string
  result: PaletteResult
}

type PaletteFlexSearchParams = {
  pokemonList: PokemonListItem[]
  pokemonTypeEntries: PokemonTypeEntryRecord[]
  moveLearners: MoveLearnersIndex
  abilityIndex: AbilityIndex
  itemIndex: ItemIndex
}

export type PaletteFlexSearch = {
  search: (query: string, limit?: number) => PaletteResult[]
}

const DEFAULT_LIMIT = 90

const ENTITY_SCORE_BONUS: Record<PaletteSearchEntityType, number> = {
  pokemon: 30,
  "pokemon-form": 40,
  move: 24,
  ability: 20,
  item: 20,
  type: 14,
  "egg-group": 14,
}

const REGIONAL_FORM_SYNONYMS: Record<string, string[]> = {
  alola: ["alolan"],
  alolan: ["alola"],
  galar: ["galarian"],
  galarian: ["galar"],
  hisui: ["hisuian"],
  hisuian: ["hisui"],
  paldea: ["paldean"],
  paldean: ["paldea"],
}

export function createPaletteFlexSearch(params: PaletteFlexSearchParams): PaletteFlexSearch {
  const docs = buildPaletteSearchDocs(params)
  const index = new Index({ tokenize: "full" })

  docs.forEach((doc, position) => {
    index.add(position, doc.searchText)
  })

  return {
    search: (query: string, limit = DEFAULT_LIMIT) => {
      const normalizedQuery = normalizeSearchText(query)
      if (!normalizedQuery) {
        return []
      }

      const canonicalQuery = canonicalId(normalizedQuery)
      const queryTokens = normalizedQuery.split(" ").filter(Boolean)
      const rawMatches = index.search(normalizedQuery, Math.max(limit * 3, 120))
      const matchPositions = Array.isArray(rawMatches)
        ? rawMatches
            .map((value) => (typeof value === "number" ? value : Number(value)))
            .filter((value) => Number.isInteger(value) && value >= 0)
        : []

      const scoredMatches = matchPositions
        .map((matchPosition, rank) => {
          const doc = docs[matchPosition]
          if (!doc) {
            return null
          }

          const score = scoreSearchDoc(doc, normalizedQuery, canonicalQuery, queryTokens, rank)
          return {
            doc,
            score,
          }
        })
        .filter((entry): entry is { doc: PaletteSearchDoc; score: number } => Boolean(entry))
        .sort((left, right) => right.score - left.score)

      const dedupedResults = new Map<string, PaletteResult>()

      for (const entry of scoredMatches) {
        if (dedupedResults.has(entry.doc.id)) {
          continue
        }

        dedupedResults.set(entry.doc.id, {
          ...entry.doc.result,
          score: entry.score,
        })

        if (dedupedResults.size >= limit) {
          break
        }
      }

      return Array.from(dedupedResults.values())
    },
  }
}

function buildPaletteSearchDocs(params: PaletteFlexSearchParams): PaletteSearchDoc[] {
  const docs: PaletteSearchDoc[] = []

  const formEntriesBySlug = new Map<string, PokemonTypeEntryRecord[]>()
  for (const entry of params.pokemonTypeEntries) {
    if (!entry.implemented || !entry.formSlug) {
      continue
    }

    const existing = formEntriesBySlug.get(entry.slug)
    if (existing) {
      existing.push(entry)
      continue
    }

    formEntriesBySlug.set(entry.slug, [entry])
  }

  for (const pokemon of params.pokemonList) {
    const formEntries = formEntriesBySlug.get(pokemon.slug) ?? []
    const formAliasSet = new Set<string>()

    for (const formEntry of formEntries) {
      for (const alias of buildFormSearchAliases(pokemon.name, formEntry)) {
        formAliasSet.add(alias)
      }
    }

    const nonFormAliases = pokemon.aliases.filter((alias) => {
      const normalizedAlias = normalizeSearchText(alias)
      return normalizedAlias ? !formAliasSet.has(normalizedAlias) : false
    })

    const pokemonTypes = pokemon.types.map((type) => titleCaseFromId(type)).join(" / ")
    const aliases = uniqueNormalized([
      pokemon.name,
      pokemon.slug,
      ...nonFormAliases,
      ...pokemon.types,
      ...pokemon.eggGroups,
      "pokemon",
    ])

    docs.push(
      createDoc({
        id: `pokemon-overview:${pokemon.slug}`,
        entityType: "pokemon",
        title: pokemon.name,
        aliases,
        searchTextParts: [pokemon.name, pokemon.slug, ...nonFormAliases, pokemonTypes, "pokemon"],
        result: {
          id: `pokemon-overview:${pokemon.slug}`,
          type: "pokemon-overview",
          title: pokemon.name,
          subtitle: `#${pokemon.dexNumber} ${pokemonTypes}`,
          slug: pokemon.slug,
          moveId: null,
          facet: null,
          score: 0,
        },
      })
    )

    for (const formEntry of formEntries) {
      if (!formEntry.formSlug) {
        continue
      }

      const formAliases = buildFormSearchAliases(pokemon.name, formEntry)
      const formTypes = (formEntry.types.length > 0 ? formEntry.types : pokemon.types)
        .map((type) => titleCaseFromId(type))
        .join(" / ")

      docs.push(
        createDoc({
          id: `pokemon-form:${formEntry.slug}:${formEntry.formSlug}`,
          entityType: "pokemon-form",
          title: formEntry.name,
          aliases: formAliases,
          searchTextParts: [
            formEntry.name,
            pokemon.name,
            formEntry.formName ?? "",
            formEntry.formSlug,
            ...formAliases,
            formTypes,
            "pokemon",
            "form",
          ],
          result: {
            id: `pokemon-form:${formEntry.slug}:${formEntry.formSlug}`,
            type: "pokemon-overview",
            title: formEntry.name,
            subtitle: formTypes
              ? `#${formEntry.dexNumber} ${formTypes} Form`
              : `#${formEntry.dexNumber} Form`,
            slug: formEntry.slug,
            moveId: null,
            facet: null,
            score: 0,
            url: `/pokemon/${formEntry.slug}?form=${encodeURIComponent(formEntry.formSlug)}`,
          },
        })
      )
    }
  }

  const moveEntries = Object.values(params.moveLearners)
  for (const move of moveEntries) {
    const learnerCount = move.learners.length
    const aliases = uniqueNormalized([move.moveName, move.moveId, move.type ?? "", "move", "moves"])

    docs.push(
      createDoc({
        id: `move:${move.moveId}`,
        entityType: "move",
        title: move.moveName,
        aliases,
        searchTextParts: [
          move.moveName,
          move.moveId,
          move.type ?? "",
          move.category ?? "",
          move.shortDescription ?? "",
          "move",
          "moves",
        ],
        result: {
          id: `move:${move.moveId}`,
          type: "move-learners",
          title: move.moveName,
          subtitle: `${learnerCount} learners`,
          slug: null,
          moveId: move.moveId,
          facet: null,
          score: 0,
        },
      })
    )
  }

  for (const ability of Object.values(params.abilityIndex)) {
    const aliases = uniqueNormalized([
      ability.name,
      ability.abilityId,
      ability.shortDescription ?? "",
      ability.description ?? "",
      "ability",
      "abilities",
    ])

    docs.push(
      createDoc({
        id: `ability:${ability.abilityId}`,
        entityType: "ability",
        title: ability.name,
        aliases,
        searchTextParts: [
          ability.name,
          ability.abilityId,
          ability.shortDescription ?? "",
          ability.description ?? "",
          "ability",
          "abilities",
        ],
        result: {
          id: `ability:${ability.abilityId}`,
          type: "ability-entry",
          title: ability.name,
          subtitle: `Ability - ${ability.pokemon.length} Pokemon`,
          slug: null,
          moveId: null,
          abilityId: ability.abilityId,
          facet: null,
          score: 0,
          url: `/abilities/${ability.abilityId}`,
        },
      })
    )
  }

  for (const item of Object.values(params.itemIndex)) {
    const subtitle = item.descriptionLines[0] ?? item.description ?? "Item entry"
    const aliases = uniqueNormalized([
      item.name,
      item.itemId,
      ...item.descriptionLines,
      item.description ?? "",
      "item",
      "items",
    ])

    docs.push(
      createDoc({
        id: `item:${item.itemId}`,
        entityType: "item",
        title: item.name,
        aliases,
        searchTextParts: [
          item.name,
          item.itemId,
          ...item.descriptionLines,
          item.description ?? "",
          "item",
          "items",
        ],
        result: {
          id: `item:${item.itemId}`,
          type: "item-entry",
          title: item.name,
          subtitle: `Item - ${subtitle}`,
          slug: null,
          moveId: null,
          itemId: item.itemId,
          facet: null,
          score: 0,
          url: `/items/${item.itemId}`,
        },
      })
    )
  }

  const typeCounts = new Map<string, number>()
  const eggGroupCounts = new Map<string, number>()

  for (const pokemon of params.pokemonList) {
    for (const typeId of pokemon.types) {
      typeCounts.set(typeId, (typeCounts.get(typeId) ?? 0) + 1)
    }

    for (const eggGroupId of pokemon.eggGroups) {
      eggGroupCounts.set(eggGroupId, (eggGroupCounts.get(eggGroupId) ?? 0) + 1)
    }
  }

  for (const [typeId, count] of typeCounts.entries()) {
    const title = titleCaseFromId(typeId)
    docs.push(
      createDoc({
        id: `type:${typeId}`,
        entityType: "type",
        title,
        aliases: uniqueNormalized([title, typeId, "type", "types"]),
        searchTextParts: [title, typeId, "type", "types"],
        result: {
          id: `type:${typeId}`,
          type: "type-entry",
          title,
          subtitle: `Type - ${count} Pokemon`,
          slug: null,
          moveId: null,
          typeId,
          facet: null,
          score: 0,
          url: `/types/${typeId}`,
        },
      })
    )
  }

  for (const [eggGroupId, count] of eggGroupCounts.entries()) {
    const title = formatEggGroup(eggGroupId)
    docs.push(
      createDoc({
        id: `egg-group:${eggGroupId}`,
        entityType: "egg-group",
        title,
        aliases: uniqueNormalized([title, eggGroupId, "egg", "egg group", "egg groups"]),
        searchTextParts: [title, eggGroupId, "egg group", "egg groups"],
        result: {
          id: `egg-group:${eggGroupId}`,
          type: "egg-group-entry",
          title,
          subtitle: `Egg Group - ${count} Pokemon`,
          slug: null,
          moveId: null,
          eggGroupId,
          facet: null,
          score: 0,
          url: `/egg-groups/${eggGroupId}`,
        },
      })
    )
  }

  return docs
}

function buildFormSearchAliases(baseName: string, form: PokemonTypeEntryRecord): string[] {
  if (!form.formSlug) {
    return []
  }

  const aliases = new Set<string>()
  const normalizedBaseName = normalizeSearchText(baseName)

  const variantTerms = new Set<string>()
  for (const value of [
    form.formName ?? "",
    form.formSlug,
    form.formSlug.replace(`${form.slug}-`, ""),
  ]) {
    const normalized = normalizeSearchText(value)
    if (!normalized) {
      continue
    }

    variantTerms.add(normalized)
    for (const expanded of expandRegionalFormTerms(normalized)) {
      variantTerms.add(expanded)
    }
  }

  for (const term of variantTerms) {
    aliases.add(term)

    if (normalizedBaseName) {
      aliases.add(`${normalizedBaseName} ${term}`)
      aliases.add(`${term} ${normalizedBaseName}`)
    }
  }

  aliases.add(normalizeSearchText(form.name))
  aliases.add(normalizeSearchText(form.id))

  return uniqueNormalized(Array.from(aliases))
}

function expandRegionalFormTerms(term: string): string[] {
  const normalized = normalizeSearchText(term)
  if (!normalized) {
    return []
  }

  const directSynonyms = REGIONAL_FORM_SYNONYMS[normalized] ?? []
  if (directSynonyms.length > 0) {
    return directSynonyms
  }

  const tokenSynonymSets = normalized
    .split(" ")
    .map((token) => {
      const synonyms = REGIONAL_FORM_SYNONYMS[token] ?? []
      return [token, ...synonyms]
    })
    .filter((tokens) => tokens.length > 1)

  if (tokenSynonymSets.length === 0) {
    return []
  }

  const expanded = new Set<string>()
  for (let index = 0; index < tokenSynonymSets.length; index += 1) {
    const sourceTokens = normalized.split(" ")
    const variantTokens = [...sourceTokens]
    const tokenSet = tokenSynonymSets[index]
    const sourceToken = tokenSet[0]
    const sourceIndex = sourceTokens.indexOf(sourceToken)
    if (sourceIndex < 0) {
      continue
    }

    for (const replacement of tokenSet.slice(1)) {
      variantTokens[sourceIndex] = replacement
      expanded.add(variantTokens.join(" "))
    }
  }

  return Array.from(expanded)
}

function createDoc(params: {
  id: string
  entityType: PaletteSearchEntityType
  title: string
  aliases: string[]
  searchTextParts: string[]
  result: PaletteResult
}): PaletteSearchDoc {
  const normalizedTitle = normalizeSearchText(params.title)
  const normalizedAliases = uniqueNormalized([normalizedTitle, ...params.aliases])
  const canonicalAliases = uniqueCanonical(normalizedAliases)

  return {
    id: params.id,
    entityType: params.entityType,
    title: params.title,
    normalizedTitle,
    canonicalTitle: canonicalId(normalizedTitle),
    aliases: normalizedAliases,
    canonicalAliases,
    searchText: normalizeSearchText(params.searchTextParts.filter(Boolean).join(" ")),
    result: params.result,
  }
}

function scoreSearchDoc(
  doc: PaletteSearchDoc,
  normalizedQuery: string,
  canonicalQuery: string,
  queryTokens: string[],
  rank: number
): number {
  let score = Math.max(0, 140 - rank * 2)

  if (doc.normalizedTitle === normalizedQuery) {
    score += 700
  }

  if (doc.aliases.includes(normalizedQuery)) {
    score += 560
  }

  if (doc.canonicalTitle === canonicalQuery) {
    score += 460
  }

  if (doc.canonicalAliases.includes(canonicalQuery)) {
    score += 380
  }

  if (doc.normalizedTitle.startsWith(normalizedQuery)) {
    score += 320
  }

  if (doc.aliases.some((alias) => alias.startsWith(normalizedQuery))) {
    score += 260
  }

  if (doc.normalizedTitle.includes(normalizedQuery)) {
    score += 160
  }

  if (doc.searchText.includes(normalizedQuery)) {
    score += 120
  }

  for (const token of queryTokens) {
    if (doc.searchText.includes(token)) {
      score += 35
    }
  }

  score += ENTITY_SCORE_BONUS[doc.entityType]

  return score
}

function uniqueNormalized(values: string[]): string[] {
  const set = new Set<string>()

  for (const value of values) {
    const normalized = normalizeSearchText(value)
    if (!normalized) {
      continue
    }
    set.add(normalized)
  }

  return Array.from(set)
}

function uniqueCanonical(values: string[]): string[] {
  const set = new Set<string>()

  for (const value of values) {
    const normalized = canonicalId(value)
    if (!normalized) {
      continue
    }
    set.add(normalized)
  }

  return Array.from(set)
}

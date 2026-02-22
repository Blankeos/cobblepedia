import type {
  MoveLearnersIndex,
  PaletteResult,
  PokemonListItem,
  QueryFacet,
  QueryResolution,
  SearchDocument,
} from "@/data/cobblemon-types"
import { normalizeSearchText, titleCaseFromId } from "@/data/formatters"

const MOVE_KEYWORDS = new Set(["move", "moves"])
const MAX_POKEMON_RESULTS = 60
const MAX_FACET_RESULTS = 40
const MAX_MOVE_RESULTS = 30
const MAX_FALLBACK_RESULTS = 30

const FACET_LABELS: Record<QueryFacet, string> = {
  "egg-group": "Egg Groups",
  moves: "Moves",
  spawn: "Spawn",
  evolution: "Evolution",
}

type PokemonCandidate = {
  doc: SearchDocument
  score: number
}

type FacetExtraction = {
  facet: QueryFacet
  pokemonTerm: string
}

export function resolveQuery(
  query: string,
  searchIndex: SearchDocument[],
  pokemonList: PokemonListItem[],
  moveLearners: MoveLearnersIndex
): QueryResolution {
  const normalizedQuery = normalizeSearchText(query)

  const pokemonDocs = searchIndex.filter(
    (doc) => doc.resultType === "pokemon-overview" && doc.slug !== null
  )
  const moveDocs = searchIndex.filter(
    (doc) => doc.resultType === "move-learners" && doc.moveId !== null && doc.slug === null
  )
  const pokemonBySlug = new Map(pokemonList.map((item) => [item.slug, item]))

  if (!normalizedQuery) {
    const defaultResults = pokemonDocs
      .slice()
      .sort(sortSearchDocs)
      .slice(0, MAX_POKEMON_RESULTS)
      .map((doc) => createPokemonResult(doc, pokemonBySlug, null, 0))

    return {
      intent: "pokemon-overview",
      normalizedQuery,
      results: defaultResults,
    }
  }

  const tokens = normalizedQuery.split(" ").filter(Boolean)

  if (tokens.length > 1 && MOVE_KEYWORDS.has(tokens[0])) {
    const moveTerm = tokens.slice(1).join(" ")
    const moveResults = matchMoves(moveTerm, moveDocs, moveLearners)
    if (moveResults.length > 0) {
      return {
        intent: "move-learners",
        normalizedQuery,
        results: moveResults,
      }
    }
  }

  const facetExtraction = extractFacet(normalizedQuery)
  if (facetExtraction?.pokemonTerm) {
    const facetCandidates = matchPokemon(facetExtraction.pokemonTerm, pokemonDocs)
    if (facetCandidates.length > 0) {
      return {
        intent: "pokemon-facet",
        normalizedQuery,
        results: facetCandidates.slice(0, MAX_FACET_RESULTS).map((candidate) => {
          return createPokemonResult(
            candidate.doc,
            pokemonBySlug,
            facetExtraction.facet,
            candidate.score + 20
          )
        }),
      }
    }
  }

  const overviewCandidates = matchPokemon(normalizedQuery, pokemonDocs)
  if (overviewCandidates.length > 0) {
    return {
      intent: "pokemon-overview",
      normalizedQuery,
      results: overviewCandidates
        .slice(0, MAX_POKEMON_RESULTS)
        .map((candidate) =>
          createPokemonResult(candidate.doc, pokemonBySlug, null, candidate.score)
        ),
    }
  }

  return {
    intent: "fuzzy-fallback",
    normalizedQuery,
    results: pokemonDocs
      .slice()
      .sort(sortSearchDocs)
      .slice(0, MAX_FALLBACK_RESULTS)
      .map((doc) => createPokemonResult(doc, pokemonBySlug, null, 0)),
  }
}

function matchMoves(
  term: string,
  moveDocs: SearchDocument[],
  moveLearners: MoveLearnersIndex
): PaletteResult[] {
  const normalizedTerm = normalizeSearchText(term)
  if (!normalizedTerm) {
    return []
  }

  const termTokens = normalizedTerm.split(" ").filter(Boolean)

  const scored = moveDocs
    .map((doc) => {
      const aliases = [doc.normalizedName, ...doc.aliases]
      let score = 0

      if (doc.moveId === normalizedTerm || aliases.includes(normalizedTerm)) {
        score += 90
      }

      if (aliases.some((value) => value.startsWith(normalizedTerm))) {
        score += 60
      }

      if (aliases.some((value) => value.includes(normalizedTerm))) {
        score += 25
      }

      for (const token of termTokens) {
        if (doc.tokens.includes(token) || aliases.some((value) => value.includes(token))) {
          score += 25
        }
      }

      const compactTerm = normalizedTerm.replace(/\s+/g, "")
      const compactName = doc.normalizedName.replace(/\s+/g, "")
      const distance = levenshteinDistance(compactTerm, compactName)
      if (distance <= 1) {
        score += 20
      } else if (distance <= 2) {
        score += 10
      }

      const learnerCount = doc.moveId ? (moveLearners[doc.moveId]?.learners.length ?? 0) : 0

      return {
        doc,
        score,
        learnerCount,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return right.learnerCount - left.learnerCount
    })

  return scored.slice(0, MAX_MOVE_RESULTS).map((entry) => {
    const moveId = entry.doc.moveId ?? ""
    const learnerCount = moveLearners[moveId]?.learners.length ?? 0

    return {
      id: entry.doc.id,
      type: "move-learners",
      title: entry.doc.name,
      subtitle: `${learnerCount} learners`,
      slug: null,
      moveId,
      facet: null,
      score: entry.score,
    } satisfies PaletteResult
  })
}

function matchPokemon(term: string, pokemonDocs: SearchDocument[]): PokemonCandidate[] {
  const normalizedTerm = normalizeSearchText(term)
  if (!normalizedTerm) {
    return []
  }

  const termTokens = normalizedTerm.split(" ").filter(Boolean)

  return pokemonDocs
    .map((doc) => {
      const aliases = [doc.normalizedName, ...doc.aliases]
      let score = 0

      if (aliases.includes(normalizedTerm)) {
        score += 100
      }

      if (aliases.some((value) => value.startsWith(normalizedTerm))) {
        score += 60
      }

      if (aliases.some((value) => value.includes(normalizedTerm))) {
        score += 25
      }

      for (const token of termTokens) {
        if (doc.tokens.includes(token) || aliases.some((value) => value.includes(token))) {
          score += 25
        }
      }

      const compactTerm = normalizedTerm.replace(/\s+/g, "")
      const compactName = doc.normalizedName.replace(/\s+/g, "")
      const distance = levenshteinDistance(compactTerm, compactName)
      if (distance <= 1) {
        score += 20
      } else if (distance <= 2) {
        score += 10
      }

      return { doc, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.doc.implemented !== left.doc.implemented) {
        return Number(right.doc.implemented) - Number(left.doc.implemented)
      }

      return (
        (left.doc.dexNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.doc.dexNumber ?? Number.MAX_SAFE_INTEGER)
      )
    })
}

function createPokemonResult(
  doc: SearchDocument,
  pokemonBySlug: Map<string, PokemonListItem>,
  facet: QueryFacet | null,
  score: number
): PaletteResult {
  const slug = doc.slug ?? ""
  const pokemon = pokemonBySlug.get(slug)
  const types = pokemon?.types.map((type) => titleCaseFromId(type)).join(" / ")
  const dexText = doc.dexNumber ? `#${doc.dexNumber}` : "No Dex"
  const subtitle = facet
    ? `${dexText} ${FACET_LABELS[facet]}`
    : types
      ? `${dexText} ${types}`
      : dexText

  return {
    id: facet ? `${doc.id}:${facet}` : doc.id,
    type: facet ? "pokemon-facet" : "pokemon-overview",
    title: doc.name,
    subtitle,
    slug,
    moveId: null,
    facet,
    score,
  }
}

function extractFacet(normalizedQuery: string): FacetExtraction | null {
  const tokens = normalizedQuery.split(" ").filter(Boolean)

  if (/\begg groups?\b/.test(normalizedQuery)) {
    return {
      facet: "egg-group",
      pokemonTerm: normalizeSearchText(normalizedQuery.replace(/\begg groups?\b/g, " ")),
    }
  }

  const consumedIndexes = new Set<number>()
  let facet: QueryFacet | null = null

  for (const [index, token] of tokens.entries()) {
    if (token === "egg") {
      facet = "egg-group"
      consumedIndexes.add(index)
      continue
    }

    if (token === "spawn" || token === "spawns") {
      facet = "spawn"
      consumedIndexes.add(index)
      continue
    }

    if (token === "move" || token === "moves") {
      facet = "moves"
      consumedIndexes.add(index)
      continue
    }

    if (token === "evolve" || token === "evolution" || token === "evo") {
      facet = "evolution"
      consumedIndexes.add(index)
    }
  }

  if (!facet) {
    return null
  }

  const pokemonTerm = tokens
    .filter((_, index) => !consumedIndexes.has(index))
    .join(" ")
    .trim()

  return {
    facet,
    pokemonTerm: normalizeSearchText(pokemonTerm),
  }
}

function sortSearchDocs(left: SearchDocument, right: SearchDocument): number {
  if (right.implemented !== left.implemented) {
    return Number(right.implemented) - Number(left.implemented)
  }

  return (left.dexNumber ?? Number.MAX_SAFE_INTEGER) - (right.dexNumber ?? Number.MAX_SAFE_INTEGER)
}

function levenshteinDistance(source: string, target: string): number {
  if (source === target) {
    return 0
  }

  if (!source) {
    return target.length
  }

  if (!target) {
    return source.length
  }

  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = source[row - 1] === target[col - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      )
    }
  }

  return matrix[rows - 1][cols - 1]
}

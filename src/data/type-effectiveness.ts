// Type effectiveness chart for Cobblemon types
// Format: attackingType: { defendingType: multiplier }
// multiplier: 0 = immune, 0.5 = not very effective, 1 = normal, 2 = super effective

export const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {
  normal: {
    rock: 0.5,
    ghost: 0,
    steel: 0.5,
  },
  fire: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 2,
    bug: 2,
    rock: 0.5,
    dragon: 0.5,
    steel: 2,
  },
  water: {
    fire: 2,
    water: 0.5,
    grass: 0.5,
    ground: 2,
    rock: 2,
    dragon: 0.5,
  },
  electric: {
    water: 2,
    electric: 0.5,
    grass: 0.5,
    ground: 0,
    flying: 2,
    dragon: 0.5,
  },
  grass: {
    fire: 0.5,
    water: 2,
    grass: 0.5,
    poison: 0.5,
    ground: 2,
    flying: 0.5,
    bug: 0.5,
    rock: 2,
    dragon: 0.5,
    steel: 0.5,
  },
  ice: {
    fire: 0.5,
    water: 0.5,
    grass: 2,
    ice: 0.5,
    ground: 2,
    flying: 2,
    dragon: 2,
    steel: 0.5,
  },
  fighting: {
    normal: 2,
    ice: 2,
    poison: 0.5,
    flying: 0.5,
    psychic: 0.5,
    bug: 0.5,
    rock: 2,
    ghost: 0,
    dark: 2,
    steel: 2,
    fairy: 0.5,
  },
  poison: {
    grass: 2,
    poison: 0.5,
    ground: 0.5,
    rock: 0.5,
    ghost: 0.5,
    steel: 0,
    fairy: 2,
  },
  ground: {
    fire: 2,
    electric: 2,
    grass: 0.5,
    poison: 2,
    flying: 0,
    bug: 0.5,
    rock: 2,
    steel: 2,
  },
  flying: {
    electric: 0.5,
    grass: 2,
    fighting: 2,
    bug: 2,
    rock: 0.5,
    steel: 0.5,
  },
  psychic: {
    fighting: 2,
    poison: 2,
    psychic: 0.5,
    dark: 0,
    steel: 0.5,
  },
  bug: {
    fire: 0.5,
    grass: 2,
    fighting: 0.5,
    poison: 0.5,
    flying: 0.5,
    psychic: 2,
    ghost: 0.5,
    dark: 2,
    steel: 0.5,
    fairy: 0.5,
  },
  rock: {
    fire: 2,
    ice: 2,
    fighting: 0.5,
    ground: 0.5,
    flying: 2,
    bug: 2,
    steel: 0.5,
  },
  ghost: {
    normal: 0,
    psychic: 2,
    ghost: 2,
    dark: 0.5,
  },
  dragon: {
    dragon: 2,
    steel: 0.5,
    fairy: 0,
  },
  dark: {
    fighting: 0.5,
    psychic: 2,
    ghost: 2,
    dark: 0.5,
    fairy: 0.5,
  },
  steel: {
    fire: 0.5,
    water: 0.5,
    electric: 0.5,
    ice: 2,
    rock: 2,
    steel: 0.5,
    fairy: 2,
  },
  fairy: {
    fire: 0.5,
    fighting: 2,
    poison: 0.5,
    dragon: 2,
    dark: 2,
    steel: 0.5,
  },
}

export interface TypeMatchup {
  type: string
  multiplier: number
}

export function getOffensiveMatchups(attackingType: string): TypeMatchup[] {
  const matchups = TYPE_EFFECTIVENESS[attackingType] || {}
  return Object.entries(matchups).map(([type, multiplier]) => ({
    type,
    multiplier,
  }))
}

export function getDefensiveMatchups(defendingType: string): TypeMatchup[] {
  const matchups: TypeMatchup[] = []

  for (const [attackingType, effectiveness] of Object.entries(TYPE_EFFECTIVENESS)) {
    const multiplier = effectiveness[defendingType]
    if (multiplier !== undefined) {
      matchups.push({ type: attackingType, multiplier })
    }
  }

  return matchups
}

export function getDualTypeDefensiveMatchups(type1: string, type2: string): TypeMatchup[] {
  const matchups = new Map<string, number>()

  // Start with all types having 1x effectiveness
  const allTypes = Object.keys(TYPE_EFFECTIVENESS)
  for (const type of allTypes) {
    matchups.set(type, 1)
  }

  // Apply type 1 multipliers
  for (const [attackingType, effectiveness] of Object.entries(TYPE_EFFECTIVENESS)) {
    const multiplier = effectiveness[type1]
    if (multiplier !== undefined) {
      matchups.set(attackingType, (matchups.get(attackingType) || 1) * multiplier)
    }
  }

  // Apply type 2 multipliers
  for (const [attackingType, effectiveness] of Object.entries(TYPE_EFFECTIVENESS)) {
    const multiplier = effectiveness[type2]
    if (multiplier !== undefined) {
      matchups.set(attackingType, (matchups.get(attackingType) || 1) * multiplier)
    }
  }

  return Array.from(matchups.entries()).map(([type, multiplier]) => ({
    type,
    multiplier,
  }))
}

export function categorizeMatchups(matchups: TypeMatchup[]) {
  return {
    immune: matchups.filter((m) => m.multiplier === 0),
    quarter: matchups.filter((m) => m.multiplier === 0.25),
    half: matchups.filter((m) => m.multiplier === 0.5),
    double: matchups.filter((m) => m.multiplier === 2),
    quadruple: matchups.filter((m) => m.multiplier === 4),
  }
}

import type { MoveSourceType } from "@/data/cobblemon-types"

const PUNCTUATION_EXCEPT_HYPHEN_REGEX = /[^\p{L}\p{N}\s-]/gu

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(PUNCTUATION_EXCEPT_HYPHEN_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function canonicalId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function titleCaseFromId(value: string): string {
  const withoutNamespace = value.includes(":") ? (value.split(":").at(-1) ?? value) : value

  return withoutNamespace
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ")
}

export function formatAbilityId(value: string): { id: string; hidden: boolean; label: string } {
  const hidden = value.startsWith("h:")
  const id = hidden ? value.slice(2) : value
  return {
    id,
    hidden,
    label: titleCaseFromId(id),
  }
}

export function formatEggGroup(value: string): string {
  return titleCaseFromId(value)
}

export function formatMoveSource(sourceType: MoveSourceType, sourceValue: number | null): string {
  if (sourceType === "level") {
    return sourceValue === null ? "Level" : `Level ${sourceValue}`
  }

  if (sourceType === "egg") return "Egg"
  if (sourceType === "tm") return "TM"
  if (sourceType === "tutor") return "Tutor"
  if (sourceType === "legacy") return "Legacy"
  if (sourceType === "special") return "Special"
  return "Form Change"
}

export function parsePokemonRef(raw: string): {
  raw: string
  baseId: string
  aspectTokens: string[]
} {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)
  return {
    raw,
    baseId: tokens[0] ?? "",
    aspectTokens: tokens.slice(1),
  }
}

export function parseLevelRange(levelText: string | null): {
  min: number | null
  max: number | null
} {
  if (!levelText) {
    return { min: null, max: null }
  }

  const trimmed = levelText.trim()
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (rangeMatch) {
    return {
      min: Number.parseInt(rangeMatch[1], 10),
      max: Number.parseInt(rangeMatch[2], 10),
    }
  }

  const oneMatch = trimmed.match(/^(\d+)$/)
  if (oneMatch) {
    const value = Number.parseInt(oneMatch[1], 10)
    return { min: value, max: value }
  }

  return { min: null, max: null }
}

export function formatBiomeToken(token: string): string {
  const normalized = token.startsWith("#") ? token.slice(1) : token
  const [, id = normalized] = normalized.split(":")
  return titleCaseFromId(id)
}

export function formatEvolutionRequirement(requirement: Record<string, unknown>): string {
  const variant = String(requirement.variant ?? "unknown")

  if (variant === "level") {
    const minLevel = Number(requirement.minLevel ?? requirement.level ?? requirement.amount ?? 0)
    return minLevel > 0 ? `Level ${minLevel}+` : "Level up"
  }

  if (variant === "friendship") {
    const amount = Number(requirement.amount ?? 0)
    return amount > 0 ? `Friendship ${amount}+` : "High friendship"
  }

  if (variant === "time_range") {
    return `Time: ${titleCaseFromId(String(requirement.range ?? "any"))}`
  }

  if (variant === "held_item") {
    return `Hold ${titleCaseFromId(String(requirement.itemCondition ?? "item"))}`
  }

  if (variant === "has_move") {
    return `Knows ${titleCaseFromId(String(requirement.move ?? "move"))}`
  }

  if (variant === "has_move_type") {
    return `Knows ${titleCaseFromId(String(requirement.type ?? "type"))} move`
  }

  if (variant === "biome") {
    return `Biome ${formatBiomeToken(String(requirement.biomeCondition ?? ""))}`
  }

  if (variant === "weather") {
    const raining = Boolean(requirement.isRaining)
    return raining ? "During rain" : "Specific weather"
  }

  if (variant === "moon_phase") {
    return `Moon ${titleCaseFromId(String(requirement.moonPhase ?? "phase"))}`
  }

  if (variant === "party_member") {
    const target = titleCaseFromId(String(requirement.target ?? "ally"))
    return `Party member: ${target}`
  }

  if (variant === "defeat") {
    const target = titleCaseFromId(String(requirement.target ?? "target"))
    const amount = Number(requirement.amount ?? 1)
    return `Defeat ${amount} ${target}`
  }

  if (variant === "use_move") {
    const move = titleCaseFromId(String(requirement.move ?? "move"))
    const amount = Number(requirement.amount ?? 1)
    return `Use ${move} ${amount} time(s)`
  }

  if (variant === "structure") {
    const structure = String(
      requirement.structureCondition ?? requirement.structureAnticondition ?? ""
    )
    return `Structure ${titleCaseFromId(structure)}`
  }

  if (variant === "stat_compare") {
    const highStat = titleCaseFromId(String(requirement.highStat ?? ""))
    const lowStat = titleCaseFromId(String(requirement.lowStat ?? ""))
    return `${highStat} > ${lowStat}`
  }

  if (variant === "stat_equal") {
    const statOne = titleCaseFromId(String(requirement.statOne ?? ""))
    const statTwo = titleCaseFromId(String(requirement.statTwo ?? ""))
    return `${statOne} = ${statTwo}`
  }

  if (variant === "properties") {
    return `Property ${String(requirement.target ?? "condition")}`
  }

  if (variant === "property_range") {
    const feature = String(requirement.feature ?? "property")
    const range = String(requirement.range ?? "")
    return `${titleCaseFromId(feature)} ${range}`
  }

  if (variant === "blocks_traveled") {
    return `${Number(requirement.amount ?? 0)} blocks traveled`
  }

  if (variant === "advancement") {
    return `Advancement ${titleCaseFromId(String(requirement.requiredAdvancement ?? ""))}`
  }

  if (variant === "damage_taken") {
    return `Take ${Number(requirement.amount ?? 0)} damage`
  }

  if (variant === "recoil") {
    return `Take ${Number(requirement.amount ?? 0)} recoil damage`
  }

  if (variant === "battle_critical_hits") {
    return `Land ${Number(requirement.amount ?? 0)} critical hits`
  }

  return `Requirement: ${JSON.stringify(requirement)}`
}

export function formatConditionChips(condition: Record<string, unknown> | null): string[] {
  if (!condition) {
    return []
  }

  const chips: string[] = []

  const biomes = Array.isArray(condition.biomes) ? condition.biomes : []
  if (biomes.length > 0) {
    chips.push(
      `Biomes: ${biomes
        .slice(0, 2)
        .map((value) => formatBiomeToken(String(value)))
        .join(", ")}`
    )
  }

  if (typeof condition.timeRange === "string") {
    chips.push(`Time: ${titleCaseFromId(condition.timeRange)}`)
  }

  if (typeof condition.canSeeSky === "boolean") {
    chips.push(condition.canSeeSky ? "Can see sky" : "No sky access")
  }

  if (typeof condition.minSkyLight === "number" || typeof condition.maxSkyLight === "number") {
    chips.push(`Sky light ${condition.minSkyLight ?? "*"}-${condition.maxSkyLight ?? "*"}`)
  }

  if (typeof condition.minY === "number" || typeof condition.maxY === "number") {
    chips.push(`Y ${condition.minY ?? "*"}-${condition.maxY ?? "*"}`)
  }

  if (Array.isArray(condition.structures) && condition.structures.length > 0) {
    chips.push(
      `Structures: ${condition.structures
        .slice(0, 2)
        .map((value) => formatBiomeToken(String(value)))
        .join(", ")}`
    )
  }

  if (typeof condition.isRaining === "boolean") {
    chips.push(condition.isRaining ? "Raining" : "Not raining")
  }

  if (typeof condition.minLureLevel === "number" || typeof condition.maxLureLevel === "number") {
    chips.push(`Lure ${condition.minLureLevel ?? "*"}-${condition.maxLureLevel ?? "*"}`)
  }

  if (typeof condition.rodType === "string") {
    chips.push(`Rod: ${titleCaseFromId(condition.rodType)}`)
  }

  return chips
}

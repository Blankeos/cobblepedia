import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { IconShield, IconSword } from "@/assets/icons"
import { DualTypeSelector } from "@/components/dual-type-selector"
import { PokemonSprite } from "@/components/pokemon-sprite"
import { loadPokemonTypeEntries } from "@/data/data-loader"
import { canonicalId, titleCaseFromId } from "@/data/formatters"
import {
  categorizeMatchups,
  getDefensiveMatchups,
  getDualTypeDefensiveMatchups,
  getOffensiveMatchups,
  type TypeMatchup,
} from "@/data/type-effectiveness"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

const TYPE_ORDER = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const

const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
}

export function TypesPageView(props: { initialType?: string }) {
  const [pokemonTypeEntries] = createResource(loadPokemonTypeEntries)

  const initialPrimary = canonicalId(props.initialType ?? "")
  const initialSecondary =
    typeof window !== "undefined"
      ? canonicalId(new URLSearchParams(window.location.search).get("secondary") ?? "")
      : ""

  const [primaryType, setPrimaryType] = createSignal(initialPrimary)
  const [secondaryType, setSecondaryType] = createSignal<string | null>(
    initialSecondary && initialSecondary !== initialPrimary ? initialSecondary : null
  )

  createEffect(() => {
    const nextPrimary = canonicalId(props.initialType ?? "")
    const nextSecondaryFromUrl =
      typeof window !== "undefined"
        ? canonicalId(new URLSearchParams(window.location.search).get("secondary") ?? "")
        : ""

    setPrimaryType(nextPrimary)
    setSecondaryType(
      nextPrimary && nextSecondaryFromUrl && nextSecondaryFromUrl !== nextPrimary
        ? nextSecondaryFromUrl
        : null
    )
  })

  useMetadata({
    title: getTitle("Type"),
  })

  const typeColor = createMemo(() => TYPE_COLORS[primaryType()] ?? "#888888")

  const availableTypes = createMemo(() => {
    const list = pokemonTypeEntries() ?? []
    const set = new Set<string>()
    for (const entry of list) {
      for (const type of entry.types) {
        set.add(type)
      }
    }
    return sortTypes(Array.from(set))
  })

  const selectedTypes = createMemo(() => {
    const primary = primaryType()
    const secondary = secondaryType()
    if (!primary) return []
    if (secondary) return [primary, secondary]
    return [primary]
  })

  const syncUrl = (primary: string, secondary: string | null) => {
    if (typeof window === "undefined") return
    const path = primary ? `/types/${primary}` : "/types"
    const search = new URLSearchParams()
    if (secondary) {
      search.set("secondary", secondary)
    }
    const nextUrl = search.toString() ? `${path}?${search.toString()}` : path
    window.history.replaceState(null, "", nextUrl)
  }

  const handleTypeChange = (types: string[]) => {
    const validTypes = new Set(availableTypes())
    const normalized = types
      .map((type) => canonicalId(type))
      .filter(Boolean)
      .filter((type, index, arr) => arr.indexOf(type) === index)
      .filter((type) => validTypes.size === 0 || validTypes.has(type))
      .slice(0, 2)

    const nextPrimary = normalized[0] ?? ""
    const nextSecondary = normalized[1] ?? null

    setPrimaryType(nextPrimary)
    setSecondaryType(nextPrimary ? nextSecondary : null)
    syncUrl(nextPrimary, nextPrimary ? nextSecondary : null)
  }

  const filteredPokemon = createMemo(() => {
    const list = pokemonTypeEntries() ?? []
    const currentType = primaryType()
    const secondary = secondaryType()
    if (!currentType) return []

    return list.filter((entry) => {
      if (!entry.types.includes(currentType)) return false
      if (secondary && !entry.types.includes(secondary)) return false
      return true
    })
  })

  const isUnknownType = createMemo(() => {
    const currentType = primaryType()
    return !!currentType && !availableTypes().includes(currentType)
  })

  const offensiveMatchups = createMemo(() => {
    const type = primaryType()
    if (!type) return null
    return categorizeMatchups(getOffensiveMatchups(type))
  })

  const defensiveMatchups = createMemo(() => {
    const primary = primaryType()
    const secondary = secondaryType()
    if (!primary) return null

    if (secondary) {
      return categorizeMatchups(getDualTypeDefensiveMatchups(primary, secondary))
    }
    return categorizeMatchups(getDefensiveMatchups(primary))
  })

  const hasNoSelection = createMemo(() => !primaryType())

  return (
    <div class="mx-auto max-w-6xl px-3 py-8 sm:px-4 lg:px-8">
      <Show when={!pokemonTypeEntries.loading} fallback={<LoadingState />}>
        <Show when={!isUnknownType()} fallback={<UnknownTypeState typeId={primaryType()} />}>
          <div class="space-y-8">
            <section class="border border-border bg-card p-4">
              <div class="mb-3">
                <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                  Type Explorer
                </p>
              </div>
              <DualTypeSelector
                availableTypes={availableTypes()}
                selectedTypes={selectedTypes()}
                onChange={handleTypeChange}
              />
            </section>

            <Show
              when={!hasNoSelection()}
              fallback={<EmptySelectionState availableTypes={availableTypes()} />}
            >
              <header class="relative overflow-hidden border border-border bg-card">
                <div class="relative p-6 sm:p-8">
                  <div class="flex items-start justify-between gap-4">
                    <div class="space-y-2">
                      <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                        Type Analysis
                      </p>
                      <div class="flex items-center gap-3">
                        <div
                          class="h-3 w-3 border"
                          style={{
                            "background-color": typeColor(),
                            "border-color": typeColor(),
                          }}
                        />
                        <h1 class="font-semibold text-3xl tracking-tight sm:text-4xl">
                          {titleCaseFromId(primaryType())}
                          <Show when={secondaryType()}>
                            {(type) => (
                              <>
                                {" / "}
                                <span style={{ color: TYPE_COLORS[type()] }}>
                                  {titleCaseFromId(type())}
                                </span>
                              </>
                            )}
                          </Show>
                        </h1>
                      </div>
                      <p class="text-muted-foreground text-sm">
                        {filteredPokemon().length} Matches
                        <Show when={secondaryType()}>
                          <span> with both types</span>
                        </Show>
                      </p>
                    </div>

                    <div class="hidden text-right sm:block">
                      <p class="font-mono text-muted-foreground text-xs">
                        #
                        {String(
                          TYPE_ORDER.indexOf(primaryType() as (typeof TYPE_ORDER)[number]) + 1
                        ).padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                </div>
              </header>

              <section class="grid gap-4 lg:grid-cols-2">
                <EffectivenessCard
                  title="Offensive"
                  subtitle={`When ${titleCaseFromId(primaryType())} attacks`}
                  immune={offensiveMatchups()?.immune ?? []}
                  notVeryEffective={offensiveMatchups()?.half ?? []}
                  superEffective={offensiveMatchups()?.double ?? []}
                  noEffect={offensiveMatchups()?.immune ?? []}
                  typeColor={typeColor()}
                />

                <EffectivenessCard
                  title="Defensive"
                  subtitle={
                    secondaryType()
                      ? `When ${titleCaseFromId(primaryType())}/${titleCaseFromId(secondaryType() || "")} is attacked`
                      : `When ${titleCaseFromId(primaryType())} is attacked`
                  }
                  immune={defensiveMatchups()?.immune ?? []}
                  notVeryEffective={[
                    ...(defensiveMatchups()?.half ?? []),
                    ...(defensiveMatchups()?.quarter ?? []),
                  ]}
                  superEffective={[
                    ...(defensiveMatchups()?.double ?? []),
                    ...(defensiveMatchups()?.quadruple ?? []),
                  ]}
                  noEffect={[]}
                  typeColor={typeColor()}
                />
              </section>

              <section>
                <div class="mb-3 flex items-center justify-between">
                  <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                    Pokemon ({filteredPokemon().length})
                  </p>
                </div>

                <Show
                  when={filteredPokemon().length > 0}
                  fallback={
                    <div class="border border-border bg-card p-8 text-center">
                      <p class="text-muted-foreground text-sm">
                        No Pokemon with {titleCaseFromId(primaryType())}
                        <Show when={secondaryType()}>
                          {(type) => <span> and {titleCaseFromId(type())}</span>}
                        </Show>
                        .
                      </p>
                    </div>
                  }
                >
                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <For each={filteredPokemon()}>
                      {(pokemon) => (
                        <a
                          href={buildPokemonTypeEntryHref(pokemon.slug, pokemon.formSlug)}
                          class="group flex items-center gap-3 border border-border bg-card p-3 transition-colors hover:border-muted-foreground"
                        >
                          <span class="font-mono text-muted-foreground text-xs">
                            #{String(pokemon.dexNumber).padStart(3, "0")}
                          </span>

                          <PokemonSprite
                            dexNumber={pokemon.dexNumber}
                            name={pokemon.name}
                            class="h-8 w-8"
                            imageClass="h-6 w-6"
                          />

                          <div class="min-w-0 flex-1">
                            <p class="truncate font-medium text-sm group-hover:text-foreground">
                              {pokemon.name}
                            </p>
                            <Show when={pokemon.formName}>
                              {(formName) => (
                                <p class="truncate text-muted-foreground text-xs">
                                  Form: {formName()}
                                </p>
                              )}
                            </Show>
                          </div>

                          <div class="flex items-center gap-1">
                            <For each={pokemon.types}>
                              {(type) => {
                                const isActive = type === primaryType() || type === secondaryType()
                                const typeColor = TYPE_COLORS[type] ?? "#888888"
                                return (
                                  <span
                                    class={cn(
                                      "px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                                      isActive ? "text-white" : "border bg-transparent"
                                    )}
                                    style={{
                                      "border-color": isActive ? undefined : typeColor,
                                      "background-color": isActive ? typeColor : undefined,
                                      color: isActive ? undefined : typeColor,
                                    }}
                                  >
                                    {titleCaseFromId(type)}
                                  </span>
                                )
                              }}
                            </For>
                          </div>
                        </a>
                      )}
                    </For>
                  </div>
                </Show>
              </section>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  )
}

function EffectivenessCard(props: {
  title: string
  subtitle: string
  immune: TypeMatchup[]
  notVeryEffective: TypeMatchup[]
  superEffective: TypeMatchup[]
  noEffect: TypeMatchup[]
  typeColor: string
}) {
  const hasData = () =>
    props.immune.length > 0 ||
    props.notVeryEffective.length > 0 ||
    props.superEffective.length > 0 ||
    props.noEffect.length > 0

  const Icon = () =>
    props.title === "Offensive" ? (
      <IconSword width={20} height={20} />
    ) : (
      <IconShield width={20} height={20} />
    )

  return (
    <div class="overflow-hidden border border-border bg-card">
      <div class="border-border border-b bg-muted/30 px-4 py-4">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              "background-color": `${props.typeColor}20`,
              color: props.typeColor,
            }}
          >
            <Icon />
          </div>
          <div>
            <h3 class="font-semibold text-base">{props.title}</h3>
            <p class="text-muted-foreground text-xs">{props.subtitle}</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 p-4">
        <Show when={hasData()} fallback={<NoEffectData />}>
          <Show when={props.superEffective.length > 0}>
            <MatchupGroup
              label="Super Effective"
              types={props.superEffective.map((m) => m.type)}
              multiplier="2x"
              variant="positive"
            />
          </Show>

          <Show when={props.notVeryEffective.length > 0}>
            <MatchupGroup
              label="Not Very Effective"
              types={props.notVeryEffective.map((m) => m.type)}
              multiplier="1/2x"
              variant="negative"
            />
          </Show>

          <Show when={props.immune.length > 0}>
            <MatchupGroup
              label="No Effect"
              types={props.immune.map((m) => m.type)}
              multiplier="0x"
              variant="immune"
            />
          </Show>
        </Show>
      </div>
    </div>
  )
}

function MatchupGroup(props: {
  label: string
  types: string[]
  multiplier: string
  variant: "positive" | "negative" | "immune"
}) {
  const colors = {
    positive: { bg: "#3f1d1d", text: "#f87171" },
    negative: { bg: "#1e293b", text: "#60a5fa" },
    immune: { bg: "#27272a", text: "#a1a1aa" },
  }

  const theme = colors[props.variant]

  return (
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <span class="font-mono text-muted-foreground text-xs">{props.label}</span>
        <span
          class="px-1.5 py-0.5 font-mono text-[10px]"
          style={{ "background-color": theme.bg, color: theme.text }}
        >
          {props.multiplier}
        </span>
      </div>

      <div class="flex flex-wrap gap-1">
        <For each={sortTypes(props.types)}>
          {(type) => (
            <a
              href={`/types/${type}`}
              class="border px-2 py-1 font-mono text-xs uppercase tracking-wider transition-colors hover:opacity-80"
              style={{
                "border-color": TYPE_COLORS[type] ?? "#888888",
                color: TYPE_COLORS[type] ?? "#888888",
              }}
            >
              {titleCaseFromId(type)}
            </a>
          )}
        </For>
      </div>
    </div>
  )
}

function EmptySelectionState(props: { availableTypes: string[] }) {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 border border-border bg-card p-8 text-center">
      <h2 class="font-semibold text-xl">Select a Type</h2>
      <p class="text-muted-foreground text-sm">
        Use the selector above to explore type effectiveness and Pokemon.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <For each={props.availableTypes}>
          {(type) => (
            <a
              href={`/types/${type}`}
              class="border px-3 py-1.5 font-mono text-xs uppercase transition-colors hover:opacity-80"
              style={{
                "border-color": TYPE_COLORS[type] ?? "#888888",
                color: TYPE_COLORS[type] ?? "#888888",
              }}
            >
              {type}
            </a>
          )}
        </For>
      </div>
    </div>
  )
}

function NoEffectData() {
  return (
    <div class="flex items-center justify-center py-6">
      <p class="text-muted-foreground text-xs">No special effectiveness</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading type data...</p>
    </div>
  )
}

function UnknownTypeState(props: { typeId: string }) {
  return (
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 border border-border bg-card p-8 text-center">
      <h1 class="font-semibold text-2xl">Type Not Found</h1>
      <p class="text-muted-foreground text-sm">
        <span class="font-mono">{props.typeId || "unknown"}</span> is not a recognized type.
      </p>
    </div>
  )
}

function sortTypes(types: string[]): string[] {
  return [...types].sort((left, right) => {
    const leftIndex = TYPE_ORDER.indexOf(left as (typeof TYPE_ORDER)[number])
    const rightIndex = TYPE_ORDER.indexOf(right as (typeof TYPE_ORDER)[number])

    if (leftIndex !== -1 && rightIndex !== -1 && leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    if (leftIndex !== -1) return -1
    if (rightIndex !== -1) return 1

    return left.localeCompare(right)
  })
}

function buildPokemonTypeEntryHref(slug: string, formSlug: string | null): string {
  if (!formSlug) {
    return `/pokemon/${slug}`
  }

  return `/pokemon/${slug}?form=${encodeURIComponent(formSlug)}`
}

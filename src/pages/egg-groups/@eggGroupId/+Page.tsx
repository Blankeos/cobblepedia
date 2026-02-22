import { createMemo, createResource, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { loadPokemonList } from "@/data/data-loader"
import { canonicalId, formatEggGroup, titleCaseFromId } from "@/data/formatters"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

const EGG_GROUP_ORDER = [
  "monster",
  "water1",
  "bug",
  "flying",
  "field",
  "fairy",
  "grass",
  "human_like",
  "water3",
  "mineral",
  "amorphous",
  "water2",
  "ditto",
  "dragon",
  "undiscovered",
] as const

const EGG_GROUP_COLORS: Record<string, string> = {
  monster: "#8b5cf6",
  water1: "#38bdf8",
  bug: "#84cc16",
  flying: "#818cf8",
  field: "#d97706",
  fairy: "#f472b6",
  grass: "#22c55e",
  human_like: "#f97316",
  water3: "#0ea5e9",
  mineral: "#94a3b8",
  amorphous: "#a78bfa",
  water2: "#0284c7",
  ditto: "#e879f9",
  dragon: "#6366f1",
  undiscovered: "#64748b",
}

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

export default function Page() {
  const pageContext = usePageContext()
  const eggGroupParam = createMemo(() =>
    canonicalId(String(pageContext.routeParams.eggGroupId ?? ""))
  )
  const [pokemonList] = createResource(loadPokemonList)

  useMetadata({
    title: getTitle("Egg Group"),
  })

  const availableEggGroups = createMemo(() => {
    const set = new Set<string>()

    for (const pokemon of pokemonList() ?? []) {
      for (const group of pokemon.eggGroups) {
        set.add(group)
      }
    }

    return sortEggGroups(Array.from(set))
  })

  const activeEggGroup = createMemo(() => {
    const param = eggGroupParam()
    return availableEggGroups().find((group) => canonicalId(group) === param) ?? null
  })

  const members = createMemo(() => {
    const group = activeEggGroup()
    if (!group) {
      return []
    }

    return (pokemonList() ?? []).filter((pokemon) => {
      if (!pokemon.implemented) {
        return false
      }

      return pokemon.eggGroups.includes(group)
    })
  })

  return (
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Show when={!pokemonList.loading} fallback={<LoadingState />}>
        <Show
          when={activeEggGroup()}
          fallback={<UnknownEggGroupState eggGroupId={eggGroupParam()} />}
        >
          {(eggGroupSignal) => {
            const eggGroup = eggGroupSignal()
            const eggGroupColor = EGG_GROUP_COLORS[eggGroup] ?? "#9ca3af"

            return (
              <div class="space-y-6">
                <header class="border border-border bg-card p-6">
                  <p class="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wide">
                    Egg Group
                  </p>
                  <h1 class="font-semibold text-3xl tracking-tight sm:text-4xl">
                    {formatEggGroup(eggGroup)} Pokemon
                  </h1>
                  <div class="mt-3 flex items-center gap-3">
                    <span
                      class="border px-3 py-1 font-mono text-xs uppercase tracking-wider"
                      style={{
                        "border-color": eggGroupColor,
                        color: eggGroupColor,
                      }}
                    >
                      {eggGroup}
                    </span>
                    <span class="text-muted-foreground text-sm">{members().length} results</span>
                  </div>
                </header>

                <section class="border border-border bg-card p-4">
                  <p class="mb-3 font-mono text-muted-foreground text-xs uppercase tracking-wide">
                    Browse Egg Groups
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <For each={availableEggGroups()}>
                      {(group) => (
                        <a
                          href={`/egg-groups/${group}`}
                          class={cn(
                            "border px-3 py-1.5 font-medium text-xs uppercase tracking-wider transition-colors hover:bg-secondary/60",
                            group === eggGroup && "bg-secondary"
                          )}
                          style={{
                            "border-color": EGG_GROUP_COLORS[group] ?? "#9ca3af",
                            color: EGG_GROUP_COLORS[group] ?? "#9ca3af",
                          }}
                        >
                          {formatEggGroup(group)}
                        </a>
                      )}
                    </For>
                  </div>
                </section>

                <section>
                  <Show
                    when={members().length > 0}
                    fallback={
                      <div class="border border-border bg-card p-8 text-center text-muted-foreground text-sm">
                        No Pokemon are currently listed for this egg group.
                      </div>
                    }
                  >
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <For each={members()}>
                        {(pokemon) => (
                          <a
                            href={`/pokemon/${pokemon.slug}`}
                            class="border border-border bg-card p-4 transition-colors hover:border-muted-foreground hover:bg-secondary"
                          >
                            <div class="mb-2 flex items-center justify-between">
                              <span class="font-medium">{pokemon.name}</span>
                              <span class="font-mono text-muted-foreground text-xs">
                                #{String(pokemon.dexNumber).padStart(3, "0")}
                              </span>
                            </div>

                            <div class="mb-2 flex flex-wrap gap-1">
                              <For each={pokemon.types}>
                                {(type) => (
                                  <span
                                    class="border px-2 py-0.5 font-medium text-[11px] uppercase tracking-wider"
                                    style={{
                                      "border-color": TYPE_COLORS[type] ?? "#888888",
                                      color: TYPE_COLORS[type] ?? "#888888",
                                    }}
                                  >
                                    {titleCaseFromId(type)}
                                  </span>
                                )}
                              </For>
                            </div>

                            <div class="flex flex-wrap gap-1">
                              <For each={pokemon.eggGroups}>
                                {(group) => (
                                  <span
                                    class={cn(
                                      "border px-2 py-0.5 font-medium text-[11px] uppercase tracking-wider",
                                      group === eggGroup && "bg-secondary"
                                    )}
                                    style={{
                                      "border-color": EGG_GROUP_COLORS[group] ?? "#9ca3af",
                                      color: EGG_GROUP_COLORS[group] ?? "#9ca3af",
                                    }}
                                  >
                                    {formatEggGroup(group)}
                                  </span>
                                )}
                              </For>
                            </div>
                          </a>
                        )}
                      </For>
                    </div>
                  </Show>
                </section>
              </div>
            )
          }}
        </Show>
      </Show>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading egg groups...</p>
    </div>
  )
}

function UnknownEggGroupState(props: { eggGroupId: string }) {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 border border-border bg-card p-6 text-center">
      <h1 class="font-semibold text-2xl">Egg Group Not Found</h1>
      <p class="text-muted-foreground text-sm">
        <span class="font-mono">{props.eggGroupId || "unknown"}</span> is not a recognized egg group
        in this dataset.
      </p>
    </div>
  )
}

function sortEggGroups(groups: string[]): string[] {
  return [...groups].sort((left, right) => {
    const leftIndex = EGG_GROUP_ORDER.indexOf(left as (typeof EGG_GROUP_ORDER)[number])
    const rightIndex = EGG_GROUP_ORDER.indexOf(right as (typeof EGG_GROUP_ORDER)[number])

    if (leftIndex !== -1 && rightIndex !== -1 && leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    if (leftIndex !== -1) {
      return -1
    }

    if (rightIndex !== -1) {
      return 1
    }

    return left.localeCompare(right)
  })
}

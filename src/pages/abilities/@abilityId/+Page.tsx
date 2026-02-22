import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import type { AbilityEntryRecord } from "@/data/cobblemon-types"
import { loadAbilityIndex } from "@/data/data-loader"
import { canonicalId } from "@/data/formatters"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

export default function Page() {
  const pageContext = usePageContext()
  const abilityId = createMemo(() => canonicalId(String(pageContext.routeParams.abilityId ?? "")))

  const [entry] = createResource(abilityId, async (nextAbilityId) => {
    if (!nextAbilityId) {
      return null
    }

    const abilityIndex = await loadAbilityIndex()
    return abilityIndex[nextAbilityId] ?? null
  })

  useMetadata({
    title: getTitle("Ability"),
  })

  return (
    <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Show when={!entry.loading} fallback={<LoadingState />}>
        <Show when={entry()} fallback={<NotFoundState abilityId={abilityId()} />}>
          {(entrySignal) => <AbilityDetailView entry={entrySignal()} />}
        </Show>
      </Show>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading ability data...</p>
    </div>
  )
}

function NotFoundState(props: { abilityId: string }) {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 border border-border bg-card p-6 text-center">
      <h1 class="font-semibold text-2xl">Ability Not Found</h1>
      <p class="text-muted-foreground text-sm">
        No ability entry exists for <span class="font-mono">{props.abilityId || "this id"}</span>.
      </p>
    </div>
  )
}

function AbilityDetailView(props: { entry: AbilityEntryRecord }) {
  const [filter, setFilter] = createSignal<"all" | "hidden" | "regular">("all")

  const visiblePokemon = createMemo(() => {
    const nextFilter = filter()
    if (nextFilter === "all") {
      return props.entry.pokemon
    }

    if (nextFilter === "hidden") {
      return props.entry.pokemon.filter((pokemon) => pokemon.hidden)
    }

    return props.entry.pokemon.filter((pokemon) => !pokemon.hidden)
  })

  const hiddenCount = createMemo(
    () => props.entry.pokemon.filter((pokemon) => pokemon.hidden).length
  )

  return (
    <div class="space-y-6">
      <header class="border border-border bg-card p-6">
        <p class="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wide">
          Ability: {props.entry.abilityId}
        </p>
        <h1 class="font-semibold text-3xl tracking-tight sm:text-4xl">{props.entry.name}</h1>
        <p class="mt-4 text-muted-foreground text-sm leading-relaxed">
          {props.entry.description ||
            props.entry.shortDescription ||
            "No ability description is available."}
        </p>
        <Show
          when={
            props.entry.description &&
            props.entry.shortDescription &&
            props.entry.description !== props.entry.shortDescription
          }
        >
          <p class="mt-3 border-border border-t pt-3 text-muted-foreground text-xs leading-relaxed">
            Short: {props.entry.shortDescription}
          </p>
        </Show>
      </header>

      <section class="border border-border bg-card">
        <div class="flex flex-wrap items-center justify-between gap-3 border-border border-b p-4">
          <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
            Pokemon with this ability ({visiblePokemon().length})
          </p>
          <div class="flex gap-1">
            <FilterButton
              label="All"
              active={filter() === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterButton
              label={`Regular (${props.entry.pokemon.length - hiddenCount()})`}
              active={filter() === "regular"}
              onClick={() => setFilter("regular")}
            />
            <FilterButton
              label={`Hidden (${hiddenCount()})`}
              active={filter() === "hidden"}
              onClick={() => setFilter("hidden")}
            />
          </div>
        </div>

        <Show
          when={visiblePokemon().length > 0}
          fallback={
            <p class="px-4 py-8 text-center text-muted-foreground text-sm">
              No Pokemon match the selected ability filter.
            </p>
          }
        >
          <div class="max-h-[560px] overflow-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-secondary">
                <tr>
                  <th class="px-4 py-2 text-left font-medium text-muted-foreground">Pokemon</th>
                  <th class="px-4 py-2 text-right font-medium text-muted-foreground">Slot</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <For each={visiblePokemon()}>
                  {(pokemon) => (
                    <tr class="hover:bg-secondary/40">
                      <td class="px-4 py-2.5">
                        <a href={`/pokemon/${pokemon.slug}`} class="hover:underline">
                          #{String(pokemon.dexNumber).padStart(3, "0")} {pokemon.name}
                        </a>
                      </td>
                      <td class="px-4 py-2.5 text-right">
                        <span
                          class={cn(
                            "border px-2 py-0.5 text-xs",
                            pokemon.hidden
                              ? "border-border bg-secondary text-muted-foreground"
                              : "border-foreground/20 bg-foreground/10 text-foreground"
                          )}
                        >
                          {pokemon.hidden ? "Hidden" : "Regular"}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </section>
    </div>
  )
}

function FilterButton(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      class={cn(
        "border px-2.5 py-1 text-xs transition-colors",
        props.active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-secondary text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      )}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}

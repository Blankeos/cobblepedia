import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { PokemonSprite } from "@/components/pokemon-sprite"
import type { AbilityEntryRecord, AbilitySlot } from "@/data/cobblemon-types"
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
    <div class="mx-auto max-w-5xl px-3 py-8 sm:px-4 lg:px-8">
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
      return props.entry.pokemon.filter((pokemon) =>
        resolveEffectiveAbilitySlots(pokemon).includes("hidden")
      )
    }

    return props.entry.pokemon.filter((pokemon) =>
      resolveEffectiveAbilitySlots(pokemon).some((slot) => slot !== "hidden")
    )
  })

  const hiddenCount = createMemo(
    () =>
      props.entry.pokemon.filter((pokemon) =>
        resolveEffectiveAbilitySlots(pokemon).includes("hidden")
      ).length
  )

  const regularCount = createMemo(
    () =>
      props.entry.pokemon.filter((pokemon) =>
        resolveEffectiveAbilitySlots(pokemon).some((slot) => slot !== "hidden")
      ).length
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
        <p class="mt-2 text-muted-foreground text-xs">
          Slot badges show base species slots. Form-only slots are listed with form tags.
        </p>
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
              label={`Regular (${regularCount()})`}
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
                  {(pokemon) => {
                    const primaryFormSprite = resolvePrimaryAbilityFormSprite(pokemon)

                    return (
                      <tr class="hover:bg-secondary/40">
                        <td class="px-4 py-2.5">
                          <a
                            href={resolvePokemonAbilityHref(pokemon)}
                            class="inline-flex items-center gap-2 hover:underline"
                          >
                            <PokemonSprite
                              dexNumber={pokemon.dexNumber}
                              slug={pokemon.slug}
                              formSlug={primaryFormSprite?.formSlug ?? null}
                              formName={primaryFormSprite?.formName ?? null}
                              name={pokemon.name}
                              class="h-8 w-8"
                              imageClass="h-6 w-6"
                            />
                            <span>
                              #{String(pokemon.dexNumber).padStart(3, "0")} {pokemon.name}
                            </span>
                          </a>
                        </td>
                        <td class="px-4 py-2.5 text-right">
                          <div class="flex flex-col items-end gap-1">
                            <div class="flex justify-end gap-1">
                              <Show
                                when={resolveAbilitySlots(pokemon).length > 0}
                                fallback={
                                  <span class="border border-border bg-secondary px-2 py-0.5 text-muted-foreground text-xs">
                                    Form Only
                                  </span>
                                }
                              >
                                <For each={resolveAbilitySlots(pokemon)}>
                                  {(slot) => (
                                    <span
                                      class={cn("border px-2 py-0.5 text-xs", slotBadgeClass(slot))}
                                    >
                                      {formatAbilitySlot(slot)}
                                    </span>
                                  )}
                                </For>
                              </Show>
                            </div>

                            <Show when={resolveFormAbilitySlots(pokemon).length > 0}>
                              <div class="flex flex-wrap justify-end gap-1">
                                <For each={resolveFormAbilitySlots(pokemon)}>
                                  {(formSlot) => (
                                    <a
                                      href={`/pokemon/${pokemon.slug}?form=${encodeURIComponent(formSlot.formSlug)}`}
                                      class="border border-border bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                                    >
                                      {formSlot.formName}: {formatAbilitySlotList(formSlot.slots)}
                                    </a>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                        </td>
                      </tr>
                    )
                  }}
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

function resolveAbilitySlots(pokemon: AbilityEntryRecord["pokemon"][number]): AbilitySlot[] {
  if (Array.isArray(pokemon.slots) && pokemon.slots.length > 0) {
    return pokemon.slots
  }

  if (Array.isArray(pokemon.formSlots) && pokemon.formSlots.length > 0) {
    return []
  }

  return pokemon.hidden ? ["hidden"] : ["first"]
}

function resolveFormAbilitySlots(
  pokemon: AbilityEntryRecord["pokemon"][number]
): AbilityEntryRecord["pokemon"][number]["formSlots"] {
  if (!Array.isArray(pokemon.formSlots)) {
    return []
  }

  return pokemon.formSlots.filter(
    (formSlot) =>
      Boolean(formSlot.formName) &&
      Boolean(formSlot.formSlug) &&
      Array.isArray(formSlot.slots) &&
      formSlot.slots.length > 0
  )
}

function resolvePrimaryAbilityFormSprite(pokemon: AbilityEntryRecord["pokemon"][number]): {
  formSlug: string
  formName: string
} | null {
  const baseSlots = resolveAbilitySlots(pokemon)
  if (baseSlots.length > 0) {
    return null
  }

  const firstFormSlot = resolveFormAbilitySlots(pokemon)[0]
  if (!firstFormSlot) {
    return null
  }

  return {
    formSlug: firstFormSlot.formSlug,
    formName: firstFormSlot.formName,
  }
}

function resolvePokemonAbilityHref(pokemon: AbilityEntryRecord["pokemon"][number]): string {
  const baseSlots = resolveAbilitySlots(pokemon)
  if (baseSlots.length > 0) {
    return `/pokemon/${pokemon.slug}`
  }

  const firstFormSlot = resolveFormAbilitySlots(pokemon)[0]
  if (!firstFormSlot) {
    return `/pokemon/${pokemon.slug}`
  }

  return `/pokemon/${pokemon.slug}?form=${encodeURIComponent(firstFormSlot.formSlug)}`
}

function resolveEffectiveAbilitySlots(
  pokemon: AbilityEntryRecord["pokemon"][number]
): AbilitySlot[] {
  const slots = new Set<AbilitySlot>(resolveAbilitySlots(pokemon))

  for (const formSlot of resolveFormAbilitySlots(pokemon)) {
    for (const slot of formSlot.slots) {
      slots.add(slot)
    }
  }

  return Array.from(slots)
}

function formatAbilitySlotList(slots: AbilitySlot[]): string {
  return slots.map((slot) => formatAbilitySlot(slot)).join(" + ")
}

function formatAbilitySlot(slot: AbilitySlot): string {
  if (slot === "first") {
    return "First"
  }

  if (slot === "second") {
    return "Second"
  }

  return "Hidden"
}

function slotBadgeClass(slot: AbilitySlot): string {
  if (slot === "first") {
    return "border-foreground/20 bg-foreground/10 text-foreground"
  }

  if (slot === "second") {
    return "border-info/40 bg-info/10 text-info"
  }

  return "border-border bg-secondary text-muted-foreground"
}

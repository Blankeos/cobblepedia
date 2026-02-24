import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { IconEgg } from "@/assets/icons"
import { DualEggGroupSelector } from "@/components/dual-egg-group-selector"
import { PokemonSprite } from "@/components/pokemon-sprite"
import type { MoveLearnerEntryRecord, MoveSourceType } from "@/data/cobblemon-types"
import { loadMoveLearnerEntry } from "@/data/data-loader"
import { canonicalId, formatEggGroup, formatMoveSource, titleCaseFromId } from "@/data/formatters"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

const METHOD_FILTERS = [
  "all",
  "level",
  "egg",
  "tm",
  "tutor",
  "legacy",
  "special",
  "form_change",
] as const

type MethodFilter = (typeof METHOD_FILTERS)[number]

const MOVE_TYPE_COLORS: Record<string, string> = {
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
  stellar: "#fb7185",
}

export default function Page() {
  const pageContext = usePageContext()
  const moveId = createMemo(() => canonicalId(String(pageContext.routeParams.moveId ?? "")))

  const [entry] = createResource(
    () => moveId(),
    async (nextMoveId) => {
      if (!nextMoveId) {
        return null
      }

      return loadMoveLearnerEntry(nextMoveId)
    }
  )

  useMetadata({
    title: getTitle("Move"),
  })

  return (
    <div class="mx-auto max-w-5xl px-3 py-8 sm:px-4 lg:px-8">
      <Show when={!entry.loading} fallback={<LoadingState />}>
        <Show when={entry()} fallback={<NotFoundState moveId={moveId()} />}>
          {(entrySignal) => <MoveDetailView entry={entrySignal()} />}
        </Show>
      </Show>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading move learners...</p>
    </div>
  )
}

function NotFoundState(props: { moveId: string }) {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 border border-border bg-card p-6 text-center">
      <h1 class="font-semibold text-2xl">Move Not Found</h1>
      <p class="text-muted-foreground text-sm">
        No learner data exists for <span class="font-mono">{props.moveId || "this move"}</span>.
      </p>
    </div>
  )
}

function MoveDetailView(props: { entry: MoveLearnerEntryRecord }) {
  const [activeMethod, setActiveMethod] = createSignal<MethodFilter>("all")
  const [search, setSearch] = createSignal("")
  const [selectedEggGroups, setSelectedEggGroups] = createSignal<string[]>([])

  const moveTypeId = createMemo(() => canonicalId(props.entry.type ?? ""))
  const moveTypeColor = createMemo(() => MOVE_TYPE_COLORS[moveTypeId()] ?? "#888888")
  const moveTypeHref = createMemo(() => {
    const typeId = moveTypeId()
    return typeId ? `/types/${typeId}` : null
  })

  const availableEggGroups = createMemo(() => {
    const groups = new Set<string>()

    for (const learner of props.entry.learners) {
      for (const group of getLearnerEggGroups(learner)) {
        groups.add(group)
      }
    }

    return Array.from(groups).sort((left, right) => {
      return formatEggGroup(left).localeCompare(formatEggGroup(right))
    })
  })

  createEffect(() => {
    const validGroups = new Set(availableEggGroups())
    const filtered = selectedEggGroups().filter((group) => validGroups.has(group))

    if (filtered.length !== selectedEggGroups().length) {
      setSelectedEggGroups(filtered)
    }
  })

  const handleEggGroupChange = (eggGroups: string[]) => {
    const validGroups = new Set(availableEggGroups())
    const normalized = eggGroups
      .map((group) => canonicalId(group))
      .map((normalizedGroup) => {
        return availableEggGroups().find((group) => canonicalId(group) === normalizedGroup) ?? null
      })
      .filter((group): group is string => Boolean(group))
      .filter((group, index, list) => list.indexOf(group) === index)
      .filter((group) => validGroups.has(group))
      .slice(0, 2)

    setSelectedEggGroups(normalized)
  }

  const counts = createMemo(() => ({
    all: props.entry.learners.length,
    level: props.entry.learners.filter((learner) => learner.methods.includes("level")).length,
    egg: props.entry.learners.filter((learner) => learner.methods.includes("egg")).length,
    tm: props.entry.learners.filter((learner) => learner.methods.includes("tm")).length,
    tutor: props.entry.learners.filter((learner) => learner.methods.includes("tutor")).length,
    legacy: props.entry.learners.filter((learner) => learner.methods.includes("legacy")).length,
    special: props.entry.learners.filter((learner) => learner.methods.includes("special")).length,
    form_change: props.entry.learners.filter((learner) => learner.methods.includes("form_change"))
      .length,
  }))

  const filteredLearners = createMemo(() => {
    const query = search().trim().toLowerCase()
    const method = activeMethod()
    const eggGroupFilter = selectedEggGroups()

    return props.entry.learners.filter((learner) => {
      if (method !== "all" && !learner.methods.includes(method as MoveSourceType)) {
        return false
      }

      if (
        eggGroupFilter.length > 0 &&
        !eggGroupFilter.every((group) => getLearnerEggGroups(learner).includes(group))
      ) {
        return false
      }

      if (!query) {
        return true
      }

      const eggGroups = getLearnerEggGroups(learner)
      const formNames = learner.forms.map((form) => form.name)

      return (
        learner.name.toLowerCase().includes(query) ||
        learner.slug.toLowerCase().includes(query) ||
        String(learner.dexNumber).includes(query) ||
        formNames.some((formName) => formName.toLowerCase().includes(query)) ||
        eggGroups.some((group) => {
          return (
            group.toLowerCase().includes(query) ||
            formatEggGroup(group).toLowerCase().includes(query)
          )
        })
      )
    })
  })

  return (
    <div class="space-y-6">
      <header class="border bg-card p-6" style={{ "border-color": moveTypeColor() }}>
        <p class="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wide">
          Move: {props.entry.moveId}
        </p>
        <h1 class="font-semibold text-3xl tracking-tight sm:text-4xl">{props.entry.moveName}</h1>
        <p class="mt-3 text-muted-foreground text-sm leading-relaxed">
          {props.entry.description ||
            props.entry.shortDescription ||
            "No move description is available."}
        </p>
        <Show
          when={
            props.entry.description &&
            props.entry.shortDescription &&
            props.entry.description !== props.entry.shortDescription
          }
        >
          <p class="mt-2 border-border border-t pt-2 text-muted-foreground text-xs leading-relaxed">
            Short: {props.entry.shortDescription}
          </p>
        </Show>
        <p class="mt-2 text-muted-foreground text-sm">
          {props.entry.learners.length} Pokemon can learn this move.
        </p>

        <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatBadge
            label="Type"
            value={formatMoveTypeLabel(props.entry.type)}
            accentColor={moveTypeColor()}
            emphasized
            href={moveTypeHref()}
          />
          <StatBadge label="Category" value={formatMoveCategory(props.entry.category)} />
          <StatBadge
            label="Damage"
            value={formatMoveDamage(props.entry.basePower, props.entry.category)}
          />
          <StatBadge
            label="Accuracy"
            value={formatMoveAccuracy(props.entry.accuracy, props.entry.alwaysHits)}
          />
        </div>
      </header>

      <section class="border border-border bg-card">
        <div class="border-border border-b p-4">
          <div class="mb-3 flex flex-wrap gap-1">
            <For each={METHOD_FILTERS}>
              {(filter) => (
                <button
                  type="button"
                  class={cn(
                    "border px-3 py-1.5 text-xs transition-colors",
                    activeMethod() === filter
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-secondary hover:border-muted-foreground"
                  )}
                  onClick={() => setActiveMethod(filter)}
                >
                  {formatMoveSourceLabel(filter)}
                  <span class="ml-1 font-mono opacity-70">{counts()[filter]}</span>
                </button>
              )}
            </For>
          </div>

          <input
            type="text"
            class="w-full border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
            placeholder="Filter Pokemon by name, slug, dex, or egg group..."
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />

          <div class="mt-3 space-y-2">
            <div class="flex items-center justify-between">
              <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                Egg Group Filter
              </p>
              <Show when={selectedEggGroups().length > 0}>
                <button
                  type="button"
                  class="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
                  onClick={() => setSelectedEggGroups([])}
                >
                  Clear
                </button>
              </Show>
            </div>
            <DualEggGroupSelector
              availableEggGroups={availableEggGroups()}
              selectedEggGroups={selectedEggGroups()}
              onChange={handleEggGroupChange}
            />
          </div>
        </div>

        <div class="max-h-[560px] overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-secondary">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-muted-foreground">Pokemon</th>
                <th class="px-4 py-2 text-right font-medium text-muted-foreground">Methods</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <For each={filteredLearners()}>
                {(learner) => {
                  const spriteForm = resolveMoveLearnerSpriteForm(learner)

                  return (
                    <tr class="hover:bg-secondary/40">
                      <td class="px-4 py-2.5">
                        <div class="space-y-1.5">
                          <a
                            href={resolveMoveLearnerHref(learner)}
                            class="inline-flex items-center gap-2 hover:underline"
                          >
                            <PokemonSprite
                              dexNumber={learner.dexNumber}
                              slug={learner.slug}
                              formSlug={spriteForm?.slug ?? null}
                              formName={spriteForm?.name ?? null}
                              name={learner.name}
                              class="h-8 w-8"
                              imageClass="h-6 w-6"
                            />
                            <span>
                              #{String(learner.dexNumber).padStart(3, "0")} {learner.name}
                            </span>
                          </a>

                          <div class="flex flex-wrap gap-1">
                            <For each={getLearnerEggGroups(learner)}>
                              {(group) => (
                                <span class="inline-flex items-center gap-1 border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                                  <IconEgg class="h-3 w-3" />
                                  {formatEggGroup(group)}
                                </span>
                              )}
                            </For>
                          </div>

                          <Show when={learner.forms.length > 0}>
                            <div class="flex flex-wrap gap-1">
                              <Show when={!learner.baseAvailable}>
                                <span class="border border-border bg-secondary/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                                  Form Only
                                </span>
                              </Show>
                              <For each={learner.forms}>
                                {(form) => (
                                  <a
                                    href={`/pokemon/${learner.slug}?form=${encodeURIComponent(form.slug)}`}
                                    class="border border-border bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                                  >
                                    {form.name}
                                  </a>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </td>
                      <td class="px-4 py-2.5">
                        <div class="flex justify-end gap-1">
                          <For each={learner.methods}>
                            {(method) => (
                              <span class="border border-border bg-secondary px-2 py-0.5 text-muted-foreground text-xs">
                                {formatLearnerMethodLabel(learner, method)}
                              </span>
                            )}
                          </For>
                        </div>
                      </td>
                    </tr>
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>

        <Show when={filteredLearners().length === 0}>
          <p class="border-border border-t px-4 py-8 text-center text-muted-foreground text-sm">
            No Pokemon match this filter.
          </p>
        </Show>
      </section>
    </div>
  )
}

function formatMoveSourceLabel(filter: MethodFilter): string {
  if (filter === "all") {
    return "All"
  }

  return formatMoveSource(filter, null)
}

function StatBadge(props: {
  label: string
  value: string
  accentColor?: string
  emphasized?: boolean
  href?: string | null
}) {
  const containerClass = cn(
    "border bg-secondary/40 px-3 py-2",
    props.emphasized && "bg-secondary/60",
    props.href &&
      "block transition-colors hover:border-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-muted-foreground/50"
  )

  const valueClass = cn(
    "mt-0.5 font-medium text-sm",
    props.emphasized && "font-semibold",
    props.href && "underline-offset-2 hover:underline"
  )

  const valueStyle =
    props.emphasized && props.accentColor ? { color: props.accentColor } : undefined

  const content = (
    <>
      <p class="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
        {props.label}
      </p>
      <p class={valueClass} style={valueStyle}>
        {props.value}
      </p>
    </>
  )

  if (props.href) {
    return (
      <a
        href={props.href}
        class={containerClass}
        style={props.accentColor ? { "border-color": props.accentColor } : undefined}
      >
        {content}
      </a>
    )
  }

  return (
    <div
      class={containerClass}
      style={props.accentColor ? { "border-color": props.accentColor } : undefined}
    >
      {content}
    </div>
  )
}

function formatMoveTypeLabel(type: string | null): string {
  const normalized = canonicalId(type ?? "")
  return normalized ? titleCaseFromId(normalized) : "Unknown"
}

function formatMoveCategory(category: string | null): string {
  const normalized = canonicalId(category ?? "")
  if (!normalized) {
    return "-"
  }

  return titleCaseFromId(normalized)
}

function formatMoveDamage(basePower: number | null, category: string | null): string {
  const normalizedCategory = canonicalId(category ?? "")

  if (typeof basePower !== "number" || !Number.isFinite(basePower) || basePower <= 0) {
    return normalizedCategory === "status" ? "-" : "Varies"
  }

  return String(basePower)
}

function formatMoveAccuracy(accuracy: number | null, alwaysHits: boolean): string {
  if (alwaysHits) {
    return "Always"
  }

  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) {
    return "-"
  }

  return `${accuracy}%`
}

function getLearnerEggGroups(learner: MoveLearnerEntryRecord["learners"][number]): string[] {
  return Array.isArray(learner.eggGroups)
    ? learner.eggGroups.filter((group): group is string => typeof group === "string")
    : []
}

function getLearnerLevelUpLevels(learner: MoveLearnerEntryRecord["learners"][number]): number[] {
  return Array.isArray(learner.levelUpLevels)
    ? learner.levelUpLevels
        .filter((level): level is number => typeof level === "number" && Number.isFinite(level))
        .sort((left, right) => left - right)
    : []
}

function formatLearnerMethodLabel(
  learner: MoveLearnerEntryRecord["learners"][number],
  method: MoveSourceType
): string {
  if (method !== "level") {
    return formatMoveSource(method, null)
  }

  const levels = getLearnerLevelUpLevels(learner)
  if (levels.length > 0) {
    return `Level ${levels.join(", ")}`
  }

  return "Level"
}

function resolveMoveLearnerSpriteForm(
  learner: MoveLearnerEntryRecord["learners"][number]
): { slug: string; name: string } | null {
  if (learner.baseAvailable || learner.forms.length === 0) {
    return null
  }

  const firstForm = learner.forms[0]
  if (!firstForm) {
    return null
  }

  return firstForm
}

function resolveMoveLearnerHref(learner: MoveLearnerEntryRecord["learners"][number]): string {
  if (learner.baseAvailable || learner.forms.length === 0) {
    return `/pokemon/${learner.slug}`
  }

  const primaryForm = learner.forms[0]
  if (!primaryForm) {
    return `/pokemon/${learner.slug}`
  }

  return `/pokemon/${learner.slug}?form=${encodeURIComponent(primaryForm.slug)}`
}

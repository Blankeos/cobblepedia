import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import type { MoveLearnerEntryRecord, MoveSourceType } from "@/data/cobblemon-types"
import { loadMoveLearners } from "@/data/data-loader"
import { canonicalId, formatMoveSource } from "@/data/formatters"
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

export default function Page() {
  const pageContext = usePageContext()
  const moveId = createMemo(() => canonicalId(String(pageContext.routeParams.moveId ?? "")))

  const [entry] = createResource(moveId, async (nextMoveId) => {
    if (!nextMoveId) {
      return null
    }

    const moveLearners = await loadMoveLearners()
    return moveLearners[nextMoveId] ?? null
  })

  useMetadata({
    title: getTitle("Move"),
  })

  return (
    <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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

    return props.entry.learners.filter((learner) => {
      if (method !== "all" && !learner.methods.includes(method as MoveSourceType)) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        learner.name.toLowerCase().includes(query) ||
        learner.slug.toLowerCase().includes(query) ||
        String(learner.dexNumber).includes(query)
      )
    })
  })

  return (
    <div class="space-y-6">
      <header class="border border-border bg-card p-6">
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
            placeholder="Filter Pokemon by name, slug, or dex..."
            value={search()}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
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
                {(learner) => (
                  <tr class="hover:bg-secondary/40">
                    <td class="px-4 py-2.5">
                      <a href={`/pokemon/${learner.slug}`} class="hover:underline">
                        #{String(learner.dexNumber).padStart(3, "0")} {learner.name}
                      </a>
                    </td>
                    <td class="px-4 py-2.5">
                      <div class="flex justify-end gap-1">
                        <For each={learner.methods}>
                          {(method) => (
                            <span class="border border-border bg-secondary px-2 py-0.5 text-muted-foreground text-xs">
                              {formatMoveSource(method, null)}
                            </span>
                          )}
                        </For>
                      </div>
                    </td>
                  </tr>
                )}
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

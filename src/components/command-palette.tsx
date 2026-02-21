import { useHotkeys } from "bagon-hooks"
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type {
  MoveLearnerEntryRecord,
  MoveLearnersIndex,
  MoveSourceType,
  PaletteResult,
  PokemonDetailRecord,
  PokemonListItem,
  QueryFacet,
  SearchDocument,
} from "@/data/cobblemon-types"
import {
  loadMoveLearners,
  loadPokemonDetail,
  loadPokemonList,
  loadSearchIndex,
} from "@/data/data-loader"
import {
  formatConditionChips,
  formatEggGroup,
  formatMoveSource,
  titleCaseFromId,
} from "@/data/formatters"
import { resolveQuery } from "@/data/query-engine"

const MOVE_TABS = ["all", "level", "egg", "tm", "tutor"] as const
type MoveTab = (typeof MOVE_TABS)[number]

export default function CommandPalette() {
  const [isOpen, setIsOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [activeIndex, setActiveIndex] = createSignal(0)

  const [searchIndex, setSearchIndex] = createSignal<SearchDocument[] | null>(null)
  const [pokemonList, setPokemonList] = createSignal<PokemonListItem[] | null>(null)
  const [moveLearners, setMoveLearners] = createSignal<MoveLearnersIndex | null>(null)
  const [loadError, setLoadError] = createSignal<string | null>(null)

  let dialogRef: HTMLDialogElement | undefined
  let inputRef: HTMLInputElement | undefined

  const dataReady = createMemo(() => {
    return searchIndex() !== null && pokemonList() !== null && moveLearners() !== null
  })

  const resolution = createMemo(() => {
    if (!dataReady()) {
      return {
        intent: "fuzzy-fallback" as const,
        normalizedQuery: "",
        results: [] as PaletteResult[],
      }
    }

    return resolveQuery(query(), searchIndex() ?? [], pokemonList() ?? [], moveLearners() ?? {})
  })

  const results = createMemo(() => resolution().results)
  const activeResult = createMemo(() => {
    const current = results()
    const index = activeIndex()
    if (current.length === 0) {
      return null
    }

    if (index < 0) {
      return current[0]
    }

    if (index >= current.length) {
      return current[current.length - 1]
    }

    return current[index]
  })

  const [activePokemonDetail] = createResource(
    () => activeResult()?.slug,
    async (slug) => {
      if (!slug) {
        return null
      }

      return loadPokemonDetail(slug)
    }
  )

  const activeMoveEntry = createMemo<MoveLearnerEntryRecord | null>(() => {
    const result = activeResult()
    const index = moveLearners()
    if (!result || result.type !== "move-learners" || !result.moveId || !index) {
      return null
    }

    return index[result.moveId] ?? null
  })

  createEffect(
    on(results, (nextResults) => {
      if (nextResults.length === 0) {
        setActiveIndex(0)
        return
      }

      if (activeIndex() >= nextResults.length) {
        setActiveIndex(0)
      }
    })
  )

  createEffect(
    on(query, () => {
      setActiveIndex(0)
    })
  )

  createEffect(() => {
    const dialog = dialogRef
    if (!dialog) {
      return
    }

    if (isOpen()) {
      if (!dialog.open) {
        dialog.showModal()
      }

      queueMicrotask(() => {
        inputRef?.focus()
        inputRef?.select()
      })
      return
    }

    if (dialog.open) {
      dialog.close()
    }
  })

  createEffect(() => {
    if (!isOpen() || dataReady()) {
      return
    }

    void Promise.all([loadSearchIndex(), loadPokemonList(), loadMoveLearners()])
      .then(([nextSearchIndex, nextPokemonList, nextMoveLearners]) => {
        setSearchIndex(nextSearchIndex)
        setPokemonList(nextPokemonList)
        setMoveLearners(nextMoveLearners)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load index"
        setLoadError(message)
      })
  })

  useHotkeys([
    [
      "meta+k",
      (event?: KeyboardEvent) => {
        event?.preventDefault()
        openPalette()
      },
    ],
    [
      "ctrl+k",
      (event?: KeyboardEvent) => {
        event?.preventDefault()
        openPalette()
      },
    ],
    [
      "escape",
      () => {
        closePalette()
      },
    ],
  ])

  onMount(() => {
    const onOpenPalette = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }

      openPalette(typeof event.detail === "string" ? event.detail : "")
    }

    window.addEventListener("cobblepedia:open-palette", onOpenPalette)
    onCleanup(() => {
      window.removeEventListener("cobblepedia:open-palette", onOpenPalette)
    })
  })

  function openPalette(nextQuery = "") {
    setIsOpen(true)
    setQuery(nextQuery)
  }

  function closePalette() {
    setIsOpen(false)
  }

  function executeResult(result: PaletteResult | null) {
    if (!result) {
      return
    }

    if (result.slug) {
      closePalette()
      window.location.assign(`/pokemon/${result.slug}`)
      return
    }

    if (result.type === "move-learners" && result.moveId) {
      const firstLearner = moveLearners()?.[result.moveId]?.learners[0]
      if (firstLearner) {
        closePalette()
        window.location.assign(`/pokemon/${firstLearner.slug}`)
      }
    }
  }

  function onQueryKeyDown(event: KeyboardEvent) {
    const currentResults = results()

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (currentResults.length > 0) {
        setActiveIndex((current) => Math.min(current + 1, currentResults.length - 1))
      }
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (currentResults.length > 0) {
        setActiveIndex((current) => Math.max(current - 1, 0))
      }
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      executeResult(activeResult())
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      closePalette()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      class="palette-dialog"
      aria-label="Cobblepedia command palette"
      onClose={closePalette}
      onCancel={(event) => {
        event.preventDefault()
        closePalette()
      }}
    >
      <div
        class="palette-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Cobblepedia command palette"
      >
        <Command>
          <CommandInput
            ref={inputRef}
            value={query()}
            onValueChange={setQuery}
            onKeyDown={onQueryKeyDown}
            placeholder="Try: lucario moves | lucario spawn | moves trickroom"
          />

          <div class="palette-main">
            <div class="palette-results">
              <Show
                when={!loadError()}
                fallback={<div class="palette-status">Failed to load index: {loadError()}</div>}
              >
                <Show
                  when={dataReady()}
                  fallback={<div class="palette-status">Loading search index...</div>}
                >
                  <CommandList>
                    <Show
                      when={results().length > 0}
                      fallback={
                        <CommandEmpty>Try `lucario evolution` or `moves trickroom`.</CommandEmpty>
                      }
                    >
                      <For each={results()}>
                        {(result, index) => (
                          <CommandItem
                            value={result.id}
                            classList={{ "is-active": index() === activeIndex() }}
                            onPointerMove={() => setActiveIndex(index())}
                            onClick={() => executeResult(result)}
                          >
                            <div class="command-item-content">
                              <div class="command-item-title">{result.title}</div>
                              <div class="command-item-subtitle">{result.subtitle}</div>
                            </div>
                          </CommandItem>
                        )}
                      </For>
                    </Show>
                  </CommandList>
                </Show>
              </Show>
            </div>

            <div class="palette-preview">
              <QuickviewPanel
                result={activeResult()}
                pokemonDetail={activePokemonDetail()}
                moveEntry={activeMoveEntry()}
                loadingPokemon={activePokemonDetail.loading}
              />
            </div>
          </div>

          <div class="palette-footer">
            <span>Enter to open Pokemon page</span>
            <span>Esc to close</span>
            <span>Cmd/Ctrl+K to open</span>
          </div>
        </Command>
      </div>
    </dialog>
  )
}

function QuickviewPanel(props: {
  result: PaletteResult | null
  pokemonDetail: PokemonDetailRecord | null | undefined
  moveEntry: MoveLearnerEntryRecord | null
  loadingPokemon: boolean
}) {
  return (
    <Show
      when={props.result}
      fallback={
        <div class="quickview-empty">
          <p>Quickview</p>
          <p>Type a query to preview details instantly.</p>
        </div>
      }
    >
      {(resultSignal) => {
        const result = createMemo(() => resultSignal())
        const facet = createMemo(() => resolveResultFacet(result()))

        return (
          <Switch>
            <Match when={result().type === "move-learners"}>
              <MoveLearnersQuickview entry={props.moveEntry} />
            </Match>

            <Match when={facet() === "moves"}>
              <MovesFacetQuickview detail={props.pokemonDetail} loading={props.loadingPokemon} />
            </Match>

            <Match when={facet() === "spawn"}>
              <SpawnFacetQuickview detail={props.pokemonDetail} loading={props.loadingPokemon} />
            </Match>

            <Match when={facet() === "evolution"}>
              <EvolutionFacetQuickview
                detail={props.pokemonDetail}
                loading={props.loadingPokemon}
              />
            </Match>

            <Match when={facet() === "egg-group"}>
              <EggGroupFacetQuickview detail={props.pokemonDetail} loading={props.loadingPokemon} />
            </Match>

            <Match when={true}>
              <PokemonOverviewQuickview
                detail={props.pokemonDetail}
                loading={props.loadingPokemon}
              />
            </Match>
          </Switch>
        )
      }}
    </Show>
  )
}

function PokemonOverviewQuickview(props: {
  detail: PokemonDetailRecord | null | undefined
  loading: boolean
}) {
  return (
    <Show
      when={!props.loading}
      fallback={<div class="quickview-status">Loading Pokemon details...</div>}
    >
      <Show
        when={props.detail}
        fallback={<div class="quickview-status">Pokemon details unavailable.</div>}
      >
        {(detailSignal) => {
          const detail = detailSignal()
          const nextEvolutions = detail.evolutions
            .map((edge) => titleCaseFromId(edge.result.slug))
            .filter(Boolean)
          const spawnHints = detail.spawnEntries.slice(0, 3)

          return (
            <div class="quickview-stack">
              <div class="quickview-header">
                <h3>
                  {detail.name} <span>#{detail.dexNumber}</span>
                </h3>
                <p>{detail.types.map((type) => titleCaseFromId(type)).join(" / ")}</p>
              </div>

              <section>
                <h4>Abilities</h4>
                <div class="chip-row">
                  <For each={detail.abilities}>
                    {(ability) => (
                      <span class="chip">
                        {ability.hidden ? `${ability.label} (Hidden)` : ability.label}
                      </span>
                    )}
                  </For>
                </div>
              </section>

              <section>
                <h4>Egg Groups</h4>
                <div class="chip-row">
                  <For each={detail.eggGroups}>
                    {(group) => <span class="chip">{formatEggGroup(group)}</span>}
                  </For>
                </div>
              </section>

              <section>
                <h4>Evolution</h4>
                <p>
                  Pre: {detail.preEvolution ? titleCaseFromId(detail.preEvolution.slug) : "None"} ·
                  Next: {nextEvolutions.length > 0 ? nextEvolutions.join(", ") : "None"}
                </p>
              </section>

              <section>
                <h4>Spawn Summary</h4>
                <Show
                  when={spawnHints.length > 0}
                  fallback={<p>No spawn entries available for this snapshot.</p>}
                >
                  <For each={spawnHints}>
                    {(entry) => (
                      <p>
                        {titleCaseFromId(entry.bucket)} · {entry.levelText ?? "-"} ·{" "}
                        {titleCaseFromId(entry.spawnablePositionType)}
                      </p>
                    )}
                  </For>
                </Show>
              </section>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}

function EggGroupFacetQuickview(props: {
  detail: PokemonDetailRecord | null | undefined
  loading: boolean
}) {
  return (
    <Show
      when={!props.loading}
      fallback={<div class="quickview-status">Loading egg groups...</div>}
    >
      <Show
        when={props.detail}
        fallback={<div class="quickview-status">Pokemon details unavailable.</div>}
      >
        {(detailSignal) => {
          const detail = detailSignal()
          return (
            <div class="quickview-stack">
              <div class="quickview-header">
                <h3>{detail.name} Egg Groups</h3>
                <p>Breeding categories for this species.</p>
              </div>

              <div class="chip-row">
                <For each={detail.eggGroups}>
                  {(group) => <span class="chip">{formatEggGroup(group)}</span>}
                </For>
              </div>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}

function MovesFacetQuickview(props: {
  detail: PokemonDetailRecord | null | undefined
  loading: boolean
}) {
  const [activeTab, setActiveTab] = createSignal<MoveTab>("all")
  const [moveQuery, setMoveQuery] = createSignal("")

  const counts = createMemo(() => {
    const detail = props.detail
    if (!detail) {
      return {
        all: 0,
        level: 0,
        egg: 0,
        tm: 0,
        tutor: 0,
      }
    }

    return {
      all: detail.moves.length,
      level: detail.moves.filter((move) => move.sourceType === "level").length,
      egg: detail.moves.filter((move) => move.sourceType === "egg").length,
      tm: detail.moves.filter((move) => move.sourceType === "tm").length,
      tutor: detail.moves.filter((move) => move.sourceType === "tutor").length,
    }
  })

  const filteredMoves = createMemo(() => {
    const detail = props.detail
    if (!detail) {
      return []
    }

    const tab = activeTab()
    const normalizedMoveQuery = moveQuery().toLowerCase().trim()

    return detail.moves
      .filter((move) => {
        if (tab !== "all" && move.sourceType !== tab) {
          return false
        }

        if (!normalizedMoveQuery) {
          return true
        }

        const target = `${move.moveName} ${move.moveId}`.toLowerCase()
        return target.includes(normalizedMoveQuery)
      })
      .slice(0, 40)
  })

  return (
    <Show when={!props.loading} fallback={<div class="quickview-status">Loading move list...</div>}>
      <Show
        when={props.detail}
        fallback={<div class="quickview-status">Pokemon details unavailable.</div>}
      >
        {(detailSignal) => {
          const detail = detailSignal()

          return (
            <div class="quickview-stack">
              <div class="quickview-header">
                <h3>{detail.name} Moves</h3>
                <p>Filter by source and search inside move names.</p>
              </div>

              <div class="chip-row" role="tablist" aria-label="Move source tabs">
                <For each={MOVE_TABS}>
                  {(tab) => (
                    <button
                      type="button"
                      role="tab"
                      classList={{
                        chip: true,
                        "chip-active": activeTab() === tab,
                      }}
                      aria-selected={activeTab() === tab}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "all" ? "All" : titleCaseFromId(tab)} ({counts()[tab]})
                    </button>
                  )}
                </For>
              </div>

              <input
                class="quickview-input"
                value={moveQuery()}
                onInput={(event) => setMoveQuery(event.currentTarget.value)}
                placeholder="Search move names"
              />

              <ul class="quickview-list">
                <For each={filteredMoves()}>
                  {(move) => (
                    <li>
                      <span>{move.moveName}</span>
                      <span>{formatMoveSource(move.sourceType, move.sourceValue)}</span>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}

function SpawnFacetQuickview(props: {
  detail: PokemonDetailRecord | null | undefined
  loading: boolean
}) {
  return (
    <Show
      when={!props.loading}
      fallback={<div class="quickview-status">Loading spawn rows...</div>}
    >
      <Show
        when={props.detail}
        fallback={<div class="quickview-status">Pokemon details unavailable.</div>}
      >
        {(detailSignal) => {
          const detail = detailSignal()
          return (
            <div class="quickview-stack">
              <div class="quickview-header">
                <h3>{detail.name} Spawn</h3>
                <p>Bucket, level, position, and condition highlights.</p>
              </div>

              <Show
                when={detail.spawnEntries.length > 0}
                fallback={<div class="quickview-status">No spawn entries for this species.</div>}
              >
                <ul class="quickview-list quickview-list-spawns">
                  <For each={detail.spawnEntries.slice(0, 16)}>
                    {(entry) => (
                      <li>
                        <div>
                          <strong>{titleCaseFromId(entry.bucket)}</strong>
                          <span>
                            {entry.levelText ?? "-"} ·{" "}
                            {titleCaseFromId(entry.spawnablePositionType)}
                          </span>
                        </div>
                        <div class="chip-row">
                          <For each={formatConditionChips(entry.condition).slice(0, 3)}>
                            {(chip) => <span class="chip">{chip}</span>}
                          </For>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}

function EvolutionFacetQuickview(props: {
  detail: PokemonDetailRecord | null | undefined
  loading: boolean
}) {
  return (
    <Show
      when={!props.loading}
      fallback={<div class="quickview-status">Loading evolution family...</div>}
    >
      <Show
        when={props.detail}
        fallback={<div class="quickview-status">Pokemon details unavailable.</div>}
      >
        {(detailSignal) => {
          const detail = detailSignal()
          const family = detail.evolutionFamily

          return (
            <div class="quickview-stack">
              <div class="quickview-header">
                <h3>{detail.name} Evolution</h3>
                <p>Full family edges and readable requirements.</p>
              </div>

              <div class="chip-row">
                <For each={family.members}>
                  {(member) => <span class="chip">{member.name}</span>}
                </For>
              </div>

              <ul class="quickview-list">
                <For each={family.edges}>
                  {(edge) => (
                    <li>
                      <div>
                        <strong>
                          {titleCaseFromId(edge.fromSlug)} {" -> "} {titleCaseFromId(edge.toSlug)}
                        </strong>
                        <span>{titleCaseFromId(edge.method)}</span>
                      </div>
                      <Show when={edge.requirementText.length > 0}>
                        <div class="chip-row">
                          <For each={edge.requirementText}>
                            {(text) => <span class="chip">{text}</span>}
                          </For>
                        </div>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}

function MoveLearnersQuickview(props: { entry: MoveLearnerEntryRecord | null }) {
  return (
    <Show
      when={props.entry}
      fallback={<div class="quickview-status">Move details unavailable.</div>}
    >
      {(entrySignal) => {
        const entry = entrySignal()
        return (
          <div class="quickview-stack">
            <div class="quickview-header">
              <h3>{entry.moveName}</h3>
              <p>{entry.learners.length} Pokemon can learn this move.</p>
            </div>

            <ul class="quickview-list">
              <For each={entry.learners.slice(0, 30)}>
                {(learner) => (
                  <li>
                    <a href={`/pokemon/${learner.slug}`}>{learner.name}</a>
                    <span>{learner.methods.map((method) => sourceLabel(method)).join(", ")}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )
      }}
    </Show>
  )
}

function sourceLabel(sourceType: MoveSourceType): string {
  return formatMoveSource(sourceType, null)
}

function resolveResultFacet(result: PaletteResult): QueryFacet | null {
  if (result.facet) {
    return result.facet
  }

  const subtitle = result.subtitle.toLowerCase()
  if (subtitle.includes("egg groups")) {
    return "egg-group"
  }
  if (subtitle.includes("moves")) {
    return "moves"
  }
  if (subtitle.includes("spawn")) {
    return "spawn"
  }
  if (subtitle.includes("evolution")) {
    return "evolution"
  }

  return null
}

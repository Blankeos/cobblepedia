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
import { navigate } from "vike/client/router"
import { ItemSprite } from "@/components/item-sprite"
import { PokemonSprite } from "@/components/pokemon-sprite"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type {
  AbilityEntryRecord,
  AbilityIndex,
  ItemEntryRecord,
  ItemIndex,
  MoveLearnerEntryRecord,
  MoveSourceType,
  PaletteResult,
  PokemonDetailRecord,
  PokemonListItem,
  PokemonTypeEntryRecord,
  QueryFacet,
  QueryResolution,
  SearchDocument,
} from "@/data/cobblemon-types"
import {
  loadAbilityIndex,
  loadItemIndex,
  loadMoveLearnerEntry,
  loadPokemonDetail,
  loadPokemonList,
  loadPokemonTypeEntries,
  loadSearchIndex,
} from "@/data/data-loader"
import {
  formatConditionChips,
  formatEggGroup,
  formatMoveSource,
  sortMovesForTab,
  titleCaseFromId,
} from "@/data/formatters"
import { createPaletteFlexSearch } from "@/data/palette-flex-search"
import { resolveQuery } from "@/data/query-engine"
import { cn } from "@/utils/cn"

const MOVE_TABS = ["all", "level", "egg", "tm", "tutor"] as const
type MoveTab = (typeof MOVE_TABS)[number]

const PRIMARY_PAGES: Array<{
  id: string
  title: string
  subtitle: string
  url: string
  icon: string
  image?: string
}> = [
  {
    id: "page:pokemon",
    title: "Pokemon",
    subtitle: "List Pokemon directly in the command palette",
    url: "/",
    icon: "PK",
  },
  {
    id: "page:rideable",
    title: "Rideable Mons",
    subtitle: "Browse Pokemon that can be ridden",
    url: "/rideable-mons",
    icon: "RI",
    image: "/imgs/rideable-mons.jpg",
  },
  {
    id: "page:types",
    title: "Types",
    subtitle: "Explore type matchups and effectiveness",
    url: "/types",
    icon: "TY",
  },
  {
    id: "page:egg-groups",
    title: "Egg Groups",
    subtitle: "Explore breeding compatibility",
    url: "/egg-groups",
    icon: "EG",
    image: "/imgs/egggroups.jpg",
  },
]

export default function CommandPalette() {
  const [isOpen, setIsOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [selectedResultId, setSelectedResultId] = createSignal("")
  const [activePrimaryPageId, setActivePrimaryPageId] = createSignal<string | null>(null)

  const [searchIndex, setSearchIndex] = createSignal<SearchDocument[] | null>(null)
  const [pokemonList, setPokemonList] = createSignal<PokemonListItem[] | null>(null)
  const [pokemonTypeEntries, setPokemonTypeEntries] = createSignal<PokemonTypeEntryRecord[] | null>(
    null
  )
  const [abilityIndex, setAbilityIndex] = createSignal<AbilityIndex | null>(null)
  const [itemIndex, setItemIndex] = createSignal<ItemIndex | null>(null)
  const [loadError, setLoadError] = createSignal<string | null>(null)

  let inputRef: HTMLInputElement | undefined

  const dataReady = createMemo(() => {
    return (
      searchIndex() !== null &&
      pokemonList() !== null &&
      pokemonTypeEntries() !== null &&
      abilityIndex() !== null &&
      itemIndex() !== null
    )
  })

  const primaryPageResults = createMemo((): PaletteResult[] => {
    const currentQuery = query().trim().toLowerCase()

    // Show primary pages when query is empty or starts with > or /
    if (!currentQuery || currentQuery.startsWith(">") || currentQuery.startsWith("/")) {
      const searchTerm = currentQuery.replace(/^[>/]/, "").trim()

      return PRIMARY_PAGES.filter((page) => {
        if (!searchTerm) return true
        return (
          page.title.toLowerCase().includes(searchTerm) ||
          page.subtitle.toLowerCase().includes(searchTerm) ||
          page.id.toLowerCase().includes(searchTerm)
        )
      }).map((page) => ({
        id: page.id,
        type: "primary-page" as const,
        title: page.title,
        subtitle: page.subtitle,
        slug: null,
        moveId: null,
        facet: null,
        score: 1000,
        url: page.url,
      }))
    }

    return []
  })

  const isShowingPrimaryPagesOnly = createMemo(() => {
    const currentQuery = query().trim()

    if (currentQuery.startsWith("/") || currentQuery.startsWith(">")) {
      return true
    }

    if (activePrimaryPageId() === "page:pokemon") {
      return false
    }

    return !currentQuery
  })

  const pokemonPrimaryResults = createMemo((): PaletteResult[] => {
    if (activePrimaryPageId() !== "page:pokemon") {
      return []
    }

    const list = pokemonList() ?? []
    const searchTerm = query().trim().toLowerCase()

    if (searchTerm.startsWith("/") || searchTerm.startsWith(">")) {
      return []
    }

    return list
      .filter((pokemon) => pokemon.implemented)
      .filter((pokemon) => {
        if (!searchTerm) {
          return true
        }

        const target = `${pokemon.name} ${pokemon.slug} ${pokemon.aliases.join(" ")}`.toLowerCase()
        return target.includes(searchTerm)
      })
      .sort((left, right) => {
        if (left.dexNumber !== right.dexNumber) {
          return left.dexNumber - right.dexNumber
        }

        return left.name.localeCompare(right.name)
      })
      .slice(0, 90)
      .map((pokemon) => {
        const pokemonTypes = pokemon.types.map((type) => titleCaseFromId(type)).join(" / ")

        return {
          id: `pokemon-overview:${pokemon.slug}`,
          type: "pokemon-overview" as const,
          title: pokemon.name,
          subtitle: pokemonTypes
            ? `#${pokemon.dexNumber} ${pokemonTypes}`
            : `#${pokemon.dexNumber}`,
          slug: pokemon.slug,
          moveId: null,
          facet: null,
          score: 1000 - pokemon.dexNumber,
        }
      })
  })

  const flexSearch = createMemo(() => {
    const docs = searchIndex()
    const list = pokemonList()
    const typeEntries = pokemonTypeEntries()
    const abilities = abilityIndex()
    const items = itemIndex()

    if (!docs || !list || !typeEntries || !abilities || !items) {
      return null
    }

    const moveSearchDocs = docs.filter((doc) => {
      return doc.resultType === "move-learners" && doc.moveId !== null
    })

    return createPaletteFlexSearch({
      pokemonList: list,
      pokemonTypeEntries: typeEntries,
      moveSearchDocs,
      abilityIndex: abilities,
      itemIndex: items,
    })
  })

  const resolution = createMemo<QueryResolution>(() => {
    const currentQuery = query().trim()
    const primaryPages = primaryPageResults()

    if (activePrimaryPageId() === "page:pokemon" && !isShowingPrimaryPagesOnly()) {
      return {
        intent: "pokemon-overview" as const,
        normalizedQuery: currentQuery,
        results: pokemonPrimaryResults(),
      }
    }

    // When showing primary pages only, don't include search results
    if (isShowingPrimaryPagesOnly()) {
      return {
        intent: "primary-pages" as const,
        normalizedQuery: currentQuery.replace(/^[>/]/, "").trim(),
        results: primaryPages,
      }
    }

    if (!dataReady()) {
      return {
        intent: "fuzzy-fallback" as const,
        normalizedQuery: "",
        results: [],
      }
    }

    const parserResolution = resolveQuery(query(), searchIndex() ?? [], pokemonList() ?? [])

    const entityResults = flexSearch()?.search(currentQuery, 90) ?? []

    const parserResults =
      parserResolution.intent === "pokemon-facet" || parserResolution.intent === "move-learners"
        ? parserResolution.results.map((result) => ({
            ...result,
            score: result.score + 500,
          }))
        : entityResults.length === 0
          ? parserResolution.results
          : []

    const mergedResults = mergeResultsById([...parserResults, ...entityResults], 90)

    if (mergedResults.length > 0) {
      return {
        intent: "mixed-search" as const,
        normalizedQuery: currentQuery,
        results: mergedResults,
      }
    }

    return parserResolution
  })

  const results = createMemo(() => resolution().results)
  const groupedResults = createMemo(() => groupPaletteResults(results()))
  const pokemonDexBySlug = createMemo(() => {
    const map = new Map<string, number>()

    for (const pokemon of pokemonList() ?? []) {
      map.set(pokemon.slug, pokemon.dexNumber)
    }

    return map
  })

  const itemAssetPathById = createMemo(() => {
    const map = new Map<string, string>()

    for (const item of Object.values(itemIndex() ?? {})) {
      if (item.assetPath) {
        map.set(item.itemId, item.assetPath)
      }
    }

    return map
  })

  const activeResult = createMemo(() => {
    const current = results()
    if (current.length === 0) {
      return null
    }

    const selectedId = selectedResultId()
    if (selectedId) {
      const selectedResult = current.find((result) => result.id === selectedId)
      if (selectedResult) {
        return selectedResult
      }
    }

    return current[0]
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

  const [activeMoveEntry] = createResource(
    () => {
      const result = activeResult()
      if (!result || result.type !== "move-learners" || !result.moveId) {
        return null
      }

      return result.moveId
    },
    async (moveId) => {
      if (!moveId) {
        return null
      }

      return loadMoveLearnerEntry(moveId)
    }
  )

  const activeAbilityEntry = createMemo<AbilityEntryRecord | null>(() => {
    const result = activeResult()
    const index = abilityIndex()

    if (!result || result.type !== "ability-entry" || !result.abilityId || !index) {
      return null
    }

    return index[result.abilityId] ?? null
  })

  const activeItemEntry = createMemo<ItemEntryRecord | null>(() => {
    const result = activeResult()
    const index = itemIndex()

    if (!result || result.type !== "item-entry" || !result.itemId || !index) {
      return null
    }

    return index[result.itemId] ?? null
  })

  createEffect(
    on(results, (nextResults) => {
      if (nextResults.length === 0) {
        setSelectedResultId("")
        return
      }

      const currentSelection = selectedResultId()
      if (!nextResults.some((result) => result.id === currentSelection)) {
        setSelectedResultId(nextResults[0]?.id ?? "")
      }
    })
  )

  createEffect(
    on(query, (nextQuery) => {
      const normalized = nextQuery.trim()
      if (normalized.startsWith("/") || normalized.startsWith(">")) {
        setActivePrimaryPageId(null)
      }
    })
  )

  createEffect(() => {
    if (!isOpen() || dataReady()) {
      return
    }

    void Promise.all([
      loadSearchIndex(),
      loadPokemonList(),
      loadPokemonTypeEntries(),
      loadAbilityIndex(),
      loadItemIndex(),
    ])
      .then(
        ([
          nextSearchIndex,
          nextPokemonList,
          nextPokemonTypeEntries,
          nextAbilityIndex,
          nextItemIndex,
        ]) => {
          setSearchIndex(nextSearchIndex)
          setPokemonList(nextPokemonList)
          setPokemonTypeEntries(nextPokemonTypeEntries)
          setAbilityIndex(nextAbilityIndex)
          setItemIndex(nextItemIndex)
        }
      )
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to load index"
        setLoadError(message)
      })
  })

  // Focus input when dialog opens
  createEffect(() => {
    if (isOpen()) {
      queueMicrotask(() => {
        inputRef?.focus()
        inputRef?.select()
      })
    }
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
    setSelectedResultId("")
    setActivePrimaryPageId(null)
  }

  function closePalette() {
    setIsOpen(false)
    setQuery("")
    setSelectedResultId("")
    setActivePrimaryPageId(null)
  }

  function executeResult(result: PaletteResult | null, openInNewTab = false) {
    if (!result) {
      return
    }

    if (result.type === "primary-page" && result.id === "page:pokemon") {
      setActivePrimaryPageId("page:pokemon")
      setQuery("")
      setSelectedResultId("")
      return
    }

    const navigateTo = (url: string) => {
      if (openInNewTab) {
        window.open(url, "_blank")
      } else {
        void navigate(url)
      }
    }

    if (result.url) {
      closePalette()
      navigateTo(result.url)
      return
    }

    if (result.slug) {
      closePalette()
      navigateTo(`/pokemon/${result.slug}`)
      return
    }

    if (result.type === "move-learners" && result.moveId) {
      closePalette()
      navigateTo(`/moves/${result.moveId}`)
    }
  }

  function onCommandKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault()
      const result = activeResult()
      if (result) {
        executeResult(result, event.shiftKey)
      }
      return
    }
  }

  return (
    <CommandDialog
      open={isOpen()}
      value={selectedResultId()}
      onValueChange={setSelectedResultId}
      onKeyDown={onCommandKeyDown}
      onOpenChange={(open) => {
        if (!open) closePalette()
      }}
      shouldFilter={false}
      class="!max-w-[900px] !w-[90vw] !p-0 !overflow-hidden"
    >
      <div class="flex flex-col bg-card">
        <CommandInput
          ref={inputRef}
          value={query()}
          onValueChange={setQuery}
          placeholder="Search Pokemon, moves, abilities, items, types, egg groups..."
        />

        <div class="grid h-[500px] min-h-[400px] grid-cols-[280px_1fr] overflow-hidden">
          <div class="min-h-0 overflow-hidden border-border border-r">
            <Show
              when={!loadError()}
              fallback={
                <div class="p-12 text-center text-muted-foreground text-sm">
                  Failed to load index: {loadError()}
                </div>
              }
            >
              <Show
                when={isShowingPrimaryPagesOnly() || dataReady()}
                fallback={
                  <div class="p-12 text-center text-muted-foreground text-sm">
                    Loading search index...
                  </div>
                }
              >
                <CommandList class="h-full max-h-none min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-0">
                  <Show
                    when={results().length > 0}
                    fallback={
                      <CommandEmpty class="py-6 text-center text-sm">
                        {isShowingPrimaryPagesOnly()
                          ? "No pages found. Try a different search."
                          : activePrimaryPageId() === "page:pokemon"
                            ? "No Pokemon found. Try another name."
                            : "Try `lucario evolution` or `moves trickroom`."}
                      </CommandEmpty>
                    }
                  >
                    <For each={groupedResults()}>
                      {(group) => (
                        <CommandGroup heading={group.heading}>
                          <For each={group.results}>
                            {(result) => (
                              <CommandItem
                                value={result.id}
                                class={cn(
                                  "flex cursor-pointer items-center gap-2 border-transparent border-l-2 p-3 transition-colors aria-selected:border-l-foreground aria-selected:bg-secondary aria-selected:text-foreground"
                                )}
                                onSelect={() => {
                                  executeResult(result)
                                }}
                              >
                                <Show
                                  when={
                                    result.type === "item-entry" ? (result.itemId ?? null) : null
                                  }
                                  fallback={
                                    <Show
                                      when={
                                        result.slug
                                          ? (pokemonDexBySlug().get(result.slug) ?? null)
                                          : null
                                      }
                                      fallback={<PrimaryPageIcon result={result} />}
                                    >
                                      {(dexNumber) => (
                                        <PokemonSprite
                                          dexNumber={dexNumber()}
                                          slug={result.slug ?? undefined}
                                          formSlug={result.formSlug ?? null}
                                          formName={result.formName ?? null}
                                          name={result.title}
                                          class="h-10 w-10"
                                          imageClass="h-7 w-7"
                                        />
                                      )}
                                    </Show>
                                  }
                                >
                                  {(itemId) => (
                                    <div class="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-secondary/40">
                                      <ItemSprite
                                        itemId={itemId()}
                                        name={result.title}
                                        assetPath={itemAssetPathById().get(itemId()) ?? null}
                                        class="h-7 w-7"
                                      />
                                    </div>
                                  )}
                                </Show>

                                <div class="min-w-0">
                                  <div class="truncate font-medium text-sm">{result.title}</div>
                                  <div class="truncate text-muted-foreground text-xs">
                                    {result.subtitle}
                                  </div>
                                </div>
                              </CommandItem>
                            )}
                          </For>
                        </CommandGroup>
                      )}
                    </For>
                  </Show>
                </CommandList>
              </Show>
            </Show>
          </div>

          <div class="hidden min-h-0 overflow-y-auto p-5 lg:block">
            <QuickviewPanel
              result={activeResult()}
              pokemonDetail={activePokemonDetail()}
              moveEntry={activeMoveEntry() ?? null}
              abilityEntry={activeAbilityEntry()}
              itemEntry={activeItemEntry()}
              pokemonList={pokemonList()}
              loadingPokemon={activePokemonDetail.loading}
              loadingMove={activeMoveEntry.loading}
            />
          </div>
        </div>

        <div class="flex items-center justify-between border-border border-t bg-secondary px-5 py-3">
          <span class="text-muted-foreground text-xs">Enter to open · / or &gt; for pages</span>
          <span class="text-muted-foreground text-xs">Esc to close</span>
        </div>
      </div>
    </CommandDialog>
  )
}

function QuickviewPanel(props: {
  result: PaletteResult | null
  pokemonDetail: PokemonDetailRecord | null | undefined
  moveEntry: MoveLearnerEntryRecord | null
  abilityEntry: AbilityEntryRecord | null
  itemEntry: ItemEntryRecord | null
  pokemonList: PokemonListItem[] | null
  loadingPokemon: boolean
  loadingMove: boolean
}) {
  return (
    <Show
      when={props.result}
      fallback={
        <div class="flex h-full flex-col items-center justify-center gap-2 border border-border border-dashed p-10 text-center text-muted-foreground">
          <p class="font-medium text-foreground">Quickview</p>
          <p class="text-sm">Type to preview details.</p>
        </div>
      }
    >
      {(resultSignal) => {
        const result = createMemo(() => resultSignal())
        const facet = createMemo(() => resolveResultFacet(result()))

        return (
          <Switch>
            <Match when={result().type === "primary-page"}>
              <PrimaryPageQuickview result={result()} />
            </Match>

            <Match when={result().type === "move-learners"}>
              <MoveLearnersQuickview entry={props.moveEntry} loading={props.loadingMove} />
            </Match>

            <Match when={result().type === "ability-entry"}>
              <AbilityEntryQuickview entry={props.abilityEntry} />
            </Match>

            <Match when={result().type === "item-entry"}>
              <ItemEntryQuickview entry={props.itemEntry} />
            </Match>

            <Match when={result().type === "type-entry"}>
              <TypeEntryQuickview result={result()} pokemonList={props.pokemonList} />
            </Match>

            <Match when={result().type === "egg-group-entry"}>
              <EggGroupEntryQuickview result={result()} pokemonList={props.pokemonList} />
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
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">Loading Pokemon details...</div>
      }
    >
      <Show
        when={props.detail}
        fallback={
          <div class="p-12 text-center text-muted-foreground text-sm">
            Pokemon details unavailable.
          </div>
        }
      >
        {(detailSignal) => {
          const detail = detailSignal()
          const nextEvolutions = detail.evolutions
            .map((edge) => titleCaseFromId(edge.result.slug))
            .filter(Boolean)
          const spawnHints = detail.spawnEntries.slice(0, 3)

          return (
            <div class="flex flex-col gap-6">
              <div class="border-border border-b pb-4">
                <h3 class="mb-1 font-semibold text-lg">
                  {detail.name}{" "}
                  <span class="font-normal text-muted-foreground">#{detail.dexNumber}</span>
                </h3>
                <p class="text-muted-foreground text-sm">
                  {detail.types.map((type) => titleCaseFromId(type)).join(" / ")}
                </p>
              </div>

              <div>
                <h4 class="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Abilities
                </h4>
                <div class="flex flex-wrap gap-2">
                  <For each={detail.abilities}>
                    {(ability) => (
                      <span class="border border-border bg-secondary px-2.5 py-1 text-xs">
                        {ability.hidden ? `${ability.label} (Hidden)` : ability.label}
                      </span>
                    )}
                  </For>
                </div>
              </div>

              <div>
                <h4 class="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Egg Groups
                </h4>
                <div class="flex flex-wrap gap-2">
                  <For each={detail.eggGroups}>
                    {(group) => (
                      <span class="border border-border bg-secondary px-2.5 py-1 text-xs">
                        {formatEggGroup(group)}
                      </span>
                    )}
                  </For>
                </div>
              </div>

              <div>
                <h4 class="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Evolution
                </h4>
                <p class="text-muted-foreground text-sm">
                  Pre: {detail.preEvolution ? titleCaseFromId(detail.preEvolution.slug) : "None"} ·
                  Next: {nextEvolutions.length > 0 ? nextEvolutions.join(", ") : "None"}
                </p>
              </div>

              <div>
                <h4 class="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  Spawn Summary
                </h4>
                <Show
                  when={spawnHints.length > 0}
                  fallback={
                    <p class="text-muted-foreground text-sm">
                      No spawn entries available for this snapshot.
                    </p>
                  }
                >
                  <div class="space-y-1">
                    <For each={spawnHints}>
                      {(entry) => (
                        <p class="text-muted-foreground text-sm">
                          {titleCaseFromId(entry.bucket)} · {entry.levelText ?? "-"} ·{" "}
                          {titleCaseFromId(entry.spawnablePositionType)}
                        </p>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
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
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">Loading egg groups...</div>
      }
    >
      <Show
        when={props.detail}
        fallback={
          <div class="p-12 text-center text-muted-foreground text-sm">
            Pokemon details unavailable.
          </div>
        }
      >
        {(detailSignal) => {
          const detail = detailSignal()
          return (
            <div class="flex flex-col gap-6">
              <div class="border-border border-b pb-4">
                <h3 class="mb-1 font-semibold text-lg">{detail.name} Egg Groups</h3>
                <p class="text-muted-foreground text-sm">Breeding categories for this species.</p>
              </div>

              <div class="flex flex-wrap gap-2">
                <For each={detail.eggGroups}>
                  {(group) => (
                    <span class="border border-border bg-secondary px-2.5 py-1 text-sm">
                      {formatEggGroup(group)}
                    </span>
                  )}
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

    return sortMovesForTab(
      detail.moves.filter((move) => {
        if (tab !== "all" && move.sourceType !== tab) {
          return false
        }

        if (!normalizedMoveQuery) {
          return true
        }

        const target = `${move.moveName} ${move.moveId}`.toLowerCase()
        return target.includes(normalizedMoveQuery)
      }),
      tab
    ).slice(0, 40)
  })

  return (
    <Show
      when={!props.loading}
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">Loading move list...</div>
      }
    >
      <Show
        when={props.detail}
        fallback={
          <div class="p-12 text-center text-muted-foreground text-sm">
            Pokemon details unavailable.
          </div>
        }
      >
        {(detailSignal) => {
          const detail = detailSignal()

          return (
            <div class="flex flex-col gap-5">
              <div class="border-border border-b pb-4">
                <h3 class="mb-1 font-semibold text-lg">{detail.name} Moves</h3>
                <p class="text-muted-foreground text-sm">
                  Filter by source and search inside move names.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <For each={MOVE_TABS}>
                  {(tab) => (
                    <button
                      type="button"
                      role="tab"
                      class={cn(
                        "border px-2.5 py-1 text-xs transition-colors",
                        activeTab() === tab
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-secondary hover:border-muted-foreground"
                      )}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === "all" ? "All" : titleCaseFromId(tab)} ({counts()[tab]})
                    </button>
                  )}
                </For>
              </div>

              <input
                class="w-full border border-border bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
                value={moveQuery()}
                onInput={(event) => setMoveQuery(event.currentTarget.value)}
                placeholder="Search move names"
              />

              <div class="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
                <For each={filteredMoves()}>
                  {(move) => (
                    <div class="flex items-center justify-between border-border border-b py-2 last:border-0">
                      <span class="text-sm">{move.moveName}</span>
                      <span class="text-muted-foreground text-xs">
                        {formatMoveSource(move.sourceType, move.sourceValue)}
                      </span>
                    </div>
                  )}
                </For>
              </div>
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
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">Loading spawn rows...</div>
      }
    >
      <Show
        when={props.detail}
        fallback={
          <div class="p-12 text-center text-muted-foreground text-sm">
            Pokemon details unavailable.
          </div>
        }
      >
        {(detailSignal) => {
          const detail = detailSignal()
          return (
            <div class="flex flex-col gap-5">
              <div class="border-border border-b pb-4">
                <h3 class="mb-1 font-semibold text-lg">{detail.name} Spawn</h3>
                <p class="text-muted-foreground text-sm">
                  Bucket, level, position, and condition highlights.
                </p>
              </div>

              <Show
                when={detail.spawnEntries.length > 0}
                fallback={
                  <div class="p-12 text-center text-muted-foreground text-sm">
                    No spawn entries for this species.
                  </div>
                }
              >
                <div class="flex max-h-[400px] flex-col gap-3 overflow-y-auto">
                  <For each={detail.spawnEntries.slice(0, 16)}>
                    {(entry) => (
                      <div class="border-border border-b py-3 last:border-0">
                        <div class="mb-2 flex items-center justify-between">
                          <span class="font-medium">{titleCaseFromId(entry.bucket)}</span>
                          <span class="text-muted-foreground text-sm">
                            {entry.levelText ?? "-"} ·{" "}
                            {titleCaseFromId(entry.spawnablePositionType)}
                          </span>
                        </div>
                        <div class="flex flex-wrap gap-1">
                          <For each={formatConditionChips(entry.condition).slice(0, 3)}>
                            {(chip) => (
                              <span class="border border-border bg-secondary px-2 py-0.5 text-xs">
                                {chip}
                              </span>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
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
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">
          Loading evolution family...
        </div>
      }
    >
      <Show
        when={props.detail}
        fallback={
          <div class="p-12 text-center text-muted-foreground text-sm">
            Pokemon details unavailable.
          </div>
        }
      >
        {(detailSignal) => {
          const detail = detailSignal()
          const family = detail.evolutionFamily
          const memberByNodeId = new Map(family.members.map((member) => [member.nodeId, member]))

          return (
            <div class="flex flex-col gap-5">
              <div class="border-border border-b pb-4">
                <h3 class="mb-1 font-semibold text-lg">{detail.name} Evolution</h3>
                <p class="text-muted-foreground text-sm">
                  Full family edges and readable requirements.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <For each={family.members}>
                  {(member) => (
                    <span class="border border-border bg-secondary px-2.5 py-1 text-sm">
                      {formatEvolutionFamilyMemberLabel(member, member.slug)}
                    </span>
                  )}
                </For>
              </div>

              <div class="flex max-h-[400px] flex-col gap-3 overflow-y-auto">
                <For each={family.edges}>
                  {(edge) => {
                    const fromMember = memberByNodeId.get(edge.fromNodeId)
                    const toMember = memberByNodeId.get(edge.toNodeId)

                    return (
                      <div class="border-border border-b py-3 last:border-0">
                        <div class="mb-2">
                          <span class="font-medium">
                            {formatEvolutionFamilyMemberLabel(fromMember, edge.fromSlug)} →{" "}
                            {formatEvolutionFamilyMemberLabel(toMember, edge.toSlug)}
                          </span>
                          <span class="ml-2 text-muted-foreground text-sm">
                            {titleCaseFromId(edge.method)}
                          </span>
                        </div>
                        <Show when={edge.requirementText.length > 0}>
                          <div class="flex flex-wrap gap-1">
                            <For each={edge.requirementText}>
                              {(text) => (
                                <span class="border border-border bg-secondary px-2 py-0.5 text-xs">
                                  {text}
                                </span>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )
                  }}
                </For>
              </div>
            </div>
          )
        }}
      </Show>
    </Show>
  )
}

function formatEvolutionFamilyMemberLabel(
  member: PokemonDetailRecord["evolutionFamily"]["members"][number] | undefined,
  fallbackSlug: string
): string {
  if (!member) {
    return titleCaseFromId(fallbackSlug)
  }

  if (!member.formName) {
    return member.name
  }

  return `${member.name} (${member.formName})`
}

function MoveLearnersQuickview(props: { entry: MoveLearnerEntryRecord | null; loading: boolean }) {
  return (
    <Show
      when={props.entry}
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">
          {props.loading ? "Loading move details..." : "Move details unavailable."}
        </div>
      }
    >
      {(entrySignal) => {
        const entry = entrySignal()
        return (
          <div class="flex flex-col gap-5">
            <div class="border-border border-b pb-4">
              <h3 class="mb-1 font-semibold text-lg">{entry.moveName}</h3>
              <p class="text-muted-foreground text-sm">
                {entry.learners.length} Pokemon can learn this move.
              </p>
            </div>

            <div class="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
              <For each={entry.learners.slice(0, 30)}>
                {(learner) => {
                  const spriteForm = resolveMoveLearnerSpriteForm(learner)

                  return (
                    <div class="flex items-center justify-between gap-2 border-border border-b py-2 last:border-0">
                      <a
                        href={resolveMoveLearnerHref(learner)}
                        class="flex min-w-0 items-center gap-2 hover:underline"
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
                        <span class="truncate text-sm">{learner.name}</span>
                      </a>
                      <div class="text-right text-muted-foreground text-xs">
                        <div>{learner.methods.map((method) => sourceLabel(method)).join(", ")}</div>
                        <Show when={learner.forms.length > 0}>
                          <div class="mt-0.5">
                            <Show when={!learner.baseAvailable}>
                              <span class="mr-1 uppercase">Form Only</span>
                            </Show>
                            <span>{learner.forms.map((form) => form.name).join(", ")}</span>
                          </div>
                        </Show>
                      </div>
                    </div>
                  )
                }}
              </For>
            </div>
          </div>
        )
      }}
    </Show>
  )
}

function AbilityEntryQuickview(props: { entry: AbilityEntryRecord | null }) {
  return (
    <Show
      when={props.entry}
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">
          Ability details unavailable.
        </div>
      }
    >
      {(entrySignal) => {
        const entry = entrySignal()

        return (
          <div class="flex flex-col gap-5">
            <div class="border-border border-b pb-4">
              <h3 class="mb-1 font-semibold text-lg">{entry.name}</h3>
              <p class="text-muted-foreground text-sm">
                {entry.description || entry.shortDescription || "No ability description available."}
              </p>
              <p class="mt-2 text-muted-foreground text-xs">
                {entry.pokemon.length} Pokemon can have this ability.
              </p>
            </div>

            <div class="flex max-h-[400px] flex-col gap-2 overflow-y-auto">
              <For each={entry.pokemon.slice(0, 30)}>
                {(pokemon) => (
                  <a
                    href={`/pokemon/${pokemon.slug}`}
                    class="flex items-center justify-between gap-2 border-border border-b py-2 last:border-0 hover:underline"
                  >
                    <div class="flex min-w-0 items-center gap-2">
                      <PokemonSprite
                        dexNumber={pokemon.dexNumber}
                        name={pokemon.name}
                        class="h-8 w-8"
                        imageClass="h-6 w-6"
                      />
                      <span class="truncate text-sm">{pokemon.name}</span>
                    </div>
                    <span class="text-muted-foreground text-xs">
                      {pokemon.hidden ? "Hidden" : "Regular"}
                    </span>
                  </a>
                )}
              </For>
            </div>
          </div>
        )
      }}
    </Show>
  )
}

function ItemEntryQuickview(props: { entry: ItemEntryRecord | null }) {
  return (
    <Show
      when={props.entry}
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">Item details unavailable.</div>
      }
    >
      {(entrySignal) => {
        const entry = entrySignal()

        return (
          <div class="flex flex-col gap-5">
            <div class="border-border border-b pb-4">
              <div class="mb-3 flex items-center gap-3">
                <ItemSprite
                  itemId={entry.itemId}
                  name={entry.name}
                  assetPath={entry.assetPath}
                  class="h-10 w-10"
                />
                <h3 class="font-semibold text-lg">{entry.name}</h3>
              </div>
              <p class="text-muted-foreground text-sm">
                {entry.description || "No item description available."}
              </p>
              <p class="mt-2 font-mono text-muted-foreground text-xs">Item ID: {entry.itemId}</p>
            </div>

            <Show when={entry.descriptionLines.length > 1}>
              <div class="space-y-2">
                <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                  Details
                </p>
                <div class="space-y-1">
                  <For each={entry.descriptionLines}>
                    {(line) => <p class="text-muted-foreground text-sm">{line}</p>}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        )
      }}
    </Show>
  )
}

function TypeEntryQuickview(props: {
  result: PaletteResult
  pokemonList: PokemonListItem[] | null
}) {
  const typeId = createMemo(() => props.result.typeId ?? "")

  const matchingPokemon = createMemo(() => {
    const currentType = typeId()
    if (!currentType) {
      return []
    }

    return (props.pokemonList ?? []).filter((pokemon) => {
      return pokemon.implemented && pokemon.types.includes(currentType)
    })
  })

  return (
    <div class="flex flex-col gap-5">
      <div class="border-border border-b pb-4">
        <h3 class="mb-1 font-semibold text-lg">{props.result.title}</h3>
        <p class="text-muted-foreground text-sm">Type explorer with matchup and Pokemon list.</p>
        <p class="mt-2 text-muted-foreground text-xs">{matchingPokemon().length} Pokemon found.</p>
      </div>

      <div class="flex max-h-[380px] flex-col gap-2 overflow-y-auto">
        <For each={matchingPokemon().slice(0, 30)}>
          {(pokemon) => (
            <a
              href={`/pokemon/${pokemon.slug}`}
              class="flex items-center justify-between gap-2 border-border border-b py-2 last:border-0 hover:underline"
            >
              <div class="flex min-w-0 items-center gap-2">
                <PokemonSprite
                  dexNumber={pokemon.dexNumber}
                  name={pokemon.name}
                  class="h-8 w-8"
                  imageClass="h-6 w-6"
                />
                <span class="truncate text-sm">{pokemon.name}</span>
              </div>
              <span class="text-muted-foreground text-xs">#{pokemon.dexNumber}</span>
            </a>
          )}
        </For>
      </div>
    </div>
  )
}

function EggGroupEntryQuickview(props: {
  result: PaletteResult
  pokemonList: PokemonListItem[] | null
}) {
  const eggGroupId = createMemo(() => props.result.eggGroupId ?? "")

  const matchingPokemon = createMemo(() => {
    const currentGroup = eggGroupId()
    if (!currentGroup) {
      return []
    }

    return (props.pokemonList ?? []).filter((pokemon) => {
      return pokemon.implemented && pokemon.eggGroups.includes(currentGroup)
    })
  })

  return (
    <div class="flex flex-col gap-5">
      <div class="border-border border-b pb-4">
        <h3 class="mb-1 font-semibold text-lg">{props.result.title}</h3>
        <p class="text-muted-foreground text-sm">Egg group explorer and compatibility list.</p>
        <p class="mt-2 text-muted-foreground text-xs">{matchingPokemon().length} Pokemon found.</p>
      </div>

      <div class="flex max-h-[380px] flex-col gap-2 overflow-y-auto">
        <For each={matchingPokemon().slice(0, 30)}>
          {(pokemon) => (
            <a
              href={`/pokemon/${pokemon.slug}`}
              class="flex items-center justify-between gap-2 border-border border-b py-2 last:border-0 hover:underline"
            >
              <div class="flex min-w-0 items-center gap-2">
                <PokemonSprite
                  dexNumber={pokemon.dexNumber}
                  name={pokemon.name}
                  class="h-8 w-8"
                  imageClass="h-6 w-6"
                />
                <span class="truncate text-sm">{pokemon.name}</span>
              </div>
              <span class="text-muted-foreground text-xs">#{pokemon.dexNumber}</span>
            </a>
          )}
        </For>
      </div>
    </div>
  )
}

function PrimaryPageQuickview(props: { result: PaletteResult }) {
  const pageInfo = createMemo(() => PRIMARY_PAGES.find((p) => p.id === props.result.id))
  const opensPaletteList = createMemo(() => pageInfo()?.id === "page:pokemon")

  return (
    <Show
      when={pageInfo()}
      fallback={
        <div class="p-12 text-center text-muted-foreground text-sm">
          Page information unavailable.
        </div>
      }
    >
      {(info) => (
        <div class="flex flex-col gap-5">
          <div class="border-border border-b pb-4">
            <div class="mb-3 flex items-center gap-3">
              {info().image ? (
                <img
                  src={info().image}
                  alt={info().title}
                  class="h-12 w-12 rounded-md border border-border object-cover"
                />
              ) : (
                <div class="flex h-12 w-12 items-center justify-center border border-border bg-secondary/40 font-mono text-muted-foreground text-sm">
                  {info().icon}
                </div>
              )}
              <div>
                <h3 class="font-semibold text-lg">{info().title}</h3>
                <p class="text-muted-foreground text-sm">{info().subtitle}</p>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <p class="text-muted-foreground text-sm">
              {opensPaletteList()
                ? "Press Enter to list Pokemon directly in this palette."
                : "Press Enter to navigate to this page."}
            </p>

            <Show when={!opensPaletteList()}>
              <div class="flex items-center gap-2 text-muted-foreground text-xs">
                <span class="font-mono">URL:</span>
                <code class="border border-border bg-secondary px-2 py-1">{info().url}</code>
              </div>
            </Show>
          </div>

          <div class="border-border border-t pt-4">
            <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
              Quick Tips
            </p>
            <ul class="mt-2 space-y-1 text-muted-foreground text-sm">
              <li>
                • Type <code class="rounded bg-secondary px-1">/</code> or{" "}
                <code class="rounded bg-secondary px-1">&gt;</code> to filter pages
              </li>
              <li>
                •{" "}
                {opensPaletteList()
                  ? "Type to filter the Pokemon list after opening it"
                  : "Search normally to find Pokemon and data entries"}
              </li>
              <li>• Use arrow keys to navigate results</li>
            </ul>
          </div>
        </div>
      )}
    </Show>
  )
}

function sourceLabel(sourceType: string): string {
  return formatMoveSource(sourceType as MoveSourceType, null)
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

function mergeResultsById(results: PaletteResult[], limit: number): PaletteResult[] {
  const deduped = new Map<string, PaletteResult>()

  for (const result of results) {
    const existing = deduped.get(result.id)
    if (!existing || result.score > existing.score) {
      deduped.set(result.id, result)
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.title.localeCompare(right.title)
    })
    .slice(0, limit)
}

function groupPaletteResults(
  results: PaletteResult[]
): Array<{ key: string; heading: string; results: PaletteResult[] }> {
  const groups = new Map<string, { key: string; heading: string; results: PaletteResult[] }>()

  for (const result of results) {
    const descriptor = resolveResultGroupDescriptor(result)
    const existing = groups.get(descriptor.key)

    if (existing) {
      existing.results.push(result)
      continue
    }

    groups.set(descriptor.key, {
      key: descriptor.key,
      heading: descriptor.heading,
      results: [result],
    })
  }

  const groupOrder = ["pages", "pokemon", "moves", "abilities", "items", "types", "egg-groups"]

  return groupOrder
    .map((key) => groups.get(key))
    .filter((group): group is { key: string; heading: string; results: PaletteResult[] } =>
      Boolean(group)
    )
}

function resolveResultGroupDescriptor(result: PaletteResult): { key: string; heading: string } {
  if (result.type === "primary-page") {
    return { key: "pages", heading: "Pages" }
  }

  if (result.type === "pokemon-overview" || result.type === "pokemon-facet") {
    return { key: "pokemon", heading: "Pokemon" }
  }

  if (result.type === "move-learners") {
    return { key: "moves", heading: "Moves" }
  }

  if (result.type === "ability-entry") {
    return { key: "abilities", heading: "Abilities" }
  }

  if (result.type === "item-entry") {
    return { key: "items", heading: "Items" }
  }

  if (result.type === "type-entry") {
    return { key: "types", heading: "Types" }
  }

  return { key: "egg-groups", heading: "Egg Groups" }
}

function PrimaryPageIcon(props: { result: PaletteResult }) {
  const pageInfo = createMemo(() => PRIMARY_PAGES.find((p) => p.id === props.result.id))

  return (
    <Show when={pageInfo()}>
      {(info) => (
        <>
          {info().image ? (
            <img
              src={info().image}
              alt={info().title}
              class="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <div class="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-secondary/40 font-mono text-[10px] text-muted-foreground uppercase">
              {resolveResultIcon(props.result)}
            </div>
          )}
        </>
      )}
    </Show>
  )
}

function resolveResultIcon(result: PaletteResult): string {
  if (result.type === "primary-page") {
    return PRIMARY_PAGES.find((page) => page.id === result.id)?.icon ?? "PG"
  }

  if (result.type === "move-learners") {
    return "MV"
  }

  if (result.type === "ability-entry") {
    return "AB"
  }

  if (result.type === "item-entry") {
    return "IT"
  }

  if (result.type === "type-entry") {
    return "TY"
  }

  if (result.type === "egg-group-entry") {
    return "EG"
  }

  return "PK"
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

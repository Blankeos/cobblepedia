import { useKeyboard } from "bagon-hooks"
import type { JSX } from "solid-js"
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { PokemonSprite } from "@/components/pokemon-sprite"
import { RideableCategoryIcon, RideableClassIcon } from "@/components/rideable-icons"
import { loadRideableMons } from "@/data/data-loader"
import { titleCaseFromId } from "@/data/formatters"
import { formatRideableCategory, formatRideableClass } from "@/data/rideable"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

type SeatFilter = "ALL" | "1" | "2" | "3+"
type SortOption = "dex" | "name" | "seats" | "modes"

const CATEGORY_FILTERS = ["ALL", "LAND", "LIQUID", "AIR"] as const
type RideableCategoryFilter = (typeof CATEGORY_FILTERS)[number]
type RideableCategory = Exclude<RideableCategoryFilter, "ALL">

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

const CLASS_ORDER = ["horse", "bird", "boat", "dolphin", "hover", "jet", "rocket", "submarine"]

export default function Page() {
  useMetadata({
    title: getTitle("Rideable Mons"),
  })

  const [rideableMons] = createResource(loadRideableMons)
  const [search, setSearch] = createSignal("")
  const [categoryFilters, setCategoryFilters] = createSignal<RideableCategory[]>([])
  const [classFilter, setClassFilter] = createSignal<string>("ALL")
  const [seatFilter, setSeatFilter] = createSignal<SeatFilter>("ALL")
  const [sortBy, setSortBy] = createSignal<SortOption>("dex")
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  let searchInputRef: HTMLInputElement | undefined

  createEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const queryParam = new URLSearchParams(window.location.search).get("query")?.trim() ?? ""
    if (queryParam) {
      setSearch(queryParam)
    }
  })

  const availableClasses = createMemo(() => {
    const classes = new Set<string>()

    for (const pokemon of rideableMons() ?? []) {
      for (const classId of pokemon.classes) {
        classes.add(classId)
      }
    }

    return Array.from(classes).sort((left, right) => {
      const leftOrder = CLASS_ORDER.indexOf(left)
      const rightOrder = CLASS_ORDER.indexOf(right)

      if (leftOrder !== -1 && rightOrder !== -1 && leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      if (leftOrder !== -1) {
        return -1
      }

      if (rightOrder !== -1) {
        return 1
      }

      return left.localeCompare(right)
    })
  })

  const categoryCounts = createMemo(() => {
    const counts: Record<string, number> = {
      ALL: (rideableMons() ?? []).length,
      LAND: 0,
      LIQUID: 0,
      AIR: 0,
    }

    for (const pokemon of rideableMons() ?? []) {
      for (const category of pokemon.categories) {
        if (category in counts) {
          counts[category] += 1
        }
      }
    }

    return counts
  })

  const filteredMons = createMemo(() => {
    const query = search().trim().toLowerCase()
    const categories = categoryFilters()
    const classId = classFilter()
    const seats = seatFilter()
    const sort = sortBy()

    const filtered = (rideableMons() ?? []).filter((pokemon) => {
      if (query) {
        const haystack = `${pokemon.name} ${pokemon.slug} ${pokemon.dexNumber}`.toLowerCase()
        if (!haystack.includes(query)) {
          return false
        }
      }

      if (
        categories.length > 0 &&
        !categories.every((category) => pokemon.categories.includes(category))
      ) {
        return false
      }

      if (classId !== "ALL" && !pokemon.classes.includes(classId)) {
        return false
      }

      if (seats === "1" && pokemon.seatCount !== 1) {
        return false
      }

      if (seats === "2" && pokemon.seatCount !== 2) {
        return false
      }

      if (seats === "3+" && pokemon.seatCount < 3) {
        return false
      }

      return true
    })

    return filtered.sort((left, right) => {
      if (sort === "name") {
        return left.name.localeCompare(right.name)
      }

      if (sort === "seats") {
        if (left.seatCount !== right.seatCount) {
          return right.seatCount - left.seatCount
        }
      }

      if (sort === "modes") {
        if (left.categories.length !== right.categories.length) {
          return right.categories.length - left.categories.length
        }
      }

      if (left.dexNumber !== right.dexNumber) {
        return left.dexNumber - right.dexNumber
      }

      return left.slug.localeCompare(right.slug)
    })
  })

  const summary = createMemo(() => {
    const all = rideableMons() ?? []

    return {
      total: all.length,
      air: all.filter((pokemon) => pokemon.categories.includes("AIR")).length,
      land: all.filter((pokemon) => pokemon.categories.includes("LAND")).length,
      liquid: all.filter((pokemon) => pokemon.categories.includes("LIQUID")).length,
      multiMode: all.filter((pokemon) => pokemon.categories.length > 1).length,
      multiSeat: all.filter((pokemon) => pokemon.seatCount > 1).length,
    }
  })

  createEffect(() => {
    search()
    categoryFilters()
    classFilter()
    seatFilter()
    sortBy()
    setSelectedIndex(0)
  })

  const toggleCategoryFilter = (category: RideableCategoryFilter) => {
    if (category === "ALL") {
      setCategoryFilters([])
      return
    }

    setCategoryFilters((current) => {
      if (current.includes(category)) {
        return current.filter((value) => value !== category)
      }

      return [...current, category]
    })
  }

  createEffect(() => {
    const maxIndex = filteredMons().length - 1
    const nextIndex = Math.min(selectedIndex(), maxIndex)
    setSelectedIndex(nextIndex < 0 ? 0 : nextIndex)
  })

  useKeyboard({
    onKeyDown: (event) => {
      const targetIsEditable = isEditableTarget(event.target)

      if (event.key === "/" && !targetIsEditable) {
        event.preventDefault()
        searchInputRef?.focus()
        searchInputRef?.select()
        return
      }

      if (targetIsEditable) {
        return
      }

      const list = filteredMons()
      if (list.length === 0) {
        return
      }

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault()
        setSelectedIndex((index) => Math.min(index + 1, list.length - 1))
        return
      }

      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault()
        setSelectedIndex((index) => Math.max(index - 1, 0))
        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        const selected = list[selectedIndex()]
        if (selected) {
          window.location.assign(`/pokemon/${selected.slug}`)
        }
      }
    },
  })

  return (
    <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Show when={!rideableMons.loading} fallback={<LoadingState />}>
        <Show when={rideableMons()}>
          {(dataSignal) => (
            <div class="space-y-4">
              {/* Compact Header */}
              <header class="flex flex-wrap items-end justify-between gap-4 border-border border-b pb-4">
                <div>
                  <span class="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                    Mounts
                  </span>
                  <h1 class="font-semibold text-3xl tracking-tight">Rideable Pokémon</h1>
                </div>

                <div class="flex items-center gap-px border border-border bg-border">
                  <StatPill label="Total" value={summary().total} />
                  <StatPill label="Air" value={summary().air} />
                  <StatPill label="Land" value={summary().land} />
                  <StatPill label="Water" value={summary().liquid} />
                </div>
              </header>

              {/* Filter Bar */}
              <section class="space-y-3">
                {/* Search + Sort Row */}
                <div class="flex flex-wrap items-center gap-3">
                  <div class="relative min-w-[200px] max-w-md flex-1">
                    <input
                      ref={searchInputRef}
                      type="text"
                      class="w-full border border-border bg-background px-3 py-2 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
                      placeholder="Search mounts..."
                      value={search()}
                      onInput={(event) => setSearch(event.currentTarget.value)}
                    />
                    <kbd class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      /
                    </kbd>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-muted-foreground text-xs uppercase">Sort</span>
                    <select
                      class="border border-border bg-background px-2 py-2 text-xs outline-none focus:border-foreground"
                      value={sortBy()}
                      onChange={(event) => setSortBy(event.currentTarget.value as SortOption)}
                    >
                      <option value="dex">Dex #</option>
                      <option value="name">Name</option>
                      <option value="seats">Seats</option>
                      <option value="modes">Modes</option>
                    </select>
                  </div>
                </div>

                {/* Filter Chips */}
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-muted-foreground text-xs uppercase">Category</span>
                  <For each={CATEGORY_FILTERS}>
                    {(category) => (
                      <FilterPill
                        active={
                          category === "ALL"
                            ? categoryFilters().length === 0
                            : categoryFilters().includes(category)
                        }
                        label={category === "ALL" ? "All" : formatRideableCategory(category)}
                        count={categoryCounts()[category] ?? undefined}
                        onClick={() => toggleCategoryFilter(category)}
                        icon={
                          category === "ALL" ? undefined : (
                            <RideableCategoryIcon category={category} class="h-3 w-3" />
                          )
                        }
                      />
                    )}
                  </For>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-muted-foreground text-xs uppercase">Class</span>
                  <FilterPill
                    active={classFilter() === "ALL"}
                    label="All"
                    onClick={() => setClassFilter("ALL")}
                  />
                  <For each={availableClasses()}>
                    {(classId) => (
                      <FilterPill
                        active={classFilter() === classId}
                        label={formatRideableClass(classId)}
                        onClick={() => setClassFilter(classId)}
                        icon={<RideableClassIcon classId={classId} class="h-3 w-3" />}
                      />
                    )}
                  </For>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-muted-foreground text-xs uppercase">Seats</span>
                  <FilterPill
                    active={seatFilter() === "ALL"}
                    label="Any"
                    onClick={() => setSeatFilter("ALL")}
                  />
                  <FilterPill
                    active={seatFilter() === "1"}
                    label="1"
                    onClick={() => setSeatFilter("1")}
                  />
                  <FilterPill
                    active={seatFilter() === "2"}
                    label="2"
                    onClick={() => setSeatFilter("2")}
                  />
                  <FilterPill
                    active={seatFilter() === "3+"}
                    label="3+"
                    onClick={() => setSeatFilter("3+")}
                  />
                </div>

                {/* Keyboard hint */}
                <div class="flex items-center gap-3 text-muted-foreground text-xs">
                  <span class="flex items-center gap-1">
                    <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono">J</kbd>
                    <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono">K</kbd>
                    <span>Navigate</span>
                  </span>
                  <span class="flex items-center gap-1">
                    <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono">
                      Enter
                    </kbd>
                    <span>Open</span>
                  </span>
                </div>
              </section>

              {/* Results Table */}
              <section class="border border-border bg-card">
                <Show
                  when={filteredMons().length > 0}
                  fallback={
                    <div class="px-4 py-12 text-center">
                      <p class="text-muted-foreground">No mounts match these filters.</p>
                    </div>
                  }
                >
                  <div class="max-h-[60vh] overflow-auto">
                    <table class="w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur-sm">
                        <tr class="border-border border-b">
                          <th class="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase">
                            Pokemon
                          </th>
                          <th class="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase">
                            Ride Type
                          </th>
                          <th class="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs uppercase">
                            Seats
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-border">
                        <For each={filteredMons()}>
                          {(pokemon, index) => {
                            const isSelected = () => selectedIndex() === index()

                            return (
                              <tr
                                class={cn(
                                  "cursor-pointer transition-colors",
                                  isSelected() ? "bg-secondary" : "hover:bg-secondary/50"
                                )}
                                onMouseEnter={() => setSelectedIndex(index())}
                                onClick={() => window.location.assign(`/pokemon/${pokemon.slug}`)}
                                aria-selected={isSelected()}
                              >
                                <td class="px-4 py-2.5">
                                  <div class="flex items-center gap-3">
                                    <PokemonSprite
                                      dexNumber={pokemon.dexNumber}
                                      name={pokemon.name}
                                      class="h-10 w-10"
                                    />
                                    <div>
                                      <a
                                        href={`/pokemon/${pokemon.slug}`}
                                        class="font-medium hover:underline"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        {pokemon.name}
                                      </a>
                                      <div class="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
                                        <span class="font-mono">
                                          #{String(pokemon.dexNumber).padStart(3, "0")}
                                        </span>
                                        <For each={pokemon.types}>
                                          {(type) => (
                                            <span
                                              class="border px-1 py-0 font-medium text-[10px] uppercase tracking-wide"
                                              style={{
                                                "border-color": `${TYPE_COLORS[type] ?? "#888"}66`,
                                                color: TYPE_COLORS[type] ?? "#888",
                                              }}
                                            >
                                              {titleCaseFromId(type)}
                                            </span>
                                          )}
                                        </For>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td class="px-4 py-2.5">
                                  <div class="flex flex-wrap gap-1.5">
                                    <For each={pokemon.behaviours}>
                                      {(behaviour) => (
                                        <span class="inline-flex items-center gap-1 border border-border bg-secondary/50 px-2 py-0.5 text-[11px]">
                                          <RideableCategoryIcon
                                            category={behaviour.category}
                                            class="h-3 w-3 text-muted-foreground"
                                          />
                                          <span class="text-muted-foreground">
                                            {formatRideableCategory(behaviour.category)}
                                          </span>
                                          <span class="text-border">/</span>
                                          <span>{titleCaseFromId(behaviour.classId)}</span>
                                        </span>
                                      )}
                                    </For>
                                  </div>
                                </td>

                                <td class="px-4 py-2.5 text-right">
                                  <span class="font-mono text-base">{pokemon.seatCount}</span>
                                </td>
                              </tr>
                            )
                          }}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>

                {/* Footer */}
                <div class="border-border border-t px-4 py-2 font-mono text-muted-foreground text-xs">
                  {filteredMons().length} of {dataSignal().length} mounts
                </div>
              </section>
            </div>
          )}
        </Show>
      </Show>
    </div>
  )
}

function FilterPill(props: {
  label: string
  active: boolean
  onClick: () => void
  icon?: JSX.Element
  count?: number
}) {
  return (
    <button
      type="button"
      class={cn(
        "inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
        props.active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground"
      )}
      onClick={props.onClick}
    >
      {props.icon}
      <span>{props.label}</span>
      <Show when={typeof props.count === "number"}>
        <span class="font-mono opacity-70">{props.count}</span>
      </Show>
    </button>
  )
}

function StatPill(props: { label: string; value: number }) {
  return (
    <div class="bg-card px-3 py-2 text-center">
      <span class="block font-mono text-[10px] text-muted-foreground uppercase">{props.label}</span>
      <span class="block font-mono text-lg leading-none">{props.value}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading mounts...</p>
    </div>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true
  }

  if (target instanceof HTMLSelectElement) {
    return true
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true
  }

  return Boolean(target.closest("[contenteditable='true']"))
}

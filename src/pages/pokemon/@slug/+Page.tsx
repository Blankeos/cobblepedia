import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import {
  IconArrowRight,
  IconBarChart,
  IconBox,
  IconEgg,
  IconForms,
  IconMapPin,
  IconSword,
  IconZap,
} from "@/assets/icons"
import { EvolutionFamilyFlow } from "@/components/evolution-family-flow"
import { RideableCategoryIcon, RideableClassIcon } from "@/components/rideable-icons"
import type {
  ItemIndex,
  MoveSourceType,
  PokemonDetailRecord,
  PokemonDexNavItem,
  RideableSummaryRecord,
} from "@/data/cobblemon-types"
import { loadItemIndex, loadPokemonDetail } from "@/data/data-loader"
import {
  formatConditionChips,
  formatEggGroup,
  formatMoveSource,
  sortMovesForTab,
  titleCaseFromId,
} from "@/data/formatters"
import pokemonDexNavData from "@/data/generated/pokemon-dex-nav.json"
import { formatRideableCategory, parseRideableSummaryFromSpecies } from "@/data/rideable"
import { resolvePokemonArtworkUrls } from "@/lib/pokeapi-artwork"
import { useLeaderNavigationHotkeys } from "@/lib/use-leader-navigation-hotkeys"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

const PAGE_MOVE_TABS = ["all", "level", "egg", "tm", "tutor"] as const
type PageMoveTab = (typeof PAGE_MOVE_TABS)[number]
type ArtworkView = "official" | "shiny"

const POKEMON_DEX_NAV = pokemonDexNavData as PokemonDexNavItem[]
const POKEMON_DEX_NAV_INDEX_BY_SLUG = new Map<string, number>()
for (const [index, pokemon] of POKEMON_DEX_NAV.entries()) {
  POKEMON_DEX_NAV_INDEX_BY_SLUG.set(pokemon.slug, index)
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

function getTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] || "#888888"
}

function getEggGroupColor(group: string): string {
  return EGG_GROUP_COLORS[group.toLowerCase()] || "#9ca3af"
}

export default function Page() {
  const pageContext = usePageContext()
  const slug = createMemo(() =>
    String(pageContext.routeParams.slug ?? "")
      .trim()
      .toLowerCase()
  )

  const [detail] = createResource(slug, async (nextSlug) => {
    if (!nextSlug) {
      return null
    }
    return loadPokemonDetail(nextSlug)
  })
  const [itemIndex] = createResource(loadItemIndex)

  const dexNeighbors = createMemo(() => findDexNeighborsByOffset(slug()))

  useMetadata({
    title: getTitle("Pokemon"),
  })

  return (
    <div class="min-h-screen bg-background">
      <Show when={!detail.loading} fallback={<LoadingState />}>
        <Show when={detail()} fallback={<NotFoundState />}>
          {(detailSignal) => (
            <PokemonDetailView
              detail={detailSignal()}
              previous={dexNeighbors().previous}
              next={dexNeighbors().next}
              itemIndex={itemIndex() ?? null}
            />
          )}
        </Show>
      </Show>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading Pokemon data...</p>
    </div>
  )
}

function NotFoundState() {
  return (
    <div class="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div class="flex h-16 w-16 items-center justify-center border border-border bg-secondary font-mono text-2xl text-muted-foreground">
        ?
      </div>
      <h2 class="font-semibold text-xl">Pokemon Not Found</h2>
      <p class="text-muted-foreground text-sm">
        This Pokemon doesn't exist in the current data snapshot.
      </p>
    </div>
  )
}

function PokemonDetailView(props: {
  detail: PokemonDetailRecord
  previous: PokemonDexNavItem | null
  next: PokemonDexNavItem | null
  itemIndex: ItemIndex | null
}) {
  const pageContext = usePageContext()
  const detail = () => props.detail
  const [activeView, setActiveView] = createSignal<ArtworkView>("official")
  const [selectedFormSlug, setSelectedFormSlug] = createSignal<string | null>(null)
  const [artworkFailed, setArtworkFailed] = createSignal(false)
  const [artworkUrlIndex, setArtworkUrlIndex] = createSignal(0)

  const requestedFormSlug = createMemo(() => {
    const queryValue = pageContext.urlParsed.search.form
    if (typeof queryValue !== "string") {
      return null
    }

    const normalized = queryValue.trim().toLowerCase()
    return normalized.length > 0 ? normalized : null
  })

  const availableForms = createMemo(() => detail().forms)

  const selectedForm = createMemo(() => {
    const slug = selectedFormSlug()
    if (!slug) {
      return null
    }

    return availableForms().find((form) => form.slug === slug) ?? null
  })

  const formOptions = createMemo(() => {
    return [
      {
        slug: null,
        label: "Base",
        battleOnly: false,
      },
      ...availableForms().map((form) => ({
        slug: form.slug,
        label: form.name,
        battleOnly: form.battleOnly,
      })),
    ]
  })

  const hasForms = createMemo(() => availableForms().length > 0)

  const activeTypes = createMemo(() => {
    const form = selectedForm()
    if (form && form.types.length > 0) {
      return form.types
    }

    return detail().types
  })

  const activeAbilities = createMemo(() => {
    const form = selectedForm()
    if (form && form.abilities.length > 0) {
      return form.abilities
    }

    return detail().abilities
  })

  const activeBaseStats = createMemo(() => {
    const form = selectedForm()
    if (form && Object.keys(form.baseStats).length > 0) {
      return form.baseStats
    }

    return detail().baseStats
  })

  const activeMoves = createMemo(() => {
    const form = selectedForm()
    if (form && form.moves.length > 0) {
      return form.moves
    }

    return detail().moves
  })

  const activeHeight = createMemo(() => {
    const form = selectedForm()
    return form?.height ?? detail().height
  })

  const activeWeight = createMemo(() => {
    const form = selectedForm()
    return form?.weight ?? detail().weight
  })

  const activeCatchRate = createMemo(() => {
    const form = selectedForm()
    return form?.catchRate ?? detail().catchRate
  })

  const activeEggCycles = createMemo(() => {
    const form = selectedForm()
    return form?.eggCycles ?? detail().eggCycles
  })

  const activeBaseFriendship = createMemo(() => {
    const form = selectedForm()
    return form?.baseFriendship ?? detail().baseFriendship
  })

  const displayName = createMemo(() => {
    const form = selectedForm()
    if (!form) {
      return detail().name
    }

    return `${detail().name} (${form.name})`
  })

  const primaryType = () => activeTypes()[0] || "normal"
  const typeColor = () => getTypeColor(primaryType())
  const rideableSummary = createMemo(() => parseRideableSummaryFromSpecies(detail().rawSpecies))

  const [artworkResolution] = createResource(
    () => ({
      dexNumber: detail().dexNumber,
      baseSlug: detail().slug,
      formSlug: selectedFormSlug(),
      formName: selectedForm()?.name ?? null,
      shiny: activeView() === "shiny",
    }),
    resolvePokemonArtworkUrls
  )

  const artworkUrl = createMemo(() => {
    const resolution = artworkResolution()
    if (!resolution) {
      return null
    }

    return resolution.urls[artworkUrlIndex()] ?? null
  })

  createEffect(() => {
    const requested = requestedFormSlug()
    const matchesForm = detail().forms.some((form) => form.slug === requested)
    setSelectedFormSlug(matchesForm ? requested : null)
  })

  createEffect(() => {
    detail().dexNumber
    selectedFormSlug()
    activeView()
    setArtworkUrlIndex(0)
    setArtworkFailed(false)
  })

  const selectForm = (nextFormSlug: string | null) => {
    setSelectedFormSlug(nextFormSlug)
    syncSelectedFormSlug(nextFormSlug)
  }

  const shiftFormSelection = (offset: number) => {
    const options = formOptions()
    const currentSlug = selectedFormSlug()
    const currentIndex = options.findIndex((option) => option.slug === currentSlug)
    if (currentIndex < 0) {
      return
    }

    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= options.length) {
      return
    }

    selectForm(options[nextIndex]?.slug ?? null)
  }

  const handleArtworkError = () => {
    const resolution = artworkResolution()
    const urls = resolution?.urls ?? []
    const nextIndex = artworkUrlIndex() + 1
    if (nextIndex < urls.length) {
      setArtworkUrlIndex(nextIndex)
      return
    }

    setArtworkFailed(true)
  }

  const artworkFallbackLabel = createMemo(() => {
    if (artworkResolution.loading) {
      return null
    }

    const resolution = artworkResolution()
    if (!resolution) {
      return null
    }

    if (selectedFormSlug() && !resolution.matchedForm) {
      return "Base form artwork"
    }

    if (artworkUrlIndex() === 1) {
      return "Home artwork"
    }

    if (artworkUrlIndex() === 2) {
      return "Sprite fallback"
    }

    return null
  })

  const leaderHotkeys = useLeaderNavigationHotkeys({
    onPrevious: () => {
      if (props.previous) {
        navigateToPokemon(props.previous.slug)
      }
    },
    onNext: () => {
      if (props.next) {
        navigateToPokemon(props.next.slug)
      }
    },
    onFormPrevious: hasForms()
      ? () => {
          shiftFormSelection(-1)
        }
      : undefined,
    onFormNext: hasForms()
      ? () => {
          shiftFormSelection(1)
        }
      : undefined,
  })

  return (
    <div class="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Dex Navigation Bar - Pokemon cards instead of arrows */}
      <nav class="mb-4 flex items-center justify-between gap-4">
        <DexNavCard pokemon={props.previous} direction="previous" />

        <div class="flex flex-wrap items-center justify-center gap-1.5 text-muted-foreground">
          <span class="hidden text-xs sm:inline">Leader</span>
          <kbd class="hidden border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            Space
          </kbd>
          <span class="hidden text-xs sm:inline">then</span>
          <kbd class="hidden border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            &lt;
          </kbd>
          <span class="hidden text-xs sm:inline">/</span>
          <kbd class="hidden border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            &gt;
          </kbd>
        </div>

        <DexNavCard pokemon={props.next} direction="next" />
      </nav>

      {/* Hero Section - Compact with view toggle */}
      <header class="relative mb-6 border border-border bg-card">
        <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          {/* Left: Pokemon Info */}
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm" style={{ color: typeColor() }}>
                #{String(detail().dexNumber).padStart(3, "0")}
              </span>
            </div>

            <h1 class="font-semibold text-3xl tracking-tight sm:text-4xl">{displayName()}</h1>

            <Show when={hasForms()}>
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wide">
                    <IconForms class="h-3.5 w-3.5" />
                    Forms
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <For each={formOptions()}>
                    {(option, index) => {
                      const isActive = () => selectedFormSlug() === option.slug
                      const position = index()
                      const total = formOptions().length

                      return (
                        <button
                          type="button"
                          class={cn(
                            "group relative inline-flex items-center gap-1.5 border px-3 py-1.5 font-medium text-xs transition-all",
                            isActive()
                              ? "border-foreground bg-foreground text-background shadow-sm"
                              : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                          )}
                          onClick={() => selectForm(option.slug)}
                        >
                          <span>{option.label}</span>
                          <Show when={option.battleOnly}>
                            <span
                              class={cn(
                                "font-mono text-[9px] uppercase tracking-wider",
                                isActive() ? "text-background/70" : "text-muted-foreground/70"
                              )}
                            >
                              Battle
                            </span>
                          </Show>

                          {/* Keyboard shortcut indicator */}
                          <Show when={!isActive() && (position === 0 || position === total - 1)}>
                            <span
                              aria-hidden="true"
                              class={cn(
                                "pointer-events-none absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100",
                                "border-border bg-secondary text-muted-foreground"
                              )}
                            >
                              {position === 0 ? "H" : "L"}
                            </span>
                          </Show>
                        </button>
                      )
                    }}
                  </For>
                </div>
              </div>
            </Show>

            <div class="flex flex-wrap gap-2">
              <For each={activeTypes()}>
                {(type) => (
                  <a
                    href={`/types/${type}`}
                    class="flex items-center gap-1.5 border px-3 py-1 font-medium text-xs uppercase tracking-wider transition-colors hover:bg-secondary/60"
                    style={{
                      "border-color": getTypeColor(type),
                      color: getTypeColor(type),
                    }}
                  >
                    <TypeIcon type={type} />
                    {titleCaseFromId(type)}
                  </a>
                )}
              </For>
            </div>

            <Show when={rideableSummary()}>
              {(summarySignal) => (
                <RideableHeroTag summary={summarySignal()} slug={detail().slug} />
              )}
            </Show>

            {/* Quick stats row */}
            <div class="mt-2 flex flex-wrap gap-4 text-sm">
              <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground">Height:</span>
                <span class="font-mono">{activeHeight() ?? "—"}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground">Weight:</span>
                <span class="font-mono">{activeWeight() ?? "—"}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground">Catch:</span>
                <span class="font-mono">{activeCatchRate() ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Right: Artwork Display */}
          <div class="flex flex-col items-center gap-3 sm:items-end">
            {/* View Toggle */}
            <div class="flex items-center border border-border bg-secondary/50">
              <ViewToggleButton
                active={activeView() === "official"}
                onClick={() => setActiveView("official")}
                label="Official"
              />
              <ViewToggleButton
                active={activeView() === "shiny"}
                onClick={() => setActiveView("shiny")}
                label="Shiny"
              />
            </div>

            <Show when={artworkFallbackLabel()}>
              {(label) => (
                <span class="border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                  {label()}
                </span>
              )}
            </Show>

            {/* Artwork Display - Compact */}
            <div class="relative h-40 w-40 overflow-hidden border border-border bg-secondary/30 sm:h-44 sm:w-44">
              <Show
                when={!artworkResolution.loading}
                fallback={
                  <div class="flex h-full w-full items-center justify-center">
                    <div class="h-5 w-5 animate-spin border-2 border-border border-t-foreground" />
                  </div>
                }
              >
                <Show
                  when={!artworkFailed() ? artworkUrl() : null}
                  fallback={
                    <div class="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center">
                      <div class="text-2xl">🖼️</div>
                      <p class="text-muted-foreground text-xs">
                        Artwork unavailable for this view.
                      </p>
                    </div>
                  }
                >
                  {(url) => (
                    <div class="flex h-full w-full items-center justify-center p-2">
                      <img
                        src={url()}
                        alt={`${displayName()} ${activeView()} artwork`}
                        class="h-full w-full object-contain"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={handleArtworkError}
                      />
                    </div>
                  )}
                </Show>
              </Show>
            </div>
          </div>
        </div>

        {/* Type accent line */}
        <div class="h-1 w-full" style={{ background: typeColor() }} />
      </header>

      {/* Main Content Grid */}
      <div class="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Stats & Core Info */}
        <div class="space-y-6">
          {/* Base Stats */}
          <section class="border border-border bg-card">
            <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
              <IconBarChart class="h-4 w-4 text-muted-foreground" />
              <h2 class="font-semibold">Base Stats</h2>
              <span class="ml-auto font-mono text-muted-foreground text-sm">
                Total:{" "}
                <span class="font-semibold text-foreground">
                  {Object.values(activeBaseStats()).reduce((sum, val) => sum + val, 0)}
                </span>
              </span>
            </div>
            <div class="p-4">
              <For each={Object.entries(activeBaseStats())}>
                {([stat, value]) => (
                  <div class="mb-3 last:mb-0">
                    <div class="mb-1 flex items-center justify-between text-sm">
                      <span class="text-muted-foreground">{formatStatName(stat)}</span>
                      <span class="font-medium font-mono">{value}</span>
                    </div>
                    <div class="h-2 w-full bg-secondary">
                      <div
                        class="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min((value / 255) * 100, 100)}%`,
                          "background-color": typeColor(),
                        }}
                      />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </section>

          {/* Abilities */}
          <section class="border border-border bg-card">
            <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
              <IconZap class="h-4 w-4 text-muted-foreground" />
              <h2 class="font-semibold">Abilities</h2>
            </div>
            <div class="divide-y divide-border">
              <For each={activeAbilities()}>
                {(ability) => (
                  <div class="flex items-center justify-between px-4 py-3">
                    <a href={`/abilities/${ability.id}`} class="hover:underline">
                      {ability.label}
                    </a>
                    <span
                      class={cn(
                        "border px-2 py-0.5 text-xs",
                        ability.slot === "first" &&
                          "border-foreground/20 bg-foreground/10 text-foreground",
                        ability.slot === "second" && "border-info/40 bg-info/10 text-info",
                        ability.slot === "hidden" &&
                          "border-border bg-secondary text-muted-foreground"
                      )}
                    >
                      {formatAbilitySlot(ability.slot)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </section>

          {/* Breeding */}
          <section class="border border-border bg-card">
            <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
              <IconEgg class="h-4 w-4 text-muted-foreground" />
              <h2 class="font-semibold">Breeding</h2>
            </div>
            <div class="grid grid-cols-2 gap-px bg-border">
              <div class="bg-card p-4">
                <span class="mb-1 block font-mono text-muted-foreground text-xs uppercase">
                  Egg Groups
                </span>
                <div class="flex flex-wrap gap-1">
                  <For each={detail().eggGroups}>
                    {(group) => (
                      <a
                        href={`/egg-groups/${group}`}
                        class="inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-medium text-xs uppercase tracking-wider transition-colors hover:bg-secondary/60"
                        style={{
                          "border-color": `${getEggGroupColor(group)}40`,
                          "background-color": `${getEggGroupColor(group)}15`,
                          color: getEggGroupColor(group),
                        }}
                      >
                        <EggGroupIcon group={group} />
                        {formatEggGroup(group)}
                      </a>
                    )}
                  </For>
                </div>
              </div>
              <div class="bg-card p-4">
                <span class="mb-1 block font-mono text-muted-foreground text-xs uppercase">
                  Egg Cycles
                </span>
                <span class="font-mono text-lg">{activeEggCycles() ?? "—"}</span>
              </div>
              <div class="bg-card p-4">
                <span class="mb-1 block font-mono text-muted-foreground text-xs uppercase">
                  Base Friendship
                </span>
                <span class="font-mono text-lg">{activeBaseFriendship() ?? "—"}</span>
              </div>
              <div class="bg-card p-4">
                <span class="mb-1 block font-mono text-muted-foreground text-xs uppercase">
                  Catch Rate
                </span>
                <span class="font-mono text-lg">{activeCatchRate() ?? "—"}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - Moves, Spawns */}
        <div class="space-y-6">
          <MovesSection moves={activeMoves()} activeFormName={selectedForm()?.name ?? null} />

          {/* Spawn Locations */}
          <section class="border border-border bg-card">
            <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
              <IconMapPin class="h-4 w-4 text-muted-foreground" />
              <h2 class="font-semibold">Spawn Locations</h2>
            </div>
            <Show
              when={detail().spawnEntries.length > 0}
              fallback={
                <p class="p-4 text-muted-foreground text-sm">
                  No spawn data available for this species.
                </p>
              }
            >
              <div class="divide-y divide-border">
                <For each={detail().spawnEntries}>
                  {(entry) => {
                    const chips = formatConditionChips(entry.condition)
                    return (
                      <div class="p-4">
                        <div class="mb-2 flex items-center justify-between">
                          <span class="font-medium">{titleCaseFromId(entry.bucket)}</span>
                          <div class="flex items-center gap-2 text-muted-foreground text-sm">
                            <span>{entry.levelText ?? "—"}</span>
                            <span>·</span>
                            <span>{titleCaseFromId(entry.spawnablePositionType)}</span>
                          </div>
                        </div>
                        <Show when={chips.length > 0}>
                          <div class="mb-2 flex flex-wrap gap-1">
                            <For each={chips.slice(0, 4)}>
                              {(chip) => (
                                <span class="border border-border bg-secondary px-2 py-0.5 text-xs">
                                  {chip}
                                </span>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={entry.weightMultipliers.length > 0}>
                          <div class="flex flex-wrap gap-2 text-xs">
                            <For each={entry.weightMultipliers.slice(0, 2)}>
                              {(multiplier) => {
                                const conditionChips = formatConditionChips(multiplier.condition)
                                return (
                                  <span class="text-muted-foreground">
                                    <span class="font-mono text-foreground">
                                      {multiplier.multiplier}×
                                    </span>
                                    {conditionChips.length > 0 && (
                                      <span> ({conditionChips.join(", ")})</span>
                                    )}
                                  </span>
                                )
                              }}
                            </For>
                          </div>
                        </Show>
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </section>
        </div>
      </div>

      <section class="mt-6 border border-border bg-card">
        <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
          <IconArrowRight class="h-4 w-4 text-muted-foreground" />
          <h2 class="font-semibold">Evolution Family</h2>
        </div>
        <Show
          when={detail().evolutionFamily.members.length > 0}
          fallback={
            <p class="p-4 text-muted-foreground text-sm">No evolution family data available.</p>
          }
        >
          <EvolutionFamilyFlow
            family={detail().evolutionFamily}
            activeSlug={detail().slug}
            activeFormSlug={selectedFormSlug() ?? requestedFormSlug()}
            itemIndex={props.itemIndex}
          />
        </Show>
      </section>

      <Show when={leaderHotkeys.leaderActive()}>
        <div class="pointer-events-none fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] border border-border bg-card/95 shadow-lg backdrop-blur-sm">
          <div class="flex items-center justify-between border-border border-b bg-secondary/70 px-3 py-2">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                Leader
              </span>
              <kbd class="border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                Space
              </kbd>
            </div>
            <span class="animate-pulse font-mono text-[10px] text-success uppercase">
              Awaiting key
            </span>
          </div>
          <div class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 px-3 py-3 text-xs">
            <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
              &gt; / .
            </kbd>
            <span>Next Pokemon</span>
            <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
              &lt; / ,
            </kbd>
            <span>Previous Pokemon</span>
            <Show when={hasForms()}>
              <>
                <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                  H
                </kbd>
                <span>Previous Form</span>
                <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                  L
                </kbd>
                <span>Next Form</span>
              </>
            </Show>
            <kbd class="border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>
            <span class="text-muted-foreground">Cancel</span>
          </div>
        </div>
      </Show>
    </div>
  )
}

function ViewToggleButton(props: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={cn(
        "border px-3 py-1 font-medium text-xs transition-all",
        props.active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {props.label}
    </button>
  )
}

function DexNavCard(props: { pokemon: PokemonDexNavItem | null; direction: "previous" | "next" }) {
  const isPrevious = props.direction === "previous"

  if (!props.pokemon) {
    return (
      <div
        class={cn(
          "flex items-center gap-2 border border-border bg-secondary/30 px-3 py-2 opacity-40",
          isPrevious ? "flex-row" : "flex-row-reverse"
        )}
      >
        <div class="flex h-8 w-8 items-center justify-center bg-secondary">
          <span class="text-muted-foreground text-xs">—</span>
        </div>
        <div class={cn("flex flex-col", isPrevious ? "items-start" : "items-end")}>
          <span class="text-[10px] text-muted-foreground">{isPrevious ? "First" : "Last"}</span>
          <span class="font-medium text-xs">—</span>
        </div>
      </div>
    )
  }

  const name = props.pokemon.name
  const dexNumber = props.pokemon.dexNumber

  return (
    <a
      href={`/pokemon/${props.pokemon.slug}`}
      class={cn(
        "group flex items-center gap-2 border border-border bg-card px-3 py-2 transition-all hover:border-muted-foreground hover:bg-secondary/30",
        isPrevious ? "flex-row" : "flex-row-reverse"
      )}
    >
      <span
        class={cn(
          "text-muted-foreground text-sm transition-colors group-hover:text-foreground",
          isPrevious ? "order-first" : "order-last"
        )}
      >
        {isPrevious ? "←" : "→"}
      </span>
      <div class="flex h-8 w-8 items-center justify-center overflow-hidden bg-secondary">
        <img
          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNumber}.png`}
          alt={name}
          class="h-6 w-6 object-contain transition-transform group-hover:scale-110"
          loading="lazy"
        />
      </div>
      <div class={cn("flex flex-col", isPrevious ? "items-start" : "items-end")}>
        <span class="font-mono text-[10px] text-muted-foreground">
          #{String(dexNumber).padStart(3, "0")}
        </span>
        <span class="font-medium text-xs transition-colors group-hover:text-foreground">
          {name}
        </span>
      </div>
    </a>
  )
}

function TypeIcon(props: { type: string }) {
  return <IconBox class="h-3.5 w-3.5" style={{ color: getTypeColor(props.type) }} />
}

function EggGroupIcon(props: { group: string }) {
  return <IconEgg class="h-3.5 w-3.5" style={{ color: getEggGroupColor(props.group) }} />
}

function RideableHeroTag(props: { summary: RideableSummaryRecord; slug: string }) {
  const rideableQueryHref = createMemo(
    () => `/rideable-mons?query=${encodeURIComponent(props.slug)}`
  )

  const seatLabel = createMemo(() =>
    props.summary.seatCount === 1 ? "1 seat" : `${props.summary.seatCount} seats`
  )

  return (
    <div class="mt-2">
      <a
        href={rideableQueryHref()}
        class="inline-flex flex-wrap items-center gap-x-3 gap-y-1 border border-success/30 bg-success/10 px-2.5 py-1.5 text-xs transition-colors hover:border-success/60 hover:bg-success/15"
      >
        <span class="font-semibold text-success uppercase tracking-wider">Mountable</span>

        <div class="flex flex-wrap items-center gap-1.5">
          <For each={props.summary.behaviours}>
            {(behaviour) => (
              <span class="inline-flex items-center gap-1 border border-border bg-background/60 px-1.5 py-0.5 text-[11px]">
                <RideableCategoryIcon
                  category={behaviour.category}
                  class="h-3 w-3 text-muted-foreground"
                />
                <RideableClassIcon classId={behaviour.classId} class="h-3 w-3" />
                <span class="text-muted-foreground">
                  {formatRideableCategory(behaviour.category)}
                </span>
                <span class="text-muted-foreground/60">/</span>
                <span>{titleCaseFromId(behaviour.classId)}</span>
              </span>
            )}
          </For>
        </div>

        <span class="text-muted-foreground">· {seatLabel()}</span>
      </a>
    </div>
  )
}

function MovesSection(props: {
  moves: PokemonDetailRecord["moves"]
  activeFormName: string | null
}) {
  const [activeTab, setActiveTab] = createSignal<PageMoveTab>("all")
  const [searchQuery, setSearchQuery] = createSignal("")

  const counts = createMemo(() => ({
    all: props.moves.length,
    level: props.moves.filter((m) => m.sourceType === "level").length,
    egg: props.moves.filter((m) => m.sourceType === "egg").length,
    tm: props.moves.filter((m) => m.sourceType === "tm").length,
    tutor: props.moves.filter((m) => m.sourceType === "tutor").length,
  }))

  const filteredMoves = createMemo(() => {
    const query = searchQuery().toLowerCase().trim()
    const tab = activeTab()

    const visibleMoves = props.moves.filter((move) => {
      if (tab !== "all" && move.sourceType !== tab) return false
      if (!query) return true

      const moveType = move.type ?? ""

      return (
        move.moveName.toLowerCase().includes(query) ||
        move.moveId.toLowerCase().includes(query) ||
        moveType.toLowerCase().includes(query) ||
        titleCaseFromId(moveType).toLowerCase().includes(query)
      )
    })

    return sortMovesForTab(visibleMoves, tab)
  })

  return (
    <section class="border border-border bg-card">
      <div class="flex items-center justify-between border-border border-b bg-secondary px-4 py-3">
        <div class="flex items-center gap-2">
          <IconSword class="h-4 w-4 text-muted-foreground" />
          <h2 class="font-semibold">Moveset</h2>
          <Show when={props.activeFormName}>
            {(formName) => (
              <span class="border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                {formName()}
              </span>
            )}
          </Show>
        </div>
        <span class="font-mono text-muted-foreground text-xs">{counts().all} total</span>
      </div>

      <div class="border-border border-b p-4">
        <div class="mb-3 flex flex-wrap gap-1">
          <For each={PAGE_MOVE_TABS}>
            {(tab) => (
              <button
                type="button"
                role="tab"
                class={cn(
                  "border px-3 py-1.5 text-xs transition-colors",
                  activeTab() === tab
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-secondary hover:border-muted-foreground"
                )}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "all" ? "All" : titleCaseFromId(tab)}
                <span class="ml-1 font-mono opacity-60">{counts()[tab]}</span>
              </button>
            )}
          </For>
        </div>

        <input
          type="text"
          class="w-full border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
          placeholder="Filter moves..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
      </div>

      <div class="max-h-[400px] overflow-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-secondary">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-muted-foreground">Move</th>
              <th class="px-4 py-2 text-right font-medium text-muted-foreground">Type</th>
              <th class="px-4 py-2 text-right font-medium text-muted-foreground">Source</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <For each={filteredMoves()}>
              {(move) => (
                <tr class="hover:bg-secondary/50">
                  <td class="px-4 py-2.5">
                    <a href={`/moves/${move.moveId}`} class="hover:underline">
                      {move.moveName}
                    </a>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <MoveTypeBadge type={move.type} />
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <SourceBadge type={move.sourceType} value={move.sourceValue} />
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SourceBadge(props: { type: MoveSourceType; value: number | null }) {
  const colors: Record<string, string> = {
    level: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    egg: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    tm: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    tutor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  }

  return (
    <span
      class={cn("border px-2 py-0.5 text-xs", colors[props.type] || "border-border bg-secondary")}
    >
      {formatMoveSource(props.type, props.value)}
    </span>
  )
}

function MoveTypeBadge(props: { type: string | null }) {
  if (!props.type) {
    return <span class="text-muted-foreground text-xs">-</span>
  }

  const typeId = props.type.toLowerCase()
  const color = getTypeColor(typeId)

  return (
    <a
      href={`/types/${typeId}`}
      class="inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-opacity hover:opacity-80"
      style={{
        "border-color": `${color}66`,
        "background-color": `${color}1a`,
        color,
      }}
    >
      <TypeIcon type={typeId} />
      {titleCaseFromId(typeId)}
    </a>
  )
}

function findDexNeighborsByOffset(currentSlug: string) {
  if (!currentSlug || POKEMON_DEX_NAV.length === 0) {
    return {
      previous: null,
      next: null,
    }
  }

  const index = POKEMON_DEX_NAV_INDEX_BY_SLUG.get(currentSlug)
  if (index === undefined) {
    return {
      previous: null,
      next: null,
    }
  }

  return {
    previous: POKEMON_DEX_NAV[index - 1] ?? null,
    next: POKEMON_DEX_NAV[index + 1] ?? null,
  }
}

function navigateToPokemon(slug: string) {
  window.location.assign(`/pokemon/${slug}`)
}

function formatStatName(stat: string): string {
  const names: Record<string, string> = {
    hp: "HP",
    attack: "Attack",
    defense: "Defense",
    special_attack: "Sp. Attack",
    special_defense: "Sp. Defense",
    speed: "Speed",
  }
  return names[stat] || titleCaseFromId(stat)
}

function formatAbilitySlot(slot: PokemonDetailRecord["abilities"][number]["slot"]): string {
  if (slot === "first") {
    return "First"
  }

  if (slot === "second") {
    return "Second"
  }

  return "Hidden"
}

function syncSelectedFormSlug(formSlug: string | null) {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)
  if (formSlug) {
    url.searchParams.set("form", formSlug)
  } else {
    url.searchParams.delete("form")
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(null, "", nextUrl)
}

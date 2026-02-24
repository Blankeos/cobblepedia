import { useQuery } from "@tanstack/solid-query"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { navigate } from "vike/client/router"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import {
  IconArrowRight,
  IconBarChart,
  IconBox,
  IconEgg,
  IconForms,
  IconGift,
  IconIconArrowUpRight,
  IconIconGhost,
  IconMapPin,
  IconMedalOutline,
  IconSword,
  IconZap,
} from "@/assets/icons"
import { EvolutionFamilyFlow } from "@/components/evolution-family-flow"
import { ItemSprite, parseItemId } from "@/components/item-sprite"
import { PokemonModelPreview } from "@/components/pokemon-model-preview"
import { RideableCategoryIcon, RideableClassIcon } from "@/components/rideable-icons"
import type {
  BiomeTagIndex,
  ItemIndex,
  MoveSourceType,
  PokemonDetailRecord,
  PokemonDexNavItem,
  PokemonDexNeighbors,
  PokemonDropData,
  RideableSummaryRecord,
  SmogonMovesetRecord,
} from "@/data/cobblemon-types"
import {
  loadBiomeTagIndex,
  loadItemIndex,
  loadMoveLearnerEntry,
  loadPokemonDetail,
  loadPokemonDexNeighbors,
  loadSmogonMovesetsBySlug,
} from "@/data/data-loader"
import {
  canonicalId,
  formatConditionChips,
  formatEggGroup,
  formatMoveSource,
  sortMovesForTab,
  titleCaseFromId,
} from "@/data/formatters"
import { formatRideableCategory, parseRideableSummaryFromSpecies } from "@/data/rideable"
import {
  buildPikalyticsDexUrl,
  buildSmogonDexUrl,
  type CompetitiveDistributionEntry,
  type CompetitiveFormHint,
  type CompetitiveReferenceData,
  loadCompetitiveReferenceData,
} from "@/lib/competitive-data"
import { resolvePokemonArtworkUrls } from "@/lib/pokeapi-artwork"
import { Tippy } from "@/lib/solid-tippy"
import { useLeaderNavigationHotkeys } from "@/lib/use-leader-navigation-hotkeys"
import { useParams } from "@/route-tree.gen"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

const PAGE_MOVE_TABS = ["all", "level", "egg", "tm", "tutor"] as const
type PageMoveTab = (typeof PAGE_MOVE_TABS)[number]
type ArtworkView = "official" | "shiny" | "model3d"

const SMOGON_LOGO_URL = "https://archives.bulbagarden.net/media/upload/3/38/Smogon_logo.png"
const PIKALYTICS_LOGO_URL = "https://cdn.pikalytics.com/images/favicon/apple-icon.png"

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

const EMPTY_DEX_NEIGHBORS: PokemonDexNeighbors = {
  previous: null,
  next: null,
}

export default function Page() {
  const routeParams = useParams({ from: "/pokemon/@slug" })
  const slug = createMemo(() =>
    String(routeParams().slug ?? "")
      .trim()
      .toLowerCase()
  )

  const detailQuery = useQuery(() => ({
    queryKey: ["pokemon-detail", slug()],
    enabled: slug().length > 0,
    queryFn: async () => {
      const currentSlug = slug()
      if (!currentSlug) {
        return null
      }

      return loadPokemonDetail(currentSlug)
    },
  }))

  const detail = createMemo(() => detailQuery.data ?? null)

  const dexNeighborParams = createMemo(() => {
    const pokemon = detail()
    if (!pokemon) {
      return null
    }

    return {
      slug: pokemon.slug,
      dexNumber: pokemon.dexNumber,
    }
  })

  const dexNeighborsQuery = useQuery(() => ({
    queryKey: [
      "pokemon-dex-neighbors",
      dexNeighborParams()?.slug ?? "",
      dexNeighborParams()?.dexNumber ?? 0,
    ],
    enabled: dexNeighborParams() !== null,
    queryFn: async () => {
      const params = dexNeighborParams()
      if (!params) {
        return EMPTY_DEX_NEIGHBORS
      }

      return loadPokemonDexNeighbors(params.slug, params.dexNumber)
    },
  }))

  const itemIndexQuery = useQuery(() => ({
    queryKey: ["item-index"],
    queryFn: loadItemIndex,
  }))

  const biomeTagIndexQuery = useQuery(() => ({
    queryKey: ["biome-tag-index"],
    queryFn: loadBiomeTagIndex,
  }))

  useMetadata({
    title: getTitle("Pokemon"),
  })

  return (
    <div class="min-h-screen bg-background">
      <Show when={!detailQuery.isPending} fallback={<LoadingState />}>
        <Show when={detail()} fallback={<NotFoundState />}>
          {(detailSignal) => (
            <PokemonDetailView
              detail={detailSignal()}
              previous={dexNeighborsQuery.data?.previous ?? null}
              next={dexNeighborsQuery.data?.next ?? null}
              itemIndex={itemIndexQuery.data ?? null}
              biomeTagIndex={biomeTagIndexQuery.data ?? {}}
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
  biomeTagIndex: BiomeTagIndex
}) {
  const pageContext = usePageContext()
  const detail = () => props.detail
  const [activeView, setActiveView] = createSignal<ArtworkView>("official")
  const [selectedFormSlug, setSelectedFormSlug] = createSignal<string | null>(null)
  const [artworkFailed, setArtworkFailed] = createSignal(false)
  const [artworkUrlIndex, setArtworkUrlIndex] = createSignal(0)

  const requestedFormSlug = createMemo(() => {
    const fromUrl = extractFormSlugFromUrl(pageContext.urlOriginal)
    if (fromUrl) {
      return fromUrl
    }

    const queryValue = pageContext.urlParsed.search.form
    if (typeof queryValue !== "string") {
      return null
    }

    return normalizeFormSlug(queryValue)
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

  const breedingExplorerHref = createMemo(() => {
    const primaryEggGroup = detail().eggGroups[0] ?? ""
    const search = new URLSearchParams()
    search.set("pokemon", detail().slug)

    if (primaryEggGroup) {
      return `/egg-groups/${primaryEggGroup}?${search.toString()}`
    }

    return `/egg-groups?${search.toString()}`
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

  const artworkResolutionQuery = useQuery(() => ({
    queryKey: [
      "pokemon-artwork-resolution",
      detail().slug,
      detail().dexNumber,
      selectedFormSlug() ?? "",
      selectedForm()?.name ?? "",
      activeView() === "shiny",
    ],
    queryFn: () =>
      resolvePokemonArtworkUrls({
        dexNumber: detail().dexNumber,
        baseSlug: detail().slug,
        formSlug: selectedFormSlug(),
        formName: selectedForm()?.name ?? null,
        shiny: activeView() === "shiny",
      }),
  }))

  const artworkResolution = createMemo(() => artworkResolutionQuery.data ?? null)

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
    if (artworkResolutionQuery.isPending) {
      return null
    }

    const resolution = artworkResolution()
    if (!resolution) {
      return null
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

  const activeEvolutionFormSlug = createMemo(() => {
    const selectedSlug = selectedForm()?.slug ?? null
    if (selectedSlug) {
      return selectedSlug
    }

    const requestedSlug = requestedFormSlug()
    if (!requestedSlug) {
      return null
    }

    const hasRequestedForm = detail().forms.some((form) => form.slug === requestedSlug)
    return hasRequestedForm ? requestedSlug : null
  })

  return (
    <div class="mx-auto max-w-6xl px-3 py-4 sm:px-4 lg:px-8">
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

      <Show when={!detail().implemented}>
        <section class="mb-4 border border-warning/30 bg-warning/10 px-4 py-3">
          <p class="font-semibold text-warning text-xs uppercase tracking-wider">Not in the game</p>
          <p class="mt-1 text-muted-foreground text-sm">
            This Pokemon is in the National Dex, but the current Cobblemon snapshot marks it as
            unimplemented.
          </p>
          <p class="mt-2 text-muted-foreground text-xs">
            It's definitely on{" "}
            <a
              href="https://modrinth.com/modpack/cobbleverse"
              target="_blank"
              rel="noreferrer"
              class="font-medium text-warning underline underline-offset-2 transition-opacity hover:opacity-80"
            >
              Cobbleverse
            </a>
            .
          </p>
        </section>
      </Show>

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
                <span class="font-mono">{activeHeight() ?? "—"} m</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-muted-foreground">Weight:</span>
                <span class="font-mono">{activeWeight() ?? "—"} kg</span>
              </div>
              <Tippy
                content={
                  <div class="max-w-[16rem] p-1">
                    <p class="text-xs leading-relaxed">
                      Chance of catching this Pokemon. Higher values (0-255) mean easier to catch.
                    </p>
                  </div>
                }
                props={{
                  trigger: "mouseenter focus",
                  placement: "top",
                  arrow: false,
                  delay: [100, 60],
                }}
              >
                <div class="flex cursor-help items-center gap-1.5">
                  <span class="text-muted-foreground">Catch Rate:</span>
                  <span class="font-mono">{activeCatchRate() ?? "—"}</span>
                </div>
              </Tippy>
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
              <ViewToggleButton
                active={activeView() === "model3d"}
                onClick={() => setActiveView("model3d")}
                label="3D"
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
              <Show when={activeView() === "model3d"}>
                <div class="h-full w-full">
                  <PokemonModelPreview
                    slug={detail().slug}
                    dexNumber={detail().dexNumber}
                    name={detail().name}
                  />
                </div>
              </Show>
              <Show when={activeView() !== "model3d"}>
                <Show
                  when={!artworkResolutionQuery.isPending}
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
            <a
              href={breedingExplorerHref()}
              class="flex items-center justify-center gap-2 border-border border-t bg-secondary/30 px-4 py-3 font-medium text-sm transition-colors hover:bg-secondary/50"
            >
              <span>See Compatible Pokemon</span>
              <IconArrowRight class="h-4 w-4" />
            </a>
          </section>

          {/* Drops */}
          <DropsCard drops={detail().drops} itemIndex={props.itemIndex} />
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
                    const biomeTokens = getConditionBiomeTokens(entry.condition)
                    const yRange = getConditionYRange(entry.condition)
                    const chips = formatConditionChips(entry.condition, {
                      includeBiomes: false,
                    })

                    return (
                      <div class="p-4">
                        <div class="mb-2 flex items-center justify-between">
                          <span class="font-medium">{titleCaseFromId(entry.bucket)}</span>
                          <div class="flex flex-wrap items-center justify-end gap-1.5">
                            <span class="border border-border bg-secondary/35 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                              Lv {entry.levelText ?? "—"}
                            </span>
                            <Show when={yRange}>
                              {(resolvedRange) => (
                                <span class="border border-border bg-secondary/35 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                  Y {resolvedRange()}
                                </span>
                              )}
                            </Show>
                            <span class="text-muted-foreground text-sm">
                              {titleCaseFromId(entry.spawnablePositionType)}
                            </span>
                          </div>
                        </div>
                        <Show when={biomeTokens.length > 0}>
                          <div class="mb-2 flex flex-wrap gap-1">
                            <For each={biomeTokens}>
                              {(biomeToken) => (
                                <BiomeConditionChip
                                  token={biomeToken}
                                  qualifyingLocations={props.biomeTagIndex[biomeToken] ?? []}
                                />
                              )}
                            </For>
                          </div>
                        </Show>
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
            activeFormSlug={activeEvolutionFormSlug()}
            itemIndex={props.itemIndex}
          />
        </Show>
      </section>

      <div class="mt-6">
        <CompetitiveSection
          slug={detail().slug}
          name={detail().name}
          dexNumber={detail().dexNumber}
          selectedForm={selectedForm()}
        />
      </div>

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

  return (
    <Show
      when={props.pokemon}
      fallback={
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
      }
    >
      {(pokemon) => {
        const dexNumber = () => pokemon().dexNumber

        return (
          <a
            href={`/pokemon/${pokemon().slug}`}
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
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNumber()}.png`}
                alt={pokemon().name}
                class="h-6 w-6 object-contain transition-transform group-hover:scale-110"
                loading="lazy"
              />
            </div>
            <div class={cn("flex flex-col", isPrevious ? "items-start" : "items-end")}>
              <span class="font-mono text-[10px] text-muted-foreground">
                #{String(dexNumber()).padStart(3, "0")}
              </span>
              <span class="font-medium text-xs transition-colors group-hover:text-foreground">
                {pokemon().name}
              </span>
            </div>
          </a>
        )
      }}
    </Show>
  )
}

function TypeIcon(props: { type: string }) {
  return <IconBox class="h-3.5 w-3.5" style={{ color: getTypeColor(props.type) }} />
}

function EggGroupIcon(props: { group: string }) {
  return <IconEgg class="h-3.5 w-3.5" style={{ color: getEggGroupColor(props.group) }} />
}

function getConditionBiomeTokens(condition: Record<string, unknown> | null): string[] {
  if (!condition || !Array.isArray(condition.biomes)) {
    return []
  }

  const seenTokens = new Set<string>()
  const tokens: string[] = []

  for (const biomeToken of condition.biomes) {
    if (typeof biomeToken !== "string") {
      continue
    }

    const normalizedToken = biomeToken.trim()
    if (!normalizedToken || seenTokens.has(normalizedToken)) {
      continue
    }

    seenTokens.add(normalizedToken)
    tokens.push(normalizedToken)
  }

  return tokens
}

function getConditionYRange(condition: Record<string, unknown> | null): string | null {
  if (!condition) {
    return null
  }

  const minY = typeof condition.minY === "number" ? Math.trunc(condition.minY) : null
  const maxY = typeof condition.maxY === "number" ? Math.trunc(condition.maxY) : null

  if (minY === null && maxY === null) {
    return null
  }

  return `${minY ?? "*"}-${maxY ?? "*"}`
}

function styleBiomeTooltipSurface(instance: { popper: HTMLElement }) {
  const tooltipBox = instance.popper.querySelector<HTMLElement>(".tippy-box")
  if (!tooltipBox) {
    return
  }

  tooltipBox.style.backgroundColor = "rgba(9, 9, 11, 0.88)"
  tooltipBox.style.border = "1px solid rgba(255, 255, 255, 0.14)"
  tooltipBox.style.backdropFilter = "blur(12px)"
  tooltipBox.style.setProperty("-webkit-backdrop-filter", "blur(12px)")
  tooltipBox.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.45)"

  const tooltipContent = tooltipBox.querySelector<HTMLElement>(".tippy-content")
  if (tooltipContent) {
    tooltipContent.style.padding = "10px"
  }
}

function BiomeConditionChip(props: { token: string; qualifyingLocations: string[] }) {
  const baseChipClass =
    "inline-flex items-center border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[11px] text-success"

  const tooltipContent = (
    <div class="w-[22rem] max-w-[calc(100vw-2rem)] space-y-2">
      <p class="font-mono text-[11px] text-white/95">{props.token}</p>
      <p class="font-mono text-[10px] text-white/70 uppercase tracking-wider">
        Qualifying locations
      </p>
      <div class="max-h-56 overflow-y-auto overflow-x-hidden rounded-[2px] border border-white/10 bg-white/[0.03] p-2">
        <ul class="m-0 list-none space-y-1 p-0">
          <For each={props.qualifyingLocations}>
            {(location) => (
              <li class="break-all font-mono text-[11px] text-white/90 leading-relaxed">
                {location}
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  )

  if (!props.token.startsWith("#") || props.qualifyingLocations.length === 0) {
    return <span class={baseChipClass}>{props.token}</span>
  }

  return (
    <Tippy
      content={tooltipContent}
      props={{
        trigger: "mouseenter focus click",
        placement: "top-start",
        interactive: true,
        arrow: false,
        maxWidth: "none",
        delay: [100, 60],
        offset: [0, 8],
        appendTo: () => document.body,
        onCreate(instance) {
          styleBiomeTooltipSurface(instance)
        },
        onMount(instance) {
          styleBiomeTooltipSurface(instance)
        },
        popperOptions: {
          strategy: "fixed",
          modifiers: [
            {
              name: "preventOverflow",
              options: {
                altAxis: true,
                padding: 12,
              },
            },
            {
              name: "flip",
              options: {
                padding: 12,
              },
            },
          ],
        },
      }}
    >
      <button
        type="button"
        class={cn(
          baseChipClass,
          "cursor-help transition-colors hover:border-success/50 hover:bg-success/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-success/50"
        )}
        aria-label={`Show qualifying locations for ${props.token}`}
      >
        {props.token}
      </button>
    </Tippy>
  )
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

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  OU: { bg: "bg-amber-500/15", text: "text-amber-600", border: "border-amber-500/30" },
  UUBL: { bg: "bg-amber-400/15", text: "text-amber-500", border: "border-amber-400/30" },
  UU: { bg: "bg-blue-500/15", text: "text-blue-600", border: "border-blue-500/30" },
  RUBL: { bg: "bg-blue-400/15", text: "text-blue-500", border: "border-blue-400/30" },
  RU: { bg: "bg-cyan-500/15", text: "text-cyan-600", border: "border-cyan-500/30" },
  NUBL: { bg: "bg-cyan-400/15", text: "text-cyan-500", border: "border-cyan-400/30" },
  NU: { bg: "bg-teal-500/15", text: "text-teal-600", border: "border-teal-500/30" },
  PUBL: { bg: "bg-teal-400/15", text: "text-teal-500", border: "border-teal-400/30" },
  PU: { bg: "bg-emerald-500/15", text: "text-emerald-600", border: "border-emerald-500/30" },
  ZU: { bg: "bg-slate-500/15", text: "text-slate-600", border: "border-slate-500/30" },
  NFE: { bg: "bg-gray-500/15", text: "text-gray-600", border: "border-gray-500/30" },
  LC: { bg: "bg-indigo-500/15", text: "text-indigo-600", border: "border-indigo-500/30" },
  Uber: { bg: "bg-red-500/15", text: "text-red-600", border: "border-red-500/30" },
  AG: { bg: "bg-red-600/15", text: "text-red-700", border: "border-red-600/30" },
}

function getTierColors(tier: string) {
  return (
    TIER_COLORS[tier] ?? {
      bg: "bg-secondary",
      text: "text-muted-foreground",
      border: "border-border",
    }
  )
}

function CompetitiveSection(props: {
  slug: string
  name: string
  dexNumber: number
  selectedForm: PokemonDetailRecord["forms"][number] | null
}) {
  const [activeTab, setActiveTab] = createSignal<"movesets" | "stats">("movesets")
  const [showAllMovesets, setShowAllMovesets] = createSignal(false)

  const selectedFormHint = createMemo<CompetitiveFormHint | null>(() => {
    if (!props.selectedForm) {
      return null
    }

    return {
      slug: props.selectedForm.slug,
      name: props.selectedForm.name,
      battleOnly: props.selectedForm.battleOnly,
      aspects: props.selectedForm.aspects,
    }
  })

  const pikalyticsFallbackId = createMemo(() => {
    const selectedForm = selectedFormHint()
    if (!selectedForm || selectedForm.battleOnly) {
      return props.name
    }

    const baseNameId = props.name.trim().replace(/\s+/g, "-")
    const formNameId = selectedForm.name.trim().replace(/\s+/g, "-")

    if (baseNameId && formNameId) {
      return `${baseNameId}-${formNameId}`
    }

    return selectedForm.slug
  })

  const competitiveQuery = useQuery(() => ({
    queryKey: [
      "competitive-reference",
      props.slug,
      props.name,
      selectedFormHint()?.slug ?? "",
      selectedFormHint()?.name ?? "",
      selectedFormHint()?.battleOnly ?? false,
    ],
    enabled: !import.meta.env.SSR,
    staleTime: 1000 * 60 * 30,
    queryFn: () =>
      loadCompetitiveReferenceData({
        slug: props.slug,
        name: props.name,
        selectedForm: selectedFormHint(),
      }),
  }))

  const smogonMovesetsQuery = useQuery(() => ({
    queryKey: ["competitive-smogon-movesets", props.slug],
    enabled: !import.meta.env.SSR,
    staleTime: 1000 * 60 * 60 * 6,
    queryFn: () => loadSmogonMovesetsBySlug(props.slug),
  }))

  const competitiveData = createMemo<CompetitiveReferenceData | null>(
    () => competitiveQuery.data ?? null
  )
  const snapshot = createMemo(() => competitiveData()?.snapshot ?? null)
  const smogonMovesets = createMemo(() => smogonMovesetsQuery.data ?? null)

  const activeSmogonEntry = createMemo<{ entryName: string; sets: SmogonMovesetRecord[] } | null>(
    () => {
      const payload = smogonMovesets()
      if (!payload) {
        return null
      }

      const selectedFormSlug = selectedFormHint()?.slug
      if (selectedFormSlug) {
        const formEntry = payload.formEntries[selectedFormSlug]
        if (formEntry && formEntry.sets.length > 0) {
          return {
            entryName: formEntry.entryName,
            sets: formEntry.sets,
          }
        }
      }

      if (payload.defaultSets.length === 0) {
        return null
      }

      return {
        entryName: payload.defaultEntryName ?? payload.name,
        sets: payload.defaultSets,
      }
    }
  )

  const visibleSmogonSets = createMemo(() => {
    const entry = activeSmogonEntry()
    if (!entry) return []
    if (showAllMovesets()) return entry.sets
    return entry.sets.slice(0, 2)
  })

  const hasMoreSets = createMemo(() => {
    const entry = activeSmogonEntry()
    if (!entry) return false
    return entry.sets.length > 2
  })

  const smogonUrl = createMemo(() => competitiveData()?.smogonUrl ?? buildSmogonDexUrl(props.slug))
  const pikalyticsUrl = createMemo(
    () => competitiveData()?.pikalyticsUrl ?? buildPikalyticsDexUrl(pikalyticsFallbackId())
  )

  const pikalyticsDataDateLabel = createMemo(() =>
    formatCompetitiveDataDate(competitiveData()?.pikalyticsDataDate ?? null)
  )

  const smogonFormatLabel = createMemo(() => smogonMovesets()?.formatLabel ?? "Smogon Gen 9")

  return (
    <section class="border border-border bg-card">
      <div class="flex items-center justify-between gap-2 border-border border-b bg-secondary px-4 py-3">
        <div class="flex items-center gap-2">
          <IconMedalOutline class="h-4 w-4 text-muted-foreground" />
          <h2 class="font-semibold">Competitive</h2>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <a
            href={smogonUrl()}
            target="_blank"
            rel="noreferrer noopener"
            class="group inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
          >
            <img
              src={SMOGON_LOGO_URL}
              alt=""
              class="h-3 w-3 object-contain"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            Smogon
            <IconIconArrowUpRight class="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
          </a>
          <a
            href={pikalyticsUrl()}
            target="_blank"
            rel="noreferrer noopener"
            class="group inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
          >
            <img
              src={PIKALYTICS_LOGO_URL}
              alt=""
              class="h-3 w-3 object-contain"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            Pikalytics
            <IconIconArrowUpRight class="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
          </a>
        </div>
      </div>

      <div class="space-y-4 p-4">
        <div class="flex flex-wrap items-center gap-3">
          <div class="inline-flex border border-border bg-secondary/30 p-0.5">
            <button
              type="button"
              class={cn(
                "px-4 py-1.5 font-medium text-[11px] uppercase tracking-wide transition-colors",
                activeTab() === "movesets"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("movesets")}
            >
              Movesets
            </button>
            <button
              type="button"
              class={cn(
                "px-4 py-1.5 font-medium text-[11px] uppercase tracking-wide transition-colors",
                activeTab() === "stats"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setActiveTab("stats")}
            >
              Stats
            </button>
          </div>

          <p class="text-muted-foreground text-xs">Data from Smogon/Pikalytics, not Cobblemon.</p>
        </div>

        <Show
          when={activeTab() === "movesets"}
          fallback={
            <div class="space-y-4">
              <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span class="border border-border bg-secondary px-2 py-1 font-mono uppercase tracking-wide">
                  {competitiveData()?.pikalyticsFormatLabel ?? "VGC 2026 Regulation Set F (1760+)"}
                </span>
                <Show when={pikalyticsDataDateLabel()}>
                  {(label) => (
                    <span class="border border-border bg-secondary/50 px-2 py-1 font-mono text-muted-foreground uppercase tracking-wide">
                      {label()}
                    </span>
                  )}
                </Show>
                <Show when={snapshot()?.ranking != null}>
                  <span class="border border-border bg-secondary/50 px-2 py-1 font-mono uppercase tracking-wide">
                    #{snapshot()?.ranking}
                  </span>
                </Show>
                <Show when={snapshot()?.usagePercent != null}>
                  <span class="border border-border bg-secondary/50 px-2 py-1 font-mono uppercase tracking-wide">
                    {formatCompetitivePercent(snapshot()?.usagePercent ?? 0)}
                  </span>
                </Show>
              </div>

              <Show
                when={!competitiveQuery.isPending}
                fallback={
                  <div class="flex items-center gap-2 text-muted-foreground text-xs">
                    <div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                    Loading Pikalytics stats...
                  </div>
                }
              >
                <Show
                  when={snapshot()}
                  fallback={
                    <div class="flex items-start gap-2 rounded-sm border border-border bg-secondary/30 px-3 py-2.5 text-xs">
                      <IconIconGhost class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                      <p class="text-muted-foreground">
                        No reliable ladder sample available for this species in the current format.
                      </p>
                    </div>
                  }
                >
                  {(snapshotSignal) => (
                    <div class="space-y-4">
                      <div class="grid gap-3 md:grid-cols-3">
                        <CompetitiveMovesList entries={snapshotSignal().topMoves} emptyLabel="—" />
                        <CompetitiveDistributionList
                          title="Items"
                          entries={snapshotSignal().topItems}
                          emptyLabel="—"
                        />
                        <CompetitiveDistributionList
                          title="Abilities"
                          entries={snapshotSignal().topAbilities}
                          emptyLabel="—"
                        />
                      </div>

                      <Show when={snapshotSignal().topSpread}>
                        {(spread) => (
                          <div class="flex items-center gap-3 rounded-sm border border-border bg-secondary/30 px-4 py-3">
                            <span class="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                              EV Spread
                            </span>
                            <div class="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              <span class="font-medium font-mono">{spread().nature}</span>
                              <span class="font-mono text-muted-foreground">
                                {spread().evSpread}
                              </span>
                              <span class="font-mono text-[10px] text-muted-foreground/70">
                                {formatCompetitivePercent(spread().percent)}
                              </span>
                            </div>
                          </div>
                        )}
                      </Show>
                    </div>
                  )}
                </Show>
              </Show>
            </div>
          }
        >
          <Show
            when={!smogonMovesetsQuery.isPending}
            fallback={
              <div class="flex items-center gap-2 text-muted-foreground text-xs">
                <div class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-foreground" />
                Loading Smogon movesets...
              </div>
            }
          >
            <Show
              when={activeSmogonEntry()}
              fallback={
                <div class="flex items-start gap-2 rounded-sm border border-border bg-secondary/30 px-3 py-2.5 text-xs">
                  <IconIconGhost class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <p class="text-muted-foreground">
                    No Smogon movesets available for this species or selected form.
                  </p>
                </div>
              }
            >
              {(entrySignal) => (
                <div class="space-y-4">
                  <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span class="border border-border bg-secondary px-2 py-1 font-mono uppercase tracking-wide">
                      {smogonFormatLabel()}
                    </span>
                    <span class="border border-border bg-secondary/50 px-2 py-1 font-mono text-muted-foreground uppercase tracking-wide">
                      {entrySignal().sets.length} sets
                    </span>
                    <span class="inline-flex items-center gap-1.5 border border-border bg-secondary/50 px-2 py-1 font-mono text-muted-foreground uppercase tracking-wide">
                      <img
                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${props.dexNumber}.png`}
                        alt=""
                        class="h-3.5 w-3.5 object-contain"
                        loading="lazy"
                      />
                      {entrySignal().entryName}
                    </span>
                  </div>

                  <div class="grid gap-3">
                    <For each={visibleSmogonSets()}>
                      {(moveset) => <SmogonMovesetCard moveset={moveset} />}
                    </For>
                  </div>

                  <Show when={hasMoreSets()}>
                    <button
                      type="button"
                      onClick={() => setShowAllMovesets(!showAllMovesets())}
                      class="w-full border border-border bg-secondary/30 px-4 py-2.5 font-medium text-muted-foreground text-xs transition-colors hover:border-muted-foreground hover:text-foreground"
                    >
                      {showAllMovesets()
                        ? "Show less"
                        : `Show ${entrySignal().sets.length - 2} more sets`}
                    </button>
                  </Show>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </section>
  )
}

function SmogonMovesetCard(props: { moveset: SmogonMovesetRecord }) {
  const evSpread = createMemo(() => formatSmogonStatSpread(props.moveset.evs))
  const ivSpread = createMemo(() => formatSmogonStatSpread(props.moveset.ivs))
  const tierColors = createMemo(() => getTierColors(props.moveset.tier))

  return (
    <div class="border border-border bg-secondary/20 p-2.5">
      {/* Compact Header */}
      <div class="mb-2 flex items-center justify-between gap-2">
        <h3 class="truncate font-medium text-xs">{props.moveset.name}</h3>
        <span
          class={cn(
            "shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide",
            tierColors().bg,
            tierColors().text,
            tierColors().border
          )}
        >
          {props.moveset.tier}
        </span>
      </div>

      {/* Compact Info Bar */}
      <div class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <Show when={props.moveset.ability}>
          {(ability) => (
            <span class="flex items-center gap-1">
              <span class="font-mono text-[9px] text-muted-foreground uppercase">Abi</span>
              <span class="font-medium">{ability()}</span>
            </span>
          )}
        </Show>
        <Show when={props.moveset.item}>
          {(item) => (
            <span class="flex items-center gap-1">
              <span class="font-mono text-[9px] text-muted-foreground uppercase">Item</span>
              <span class="font-medium">{item()}</span>
            </span>
          )}
        </Show>
        <Show when={props.moveset.natures.length > 0}>
          <span class="flex items-center gap-1">
            <span class="font-mono text-[9px] text-muted-foreground uppercase">Nat</span>
            <span class="font-mono">{props.moveset.natures.join("/")}</span>
          </span>
        </Show>
        <Show when={props.moveset.teraTypes.length > 0}>
          <span class="flex items-center gap-1">
            <span class="font-mono text-[9px] text-muted-foreground uppercase">Tera</span>
            <span>{props.moveset.teraTypes.join("/")}</span>
          </span>
        </Show>
      </div>

      {/* Compact Moves - Single Row */}
      <div class="mb-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        <For each={props.moveset.moves}>
          {(moveOptions) => <SmogonMoveSlotCompact moveOptions={moveOptions} />}
        </For>
      </div>

      {/* Compact EV/IV */}
      <Show when={evSpread() || ivSpread()}>
        <div class="flex flex-wrap gap-x-3 gap-y-0.5 border-border border-t pt-1.5 text-[10px] text-muted-foreground">
          <Show when={evSpread()}>{(spread) => <span class="font-mono">{spread()}</span>}</Show>
          <Show when={ivSpread()}>{(spread) => <span class="font-mono">{spread()}</span>}</Show>
        </div>
      </Show>
    </div>
  )
}

function SmogonMoveSlotCompact(props: { moveOptions: string[] }) {
  return (
    <span class="inline-flex items-center gap-0.5">
      <For each={props.moveOptions}>
        {(move, index) => (
          <>
            <Show when={index() > 0}>
              <span class="text-muted-foreground">/</span>
            </Show>
            <a
              href={`/moves/${canonicalId(move)}`}
              class="font-medium text-foreground transition-opacity hover:underline hover:opacity-70"
            >
              {move}
            </a>
          </>
        )}
      </For>
    </span>
  )
}

function formatSmogonStatSpread(spread: Record<string, number>): string | null {
  const orderedStats: Array<[string, string]> = [
    ["hp", "HP"],
    ["atk", "Atk"],
    ["def", "Def"],
    ["spa", "SpA"],
    ["spd", "SpD"],
    ["spe", "Spe"],
  ]

  const parts: string[] = []

  for (const [statId, label] of orderedStats) {
    const value = spread[statId]
    if (!Number.isFinite(value)) {
      continue
    }

    parts.push(`${Math.trunc(value)} ${label}`)
  }

  if (parts.length === 0) {
    return null
  }

  return parts.join(" / ")
}

function CompetitiveDistributionList(props: {
  title: string
  entries: CompetitiveDistributionEntry[]
  emptyLabel: string
}) {
  const maxPercent = createMemo(() => {
    if (props.entries.length === 0) return 0
    return Math.max(...props.entries.map((e) => e.percent))
  })

  return (
    <div class="border border-border bg-secondary/20 p-3">
      <h3 class="mb-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
        {props.title}
      </h3>

      <Show
        when={props.entries.length > 0}
        fallback={<p class="py-2 text-center text-muted-foreground text-xs">{props.emptyLabel}</p>}
      >
        <ul class="space-y-2">
          <For each={props.entries.slice(0, 4)}>
            {(entry) => {
              const barWidth = createMemo(() => {
                if (maxPercent() <= 0) return 0
                return (entry.percent / maxPercent()) * 100
              })

              return (
                <li class="group">
                  <div class="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span class="truncate font-medium">{entry.label}</span>
                    <span class="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatCompetitivePercent(entry.percent)}
                    </span>
                  </div>
                  <div class="h-0.5 w-full overflow-hidden bg-secondary/50">
                    <div
                      class="h-full bg-muted-foreground/30 transition-all duration-300"
                      style={{ width: `${barWidth()}%` }}
                    />
                  </div>
                </li>
              )
            }}
          </For>
        </ul>
      </Show>
    </div>
  )
}

function CompetitiveMovesList(props: {
  entries: CompetitiveDistributionEntry[]
  emptyLabel: string
}) {
  const maxPercent = createMemo(() => {
    if (props.entries.length === 0) return 0
    return Math.max(...props.entries.map((e) => e.percent))
  })

  return (
    <div class="border border-border bg-secondary/20 p-3">
      <h3 class="mb-2.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
        Moves
      </h3>

      <Show
        when={props.entries.length > 0}
        fallback={<p class="py-2 text-center text-muted-foreground text-xs">{props.emptyLabel}</p>}
      >
        <ul class="space-y-2">
          <For each={props.entries.slice(0, 4)}>
            {(entry) => <CompetitiveMoveItem entry={entry} maxPercent={maxPercent()} />}
          </For>
        </ul>
      </Show>
    </div>
  )
}

function CompetitiveMoveItem(props: { entry: CompetitiveDistributionEntry; maxPercent: number }) {
  const moveId = createMemo(() => {
    return canonicalId(props.entry.label)
  })

  const moveQuery = useQuery(() => ({
    queryKey: ["competitive-move", moveId()],
    enabled: !import.meta.env.SSR && !!moveId(),
    staleTime: 1000 * 60 * 30,
    queryFn: () => loadMoveLearnerEntry(moveId()),
  }))

  const moveData = createMemo(() => moveQuery.data)
  const moveType = createMemo(() => moveData()?.type ?? null)
  const typeColor = createMemo(() => (moveType() ? getTypeColor(moveType()!) : null))

  const barWidth = createMemo(() => {
    if (props.maxPercent <= 0) return 0
    return (props.entry.percent / props.maxPercent) * 100
  })

  return (
    <li class="group">
      <div class="mb-1 flex items-center justify-between gap-2 text-xs">
        <a
          href={`/moves/${moveId()}`}
          class="flex items-center gap-1.5 truncate transition-opacity hover:opacity-80"
        >
          <Show when={typeColor()}>
            {(color) => (
              <span class="h-2 w-2 shrink-0 rounded-full" style={{ "background-color": color() }} />
            )}
          </Show>
          <span class="truncate font-medium">{props.entry.label}</span>
        </a>
        <span class="shrink-0 font-mono text-[10px] text-muted-foreground">
          {formatCompetitivePercent(props.entry.percent)}
        </span>
      </div>
      <div class="h-0.5 w-full overflow-hidden bg-secondary/50">
        <div
          class="h-full bg-muted-foreground/30 transition-all duration-300"
          style={{ width: `${barWidth()}%` }}
        />
      </div>
    </li>
  )
}

function formatCompetitivePercent(percent: number): string {
  if (!Number.isFinite(percent)) {
    return "--"
  }

  if (percent >= 10) {
    return `${percent.toFixed(1)}%`
  }

  if (percent >= 1) {
    return `${percent.toFixed(2)}%`
  }

  return `${percent.toFixed(3)}%`
}

function formatCompetitiveDataDate(dataDate: string | null): string | null {
  if (!dataDate) {
    return null
  }

  const [yearToken, monthToken] = dataDate.split("-")
  const year = Number.parseInt(yearToken ?? "", 10)
  const month = Number.parseInt(monthToken ?? "", 10)

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return dataDate
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]

  return `${monthNames[month - 1]} ${year}`
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

function navigateToPokemon(slug: string) {
  void navigate(`/pokemon/${slug}`)
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

function extractFormSlugFromUrl(urlLike: string | undefined): string | null {
  if (!urlLike) {
    return null
  }

  try {
    const url = new URL(urlLike, "https://cobblepedia.local")
    return normalizeFormSlug(url.searchParams.get("form"))
  } catch {
    return null
  }
}

function normalizeFormSlug(rawValue: string | null): string | null {
  if (!rawValue) {
    return null
  }

  const normalized = rawValue.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function DropsCard(props: { drops: PokemonDropData | null; itemIndex: ItemIndex | null }) {
  const drops = () => props.drops

  const getItemPathId = (itemId: string): string => {
    return parseItemId(itemId).path
  }

  const getItemNamespace = (itemId: string): string | null => {
    return parseItemId(itemId).namespace
  }

  const resolveItemEntry = (itemId: string) => {
    if (!props.itemIndex) {
      return null
    }

    const pathId = getItemPathId(itemId)
    return props.itemIndex[itemId] ?? props.itemIndex[pathId] ?? null
  }

  const resolveDropHref = (itemId: string): string => {
    const namespace = getItemNamespace(itemId)
    const pathId = getItemPathId(itemId)

    if (namespace === "minecraft") {
      return `https://minecraft.wiki/w/${encodeURIComponent(pathId)}`
    }

    return `/items/${encodeURIComponent(pathId)}`
  }

  const formatItemName = (itemId: string): string => {
    const itemEntry = resolveItemEntry(itemId)
    if (itemEntry) {
      return itemEntry.name
    }

    return titleCaseFromId(getItemPathId(itemId))
  }

  const getAssetPath = (itemId: string): string | null => {
    return resolveItemEntry(itemId)?.assetPath ?? null
  }

  const formatDropDetails = (entry: PokemonDropData["entries"][number]): string => {
    const parts: string[] = []

    if (entry.quantityRange) {
      parts.push(entry.quantityRange)
    }

    if (entry.percentage !== undefined && entry.percentage !== null) {
      parts.push(`${entry.percentage}%`)
    }

    return parts.join(" · ")
  }

  return (
    <section class="border border-border bg-card">
      <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
        <IconGift class="h-4 w-4 text-muted-foreground" />
        <h2 class="font-semibold">Drops</h2>
      </div>
      <Show
        when={drops()}
        fallback={
          <p class="p-4 text-muted-foreground text-sm">No drop data available for this species.</p>
        }
      >
        {(dropsData) => (
          <Show
            when={dropsData().entries.length > 0}
            fallback={
              <p class="p-4 text-muted-foreground text-sm">
                No drop data available for this species.
              </p>
            }
          >
            <div class="p-4">
              <div class="space-y-2">
                <For each={dropsData().entries}>
                  {(entry) => {
                    const details = formatDropDetails(entry)
                    const isMinecraftItem = () => getItemNamespace(entry.item) === "minecraft"

                    return (
                      <a
                        href={resolveDropHref(entry.item)}
                        target={isMinecraftItem() ? "_blank" : undefined}
                        rel={isMinecraftItem() ? "noreferrer noopener" : undefined}
                        class="group flex items-center gap-3 border border-border bg-secondary/20 px-3 py-2.5 transition-colors hover:border-muted-foreground hover:bg-secondary/40"
                      >
                        <ItemSprite
                          itemId={entry.item}
                          name={formatItemName(entry.item)}
                          assetPath={getAssetPath(entry.item)}
                          class="h-6 w-6"
                        />
                        <div class="flex min-w-0 flex-1 flex-col">
                          <span class="truncate font-medium text-sm">
                            {formatItemName(entry.item)}
                          </span>
                          <Show when={details}>
                            <span class="font-mono text-[11px] text-muted-foreground">
                              {details}
                            </span>
                          </Show>
                        </div>
                      </a>
                    )
                  }}
                </For>
              </div>
            </div>
          </Show>
        )}
      </Show>
    </section>
  )
}

import { useQuery } from "@tanstack/solid-query"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { navigate } from "vike/client/router"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { IconEgg } from "@/assets/icons"
import { DualEggGroupSelector } from "@/components/dual-egg-group-selector"
import { PokemonSprite } from "@/components/pokemon-sprite"
import type { PokemonListItem } from "@/data/cobblemon-types"
import { loadPokemonDetail, loadPokemonList } from "@/data/data-loader"
import { canonicalId, formatEggGroup } from "@/data/formatters"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

const EGG_GROUP_ORDER = [
  "monster",
  "water_1",
  "water_2",
  "water_3",
  "bug",
  "flying",
  "field",
  "fairy",
  "grass",
  "human_like",
  "mineral",
  "amorphous",
  "ditto",
  "dragon",
  "undiscovered",
] as const

const EGG_GROUP_COLORS: Record<string, string> = {
  monster: "#8b5cf6",
  water_1: "#00d4ff",
  bug: "#84cc16",
  flying: "#818cf8",
  field: "#d97706",
  fairy: "#f472b6",
  grass: "#22c55e",
  human_like: "#f97316",
  water_3: "#00b8d4",
  mineral: "#94a3b8",
  amorphous: "#a78bfa",
  water_2: "#00e5ff",
  ditto: "#e879f9",
  dragon: "#6366f1",
  undiscovered: "#64748b",
}

const COMPATIBILITY_DETAIL_TIMEOUT_MS = 8000

type BreedingCompatibilityMode = "loading" | "standard" | "genderless" | "ditto" | "none"

type BreedingCompatibilitySection = {
  id: string
  title: string
  accentColor: string
  members: PokemonListItem[]
  visibleMembers: PokemonListItem[]
}

type BreedingCompatibilitySnapshot = {
  mode: BreedingCompatibilityMode
  sections: BreedingCompatibilitySection[]
  uniqueTotal: number
  uniqueVisible: number
}

type BreedingGenderProfile = {
  isGenderless: boolean
  hasMale: boolean
  hasFemale: boolean
}

export default function Page() {
  const pageContext = usePageContext()
  const initialEggGroup = createMemo(() => String(pageContext.routeParams.eggGroupId ?? ""))
  const initialPokemonSlug = createMemo(() => String(pageContext.routeParams.pokemonSlug ?? ""))

  return (
    <EggGroupsPageView
      initialEggGroup={initialEggGroup()}
      initialPokemonSlug={initialPokemonSlug()}
    />
  )
}

export function EggGroupsPageView(props: {
  initialEggGroup?: string
  initialPokemonSlug?: string
}) {
  const pageContext = usePageContext()
  const pokemonListQuery = useQuery(() => ({
    queryKey: ["pokemon-list"],
    queryFn: loadPokemonList,
  }))
  const pokemonList = createMemo(() => pokemonListQuery.data ?? [])
  const [primaryEggGroup, setPrimaryEggGroup] = createSignal("")
  const [secondaryEggGroup, setSecondaryEggGroup] = createSignal<string | null>(null)
  const [selectedPokemonSlug, setSelectedPokemonSlug] = createSignal("")
  const [pokemonSearch, setPokemonSearch] = createSignal("")
  const [compatibilitySearch, setCompatibilitySearch] = createSignal("")
  let pokemonDirectoryFilterRef: HTMLInputElement | undefined

  useMetadata({
    title: getTitle("Egg Groups"),
  })

  const availableEggGroups = createMemo(() => {
    const set = new Set<string>()
    for (const pokemon of pokemonList()) {
      for (const group of pokemon.eggGroups) {
        set.add(group)
      }
    }
    return sortEggGroups(Array.from(set))
  })

  const resolveEggGroup = (value: string) => {
    const normalized = canonicalId(value)
    if (!normalized) return ""
    return availableEggGroups().find((group) => canonicalId(group) === normalized) ?? ""
  }

  const resolvePokemonSlug = (value: string) => {
    const normalized = canonicalId(value)
    if (!normalized) return ""

    return (
      pokemonList().find(
        (pokemon) => pokemon.implemented && canonicalId(pokemon.slug) === normalized
      )?.slug ?? ""
    )
  }

  const getRoutePathname = () => {
    if (typeof pageContext.urlPathname === "string" && pageContext.urlPathname.length > 0) {
      return pageContext.urlPathname
    }

    if (typeof window !== "undefined") {
      return window.location.pathname
    }

    return ""
  }

  const getRouteSearchValue = (key: "secondary" | "pokemon") => {
    const value = pageContext.urlParsed?.search?.[key]
    if (typeof value === "string") {
      return value
    }

    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get(key) ?? ""
    }

    return ""
  }

  createEffect(() => {
    const nextPrimarySource =
      extractEggGroupIdFromPathname(getRoutePathname()) || props.initialEggGroup || ""
    const nextPrimary = resolveEggGroup(nextPrimarySource)
    const nextSecondaryFromUrl = canonicalId(getRouteSearchValue("secondary"))
    const nextSecondary = resolveEggGroup(nextSecondaryFromUrl)
    const nextPokemonFromUrl = canonicalId(
      getRouteSearchValue("pokemon") || props.initialPokemonSlug || ""
    )
    const nextPokemonSlug = resolvePokemonSlug(nextPokemonFromUrl)
    const normalizedSecondary =
      nextPrimary && nextSecondary && nextSecondary !== nextPrimary ? nextSecondary : null

    setPrimaryEggGroup(nextPrimary)
    setSecondaryEggGroup(normalizedSecondary)
    setSelectedPokemonSlug(nextPokemonSlug)
  })

  const selectedEggGroups = createMemo(() => {
    const primary = primaryEggGroup()
    const secondary = secondaryEggGroup()
    if (!primary) return []
    if (secondary) return [primary, secondary]
    return [primary]
  })

  const syncUrl = (
    primary: string,
    secondary: string | null,
    pokemonSlug: string | null,
    mode: "replace" | "push" = "replace"
  ) => {
    const path = primary ? `/egg-groups/${primary}` : "/egg-groups"
    const search = new URLSearchParams()

    if (secondary) {
      search.set("secondary", secondary)
    }

    if (pokemonSlug) {
      search.set("pokemon", pokemonSlug)
    }

    const nextUrl = search.toString() ? `${path}?${search.toString()}` : path

    if (typeof window !== "undefined") {
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl === nextUrl) {
        return
      }
    }

    void navigate(nextUrl, {
      overwriteLastHistoryEntry: mode === "replace",
      keepScrollPosition: true,
    })
  }

  const buildExplorerHref = (pokemonSlug: string | null = null) => {
    const path = primaryEggGroup() ? `/egg-groups/${primaryEggGroup()}` : "/egg-groups"
    const search = new URLSearchParams()

    if (secondaryEggGroup()) {
      search.set("secondary", secondaryEggGroup() ?? "")
    }

    if (pokemonSlug) {
      search.set("pokemon", pokemonSlug)
    }

    return search.toString() ? `${path}?${search.toString()}` : path
  }

  const handleEggGroupChange = (eggGroups: string[]) => {
    const validGroups = availableEggGroups()
    const normalized = eggGroups
      .map((group) => resolveEggGroup(group))
      .filter(Boolean)
      .filter((group, index, arr) => arr.indexOf(group) === index)
      .filter((group) => validGroups.length === 0 || validGroups.includes(group))
      .slice(0, 2)

    const nextPrimary = normalized[0] ?? ""
    const nextSecondary = normalized[1] ?? null
    const nextSelectedPokemon = ""

    setPrimaryEggGroup(nextPrimary)
    setSecondaryEggGroup(nextPrimary ? nextSecondary : null)
    setSelectedPokemonSlug(nextSelectedPokemon)
    syncUrl(nextPrimary, nextPrimary ? nextSecondary : null, nextSelectedPokemon || null)
  }

  const handlePokemonSelection = (pokemonSlug: string) => {
    const nextPokemonSlug = resolvePokemonSlug(pokemonSlug)
    const primary = primaryEggGroup()
    const secondary = secondaryEggGroup()

    if (!nextPokemonSlug) return

    const nextMode =
      selectedPokemonSlug() && selectedPokemonSlug() !== nextPokemonSlug ? "push" : "replace"
    setSelectedPokemonSlug(nextPokemonSlug)
    syncUrl(primary, secondary, nextPokemonSlug, nextMode)
  }

  const focusPokemonDirectoryFilter = () => {
    const input = pokemonDirectoryFilterRef
    if (!input) return

    input.focus()
    input.select()
  }

  createEffect(() => {
    if (typeof window === "undefined") return

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      focusPokemonDirectoryFilter()
    }

    window.addEventListener("keydown", onWindowKeyDown)
    onCleanup(() => {
      window.removeEventListener("keydown", onWindowKeyDown)
    })
  })

  const filteredPokemon = createMemo(() => {
    const list = pokemonList()
    const primary = primaryEggGroup()
    const secondary = secondaryEggGroup()
    if (!primary) return []

    return list.filter((pokemon) => {
      if (!pokemon.implemented) return false
      if (!pokemon.eggGroups.includes(primary)) return false
      if (secondary && !pokemon.eggGroups.includes(secondary)) return false
      return true
    })
  })

  const visiblePokemon = createMemo(() => {
    const query = canonicalId(pokemonSearch().trim())
    const list = filteredPokemon()

    if (!query) {
      return list
    }

    return list.filter((pokemon) => {
      return (
        canonicalId(pokemon.name).includes(query) ||
        canonicalId(pokemon.slug).includes(query) ||
        String(pokemon.dexNumber).includes(query) ||
        pokemon.eggGroups.some((group) => canonicalId(group).includes(query))
      )
    })
  })

  const selectedPokemon = createMemo(() => {
    const selectedSlug = selectedPokemonSlug()
    if (!selectedSlug) return null

    return (
      pokemonList().find(
        (pokemon) => pokemon.implemented && canonicalId(pokemon.slug) === canonicalId(selectedSlug)
      ) ?? null
    )
  })

  const selectedPokemonDetailSlug = createMemo(() => selectedPokemon()?.slug ?? "")

  const selectedPokemonDetailQuery = useQuery(() => ({
    queryKey: ["pokemon-detail", selectedPokemonDetailSlug()],
    enabled: selectedPokemonDetailSlug().length > 0,
    queryFn: async () => {
      const slug = selectedPokemonDetailSlug()
      if (!slug) {
        return null
      }

      return withTimeout(loadPokemonDetail(slug), COMPATIBILITY_DETAIL_TIMEOUT_MS, null)
    },
  }))

  const selectedPokemonDetail = createMemo(() => selectedPokemonDetailQuery.data ?? null)
  const selectedPokemonDetailIsLoading = createMemo(() => {
    return (
      selectedPokemonDetailSlug().length > 0 &&
      selectedPokemonDetailQuery.isFetching &&
      selectedPokemonDetailQuery.data === undefined
    )
  })

  const standardCompatibilityProfileKey = createMemo(() => {
    const selected = selectedPokemon()
    if (!selected) return ""
    if (selectedPokemonDetailIsLoading()) return ""

    const selectedEggGroups = selected.eggGroups.map((group) => canonicalId(group))
    const selectedIsDitto =
      canonicalId(selected.slug) === "ditto" || selectedEggGroups.includes("ditto")
    const selectedIsUndiscovered = selectedEggGroups.includes("undiscovered")
    const selectedGenderProfile = resolveBreedingGenderProfile(selectedPokemonDetail()?.maleRatio)

    if (selectedIsDitto || selectedIsUndiscovered || selectedGenderProfile.isGenderless) {
      return ""
    }

    const candidates = dedupePokemonBySlug(
      pokemonList().filter((pokemon) => {
        if (!pokemon.implemented) return false
        if (canonicalId(pokemon.slug) === "ditto") return false
        if (pokemon.eggGroups.some((group) => canonicalId(group) === "undiscovered")) {
          return false
        }

        return pokemon.eggGroups.some((group) => selectedEggGroups.includes(canonicalId(group)))
      })
    )

    return candidates
      .map((pokemon) => canonicalId(pokemon.slug))
      .sort((left, right) => left.localeCompare(right))
      .join("|")
  })

  const standardCompatibilityProfilesQuery = useQuery(() => ({
    queryKey: ["egg-group-standard-compatibility-profiles", standardCompatibilityProfileKey()],
    enabled: standardCompatibilityProfileKey().length > 0,
    queryFn: async () => {
      const slugKey = standardCompatibilityProfileKey()
      if (!slugKey) {
        return new Map<string, BreedingGenderProfile>()
      }

      const slugs = slugKey.split("|").filter(Boolean)
      const entries = await Promise.all(
        slugs.map(async (slug) => {
          const detail = await withTimeout(
            loadPokemonDetail(slug),
            COMPATIBILITY_DETAIL_TIMEOUT_MS,
            null
          )
          return [canonicalId(slug), resolveBreedingGenderProfile(detail?.maleRatio)] as const
        })
      )

      return new Map<string, BreedingGenderProfile>(entries)
    },
  }))

  const standardCompatibilityProfiles = createMemo(
    () => standardCompatibilityProfilesQuery.data ?? new Map<string, BreedingGenderProfile>()
  )
  const standardCompatibilityProfilesAreLoading = createMemo(() => {
    return (
      standardCompatibilityProfileKey().length > 0 &&
      standardCompatibilityProfilesQuery.isFetching &&
      standardCompatibilityProfilesQuery.data === undefined
    )
  })

  createEffect(() => {
    selectedPokemon()?.slug
    setCompatibilitySearch("")
  })

  const compatibilitySnapshot = createMemo<BreedingCompatibilitySnapshot | null>(() => {
    const selected = selectedPokemon()
    if (!selected) return null

    if (selectedPokemonDetailIsLoading()) {
      return {
        mode: "loading",
        sections: [],
        uniqueTotal: 0,
        uniqueVisible: 0,
      }
    }

    const implementedPokemon = pokemonList().filter((pokemon) => pokemon.implemented)
    const dittoPokemon =
      implementedPokemon.find((pokemon) => canonicalId(pokemon.slug) === "ditto") ?? null
    const selectedEggGroupsNormalized = selected.eggGroups.map((group) => canonicalId(group))
    const selectedIsDitto =
      canonicalId(selected.slug) === "ditto" || selectedEggGroupsNormalized.includes("ditto")
    const selectedIsUndiscovered = selectedEggGroupsNormalized.includes("undiscovered")
    const selectedGenderProfile = resolveBreedingGenderProfile(selectedPokemonDetail()?.maleRatio)
    const selectedIsGenderless = selectedGenderProfile.isGenderless
    const searchTerm = canonicalId(compatibilitySearch().trim())

    const applySearch = (members: PokemonListItem[]) => {
      if (!searchTerm) {
        return members
      }

      return members.filter((pokemon) => {
        return (
          canonicalId(pokemon.name).includes(searchTerm) ||
          canonicalId(pokemon.slug).includes(searchTerm) ||
          String(pokemon.dexNumber).includes(searchTerm)
        )
      })
    }

    const buildSection = (
      id: string,
      title: string,
      accentColor: string,
      members: PokemonListItem[]
    ): BreedingCompatibilitySection => {
      const uniqueMembers = sortPokemonByDex(dedupePokemonBySlug(members))

      return {
        id,
        title,
        accentColor,
        members: uniqueMembers,
        visibleMembers: applySearch(uniqueMembers),
      }
    }

    if (selectedIsDitto) {
      const allBreedableSpecies = implementedPokemon.filter((pokemon) => {
        if (canonicalId(pokemon.slug) === "ditto") return false
        return !pokemon.eggGroups.some((group) => canonicalId(group) === "undiscovered")
      })

      const section = buildSection(
        "ditto-partners",
        "All Breedable Species",
        EGG_GROUP_COLORS.ditto ?? "#e879f9",
        allBreedableSpecies
      )

      return {
        mode: "ditto",
        sections: [section],
        uniqueTotal: section.members.length,
        uniqueVisible: section.visibleMembers.length,
      }
    }

    if (selectedIsUndiscovered) {
      return {
        mode: "none",
        sections: [],
        uniqueTotal: 0,
        uniqueVisible: 0,
      }
    }

    if (selectedIsGenderless) {
      const section = buildSection(
        "genderless-partners",
        "Ditto Only",
        EGG_GROUP_COLORS.ditto ?? "#e879f9",
        dittoPokemon ? [dittoPokemon] : []
      )

      return {
        mode: "genderless",
        sections: [section],
        uniqueTotal: section.members.length,
        uniqueVisible: section.visibleMembers.length,
      }
    }

    if (standardCompatibilityProfilesAreLoading()) {
      return {
        mode: "loading",
        sections: [],
        uniqueTotal: 0,
        uniqueVisible: 0,
      }
    }

    const partnerProfiles = standardCompatibilityProfiles()

    const sections = selected.eggGroups
      .filter((group) => {
        const normalized = canonicalId(group)
        return normalized !== "ditto" && normalized !== "undiscovered"
      })
      .map((group) => {
        const groupMembers = implementedPokemon.filter((pokemon) => {
          if (canonicalId(pokemon.slug) === "ditto") {
            return false
          }

          if (pokemon.eggGroups.some((eggGroup) => canonicalId(eggGroup) === "undiscovered")) {
            return false
          }

          if (!pokemon.eggGroups.some((eggGroup) => canonicalId(eggGroup) === canonicalId(group))) {
            return false
          }

          const partnerProfile =
            partnerProfiles.get(canonicalId(pokemon.slug)) ??
            resolveBreedingGenderProfile(undefined)

          return canBreedWithGenderProfile(selectedGenderProfile, partnerProfile)
        })

        const membersWithDitto =
          dittoPokemon && !groupMembers.some((pokemon) => pokemon.slug === dittoPokemon.slug)
            ? [dittoPokemon, ...groupMembers]
            : groupMembers

        return buildSection(
          group,
          `${formatEggGroup(group)} Group`,
          EGG_GROUP_COLORS[group] ?? "#9ca3af",
          membersWithDitto
        )
      })

    const uniqueTotal = dedupePokemonBySlug(sections.flatMap((section) => section.members)).length
    const uniqueVisible = dedupePokemonBySlug(
      sections.flatMap((section) => section.visibleMembers)
    ).length

    return {
      mode: sections.length > 0 ? "standard" : "none",
      sections,
      uniqueTotal,
      uniqueVisible,
    }
  })

  const requestedEggGroupId = createMemo(() => {
    return extractEggGroupIdFromPathname(getRoutePathname()) || props.initialEggGroup || ""
  })

  const requestedEggGroup = createMemo(() => canonicalId(requestedEggGroupId()))

  const isUnknownEggGroup = createMemo(() => {
    const requested = requestedEggGroup()
    if (!requested || availableEggGroups().length === 0) return false
    return !availableEggGroups().some((group) => canonicalId(group) === requested)
  })

  const primaryEggGroupColor = createMemo(() => EGG_GROUP_COLORS[primaryEggGroup()] ?? "#9ca3af")
  const hasNoSelection = createMemo(() => !primaryEggGroup())

  return (
    <div class="mx-auto max-w-6xl px-3 py-8 sm:px-4 lg:px-8">
      <Show when={!pokemonListQuery.isPending} fallback={<LoadingState />}>
        <Show
          when={!isUnknownEggGroup()}
          fallback={<UnknownEggGroupState eggGroupId={requestedEggGroupId()} />}
        >
          <div class="space-y-6">
            <section class="border border-border bg-card p-4">
              <div class="mb-3">
                <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                  Egg Group Explorer
                </p>
              </div>
              <DualEggGroupSelector
                availableEggGroups={availableEggGroups()}
                selectedEggGroups={selectedEggGroups()}
                onChange={handleEggGroupChange}
              />
            </section>

            <Show
              when={!hasNoSelection()}
              fallback={<EmptySelectionState availableEggGroups={availableEggGroups()} />}
            >
              <header class="relative overflow-hidden border border-border bg-card">
                <div class="relative p-5 sm:p-6">
                  <div class="flex items-start justify-between gap-4">
                    <div class="space-y-2">
                      <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                        Egg Group Analysis
                      </p>
                      <div class="flex items-center gap-2">
                        <IconEgg class="h-4 w-4" style={{ color: primaryEggGroupColor() }} />
                        <h1 class="font-semibold text-2xl tracking-tight sm:text-3xl">
                          {formatEggGroup(primaryEggGroup())}
                          <Show when={secondaryEggGroup()}>
                            {(group) => (
                              <>
                                {" / "}
                                <span style={{ color: EGG_GROUP_COLORS[group()] ?? "#9ca3af" }}>
                                  {formatEggGroup(group())}
                                </span>
                              </>
                            )}
                          </Show>
                        </h1>
                      </div>
                      <p class="text-muted-foreground text-sm">
                        {filteredPokemon().length} Pokemon
                        <Show when={secondaryEggGroup()}>
                          <span> with both egg groups</span>
                        </Show>
                      </p>
                    </div>

                    <div class="hidden text-right sm:block">
                      <p class="font-mono text-muted-foreground text-xs">
                        #
                        {String(
                          EGG_GROUP_ORDER.indexOf(
                            primaryEggGroup() as (typeof EGG_GROUP_ORDER)[number]
                          ) + 1
                        ).padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                </div>
              </header>

              <section class="space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                      Pokemon Directory
                    </p>
                    <p class="text-muted-foreground text-xs">
                      {visiblePokemon().length} shown
                      <Show when={visiblePokemon().length !== filteredPokemon().length}>
                        <span> of {filteredPokemon().length}</span>
                      </Show>
                    </p>
                  </div>

                  <div class="relative w-full sm:w-80">
                    <input
                      ref={pokemonDirectoryFilterRef}
                      type="text"
                      class="w-full border border-border bg-background px-3 py-2 pr-10 text-sm outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
                      placeholder="Filter Pokemon by name, dex, or group..."
                      value={pokemonSearch()}
                      onInput={(event) => setPokemonSearch(event.currentTarget.value)}
                    />
                    <span class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      /
                    </span>
                  </div>
                </div>

                <Show
                  when={filteredPokemon().length > 0}
                  fallback={
                    <div class="border border-border bg-card p-8 text-center">
                      <p class="text-muted-foreground text-sm">
                        No Pokemon with {formatEggGroup(primaryEggGroup())}
                        <Show when={secondaryEggGroup()}>
                          {(group) => <span> and {formatEggGroup(group())}</span>}
                        </Show>
                        .
                      </p>
                    </div>
                  }
                >
                  <Show when={selectedPokemon()}>
                    {(selectedSignal) => {
                      const selected = createMemo(() => selectedSignal())
                      const snapshot = createMemo(() => compatibilitySnapshot())

                      return (
                        <section
                          class="border border-border border-l-4 bg-card p-4 sm:p-5"
                          style={{ "border-left-color": primaryEggGroupColor() }}
                        >
                          <div class="mb-4 flex flex-wrap items-start justify-between gap-3 border-border border-b pb-4">
                            <div class="space-y-1.5">
                              <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                                Compatibility
                              </p>
                              <div class="flex items-center gap-2">
                                <PokemonSprite
                                  dexNumber={selected().dexNumber}
                                  name={selected().name}
                                  class="h-10 w-10"
                                  imageClass="h-8 w-8"
                                />
                                <div>
                                  <p class="font-semibold text-lg leading-tight">
                                    {selected().name}
                                  </p>
                                  <p class="font-mono text-muted-foreground text-xs">
                                    #{String(selected().dexNumber).padStart(3, "0")}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <a
                              href={`/pokemon/${selected().slug}`}
                              class="border border-border px-2.5 py-1 text-muted-foreground text-xs transition-colors hover:border-muted-foreground hover:text-foreground"
                            >
                              Open Pokemon Page
                            </a>
                          </div>

                          <div class="mb-4 space-y-2">
                            <CompatibilityMessage
                              mode={snapshot()?.mode ?? "none"}
                              selectedName={selected().name}
                            />
                            <Show when={(snapshot()?.uniqueTotal ?? 0) > 0}>
                              <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
                                {snapshot()?.uniqueVisible ?? 0} shown /{" "}
                                {snapshot()?.uniqueTotal ?? 0} total
                              </p>
                            </Show>
                          </div>

                          <Show
                            when={snapshot()?.mode !== "loading"}
                            fallback={<CompatibilityLoadingState />}
                          >
                            <div class="space-y-3">
                              <Show when={(snapshot()?.sections.length ?? 0) > 0}>
                                <input
                                  type="text"
                                  class="w-full border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-muted-foreground"
                                  placeholder="Filter compatible Pokemon..."
                                  value={compatibilitySearch()}
                                  onInput={(event) =>
                                    setCompatibilitySearch(event.currentTarget.value)
                                  }
                                />
                              </Show>

                              <Show
                                when={(snapshot()?.sections.length ?? 0) > 0}
                                fallback={
                                  <div class="border border-border bg-secondary/20 p-5 text-center text-muted-foreground text-sm">
                                    No compatible partners are available for this Pokemon.
                                  </div>
                                }
                              >
                                <div class="grid gap-3 md:grid-cols-2">
                                  <For each={snapshot()?.sections ?? []}>
                                    {(section) => (
                                      <article class="border border-border bg-card/60">
                                        <div class="flex items-center justify-between border-border border-b px-3 py-2">
                                          <p
                                            class="font-mono text-[10px] uppercase tracking-wide"
                                            style={{ color: section.accentColor }}
                                          >
                                            {section.title}
                                          </p>
                                          <span class="font-mono text-[10px] text-muted-foreground">
                                            {section.visibleMembers.length}/{section.members.length}
                                          </span>
                                        </div>

                                        <div class="max-h-[360px] overflow-auto">
                                          <Show
                                            when={section.visibleMembers.length > 0}
                                            fallback={
                                              <p class="px-3 py-6 text-center text-muted-foreground text-sm">
                                                No matches for this filter.
                                              </p>
                                            }
                                          >
                                            <For each={section.visibleMembers}>
                                              {(partner) => {
                                                const isActive = () =>
                                                  canonicalId(selectedPokemonSlug()) ===
                                                  canonicalId(partner.slug)

                                                return (
                                                  <a
                                                    href={buildExplorerHref(partner.slug)}
                                                    class={cn(
                                                      "flex items-center justify-between gap-2 border-border border-b px-3 py-2 text-sm last:border-0 hover:bg-secondary/40",
                                                      isActive() && "bg-secondary/40"
                                                    )}
                                                    onClick={(event) => {
                                                      event.preventDefault()
                                                      handlePokemonSelection(partner.slug)
                                                    }}
                                                  >
                                                    <div class="flex min-w-0 items-center gap-2">
                                                      <PokemonSprite
                                                        dexNumber={partner.dexNumber}
                                                        name={partner.name}
                                                        class="h-7 w-7"
                                                        imageClass="h-5 w-5"
                                                      />
                                                      <span class="truncate">{partner.name}</span>
                                                    </div>
                                                    <span class="font-mono text-muted-foreground text-xs">
                                                      #{String(partner.dexNumber).padStart(3, "0")}
                                                    </span>
                                                  </a>
                                                )
                                              }}
                                            </For>
                                          </Show>
                                        </div>
                                      </article>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          </Show>
                        </section>
                      )
                    }}
                  </Show>

                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <For each={visiblePokemon()}>
                      {(pokemon) => {
                        const isSelected = () =>
                          canonicalId(selectedPokemonSlug()) === canonicalId(pokemon.slug)

                        return (
                          <a
                            href={buildExplorerHref(pokemon.slug)}
                            class={cn(
                              "group flex items-center gap-3 border border-border bg-card p-2 transition-colors hover:border-muted-foreground",
                              isSelected() && "border-foreground bg-secondary/30"
                            )}
                            aria-current={isSelected() ? "true" : undefined}
                            onClick={(event) => {
                              event.preventDefault()
                              handlePokemonSelection(pokemon.slug)
                            }}
                          >
                            <PokemonSprite
                              dexNumber={pokemon.dexNumber}
                              name={pokemon.name}
                              class="h-8 w-8 shrink-0"
                              imageClass="h-6 w-6"
                            />

                            <div class="min-w-0 flex-1">
                              <div class="flex items-center justify-between gap-2">
                                <p class="truncate font-medium text-sm group-hover:text-foreground">
                                  {pokemon.name}
                                </p>
                                <span class="font-mono text-muted-foreground text-xs">
                                  #{String(pokemon.dexNumber).padStart(3, "0")}
                                </span>
                              </div>

                              <div class="mt-0.5 flex flex-wrap items-center gap-1">
                                <For each={pokemon.eggGroups}>
                                  {(group) => (
                                    <span
                                      class="border border-dashed px-1 py-0 font-mono text-[10px] uppercase tracking-wide"
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
                            </div>
                          </a>
                        )
                      }}
                    </For>
                  </div>

                  <Show when={visiblePokemon().length === 0}>
                    <div class="border border-border bg-card p-6 text-center text-muted-foreground text-sm">
                      No Pokemon in this egg group match your filter.
                    </div>
                  </Show>
                </Show>
              </section>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading egg group data...</p>
    </div>
  )
}

function CompatibilityLoadingState() {
  return (
    <div class="flex min-h-[220px] flex-col items-center justify-center gap-3 border border-border bg-secondary/20 p-6">
      <div class="h-6 w-6 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Resolving breeding rules...</p>
    </div>
  )
}

function CompatibilityMessage(props: { mode: BreedingCompatibilityMode; selectedName: string }) {
  if (props.mode === "ditto") {
    return (
      <p class="text-muted-foreground text-sm">
        <span class="font-medium text-foreground">Ditto</span> can breed with nearly every species
        except other Ditto and Undiscovered egg-group Pokemon.
      </p>
    )
  }

  if (props.mode === "genderless") {
    return (
      <p class="text-muted-foreground text-sm">
        <span class="font-medium text-foreground">{props.selectedName}</span> is genderless and can
        only breed with Ditto.
      </p>
    )
  }

  if (props.mode === "none") {
    return (
      <p class="text-muted-foreground text-sm">
        <span class="font-medium text-foreground">{props.selectedName}</span> cannot breed.
      </p>
    )
  }

  if (props.mode === "loading") {
    return (
      <p class="text-muted-foreground text-sm">
        Loading breeding rules for{" "}
        <span class="font-medium text-foreground">{props.selectedName}</span>
        ...
      </p>
    )
  }

  return (
    <p class="text-muted-foreground text-sm">
      <span class="font-medium text-foreground">{props.selectedName}</span> can breed with Ditto and
      Pokemon sharing at least one of its egg groups.
    </p>
  )
}

function EmptySelectionState(props: { availableEggGroups: string[] }) {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 border border-border bg-card p-8 text-center">
      <h2 class="font-semibold text-xl">Select an Egg Group</h2>
      <p class="text-muted-foreground text-sm">
        Use the selector above to explore one egg group or intersect two groups.
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <For each={props.availableEggGroups}>
          {(group) => (
            <a
              href={`/egg-groups/${group}`}
              class="inline-flex items-center gap-1 border px-3 py-1.5 font-mono text-xs uppercase transition-colors hover:opacity-80"
              style={{
                "border-color": EGG_GROUP_COLORS[group] ?? "#9ca3af",
                color: EGG_GROUP_COLORS[group] ?? "#9ca3af",
              }}
            >
              <IconEgg class="h-3 w-3" />
              {formatEggGroup(group)}
            </a>
          )}
        </For>
      </div>
    </div>
  )
}

function UnknownEggGroupState(props: { eggGroupId: string }) {
  return (
    <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 border border-border bg-card p-8 text-center">
      <h1 class="font-semibold text-2xl">Egg Group Not Found</h1>
      <p class="text-muted-foreground text-sm">
        <span class="font-mono">{props.eggGroupId || "unknown"}</span> is not a recognized egg
        group.
      </p>
    </div>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }

  return target.isContentEditable
}

function extractEggGroupIdFromPathname(pathname: string): string {
  const match = pathname.match(/\/egg-groups\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ""
}

function resolveBreedingGenderProfile(maleRatio: number | null | undefined): BreedingGenderProfile {
  if (typeof maleRatio !== "number" || Number.isNaN(maleRatio)) {
    return {
      isGenderless: false,
      hasMale: true,
      hasFemale: true,
    }
  }

  if (maleRatio < 0) {
    return {
      isGenderless: true,
      hasMale: false,
      hasFemale: false,
    }
  }

  return {
    isGenderless: false,
    hasMale: maleRatio > 0,
    hasFemale: maleRatio < 1,
  }
}

function canBreedWithGenderProfile(
  selectedProfile: BreedingGenderProfile,
  partnerProfile: BreedingGenderProfile
): boolean {
  if (selectedProfile.isGenderless || partnerProfile.isGenderless) {
    return false
  }

  return (
    (selectedProfile.hasMale && partnerProfile.hasFemale) ||
    (selectedProfile.hasFemale && partnerProfile.hasMale)
  )
}

function dedupePokemonBySlug(pokemonList: PokemonListItem[]): PokemonListItem[] {
  return Array.from(new Map(pokemonList.map((pokemon) => [pokemon.slug, pokemon])).values())
}

function sortPokemonByDex(pokemonList: PokemonListItem[]): PokemonListItem[] {
  return [...pokemonList].sort((left, right) => {
    if (left.dexNumber !== right.dexNumber) {
      return left.dexNumber - right.dexNumber
    }

    return left.name.localeCompare(right.name)
  })
}

function sortEggGroups(groups: string[]): string[] {
  return [...groups].sort((left, right) => {
    const leftIndex = EGG_GROUP_ORDER.indexOf(left as (typeof EGG_GROUP_ORDER)[number])
    const rightIndex = EGG_GROUP_ORDER.indexOf(right as (typeof EGG_GROUP_ORDER)[number])

    if (leftIndex !== -1 && rightIndex !== -1 && leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    if (leftIndex !== -1) return -1
    if (rightIndex !== -1) return 1

    return left.localeCompare(right)
  })
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = globalThis.setTimeout(() => {
      resolve(fallback)
    }, timeoutMs)

    promise
      .then((value) => {
        globalThis.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch(() => {
        globalThis.clearTimeout(timeoutId)
        resolve(fallback)
      })
  })
}

import { createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { loadMeta } from "@/data/data-loader"
import { cn } from "@/utils/cn"
import getTitle from "@/utils/get-title"

// Pokemon sprite configurations for visual elements
const FEATURED_POKEMON = [
  { id: 6, name: "Charizard", slug: "charizard", types: ["fire", "flying"] },
  { id: 448, name: "Lucario", slug: "lucario", types: ["fighting", "steel"] },
  { id: 376, name: "Metagross", slug: "metagross", types: ["steel", "psychic"] },
  { id: 445, name: "Garchomp", slug: "garchomp", types: ["dragon", "ground"] },
]

const MOVE_LEARNER_POKEMON = [
  { id: 25, name: "Pikachu", slug: "pikachu" },
  { id: 65, name: "Alakazam", slug: "alakazam" },
  { id: 94, name: "Gengar", slug: "gengar" },
  { id: 149, name: "Dragonite", slug: "dragonite" },
]

const STARTER_POKEMON = [
  { id: 1, name: "Bulbasaur", slug: "bulbasaur" },
  { id: 4, name: "Charmander", slug: "charmander" },
  { id: 7, name: "Squirtle", slug: "squirtle" },
  { id: 152, name: "Chikorita", slug: "chikorita" },
  { id: 155, name: "Cyndaquil", slug: "cyndaquil" },
  { id: 158, name: "Totodile", slug: "totodile" },
]

const FAN_FAVORITES = [
  { id: 25, name: "Pikachu", slug: "pikachu" },
  { id: 448, name: "Lucario", slug: "lucario" },
  { id: 445, name: "Garchomp", slug: "garchomp" },
  { id: 376, name: "Metagross", slug: "metagross" },
  { id: 248, name: "Tyranitar", slug: "tyranitar" },
  { id: 130, name: "Gyarados", slug: "gyarados" },
]

const FINAL_CTA_POKEMON = [
  { id: 25, name: "Pikachu", slug: "pikachu" },
  { id: 6, name: "Charizard", slug: "charizard" },
  { id: 448, name: "Lucario", slug: "lucario" },
  { id: 445, name: "Garchomp", slug: "garchomp" },
  { id: 150, name: "Mewtwo", slug: "mewtwo" },
]

const EXAMPLE_QUERIES = [
  { query: "lucario moves", label: "lucario moves" },
  { query: "garchomp spawn", label: "garchomp spawn" },
  { query: "moves earthquake", label: "moves earthquake" },
  { query: "pikachu evolve", label: "pikachu evolve" },
  { query: "tyranitar egg", label: "tyranitar egg" },
  { query: "charizard", label: "charizard" },
]

// Helper to get PokeAPI sprite URL
function getSpriteUrl(pokemonId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`
}

function getOfficialArtworkUrl(pokemonId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`
}

// Type icons from Pokemon Showdown (reliable CDN)
function getTypeIconUrl(type: string): string {
  return `https://play.pokemonshowdown.com/sprites/types/${type.charAt(0).toUpperCase() + type.slice(1)}.png`
}

export default function Page() {
  useMetadata({
    title: getTitle("Home"),
  })

  const [meta] = createResource(loadMeta)
  const [demoQuery, setDemoQuery] = createSignal("")

  const openPalette = (query?: string) => {
    window.dispatchEvent(new CustomEvent("cobblepedia:open-palette", { detail: query || "" }))
  }

  const handleQuickJump = (query: string) => {
    setDemoQuery("")
    let i = 0
    const typeInterval = setInterval(() => {
      if (i <= query.length) {
        setDemoQuery(query.slice(0, i))
        i++
      } else {
        clearInterval(typeInterval)
      }
    }, 50)
  }

  return (
    <div class="min-h-screen bg-background">
      {/* Hero Section - The Living Gateway */}
      <section class="relative overflow-hidden border-border border-b">
        {/* Animated gradient background */}
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/50 via-background to-background" />

        {/* Floating side accents */}
        <div class="pointer-events-none absolute inset-0 hidden lg:block">
          {/* Left side floating elements - scattered positions */}
          <div class="pointer-events-none absolute inset-0 hidden lg:block">
            {/* Fire type - top left */}
            <div
              class="absolute top-[15%] left-[5%] animate-float opacity-30"
              style={{ "animation-delay": "0s", "animation-duration": "4s" }}
            >
              <img
                src={getTypeIconUrl("fire")}
                alt="Fire"
                class="h-12 w-12 object-contain"
                loading="lazy"
              />
            </div>
            {/* Water type - scattered */}
            <div
              class="absolute top-[35%] left-[8%] animate-float opacity-30"
              style={{ "animation-delay": "0.5s", "animation-duration": "4.2s" }}
            >
              <img
                src={getTypeIconUrl("water")}
                alt="Water"
                class="h-14 w-14 object-contain"
                loading="lazy"
              />
            </div>
            {/* Grass type */}
            <div
              class="absolute top-[55%] left-[4%] animate-float opacity-30"
              style={{ "animation-delay": "1s", "animation-duration": "3.8s" }}
            >
              <img
                src={getTypeIconUrl("grass")}
                alt="Grass"
                class="h-10 w-10 object-contain"
                loading="lazy"
              />
            </div>
            {/* Electric type */}
            <div
              class="absolute top-[75%] left-[10%] animate-float opacity-30"
              style={{ "animation-delay": "1.5s", "animation-duration": "4.5s" }}
            >
              <img
                src={getTypeIconUrl("electric")}
                alt="Electric"
                class="h-12 w-12 object-contain"
                loading="lazy"
              />
            </div>

            {/* Left Pokemon sprites - scattered */}
            <div
              class="absolute top-[20%] left-[15%] animate-float opacity-40"
              style={{ "animation-delay": "0s", "animation-duration": "5s" }}
            >
              <img
                src={getSpriteUrl(448)}
                alt="Lucario"
                class="h-16 w-16 object-contain drop-shadow-lg"
                loading="lazy"
              />
            </div>
            <div
              class="absolute top-[42%] left-[18%] animate-float opacity-40"
              style={{ "animation-delay": "0.8s", "animation-duration": "5.5s" }}
            >
              <img
                src={getSpriteUrl(6)}
                alt="Charizard"
                class="h-20 w-20 object-contain drop-shadow-lg"
                loading="lazy"
              />
            </div>
            <div
              class="absolute top-[65%] left-[12%] animate-float opacity-40"
              style={{ "animation-delay": "1.5s", "animation-duration": "4.8s" }}
            >
              <img
                src={getSpriteUrl(445)}
                alt="Garchomp"
                class="h-16 w-16 object-contain drop-shadow-lg"
                loading="lazy"
              />
            </div>

            {/* Right Pokemon sprites - scattered */}
            <div
              class="absolute top-[18%] right-[12%] animate-float opacity-40"
              style={{ "animation-delay": "0.3s", "animation-duration": "4.7s" }}
            >
              <img
                src={getSpriteUrl(130)}
                alt="Gyarados"
                class="h-20 w-20 object-contain drop-shadow-lg"
                loading="lazy"
              />
            </div>
            <div
              class="absolute top-[40%] right-[18%] animate-float opacity-40"
              style={{ "animation-delay": "1s", "animation-duration": "5.2s" }}
            >
              <img
                src={getSpriteUrl(25)}
                alt="Pikachu"
                class="h-14 w-14 object-contain drop-shadow-lg"
                loading="lazy"
              />
            </div>
            <div
              class="absolute top-[62%] right-[8%] animate-float opacity-40"
              style={{ "animation-delay": "1.8s", "animation-duration": "4.5s" }}
            >
              <img
                src={getSpriteUrl(94)}
                alt="Gengar"
                class="h-16 w-16 object-contain drop-shadow-lg"
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div class="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-3 py-24 text-center sm:px-4 sm:py-32 lg:px-8">
          {/* Badge */}
          <div class="mb-8 inline-flex items-center gap-2 border border-border bg-secondary/80 px-3 py-1.5 backdrop-blur-sm">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            <span class="font-medium text-muted-foreground text-xs">Instant Results</span>
          </div>

          {/* Main Headline */}
          <h1 class="mb-6 font-semibold text-5xl tracking-tight sm:text-7xl lg:text-8xl">
            The fastest
            <br />
            <span class="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent">
              Cobblemon wiki.
            </span>
          </h1>

          {/* Subheadline */}
          <p class="mb-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Built for speed. <span class="text-foreground">Vim-inspired.</span>
            <br class="hidden sm:block" /> Keyboard-first, zero friction, instant answers.
          </p>
          <p class="mb-10 max-w-xl text-muted-foreground text-sm">
            Spawns, moves, evolutions, egg groups, rideable mons, plus Smogon/Pikalytics movesets —
            everything's here. Feels unlike any wiki you've seen.
          </p>

          {/* CTAs */}
          <div class="mb-16 flex flex-col items-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => openPalette()}
              class="group inline-flex items-center gap-2 border border-foreground bg-foreground px-6 py-3 font-medium text-background text-sm transition-all hover:bg-foreground/90 hover:shadow-lg"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>Open Search</span>
              <span class="ml-2 flex items-center gap-1 border-background/20 border-l pl-3 text-background/70">
                <kbd class="rounded bg-background/10 px-1.5 py-0.5 font-mono text-xs">⌘</kbd>
                <span class="text-xs">K</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => openPalette("pokemon")}
              class="group inline-flex items-center gap-2 border border-border bg-card px-6 py-3 font-medium text-sm transition-all hover:border-muted-foreground hover:bg-secondary"
            >
              <span>Browse All Pokémon</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                class="transition-transform group-hover:translate-x-1"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Live Search Demo */}
          <div class="w-full max-w-2xl">
            <div class="overflow-hidden border border-border bg-card shadow-2xl">
              {/* Window chrome */}
              <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
                <div class="h-3 w-3 rounded-full bg-[#ff5f56]" />
                <div class="h-3 w-3 rounded-full bg-[#ffbd2e]" />
                <div class="h-3 w-3 rounded-full bg-[#27c93f]" />
                <span class="flex-1 text-center font-mono text-muted-foreground text-xs">
                  cobblepedia search
                </span>
              </div>

              <div class="p-6">
                {/* Search input */}
                <div class="mb-6 flex items-center gap-3 border border-border bg-secondary px-4 py-3">
                  <svg
                    class="h-4 w-4 text-muted-foreground"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                  <span class="flex-1 text-left font-mono text-sm">
                    {demoQuery() || "lucario moves"}
                    <span class="animate-pulse">|</span>
                  </span>
                  <span class="border border-border bg-background px-2 py-1 font-mono text-muted-foreground text-xs">
                    ESC
                  </span>
                </div>

                {/* Results preview */}
                <div class="grid gap-px border border-border bg-border sm:grid-cols-[1fr_1.2fr]">
                  <div class="space-y-px bg-border">
                    <div class="flex cursor-pointer items-center gap-3 border-foreground border-l-2 bg-card p-3">
                      <img src={getSpriteUrl(448)} alt="Lucario" class="h-10 w-10 object-contain" />
                      <div>
                        <div class="font-medium text-sm">Lucario</div>
                        <div class="text-muted-foreground text-xs">
                          Aura Pokémon · Fighting/Steel
                        </div>
                      </div>
                    </div>
                    <div class="flex cursor-pointer items-center gap-3 border-transparent border-l-2 p-3 transition-colors hover:bg-card">
                      <img src={getSpriteUrl(447)} alt="Riolu" class="h-10 w-10 object-contain" />
                      <div>
                        <div class="font-medium text-sm">Riolu</div>
                        <div class="text-muted-foreground text-xs">Emanation Pokémon</div>
                      </div>
                    </div>
                  </div>

                  <div class="bg-card p-4">
                    <div class="mb-3 flex items-center gap-2 border-border border-b pb-3">
                      <img src={getSpriteUrl(448)} alt="Lucario" class="h-8 w-8 object-contain" />
                      <span class="font-semibold text-sm">Lucario — Moves</span>
                    </div>
                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between border-border border-b pb-2">
                        <span class="text-muted-foreground">Type</span>
                        <span class="font-medium">Fighting / Steel</span>
                      </div>
                      <div class="flex justify-between border-border border-b pb-2">
                        <span class="text-muted-foreground">Level Moves</span>
                        <span class="font-medium">24</span>
                      </div>
                      <div class="flex justify-between border-border border-b pb-2">
                        <span class="text-muted-foreground">TM Moves</span>
                        <span class="font-medium">41</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-muted-foreground">Egg Moves</span>
                        <span class="font-medium">8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards - Four Ways In */}
      <section class="border-border border-b py-20 sm:py-28">
        <div class="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8">
          <div class="mb-16 text-center">
            <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
              Features
            </span>
            <h2 class="font-semibold text-3xl tracking-tight sm:text-4xl">
              Four ways to find what you need
            </h2>
          </div>

          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Vim Style */}
            <div class="group relative border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg">
              <div class="mb-5 flex h-12 w-12 items-center justify-center border border-border bg-secondary font-mono text-lg">
                ⌨
              </div>
              <h3 class="mb-2 font-semibold text-lg">Vim-Inspired</h3>
              <p class="mb-4 text-muted-foreground text-sm">
                hjkl to navigate. gg to top. G to bottom. For vim nerds who hate reaching for the
                mouse.
              </p>
              <div class="border border-border bg-background px-3 py-2 font-mono text-muted-foreground text-xs">
                ⌘K | Esc | ↑↓ | Enter
              </div>
            </div>

            {/* Search by Pokemon */}
            <div class="group relative border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg">
              <div class="mb-4 flex -space-x-2">
                <For each={FEATURED_POKEMON}>
                  {(pokemon) => (
                    <img
                      src={getSpriteUrl(pokemon.id)}
                      alt={pokemon.name}
                      class="h-10 w-10 rounded-full border-2 border-card bg-secondary object-contain transition-transform group-hover:scale-110"
                      loading="lazy"
                    />
                  )}
                </For>
              </div>
              <h3 class="mb-2 font-semibold text-lg">By Pokémon</h3>
              <p class="mb-4 text-muted-foreground text-sm">
                Know the name? We've got everything. Moves, spawns, evolutions, egg groups, plus
                Smogon/Pikalytics movesets.
              </p>
              <div class="border border-border bg-background px-3 py-2 font-mono text-muted-foreground text-xs">
                lucario | garchomp | metagross
              </div>
            </div>

            {/* Search by Move */}
            <div class="group relative border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg">
              <div class="mb-4 flex">
                <For each={MOVE_LEARNER_POKEMON}>
                  {(pokemon, i) => (
                    <img
                      src={getSpriteUrl(pokemon.id)}
                      alt={pokemon.name}
                      class="h-10 w-10 rounded-full border-2 border-card bg-secondary object-contain transition-transform group-hover:scale-110"
                      style={{ "z-index": MOVE_LEARNER_POKEMON.length - i() }}
                      loading="lazy"
                    />
                  )}
                </For>
              </div>
              <h3 class="mb-2 font-semibold text-lg">By Move</h3>
              <p class="mb-4 text-muted-foreground text-sm">
                Looking for a specific move? Find every learner instantly. Who learns Surf? Who gets
                Trick Room?
              </p>
              <div class="border border-border bg-background px-3 py-2 font-mono text-muted-foreground text-xs">
                moves surf | moves trickroom
              </div>
            </div>

            {/* Search by Mechanic */}
            <div class="group relative border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg">
              <div class="mb-4 flex items-center justify-center gap-1">
                <img
                  src={getSpriteUrl(129)}
                  alt="Magikarp"
                  class="h-10 w-10 object-contain transition-transform group-hover:-translate-x-1"
                  loading="lazy"
                />
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="text-muted-foreground"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                <img
                  src={getSpriteUrl(130)}
                  alt="Gyarados"
                  class="h-12 w-12 object-contain transition-transform group-hover:translate-x-1"
                  loading="lazy"
                />
              </div>
              <h3 class="mb-2 font-semibold text-lg">By Mechanic</h3>
              <p class="mb-4 text-muted-foreground text-sm">
                Need spawn data? Evolution chains? Breeding groups? Natural language facets that
                just work.
              </p>
              <div class="border border-border bg-background px-3 py-2 font-mono text-muted-foreground text-xs">
                [pokemon] egg | [pokemon] evolve
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Playground */}
      <section class="border-border border-b bg-secondary/30 py-20 sm:py-28">
        <div class="mx-auto max-w-2xl px-3 sm:px-4 lg:px-8">
          <div class="mb-8 text-center">
            <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
              Try It Live
            </span>
            <h2 class="font-semibold text-3xl tracking-tight sm:text-4xl">See it in action</h2>
          </div>

          {/* Compact cmdk-style search box */}
          <div class="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            {/* Search input */}
            <div class="border-border border-b bg-secondary/50 p-3">
              <button
                type="button"
                class="flex w-full cursor-pointer items-center gap-2 rounded bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-secondary"
                onClick={() => openPalette(demoQuery() || "lucario moves")}
              >
                <svg
                  class="h-4 w-4 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span class="flex-1 text-muted-foreground text-sm">
                  {demoQuery() || "Search Pokémon, moves, spawns..."}
                </span>
                <kbd class="hidden rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-muted-foreground text-xs sm:block">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Quick jumps - horizontal scroll on mobile */}
            <div class="scrollbar-thin flex gap-1 overflow-x-auto border-border border-b bg-card p-2">
              <For each={EXAMPLE_QUERIES}>
                {(item) => (
                  <button
                    type="button"
                    onClick={() => handleQuickJump(item.query)}
                    class={cn(
                      "shrink-0 whitespace-nowrap rounded px-2 py-1 text-xs transition-colors",
                      demoQuery() === item.query
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </div>

            {/* Results preview - compact list */}
            <div class="max-h-48 overflow-y-auto bg-card p-1">
              <Show
                when={demoQuery()}
                fallback={
                  <div class="flex items-center gap-3 px-3 py-2 text-muted-foreground text-sm">
                    <span class="text-muted-foreground/50">→</span>
                    <span>Select a quick jump above</span>
                  </div>
                }
              >
                {/* Result item */}
                <div class="flex cursor-pointer items-center gap-3 rounded bg-secondary/50 px-3 py-2">
                  <img
                    src={
                      demoQuery().includes("charizard")
                        ? getSpriteUrl(6)
                        : demoQuery().includes("garchomp")
                          ? getSpriteUrl(445)
                          : demoQuery().includes("pikachu")
                            ? getSpriteUrl(25)
                            : demoQuery().includes("tyranitar")
                              ? getSpriteUrl(248)
                              : getSpriteUrl(448)
                    }
                    alt=""
                    class="h-8 w-8 object-contain"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-medium text-sm">
                      {demoQuery().includes("charizard")
                        ? "Charizard"
                        : demoQuery().includes("garchomp")
                          ? "Garchomp"
                          : demoQuery().includes("pikachu")
                            ? "Pikachu"
                            : demoQuery().includes("tyranitar")
                              ? "Tyranitar"
                              : demoQuery().includes("earthquake")
                                ? "Earthquake"
                                : "Lucario"}
                    </div>
                    <div class="truncate text-muted-foreground text-xs">
                      {demoQuery().includes("moves")
                        ? "View all 73 moves"
                        : demoQuery().includes("spawn")
                          ? "8 spawn locations"
                          : demoQuery().includes("evolve")
                            ? "3 evolution stages"
                            : demoQuery().includes("egg")
                              ? "2 egg groups"
                              : demoQuery().includes("earthquake")
                                ? "127 Pokémon can learn"
                                : "Fighting · Steel"}
                    </div>
                  </div>
                  <span class="text-muted-foreground text-xs">↵</span>
                </div>
                {/* Additional fake results for visual */}
                <div class="flex items-center gap-3 px-3 py-2 opacity-50">
                  <div class="h-8 w-8" />
                  <div class="flex-1">
                    <div class="h-4 w-24 rounded bg-secondary" />
                  </div>
                </div>
                <div class="flex items-center gap-3 px-3 py-2 opacity-30">
                  <div class="h-8 w-8" />
                  <div class="flex-1">
                    <div class="h-4 w-32 rounded bg-secondary" />
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </section>

      {/* Data Section - Trust & Transparency */}
      <section class="border-border border-b py-20 sm:py-28">
        <div class="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8">
          <div class="mb-16 text-center">
            <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
              Data
            </span>
            <h2 class="font-semibold text-3xl tracking-tight sm:text-4xl">
              Powered by official sources
            </h2>
          </div>

          <div class="mb-12 grid gap-8 lg:grid-cols-2">
            {/* Stats */}
            <div class="space-y-6">
              <div class="flex items-center gap-3 text-muted-foreground">
                <div class="h-px flex-1 bg-border" />
                <span class="font-mono text-xs uppercase">Data Pipeline</span>
                <div class="h-px flex-1 bg-border" />
              </div>

              <div class="flex items-center justify-center gap-4 font-mono text-xs">
                <div class="flex items-center gap-2 text-muted-foreground">
                  <img
                    src="https://media.forgecdn.net/avatars/thumbnails/620/286/256/256/638008832892634916.png"
                    alt="Cobblemon"
                    class="h-5 w-5 object-contain"
                    loading="lazy"
                  />
                  Cobblemon
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="text-muted-foreground"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                <div class="flex items-center gap-2 text-muted-foreground">
                  <img
                    src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjTjeNHyqBHdImqGDutRVJ02tBUSDXaZfgtg&amp;s"
                    alt="PokeAPI"
                    class="h-5 w-5 object-contain"
                    loading="lazy"
                  />
                  PokeAPI
                </div>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="text-muted-foreground"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
                <div class="flex items-center gap-2 text-muted-foreground">
                  <img
                    src="https://archives.bulbagarden.net/media/upload/3/38/Smogon_logo.png"
                    alt="Smogon"
                    class="h-5 w-5 object-contain"
                    loading="lazy"
                  />
                  Smogon
                </div>
              </div>

              {meta.loading ? (
                <div class="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
                  <div class="bg-card p-4 text-center">
                    <div class="font-mono text-lg">...</div>
                  </div>
                </div>
              ) : meta.error ? (
                <div class="border border-border bg-card p-6 text-center">
                  <span class="text-muted-foreground text-sm">Run `bun run generate:data`</span>
                </div>
              ) : (
                <div class="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
                  <div class="bg-card p-5">
                    <div class="mb-1 font-bold font-mono text-3xl">
                      {meta()?.implementedSpeciesCount}
                    </div>
                    <div class="text-muted-foreground text-xs">Playable Species</div>
                  </div>
                  <div class="bg-card p-5">
                    <div class="mb-1 font-bold font-mono text-3xl">
                      {meta()?.spawnEntryCount.toLocaleString()}
                    </div>
                    <div class="text-muted-foreground text-xs">Spawn Entries</div>
                  </div>
                  <div class="bg-card p-5">
                    <div class="mb-1 font-bold font-mono text-3xl">{meta()?.moveCount}</div>
                    <div class="text-muted-foreground text-xs">Total Moves</div>
                  </div>
                  <div class="bg-card p-5">
                    <div class="mb-1 font-bold font-mono text-3xl">15</div>
                    <div class="text-muted-foreground text-xs">Egg Groups</div>
                  </div>
                  <div class="bg-card p-5">
                    <div class="mb-2 flex justify-center gap-1">
                      <img
                        src="https://archives.bulbagarden.net/media/upload/3/38/Smogon_logo.png"
                        alt="Smogon"
                        class="h-6 w-6 object-contain"
                        loading="lazy"
                      />
                      <img
                        src="https://cdn.pikalytics.com/images/favicon/apple-icon.png"
                        alt="Pikalytics"
                        class="h-6 w-6 object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div class="text-muted-foreground text-xs">Smogon & Pikalytics</div>
                  </div>
                  <div class="bg-card p-5">
                    <div class="mb-1 font-bold font-mono text-3xl">
                      {new Date(meta()?.generatedAt || "").toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    <div class="text-muted-foreground text-xs">Last Updated</div>
                  </div>
                </div>
              )}

              <div class="flex gap-4">
                <a
                  href="https://gitlab.com/cable-mc/cobblemon"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
                >
                  View Official Cobblemon Repo
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Visual - Data flow diagram */}
            <div class="flex items-center justify-center">
              <div class="relative h-72 w-72">
                {/* Cobblemon - top left */}
                <div class="absolute top-0 left-4 flex flex-col items-center gap-2">
                  <div class="flex aspect-square h-20 w-20 items-center justify-center border border-border bg-card shadow-sm">
                    <img
                      src="https://media.forgecdn.net/avatars/thumbnails/620/286/256/256/638008832892634916.png"
                      alt="Cobblemon"
                      class="h-10 w-10 object-contain"
                    />
                  </div>
                  <span class="font-mono text-muted-foreground text-xs">Cobblemon</span>
                </div>

                {/* Assets - top right */}
                <div class="absolute top-0 right-4 flex flex-col items-center gap-2">
                  <div class="flex aspect-square h-20 w-20 items-center justify-center border border-border bg-card shadow-sm">
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <span class="font-mono text-muted-foreground text-xs">Assets</span>
                </div>

                {/* PokeAPI - bottom left */}
                <div class="absolute bottom-0 left-4 flex flex-col items-center gap-2">
                  <div class="flex aspect-square h-20 w-20 items-center justify-center border border-border bg-card shadow-sm">
                    <img
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjTjeNHyqBHdImqGDutRVJ02tBUSDXaZfgtg&amp;s"
                      alt="PokeAPI"
                      class="h-10 w-10 object-contain"
                    />
                  </div>
                  <span class="font-mono text-muted-foreground text-xs">PokeAPI</span>
                </div>

                {/* Smogon - bottom right */}
                <div class="absolute right-4 bottom-0 flex flex-col items-center gap-2">
                  <div class="flex aspect-square h-20 w-20 items-center justify-center border border-border bg-card shadow-sm">
                    <img
                      src="https://archives.bulbagarden.net/media/upload/3/38/Smogon_logo.png"
                      alt="Smogon"
                      class="h-10 w-10 object-contain"
                    />
                  </div>
                  <span class="font-mono text-muted-foreground text-xs">Smogon</span>
                </div>

                {/* Connecting lines */}
                <svg
                  class="pointer-events-none absolute inset-0 h-full w-full opacity-20"
                  viewBox="0 0 288 288"
                >
                  <line
                    x1="72"
                    y1="52"
                    x2="216"
                    y2="236"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-dasharray="4 4"
                  />
                  <line
                    x1="216"
                    y1="52"
                    x2="72"
                    y2="236"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-dasharray="4 4"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Sprite Showcase */}
          <div class="space-y-6">
            <div class="flex items-center gap-3 text-muted-foreground">
              <div class="h-px flex-1 bg-border" />
              <span class="font-mono text-xs uppercase">Starters</span>
              <div class="h-px flex-1 bg-border" />
            </div>

            <div class="flex flex-wrap justify-center gap-4">
              <For each={STARTER_POKEMON}>
                {(pokemon) => (
                  <a
                    href={`/pokemon/${pokemon.slug}`}
                    class="group flex flex-col items-center gap-2 transition-transform hover:scale-110"
                  >
                    <img
                      src={getSpriteUrl(pokemon.id)}
                      alt={pokemon.name}
                      class="h-16 w-16 object-contain transition-transform group-hover:-translate-y-1"
                      loading="lazy"
                    />
                    <span class="font-mono text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                      {pokemon.name}
                    </span>
                  </a>
                )}
              </For>
            </div>

            <div class="flex items-center gap-3 text-muted-foreground">
              <div class="h-px flex-1 bg-border" />
              <span class="font-mono text-xs uppercase">Fan Favorites</span>
              <div class="h-px flex-1 bg-border" />
            </div>

            <div class="flex flex-wrap justify-center gap-4">
              <For each={FAN_FAVORITES}>
                {(pokemon) => (
                  <a
                    href={`/pokemon/${pokemon.slug}`}
                    class="group flex flex-col items-center gap-2 transition-transform hover:scale-110"
                  >
                    <img
                      src={getSpriteUrl(pokemon.id)}
                      alt={pokemon.name}
                      class="h-16 w-16 object-contain transition-transform group-hover:-translate-y-1"
                      loading="lazy"
                    />
                    <span class="font-mono text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                      {pokemon.name}
                    </span>
                  </a>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section class="border-border border-b bg-secondary/30 py-20 sm:py-28">
        <div class="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8">
          <div class="mb-12 text-center">
            <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
              Resources
            </span>
            <h2 class="font-semibold text-3xl tracking-tight sm:text-4xl">Useful links</h2>
          </div>

          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="https://gitlab.com/cable-mc/cobblemon"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col items-center gap-4 border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
                <img
                  src="https://media.forgecdn.net/avatars/thumbnails/620/286/256/256/638008832892634916.png"
                  alt="Cobblemon"
                  class="h-6 w-6 object-contain"
                />
              </div>
              <div class="text-center">
                <div class="font-semibold">Cobblemon</div>
                <div class="text-muted-foreground text-sm">Official Mod</div>
              </div>
            </a>

            <a
              href="https://github.com/blankeos/cobblepedia"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col items-center gap-4 border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div class="text-center">
                <div class="font-semibold">GitHub</div>
                <div class="text-muted-foreground text-sm">Source Code</div>
              </div>
            </a>

            <a
              href="https://pokeapi.co"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col items-center gap-4 border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
                <img
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjTjeNHyqBHdImqGDutRVJ02tBUSDXaZfgtg&amp;s"
                  alt="PokeAPI"
                  class="h-6 w-6 object-contain"
                />
              </div>
              <div class="text-center">
                <div class="font-semibold">PokeAPI</div>
                <div class="text-muted-foreground text-sm">Sprite Data</div>
              </div>
            </a>

            <a
              href="https://www.smogon.com"
              target="_blank"
              rel="noopener noreferrer"
              class="group flex flex-col items-center gap-4 border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-muted-foreground hover:shadow-lg"
            >
              <div class="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary transition-colors group-hover:bg-foreground group-hover:text-background">
                <img
                  src="https://archives.bulbagarden.net/media/upload/3/38/Smogon_logo.png"
                  alt="Smogon"
                  class="h-6 w-6 object-contain"
                />
              </div>
              <div class="text-center">
                <div class="font-semibold">Smogon</div>
                <div class="text-muted-foreground text-sm">Competitive</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section class="relative overflow-hidden py-24 sm:py-32">
        {/* Background gradient */}
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-secondary/30 via-background to-background" />

        <div class="relative z-10 mx-auto max-w-4xl px-3 text-center sm:px-4 lg:px-8">
          <h2 class="mb-6 font-semibold text-4xl tracking-tight sm:text-5xl lg:text-6xl">
            Everything's here.
          </h2>

          <p class="mb-10 text-lg text-muted-foreground">
            Spawns, moves, evolutions, egg groups, rideable mons, plus Smogon/Pikalytics movesets —
            all at your fingertips.
            <br class="hidden sm:block" />
            Your next discovery is a keystroke away.
          </p>

          {/* Pokemon sprite row */}
          <div class="mb-10 flex justify-center gap-2 sm:gap-4">
            <For each={FINAL_CTA_POKEMON}>
              {(pokemon) => (
                <a
                  href={`/pokemon/${pokemon.slug}`}
                  class="group transition-transform hover:scale-110"
                >
                  <img
                    src={getOfficialArtworkUrl(pokemon.id)}
                    alt={pokemon.name}
                    class="h-20 w-20 object-contain opacity-80 transition-all group-hover:opacity-100 sm:h-24 sm:w-24"
                    loading="lazy"
                  />
                </a>
              )}
            </For>
          </div>

          <div class="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => openPalette()}
              class="group inline-flex items-center gap-2 border border-foreground bg-foreground px-8 py-4 font-medium text-background text-base transition-all hover:bg-foreground/90 hover:shadow-xl"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <span>Open Search</span>
              <span class="ml-2 flex items-center gap-1 border-background/20 border-l pl-3 text-background/70">
                <kbd class="rounded bg-background/10 px-1.5 py-0.5 font-mono text-xs">⌘</kbd>
                <span class="text-xs">K</span>
              </span>
            </button>
            <p class="text-muted-foreground text-xs">Works on every page. Try it now. ↑</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-border border-t py-8">
        <div class="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8">
          <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div class="text-muted-foreground text-sm">
              Cobblepedia — Unofficial Cobblemon reference
            </div>
            <div class="flex items-center gap-6">
              <a
                href="https://gitlab.com/cable-mc/cobblemon"
                class="text-muted-foreground text-sm transition-colors hover:text-foreground"
                target="_blank"
                rel="noopener"
              >
                Cobblemon
              </a>
              <a
                href="https://github.com/blankeos/cobblepedia"
                class="text-muted-foreground text-sm transition-colors hover:text-foreground"
                target="_blank"
                rel="noopener"
              >
                GitHub
              </a>
            </div>
          </div>
          <div class="mt-4 flex flex-col items-center gap-2 text-center text-muted-foreground text-xs sm:flex-row sm:justify-between">
            <span>Not affiliated with The Pokémon Company. Made by fans, for fans.</span>
            <span>
              Open source · Made by{" "}
              <a
                href="https://carlo.tl"
                class="transition-colors hover:text-foreground"
                target="_blank"
                rel="noopener"
              >
                Carlo Taleon
              </a>{" "}
              © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </footer>

      {/* Animation styles */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

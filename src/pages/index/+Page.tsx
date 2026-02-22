import { createResource, For } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { loadMeta } from "@/data/data-loader"
import getTitle from "@/utils/get-title"

const EXAMPLE_QUERIES = [
  { query: "lucario moves", desc: "View all moves" },
  { query: "lucario spawn", desc: "Check spawn locations" },
  { query: "lucario evolution", desc: "See evolution chain" },
  { query: "moves trickroom", desc: "Find move learners" },
  { query: "charizard egg group", desc: "Check breeding" },
]

const FEATURES = [
  {
    icon: "01",
    title: "Instant Search",
    description: "Command palette that responds immediately. No loading states, no waiting.",
    example: "Cmd + K",
  },
  {
    icon: "02",
    title: "Smart Facets",
    description: "Refine queries naturally. Add 'moves', 'spawn', or 'evolution' to any Pokemon.",
    example: "lucario moves",
  },
  {
    icon: "03",
    title: "Move Lookup",
    description: "Find every Pokemon that learns a specific move and how they acquire it.",
    example: "moves trickroom",
  },
  {
    icon: "04",
    title: "Built for vim-nerds",
    description: "Keyboard-first navigation with hjkl support. No mouse required.",
    example: "hjkl / gg / G / Cmd+K",
  },
]

export default function Page() {
  useMetadata({
    title: getTitle("Home"),
  })

  const [meta] = createResource(loadMeta)

  const openPalette = (query?: string) => {
    window.dispatchEvent(new CustomEvent("cobblepedia:open-palette", { detail: query || "" }))
  }

  return (
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section class="flex flex-col items-center border-border border-b py-20 text-center">
        <div class="mb-8 inline-flex items-center gap-2 border border-border bg-secondary px-3 py-1.5">
          <span class="h-1.5 w-1.5 rounded-full bg-success"></span>
          <span class="font-medium text-muted-foreground text-xs">Instant Results</span>
        </div>

        <h1 class="mb-5 font-semibold text-4xl tracking-tight sm:text-6xl lg:text-7xl">
          The fastest
          <br />
          <span class="text-muted-foreground">Cobblemon wiki.</span>
        </h1>

        <p class="mb-10 max-w-xl text-lg text-muted-foreground">
          The most comprehensive, easy-to-use wiki for Cobblemon. Search moves, spawns, evolutions,
          and egg groups without leaving your keyboard.
        </p>

        <div class="mb-16">
          <button
            type="button"
            class="inline-flex items-center gap-2 border border-foreground bg-foreground px-6 py-3 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
            onClick={() => openPalette()}
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
        </div>

        {/* Demo Window */}
        <div class="w-full max-w-3xl border border-border bg-card">
          <div class="flex items-center gap-2 border-border border-b bg-secondary px-4 py-3">
            <div class="h-3 w-3 rounded-full bg-[#ff5f56]"></div>
            <div class="h-3 w-3 rounded-full bg-[#ffbd2e]"></div>
            <div class="h-3 w-3 rounded-full bg-[#27c93f]"></div>
            <span class="flex-1 text-center font-mono text-muted-foreground text-xs">
              cobblepedia — zsh
            </span>
          </div>
          <div class="p-6">
            <div class="mb-4 flex items-center gap-3 border border-border bg-secondary px-4 py-3">
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
              <span class="flex-1 font-mono text-sm">lucario moves</span>
              <span class="border border-border bg-background px-2 py-1 font-mono text-muted-foreground text-xs">
                ESC to close
              </span>
            </div>

            <div class="grid gap-px border border-border bg-border">
              <div class="grid grid-cols-2 gap-px bg-border">
                <div class="space-y-1 bg-card p-4">
                  <div class="flex cursor-pointer flex-col gap-1 border-foreground border-l-2 bg-secondary p-3">
                    <span class="font-medium text-sm">Lucario</span>
                    <span class="text-muted-foreground text-xs">Aura Pokemon · Fighting/Steel</span>
                  </div>
                  <div class="flex cursor-pointer flex-col gap-1 border-transparent border-l-2 p-3 hover:bg-secondary">
                    <span class="font-medium text-sm">Riolu</span>
                    <span class="text-muted-foreground text-xs">Emanation Pokemon</span>
                  </div>
                </div>

                <div class="bg-card p-4">
                  <div class="mb-3 border-border border-b pb-3 font-semibold text-sm">
                    Lucario — Moves
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
      </section>

      {/* Features Section */}
      <section class="border-border border-b py-20">
        <div class="mb-12 text-center">
          <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
            Features
          </span>
          <h2 class="font-semibold text-3xl tracking-tight">Built for speed</h2>
        </div>

        <div class="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <For each={FEATURES}>
            {(feature) => (
              <div class="bg-card p-8 transition-colors hover:bg-secondary">
                <div class="mb-5 flex h-10 w-10 items-center justify-center border border-border bg-secondary font-mono text-muted-foreground text-sm">
                  {feature.icon}
                </div>
                <h3 class="mb-2 font-semibold">{feature.title}</h3>
                <p class="mb-4 text-muted-foreground text-sm">{feature.description}</p>
                <div class="border border-border bg-background px-3 py-2 font-mono text-muted-foreground text-xs">
                  {feature.example}
                </div>
              </div>
            )}
          </For>
        </div>
      </section>

      {/* Examples Section */}
      <section class="border-border border-b py-20">
        <div class="mb-12 text-center">
          <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
            Try it
          </span>
          <h2 class="font-semibold text-3xl tracking-tight">Common queries</h2>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <For each={EXAMPLE_QUERIES}>
            {(item) => (
              <button
                type="button"
                class="flex items-center gap-3 border border-border bg-card px-4 py-4 text-left transition-colors hover:border-muted-foreground hover:bg-secondary"
                onClick={() => openPalette(item.query)}
              >
                <span class="font-mono text-muted-foreground text-xs">→</span>
                <span class="flex-1 font-mono text-sm">{item.query}</span>
              </button>
            )}
          </For>
        </div>
      </section>

      {/* Metadata Section */}
      <section class="pt-16 pb-20">
        <div class="mb-12 text-center">
          <span class="mb-3 block font-medium font-mono text-muted-foreground text-xs uppercase tracking-widest">
            Data
          </span>
          <h2 class="font-semibold text-3xl tracking-tight">Current snapshot</h2>
          <p class="mt-3 text-muted-foreground text-sm">
            Data sourced from the{" "}
            <a
              href="https://gitlab.com/cable-mc/cobblemon"
              class="text-foreground underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              official Cobblemon repository
            </a>
            ,{" "}
            <a
              href="https://gitlab.com/cable-mc/cobblemon-assets"
              class="text-foreground underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cobblemon Assets
            </a>{" "}
            for model previews, and{" "}
            <a
              href="https://pokeapi.co"
              class="text-foreground underline hover:no-underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              PokeAPI
            </a>{" "}
            for additional images.
          </p>
        </div>

        <div class="grid gap-px border border-border bg-border">
          {meta.loading ? (
            <div class="grid grid-cols-1 bg-card p-6">
              <span class="font-mono text-muted-foreground text-xs uppercase">Status</span>
              <span class="mt-1 font-mono text-lg">Loading...</span>
            </div>
          ) : meta.error ? (
            <div class="grid grid-cols-1 bg-card p-6">
              <span class="font-mono text-muted-foreground text-xs uppercase">Error</span>
              <span class="mt-1 font-mono text-lg">No data</span>
              <span class="mt-1 text-muted-foreground text-sm">Run `bun run generate:data`</span>
            </div>
          ) : (
            <div class="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              <div class="bg-card p-6">
                <span class="mb-2 block font-mono text-muted-foreground text-xs uppercase">
                  Commit
                </span>
                <span class="font-mono text-xl">{meta()?.commitSha.slice(0, 8)}</span>
              </div>
              <div class="bg-card p-6">
                <span class="mb-2 block font-mono text-muted-foreground text-xs uppercase">
                  Species
                </span>
                <span class="font-mono text-xl">{meta()?.speciesCount}</span>
                <span class="mt-1 block text-muted-foreground text-sm">
                  {meta()?.implementedSpeciesCount} implemented
                </span>
              </div>
              <div class="bg-card p-6">
                <span class="mb-2 block font-mono text-muted-foreground text-xs uppercase">
                  Spawn Entries
                </span>
                <span class="font-mono text-xl">{meta()?.spawnEntryCount}</span>
              </div>
              <div class="bg-card p-6">
                <span class="mb-2 block font-mono text-muted-foreground text-xs uppercase">
                  Generated
                </span>
                <span class="font-mono text-xl">
                  {new Date(meta()?.generatedAt || "").toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer class="border-border border-t py-8">
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
              href="https://cobbledex.info"
              class="text-muted-foreground text-sm transition-colors hover:text-foreground"
              target="_blank"
              rel="noopener"
            >
              Cobbledex
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

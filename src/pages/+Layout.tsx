import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import type { FlowProps } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import CommandPalette from "@/components/command-palette"
import { useVimScroll } from "@/lib/use-vim-scroll"
import getTitle from "@/utils/get-title"
import "@/styles/app.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  },
})

export default function RootLayout(props: FlowProps) {
  const openPalette = () => {
    window.dispatchEvent(new CustomEvent("cobblepedia:open-palette"))
  }

  useMetadata.setGlobalDefaults({
    title: getTitle("Home"),
    description:
      "Keyboard-first Cobblemon encyclopedia. Search moves, spawns, evolutions, and competitive sets instantly with Cmd+K.",
    icons: {
      icon: "/favicon.png",
    },
    openGraph: {
      images: ["/cobblepedia-banner.png"],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/cobblepedia-banner.png"],
    },
  })

  useVimScroll({
    onScrollToTop: () => {
      window.scrollTo({ top: 0, behavior: "instant" })
    },
    onScrollToBottom: () => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <div class="min-h-screen bg-background">
        <header class="sticky top-0 z-40 border-border border-b bg-background">
          <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-4 lg:px-8">
            <a href="/" class="flex items-center gap-2 font-medium text-sm">
              <span>Cobblepedia</span>
            </a>

            <button
              type="button"
              class="flex items-center gap-2 border border-border px-3 py-1.5 text-muted-foreground text-xs transition-colors hover:border-muted-foreground hover:text-foreground"
              onClick={openPalette}
            >
              <span>Search</span>
              <span class="flex items-center gap-0.5 border-border border-l pl-2 text-muted-foreground/70">
                <kbd class="font-mono text-xs">⌘</kbd>
                <span class="text-xs">K</span>
              </span>
            </button>
          </div>
        </header>

        <main class="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8">{props.children}</main>
        <CommandPalette />
      </div>
    </QueryClientProvider>
  )
}

import { createEffect, createSignal, Show } from "solid-js"
import { fetchPokemonArtworkUrl } from "@/lib/pokeapi-artwork"

export function PokemonArtworkSprite(props: { dexNumber: number; name: string }) {
  const [artworkUrl, setArtworkUrl] = createSignal<string | null>(null)
  let requestVersion = 0

  const fetchArtwork = async () => {
    const currentVersion = ++requestVersion
    const url = await fetchPokemonArtworkUrl(props.dexNumber)
    if (currentVersion !== requestVersion) {
      return
    }
    setArtworkUrl(url)
  }

  createEffect(() => {
    props.dexNumber
    void fetchArtwork()
  })

  return (
    <Show
      when={artworkUrl()}
      fallback={
        <div class="flex h-full w-full items-center justify-center font-mono text-muted-foreground text-xs">
          {props.name.slice(0, 1).toUpperCase()}
        </div>
      }
    >
      {(url) => (
        <img
          src={url()}
          alt={`${props.name} official artwork`}
          class="h-full w-full object-contain p-1"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
    </Show>
  )
}

import { createEffect, createMemo, createResource, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import { ItemSprite, normalizeItemId } from "@/components/item-sprite"
import type { ItemEntryRecord, ItemIndex } from "@/data/cobblemon-types"
import { loadItemIndex } from "@/data/data-loader"
import { canonicalId } from "@/data/formatters"
import getTitle from "@/utils/get-title"

export default function Page() {
  const pageContext = usePageContext()
  const routeItemId = createMemo(() =>
    String(pageContext.routeParams.itemId ?? "")
      .trim()
      .toLowerCase()
  )

  const [entry] = createResource(routeItemId, async (nextItemId) => {
    if (!nextItemId) {
      return null
    }

    const itemIndex = await loadItemIndex()
    return resolveItemEntry(itemIndex, nextItemId)
  })

  createEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const resolvedEntry = entry()
    const requestedItemId = routeItemId()

    if (!resolvedEntry || !requestedItemId) {
      return
    }

    if (
      requestedItemId !== resolvedEntry.itemId &&
      normalizeItemId(requestedItemId) === resolvedEntry.itemId
    ) {
      window.history.replaceState(null, "", `/items/${encodeURIComponent(resolvedEntry.itemId)}`)
    }
  })

  useMetadata({
    title: getTitle("Item"),
  })

  return (
    <div class="mx-auto max-w-4xl px-3 py-8 sm:px-4 lg:px-8">
      <Show when={!entry.loading} fallback={<LoadingState />}>
        <Show when={entry()} fallback={<NotFoundState itemId={routeItemId()} />}>
          {(entrySignal) => <ItemDetailView entry={entrySignal()} />}
        </Show>
      </Show>
    </div>
  )
}

function LoadingState() {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div class="h-8 w-8 animate-spin border-2 border-border border-t-foreground" />
      <p class="text-muted-foreground text-sm">Loading item data...</p>
    </div>
  )
}

function NotFoundState(props: { itemId: string }) {
  return (
    <div class="flex min-h-[40vh] flex-col items-center justify-center gap-4 border border-border bg-card p-6 text-center">
      <h1 class="font-semibold text-2xl">Item Not Found</h1>
      <p class="text-muted-foreground text-sm">
        No item entry exists for <span class="font-mono">{props.itemId || "this id"}</span>.
      </p>
    </div>
  )
}

function ItemDetailView(props: { entry: ItemEntryRecord }) {
  return (
    <div class="space-y-6">
      <header class="border border-border bg-card p-6">
        <div class="mb-3 flex items-start gap-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center bg-secondary/30">
            <ItemSprite
              itemId={props.entry.itemId}
              name={props.entry.name}
              assetPath={props.entry.assetPath}
              class="h-12 w-12"
            />
          </div>
          <div class="min-w-0">
            <p class="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wide">
              Item: {props.entry.itemId}
            </p>
            <h1 class="font-semibold text-3xl tracking-tight sm:text-4xl">{props.entry.name}</h1>
            <p class="mt-4 text-muted-foreground text-sm leading-relaxed">
              {props.entry.description || "No item description is available."}
            </p>
          </div>
        </div>
      </header>

      <Show when={props.entry.descriptionLines.length > 1}>
        <section class="border border-border bg-card">
          <div class="border-border border-b p-4">
            <p class="font-mono text-muted-foreground text-xs uppercase tracking-wide">
              Description
            </p>
          </div>
          <div class="space-y-2 p-4">
            <For each={props.entry.descriptionLines}>
              {(line) => <p class="text-muted-foreground text-sm leading-relaxed">{line}</p>}
            </For>
          </div>
        </section>
      </Show>
    </div>
  )
}

function resolveItemEntry(itemIndex: ItemIndex, routeItemId: string): ItemEntryRecord | null {
  const normalizedRouteId = normalizeItemId(routeItemId)
  if (normalizedRouteId && itemIndex[normalizedRouteId]) {
    return itemIndex[normalizedRouteId]
  }

  const routeCanonicalId = canonicalId(routeItemId)
  if (!routeCanonicalId) {
    return null
  }

  for (const entry of Object.values(itemIndex)) {
    if (
      canonicalId(entry.itemId) === routeCanonicalId ||
      canonicalId(entry.name) === routeCanonicalId
    ) {
      return entry
    }
  }

  return null
}

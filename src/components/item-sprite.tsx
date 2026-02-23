import { createMemo } from "solid-js"
import { cn } from "@/utils/cn"

type ItemSpriteProps = {
  itemId: string
  name: string
  assetPath?: string | null
  class?: string
}

export function normalizeItemId(itemId: string): string {
  return itemId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

export function getItemSpriteUrl(itemId: string): string {
  return `https://gitlab.com/cable-mc/cobblemon-assets/-/raw/master/items/evolution_items/${encodeURIComponent(
    normalizeItemId(itemId)
  )}.png`
}

export function getItemSpriteUrlFromPath(assetPath: string): string {
  return `https://gitlab.com/cable-mc/cobblemon-assets/-/raw/master/${assetPath}`
}

export function ItemSprite(props: ItemSpriteProps) {
  const normalizedItemId = createMemo(() => normalizeItemId(props.itemId))
  const spriteUrl = createMemo(() => {
    const path = props.assetPath?.trim().toLowerCase()
    if (path) {
      return getItemSpriteUrlFromPath(path)
    }

    return getItemSpriteUrl(normalizedItemId())
  })

  return (
    <img
      src={spriteUrl()}
      alt={props.name}
      class={cn("h-5 w-5 shrink-0 object-contain", props.class)}
      loading="lazy"
      onError={(event) => {
        event.currentTarget.style.display = "none"
      }}
    />
  )
}

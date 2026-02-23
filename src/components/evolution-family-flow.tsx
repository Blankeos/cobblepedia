import { createMemo, For, Show } from "solid-js"
import type {
  EvolutionFamilyEdgeRecord,
  EvolutionFamilyMemberRecord,
  EvolutionFamilyRecord,
  ItemIndex,
} from "@/data/cobblemon-types"
import { titleCaseFromId } from "@/data/formatters"
import { buildDiagflowLayout, type DiagflowEdge, type DiagflowNode } from "@/lib/diagflow"
import { cn } from "@/utils/cn"
import { ItemSprite } from "./item-sprite"
import { PokemonSprite } from "./pokemon-sprite"

type EvolutionFamilyFlowProps = {
  family: EvolutionFamilyRecord
  activeSlug: string
  activeFormSlug?: string | null
  itemIndex?: ItemIndex | null
}

type EvolutionFlowNode = DiagflowNode<EvolutionFamilyMemberRecord>
type EvolutionFlowEdge = DiagflowEdge<EvolutionFamilyEdgeRecord>

function formatMethodLabel(method: string): string {
  const map: Record<string, string> = {
    level_up: "Lvl",
    trade: "Trade",
    stone: "Stone",
    item_interact: "Use Item",
    block_click: "Click Block",
    use_move: "Use Move",
    defeat: "Defeat",
    friendship: "Friendship",
    biome: "Biome",
    weather: "Weather",
    party: "Party",
    advancement: "Advancement",
    function: "Function",
  }

  const normalized = method.toLowerCase().replace(/[-_]/g, "_")
  return map[normalized] ?? titleCaseFromId(method)
}

export function EvolutionFamilyFlow(props: EvolutionFamilyFlowProps) {
  const activeNodeId = createMemo(() => {
    if (props.activeFormSlug) {
      const byFormSlug = props.family.members.find(
        (member) => member.formSlug === props.activeFormSlug
      )
      if (byFormSlug) {
        return byFormSlug.nodeId
      }
    }

    const exact = props.family.members.find(
      (member) =>
        member.slug === props.activeSlug &&
        (member.formSlug ?? null) === (props.activeFormSlug ?? null)
    )
    if (exact) {
      return exact.nodeId
    }

    const base = props.family.members.find(
      (member) => member.slug === props.activeSlug && member.formSlug === null
    )
    if (base) {
      return base.nodeId
    }

    const fallback = props.family.members.find((member) => member.slug === props.activeSlug)
    return fallback?.nodeId ?? props.activeSlug
  })

  const nodes = createMemo<EvolutionFlowNode[]>(() =>
    props.family.members.map((member) => ({
      id: member.nodeId,
      data: member,
    }))
  )

  const edges = createMemo<EvolutionFlowEdge[]>(() =>
    props.family.edges.map((edge, index) => ({
      id: `${edge.fromNodeId}-${edge.toNodeId}-${index}`,
      from: edge.fromNodeId,
      to: edge.toNodeId,
      data: edge,
    }))
  )

  const maxLabelWidth = createMemo(() => {
    let maxWidth = 196
    for (const edge of props.family.edges) {
      const method = formatMethodLabel(edge.method)
      const requirements = formatRequirementSummary(edge)
      const text = requirements ? `${method} ${requirements}` : method
      const estimatedWidth = text.length * 6.35 + (requirements ? 64 : 38)
      maxWidth = Math.max(maxWidth, estimatedWidth)
    }
    return maxWidth
  })

  const layout = createMemo(() =>
    buildDiagflowLayout({
      nodes: nodes(),
      edges: edges(),
      roots: props.family.roots,
      options: {
        nodeWidth: 186,
        nodeHeight: 92,
        columnGap: Math.max(220, maxLabelWidth() + 56),
        rowGap: 46,
        minHeight: 188,
        paddingX: 12,
        paddingY: 12,
      },
    })
  )

  return (
    <div class="overflow-x-auto">
      <div
        class="relative mx-auto min-w-fit"
        style={{
          width: `${layout().width}px`,
          height: `${layout().height}px`,
        }}
      >
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${layout().width} ${layout().height}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <For each={layout().edges}>
            {(edge) => {
              const isActiveEdge = edge.from === activeNodeId() || edge.to === activeNodeId()

              return (
                <g>
                  <path
                    d={edge.path}
                    class={cn(
                      "fill-none stroke-border/70",
                      isActiveEdge ? "stroke-foreground/70" : "stroke-border/70"
                    )}
                    stroke-width={2.5}
                    stroke-linecap="round"
                  />
                  <circle
                    cx={edge.start.x}
                    cy={edge.start.y}
                    r={1.8}
                    class={cn(
                      "fill-border/75",
                      isActiveEdge ? "fill-foreground/70" : "fill-border/75"
                    )}
                  />
                  <circle
                    cx={edge.end.x}
                    cy={edge.end.y}
                    r={2.1}
                    class={cn(
                      "fill-border/75",
                      isActiveEdge ? "fill-foreground/75" : "fill-border/75"
                    )}
                  />
                </g>
              )
            }}
          </For>
        </svg>

        <For each={layout().edges}>
          {(edge) => {
            const isActiveEdge = edge.from === activeNodeId() || edge.to === activeNodeId()
            const requirementSummary = formatRequirementSummary(edge.data)
            const requirementTokens = formatRequirementTokens(edge.data)

            return (
              <div
                class="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${edge.label.x}px`,
                  top: `${edge.label.y}px`,
                }}
              >
                <div
                  class={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5",
                    isActiveEdge
                      ? "border-foreground/30 bg-background"
                      : "border-border/60 bg-background/90"
                  )}
                  title={edge.data.requirementText.join(", ") || undefined}
                >
                  <span class="whitespace-nowrap font-medium text-[10px] leading-none">
                    {formatMethodLabel(edge.data.method)}
                  </span>
                  <Show when={requirementSummary && requirementTokens.length > 0}>
                    <span class="h-3 w-px bg-border/60" />
                    <div class="flex items-center gap-1 text-[10px] text-muted-foreground leading-none">
                      <For each={requirementTokens}>
                        {(token, tokenIndex) => (
                          <div class="inline-flex items-center gap-1 whitespace-nowrap">
                            <Show when={tokenIndex() > 0}>
                              <span class="text-muted-foreground/60">/</span>
                            </Show>
                            <Show
                              when={token.itemId}
                              fallback={<span class="whitespace-nowrap">{token.text}</span>}
                            >
                              {(itemIdSignal) => (
                                <a
                                  href={`/items/${itemIdSignal()}`}
                                  class="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  <ItemSprite
                                    itemId={itemIdSignal()}
                                    name={token.text}
                                    assetPath={resolveItemAssetPath(
                                      itemIdSignal(),
                                      props.itemIndex
                                    )}
                                    class="h-3.5 w-3.5"
                                  />
                                  <span class="whitespace-nowrap">{token.text}</span>
                                </a>
                              )}
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            )
          }}
        </For>

        <For each={layout().nodes}>
          {(node) => {
            const isActiveNode = node.id === activeNodeId()

            return (
              <a
                href={toEvolutionMemberHref(node.data)}
                class={cn(
                  "group absolute z-20 flex items-center gap-3 border px-3 py-2 transition-all",
                  isActiveNode
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:border-muted-foreground hover:bg-secondary/25"
                )}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
                aria-current={isActiveNode ? "page" : undefined}
              >
                <PokemonSprite
                  dexNumber={node.data.dexNumber}
                  slug={node.data.slug}
                  formSlug={node.data.formSlug}
                  formName={node.data.formName}
                  name={
                    node.data.formName
                      ? `${node.data.name} (${node.data.formName})`
                      : node.data.name
                  }
                  class={cn(
                    "h-10 w-10",
                    isActiveNode
                      ? "border-background/40 bg-background/20"
                      : "border-border bg-secondary/40"
                  )}
                  imageClass="h-8 w-8"
                />

                <div class="min-w-0">
                  <p class="truncate font-medium text-sm leading-tight">{node.data.name}</p>
                  <p
                    class={cn(
                      "mt-1 truncate font-mono text-[10px] uppercase tracking-wider",
                      isActiveNode ? "text-background/80" : "text-muted-foreground"
                    )}
                  >
                    #{String(node.data.dexNumber).padStart(4, "0")}
                    <Show when={node.data.formName}>
                      <span
                        class={cn("ml-1", isActiveNode ? "text-background/80" : "text-foreground")}
                      >
                        {node.data.formName}
                      </span>
                    </Show>
                  </p>
                </div>
              </a>
            )
          }}
        </For>
      </div>
    </div>
  )
}

function formatRequirementSummary(edge: EvolutionFamilyEdgeRecord): string | null {
  const tokens = formatRequirementTokens(edge)
  if (tokens.length === 0) {
    return null
  }

  return tokens.map((token) => token.text).join(" / ")
}

function formatRequirementTokens(edge: EvolutionFamilyEdgeRecord): Array<{
  text: string
  itemId: string | null
}> {
  const normalizedMethod = normalizeEvolutionMethod(edge.method)
  const baseTokens = edge.requirementText
    .map((requirement) => formatRequirementToken(normalizedMethod, requirement))
    .filter((requirement): requirement is string => Boolean(requirement))

  if (baseTokens.length === 0) {
    return []
  }

  const deduped: string[] = []
  for (const token of baseTokens) {
    if (!deduped.includes(token)) {
      deduped.push(token)
    }
  }

  const itemId =
    normalizedMethod === "item_interact" ? inferItemIdFromRequirementLabel(deduped[0] ?? "") : null

  return deduped.map((text, index) => ({
    text,
    itemId: index === 0 ? itemId : null,
  }))
}

function normalizeEvolutionMethod(method: string): string {
  return method.toLowerCase().replace(/[-_]/g, "_")
}

function inferItemIdFromRequirementLabel(label: string): string | null {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  return normalized ? normalized : null
}

function resolveItemAssetPath(
  itemId: string,
  itemIndex: ItemIndex | null | undefined
): string | null {
  if (!itemIndex) {
    return null
  }

  return itemIndex[itemId]?.assetPath ?? null
}

function formatRequirementToken(normalizedMethod: string, requirement: string): string | null {
  const text = requirement.replace(/\s+/g, " ").trim()
  if (!text) {
    return null
  }

  const lower = text.toLowerCase()

  if (lower === "property gender=female") {
    return "Female only"
  }

  if (lower === "property gender=male") {
    return "Male only"
  }

  if (normalizedMethod === "item_interact" && lower.startsWith("use ")) {
    return text.slice(4)
  }

  if (normalizedMethod === "trade" && lower.startsWith("trade with ")) {
    return `With ${text.slice(11)}`
  }

  return text
}

function toEvolutionMemberHref(member: EvolutionFamilyMemberRecord): string {
  if (!member.formSlug) {
    return `/pokemon/${member.slug}`
  }

  return `/pokemon/${member.slug}?form=${encodeURIComponent(member.formSlug)}`
}

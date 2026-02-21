import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { usePageContext } from "vike-solid/usePageContext"
import type { PokemonDetailRecord } from "@/data/cobblemon-types"
import { loadPokemonDetail } from "@/data/data-loader"
import {
  formatConditionChips,
  formatEggGroup,
  formatMoveSource,
  titleCaseFromId,
} from "@/data/formatters"
import getTitle from "@/utils/get-title"

const PAGE_MOVE_TABS = ["all", "level", "egg", "tm", "tutor"] as const
type PageMoveTab = (typeof PAGE_MOVE_TABS)[number]

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

  useMetadata({
    title: getTitle("Pokemon"),
  })

  return (
    <section class="pokemon-page">
      <Show when={!detail.loading} fallback={<p>Loading Pokemon details...</p>}>
        <Show when={detail()} fallback={<p>Pokemon not found in generated snapshot.</p>}>
          {(detailSignal) => <PokemonDetailContent detail={detailSignal()} />}
        </Show>
      </Show>
    </section>
  )
}

function PokemonDetailContent(props: { detail: PokemonDetailRecord }) {
  const detail = () => props.detail

  const [activeMoveTab, setActiveMoveTab] = createSignal<PageMoveTab>("all")
  const [moveSearch, setMoveSearch] = createSignal("")

  const moveCounts = createMemo(() => {
    return {
      all: detail().moves.length,
      level: detail().moves.filter((move) => move.sourceType === "level").length,
      egg: detail().moves.filter((move) => move.sourceType === "egg").length,
      tm: detail().moves.filter((move) => move.sourceType === "tm").length,
      tutor: detail().moves.filter((move) => move.sourceType === "tutor").length,
    }
  })

  const visibleMoves = createMemo(() => {
    const moveTab = activeMoveTab()
    const query = moveSearch().trim().toLowerCase()

    return detail().moves.filter((move) => {
      if (moveTab !== "all" && move.sourceType !== moveTab) {
        return false
      }

      if (!query) {
        return true
      }

      return `${move.moveName} ${move.moveId}`.toLowerCase().includes(query)
    })
  })

  return (
    <div class="pokemon-layout">
      <header class="panel pokemon-header-card">
        <div class="pokemon-sprite-placeholder" aria-hidden="true">
          <span>#{detail().dexNumber}</span>
        </div>

        <div>
          <h1>{detail().name}</h1>
          <p>National Dex #{detail().dexNumber}</p>
          <div class="chip-row">
            <For each={detail().types}>
              {(type) => <span class="chip">{titleCaseFromId(type)}</span>}
            </For>
          </div>
        </div>
      </header>

      <section class="panel">
        <h2>Core Stats</h2>
        <div class="stats-grid">
          <For each={Object.entries(detail().baseStats)}>
            {([stat, value]) => (
              <div>
                <dt>{titleCaseFromId(stat)}</dt>
                <dd>{value}</dd>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="panel">
        <h2>Abilities</h2>
        <div class="chip-row">
          <For each={detail().abilities}>
            {(ability) => (
              <span class="chip">
                {ability.hidden ? `${ability.label} (Hidden)` : ability.label}
              </span>
            )}
          </For>
        </div>
      </section>

      <section class="panel">
        <h2>Breeding</h2>
        <div class="chip-row">
          <For each={detail().eggGroups}>
            {(group) => <span class="chip">{formatEggGroup(group)}</span>}
          </For>
        </div>

        <dl class="meta-grid">
          <div>
            <dt>Egg Cycles</dt>
            <dd>{detail().eggCycles ?? "-"}</dd>
          </div>
          <div>
            <dt>Base Friendship</dt>
            <dd>{detail().baseFriendship ?? "-"}</dd>
          </div>
          <div>
            <dt>Catch Rate</dt>
            <dd>{detail().catchRate ?? "-"}</dd>
          </div>
          <div>
            <dt>Height / Weight</dt>
            <dd>
              {detail().height ?? "-"} / {detail().weight ?? "-"}
            </dd>
          </div>
        </dl>
      </section>

      <section class="panel">
        <h2>Moves</h2>

        <div class="chip-row" role="tablist" aria-label="Move source tabs">
          <For each={PAGE_MOVE_TABS}>
            {(tab) => (
              <button
                type="button"
                role="tab"
                classList={{
                  chip: true,
                  "chip-active": activeMoveTab() === tab,
                }}
                aria-selected={activeMoveTab() === tab}
                onClick={() => setActiveMoveTab(tab)}
              >
                {tab === "all" ? "All" : titleCaseFromId(tab)} ({moveCounts()[tab]})
              </button>
            )}
          </For>
        </div>

        <input
          class="quickview-input"
          value={moveSearch()}
          onInput={(event) => setMoveSearch(event.currentTarget.value)}
          placeholder="Filter move names"
        />

        <div class="moves-table-wrap">
          <table class="moves-table">
            <thead>
              <tr>
                <th>Move</th>
                <th>Source</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              <For each={visibleMoves()}>
                {(move) => (
                  <tr>
                    <td>{move.moveName}</td>
                    <td>{formatMoveSource(move.sourceType, move.sourceValue)}</td>
                    <td>{move.moveId}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h2>Spawn</h2>
        <Show
          when={detail().spawnEntries.length > 0}
          fallback={<p>No spawn entries available for this species.</p>}
        >
          <ul class="spawn-list">
            <For each={detail().spawnEntries}>
              {(entry) => (
                <li>
                  <div>
                    <strong>{titleCaseFromId(entry.bucket)}</strong>
                    <span>
                      {entry.levelText ?? "-"} · {titleCaseFromId(entry.spawnablePositionType)}
                    </span>
                  </div>

                  <div class="chip-row">
                    <For each={formatConditionChips(entry.condition)}>
                      {(chip) => <span class="chip">{chip}</span>}
                    </For>
                  </div>

                  <Show when={entry.weightMultipliers.length > 0}>
                    <p>
                      Multipliers:{" "}
                      {entry.weightMultipliers
                        .map((multiplier) => {
                          const condition = formatConditionChips(multiplier.condition)
                          const suffix = condition.length > 0 ? ` (${condition.join(", ")})` : ""
                          return `${multiplier.multiplier}x${suffix}`
                        })
                        .join("; ")}
                    </p>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>

      <section class="panel">
        <h2>Evolution Family</h2>
        <div class="chip-row">
          <For each={detail().evolutionFamily.members}>
            {(member) => <span class="chip">{member.name}</span>}
          </For>
        </div>

        <ul class="evolution-edge-list">
          <For each={detail().evolutionFamily.edges}>
            {(edge) => (
              <li>
                <strong>
                  {titleCaseFromId(edge.fromSlug)} {" -> "} {titleCaseFromId(edge.toSlug)}
                </strong>
                <span>{titleCaseFromId(edge.method)}</span>
                <Show when={edge.requirementText.length > 0}>
                  <div class="chip-row">
                    <For each={edge.requirementText}>
                      {(text) => <span class="chip">{text}</span>}
                    </For>
                  </div>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </section>
    </div>
  )
}

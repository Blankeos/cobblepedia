import { createResource, For } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import { loadMeta } from "@/data/data-loader"
import getTitle from "@/utils/get-title"

const EXAMPLE_QUERIES = [
  "lucario egg group",
  "lucario moves",
  "lucario spawn",
  "lucario evolution",
  "moves trickroom",
]

export default function Page() {
  useMetadata({
    title: getTitle("Home"),
  })

  const [meta] = createResource(loadMeta)

  return (
    <div class="home-grid">
      <section class="panel hero-panel">
        <p class="eyebrow">Keyboard-first Cobblemon encyclopedia</p>
        <h1>Find Cobblemon answers in one command.</h1>
        <p>
          Press Cmd+K (or Ctrl+K), type a compact query, read the quickview, and hit Enter to jump
          to the full Pokemon page.
        </p>

        <div class="hero-actions">
          <button
            type="button"
            class="primary-action"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("cobblepedia:open-palette"))
            }}
          >
            Open Command Palette
          </button>
          <span class="shortcut-hint">
            <kbd>Cmd</kbd>+<kbd>K</kbd> / <kbd>Ctrl</kbd>+<kbd>K</kbd>
          </span>
        </div>
      </section>

      <section class="panel examples-panel">
        <h2>Acceptance queries</h2>
        <ul class="example-list">
          <For each={EXAMPLE_QUERIES}>
            {(query) => (
              <li>
                <button
                  type="button"
                  class="query-pill"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("cobblepedia:open-palette", { detail: query })
                    )
                  }}
                >
                  {query}
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="panel meta-panel">
        <h2>Snapshot metadata</h2>
        {meta.loading ? (
          <p>Loading snapshot details...</p>
        ) : meta.error ? (
          <p>Data snapshot missing. Run `bun run generate:data`.</p>
        ) : (
          <dl>
            <div>
              <dt>Commit</dt>
              <dd>{meta()?.commitSha.slice(0, 12)}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{meta()?.generatedAt}</dd>
            </div>
            <div>
              <dt>Species</dt>
              <dd>{meta()?.speciesCount}</dd>
            </div>
            <div>
              <dt>Implemented</dt>
              <dd>{meta()?.implementedSpeciesCount}</dd>
            </div>
            <div>
              <dt>Spawn rows</dt>
              <dd>{meta()?.spawnEntryCount}</dd>
            </div>
          </dl>
        )}
      </section>
    </div>
  )
}

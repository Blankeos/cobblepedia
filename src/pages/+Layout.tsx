import type { FlowProps } from "solid-js"
import { useMetadata } from "vike-metadata-solid"
import CommandPalette from "@/components/command-palette"
import getTitle from "@/utils/get-title"
import "@/styles/app.css"

useMetadata.setGlobalDefaults({
  title: getTitle("Home"),
  description: "Keyboard-first Cobblemon encyclopedia.",
})

export default function RootLayout(props: FlowProps) {
  return (
    <div class="app-shell">
      <header class="app-header">
        <a href="/" class="brand-link">
          Cobblepedia
        </a>
        <button
          type="button"
          class="palette-trigger"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("cobblepedia:open-palette"))
          }}
        >
          Open Palette <kbd>Cmd</kbd>+<kbd>K</kbd>
        </button>
      </header>

      <main class="app-main">{props.children}</main>
      <CommandPalette />
    </div>
  )
}

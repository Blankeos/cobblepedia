import { createMemo, createSignal, For } from "solid-js"
import { IconX } from "@/assets/icons"

const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
}

type DualTypeSelectorProps = {
  availableTypes: string[]
  selectedTypes: string[]
  onChange: (types: string[]) => void
}

export function DualTypeSelector(props: DualTypeSelectorProps) {
  const [inputValue, setInputValue] = createSignal("")
  const [isOpen, setIsOpen] = createSignal(false)
  const [highlightedIndex, setHighlightedIndex] = createSignal(0)
  let inputRef: HTMLInputElement | undefined

  const options = createMemo(() => {
    if (props.selectedTypes.length >= 2) {
      return []
    }
    const query = inputValue().toLowerCase().trim()
    return props.availableTypes
      .filter((type) => {
        if (props.selectedTypes.includes(type)) return false
        if (!query) return true
        return type.includes(query)
      })
      .map((type) => ({
        value: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        color: TYPE_COLORS[type] ?? "#888888",
      }))
  })

  const focusInput = () => {
    setTimeout(() => inputRef?.focus(), 0)
  }

  const addType = (type: string) => {
    if (props.selectedTypes.length >= 2) return
    if (props.selectedTypes.includes(type)) return
    props.onChange([...props.selectedTypes, type])
    setInputValue("")
    setIsOpen(false)
    setHighlightedIndex(0)
    focusInput()
  }

  const removeType = (type: string) => {
    props.onChange(props.selectedTypes.filter((item) => item !== type))
    focusInput()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const opts = options()
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!opts.length) return
      setIsOpen(true)
      setHighlightedIndex((index) => (index + 1) % opts.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (!opts.length) return
      setIsOpen(true)
      setHighlightedIndex((index) => (index - 1 + opts.length) % opts.length)
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      const selected = opts[highlightedIndex()]
      if (selected) {
        addType(selected.value)
      }
      return
    }

    if (event.key === "Escape") {
      setIsOpen(false)
      return
    }

    if (event.key === "Backspace" && inputValue() === "" && props.selectedTypes.length > 0) {
      event.preventDefault()
      removeType(props.selectedTypes[props.selectedTypes.length - 1])
    }
  }

  return (
    <div class="w-full">
      <div class="relative">
        <div class="flex min-h-[44px] flex-wrap items-center gap-1.5 border border-input bg-background px-3 py-2">
          <For each={props.selectedTypes}>
            {(type, index) => (
              <div
                class="inline-flex items-center gap-1.5 border px-2 py-1 text-xs"
                style={{
                  "border-color": TYPE_COLORS[type] ?? "#888888",
                  color: TYPE_COLORS[type] ?? "#888888",
                }}
              >
                <span class="font-mono text-[10px] opacity-60">
                  {index() === 0 ? "PRIMARY" : "SECONDARY"}
                </span>
                <span class="font-mono uppercase tracking-wider">{type}</span>
                <button
                  type="button"
                  class="ml-1 p-0.5 opacity-60 hover:opacity-100"
                  onClick={() => removeType(type)}
                >
                  <IconX class="h-3 w-3" />
                </button>
              </div>
            )}
          </For>

          <input
            ref={inputRef}
            type="text"
            value={inputValue()}
            onInput={(event) => {
              setInputValue(event.currentTarget.value)
              setIsOpen(true)
              setHighlightedIndex(0)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 120)}
            class="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            placeholder={props.selectedTypes.length === 0 ? "Add a type..." : "Add second type..."}
          />
        </div>

        {isOpen() && options().length > 0 ? (
          <div class="absolute inset-x-0 top-full z-50 mt-1 max-h-[280px] overflow-auto border border-border bg-popover">
            <For each={options()}>
              {(option, index) => (
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  classList={{
                    "bg-accent text-accent-foreground": highlightedIndex() === index(),
                  }}
                  onMouseEnter={() => setHighlightedIndex(index())}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addType(option.value)}
                >
                  <span
                    class="h-2 w-2 border"
                    style={{
                      "background-color": option.color,
                      "border-color": option.color,
                    }}
                  />
                  <span class="font-mono">{option.label}</span>
                </button>
              )}
            </For>
          </div>
        ) : null}
      </div>
    </div>
  )
}

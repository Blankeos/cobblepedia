import * as CommandPrimitive from "cmdk-solid"
import type { Component, ParentProps, VoidProps } from "solid-js"
import { splitProps } from "solid-js"
import { cn } from "@/utils/cn"

export const Command: Component<ParentProps<CommandPrimitive.CommandRootProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <CommandPrimitive.CommandRoot
      class={cn("command-root", local.class)}
      shouldFilter={false}
      {...others}
    />
  )
}

export const CommandInput: Component<VoidProps<CommandPrimitive.CommandInputProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return (
    <div class="command-input-wrap" cmdk-input-wrapper="">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="command-input-icon">
        <path
          d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M21 21l-6 -6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>

      <CommandPrimitive.CommandInput class={cn("command-input", local.class)} {...others} />
    </div>
  )
}

export const CommandList: Component<ParentProps<CommandPrimitive.CommandListProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return <CommandPrimitive.CommandList class={cn("command-list", local.class)} {...others} />
}

export const CommandItem: Component<ParentProps<CommandPrimitive.CommandItemProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return <CommandPrimitive.CommandItem class={cn("command-item", local.class)} {...others} />
}

export const CommandEmpty: Component<ParentProps<CommandPrimitive.CommandEmptyProps>> = (props) => {
  const [local, others] = splitProps(props, ["class"])

  return <CommandPrimitive.CommandEmpty class={cn("command-empty", local.class)} {...others} />
}

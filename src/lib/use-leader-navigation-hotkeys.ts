import { useKeyboard } from "bagon-hooks"
import { createSignal, onCleanup } from "solid-js"

type UseLeaderNavigationHotkeysProps = {
  onPrevious: () => void
  onNext: () => void
  onFormPrevious?: () => void
  onFormNext?: () => void
  timeoutMs?: number
  disabled?: boolean
}

export function useLeaderNavigationHotkeys(props: UseLeaderNavigationHotkeysProps) {
  const [leaderActive, setLeaderActive] = createSignal(false)
  let timeoutId: number | null = null

  const clearLeader = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
    setLeaderActive(false)
  }

  const armLeader = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }

    setLeaderActive(true)
    timeoutId = window.setTimeout(() => {
      timeoutId = null
      setLeaderActive(false)
    }, props.timeoutMs ?? 1200)
  }

  useKeyboard({
    isDisabled: props.disabled,
    onKeyDown: (event) => {
      if (isEditableTarget(event.target)) {
        return
      }

      if (isLeaderKey(event)) {
        event.preventDefault()
        armLeader()
        return
      }

      if (!leaderActive()) {
        return
      }

      if (isModifierKey(event)) {
        return
      }

      if (isNextKey(event)) {
        event.preventDefault()
        clearLeader()
        props.onNext()
        return
      }

      if (isPreviousKey(event)) {
        event.preventDefault()
        clearLeader()
        props.onPrevious()
        return
      }

      if (isFormPreviousKey(event) && props.onFormPrevious) {
        event.preventDefault()
        clearLeader()
        props.onFormPrevious()
        return
      }

      if (isFormNextKey(event) && props.onFormNext) {
        event.preventDefault()
        clearLeader()
        props.onFormNext()
        return
      }

      clearLeader()
    },
  })

  onCleanup(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  })

  return {
    leaderActive,
  }
}

function isLeaderKey(event: KeyboardEvent): boolean {
  return event.code === "Space" || event.key === " "
}

function isNextKey(event: KeyboardEvent): boolean {
  return event.key === ">" || event.key === "." || event.code === "Period"
}

function isPreviousKey(event: KeyboardEvent): boolean {
  return event.key === "<" || event.key === "," || event.code === "Comma"
}

function isFormPreviousKey(event: KeyboardEvent): boolean {
  return event.key === "h" || event.key === "H"
}

function isFormNextKey(event: KeyboardEvent): boolean {
  return event.key === "l" || event.key === "L"
}

function isModifierKey(event: KeyboardEvent): boolean {
  return (
    event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta"
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true
  }

  if (target instanceof HTMLSelectElement) {
    return true
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true
  }

  return Boolean(target.closest("[contenteditable='true']"))
}

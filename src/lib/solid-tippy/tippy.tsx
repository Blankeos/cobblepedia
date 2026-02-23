import {
  children,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js"
import makeTippy, { type Props } from "tippy.js"
import "tippy.js/animations/scale-subtle.css"
import "tippy.js/dist/tippy.css"

type TippyComponentProps = {
  children: JSX.Element
  content: JSX.Element | string
  props?: Omit<Partial<Props>, "content">
}

export function Tippy(props: TippyComponentProps) {
  const [local, tippyProps] = splitProps(props, ["children", "content"])
  const resolvedChildren = children(() => local.children)
  const [trigger, setTrigger] = createSignal<HTMLElement>()
  const [contentContainer, setContentContainer] = createSignal<HTMLDivElement>()

  createEffect(() => {
    const firstChild = resolvedChildren.toArray()[0]
    if (firstChild instanceof HTMLElement) {
      setTrigger(firstChild)
    }
  })

  createEffect(() => {
    const target = trigger()
    if (!target) {
      return
    }

    const instance = makeTippy(target, {
      animation: "scale-subtle",
      ...untrack(() => tippyProps.props),
      content: contentContainer() ?? "",
    })

    createEffect(() => {
      instance.setProps({
        animation: "scale-subtle",
        ...tippyProps.props,
        content: contentContainer() ?? "",
      })
    })

    onCleanup(() => {
      instance.destroy()
    })
  })

  return (
    <>
      {resolvedChildren()}
      <div style={{ display: "none" }}>
        <div ref={setContentContainer}>{local.content}</div>
      </div>
    </>
  )
}

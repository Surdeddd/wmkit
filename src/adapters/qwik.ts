import {
  component$,
  createContextId,
  jsx,
  type NoSerialize,
  noSerialize,
  type QRL,
  type Signal,
  Slot,
  untrack,
  useComputed$,
  useContext,
  useContextProvider,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from '@builder.io/qwik'
import {
  createDesktopBinder,
  createWindowManager,
  type DesktopBinder,
  type DesktopOptions,
  type ManagerOptions,
  type ManagerState,
  type WindowInit,
  type WindowManager,
} from '@surdeddd/wmkit'

export interface WmStore {
  wm: NoSerialize<WindowManager>
  binder: NoSerialize<DesktopBinder>
  version: number
}

export const WmContext = createContextId<WmStore>('wmkit.desktop')

export interface WmDesktopProps {
  options?: DesktopOptions & ManagerOptions
  options$?: QRL<() => DesktopOptions & ManagerOptions>
  class?: string
}

export const WmDesktop = component$<WmDesktopProps>((props) => {
  const element = useSignal<HTMLElement>()
  const store = useStore<WmStore>({ wm: undefined, binder: undefined, version: 0 })
  useContextProvider(WmContext, store)
  useVisibleTask$(async ({ cleanup }) => {
    let live = true
    let stop = () => {}
    cleanup(() => {
      live = false
      stop()
    })
    const options = { ...props.options, ...(props.options$ ? await props.options$() : null) }
    if (!live) return
    const wm = createWindowManager(options)
    const binder = createDesktopBinder(wm, options)
    binder.bindDesktop(element.value as HTMLElement)
    const unsubscribe = wm.subscribe(() => {
      store.version += 1
    })
    store.wm = noSerialize(wm)
    store.binder = noSerialize(binder)
    stop = () => {
      unsubscribe()
      binder.destroy()
      wm.destroy()
      store.wm = undefined
      store.binder = undefined
    }
  })
  return jsx('div', { ref: element, class: props.class, children: jsx(Slot, {}) })
})

export interface WmWindowProps extends Omit<WindowInit, 'id' | 'meta'> {
  id: string
  class?: string
}

export const WmWindow = component$<WmWindowProps>((props) => {
  const store = useContext(WmContext)
  const element = useSignal<HTMLElement>()
  useVisibleTask$(({ track, cleanup }) => {
    const wm = track(() => store.wm)
    const binder = store.binder
    const el = element.value
    if (!wm || !binder || !el) return
    const { class: _class, ...init } = props
    if (!wm.get(props.id)) wm.open(init)
    const release = binder.bindWindow(props.id, el)
    cleanup(() => {
      release()
      wm.close(props.id)
    })
  })
  useVisibleTask$(({ track }) => {
    const title = track(() => props.title)
    store.wm?.update(props.id, { title: title ?? '' })
  })
  const placed = useStore(() => ({
    x: props.x,
    y: props.y,
    width: props.width,
    height: props.height,
  }))
  useTask$(({ track }) => {
    const next = {
      x: track(() => props.x),
      y: track(() => props.y),
      width: track(() => props.width),
      height: track(() => props.height),
    }
    const wm = store.wm
    const now = wm?.get(props.id)?.bounds
    if (wm && now) {
      const b = { ...now }
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        const value = next[key]
        if (value !== undefined && value !== placed[key]) b[key] = value
      }
      wm.batch(() => {
        if (b.x !== now.x || b.y !== now.y) wm.move(props.id, b.x, b.y)
        if (b.width !== now.width || b.height !== now.height) {
          wm.resize(props.id, { width: b.width, height: b.height })
        }
      })
    }
    Object.assign(placed, next)
  })
  const closed = useComputed$(() => {
    void store.version
    return store.wm !== undefined && !store.wm.get(props.id)
  })
  const px = (value: number | undefined) => (value === undefined ? undefined : `${value}px`)
  const frame = useSignal(
    untrack(() => ({
      position: 'absolute',
      left: 0,
      top: 0,
      transform: `translate3d(${props.x ?? 0}px, ${props.y ?? 0}px, 0)`,
      width: px(props.width),
      height: px(props.height),
    })),
  )
  return jsx('section', {
    ref: element,
    class: props.class,
    hidden: closed.value,
    style: frame.value,
    children: [
      jsx('header', {
        'data-wm-drag': '',
        children: [
          jsx('span', { 'data-wm-title': '', children: props.title ?? '' }),
          jsx('span', { 'data-wm-controls': '', children: jsx(Slot, { name: 'controls' }) }),
        ],
      }),
      jsx('div', { 'data-wm-content': '', children: jsx(Slot, {}) }),
    ],
  })
})

export function useWm(): WmStore {
  return useContext(WmContext)
}

export function useWmState(): Readonly<Signal<ManagerState | undefined>> {
  const store = useContext(WmContext)
  return useComputed$(() => {
    void store.version
    return store.wm?.getState()
  })
}

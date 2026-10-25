import {
  component$,
  createContextId,
  jsx,
  type NoSerialize,
  noSerialize,
  type Signal,
  Slot,
  useComputed$,
  useContext,
  useContextProvider,
  useSignal,
  useStore,
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
  class?: string
}

export const WmDesktop = component$<WmDesktopProps>((props) => {
  const element = useSignal<HTMLElement>()
  const store = useStore<WmStore>({ wm: undefined, binder: undefined, version: 0 })
  useContextProvider(WmContext, store)
  useVisibleTask$(({ cleanup }) => {
    const wm = createWindowManager(props.options)
    const binder = createDesktopBinder(wm, props.options)
    binder.bindDesktop(element.value as HTMLElement)
    const stop = wm.subscribe(() => {
      store.version += 1
    })
    store.wm = noSerialize(wm)
    store.binder = noSerialize(binder)
    cleanup(() => {
      stop()
      binder.destroy()
      wm.destroy()
      store.wm = undefined
      store.binder = undefined
    })
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
  const closed = useComputed$(() => {
    void store.version
    return store.wm !== undefined && !store.wm.get(props.id)
  })
  const px = (value: number | undefined) => (value === undefined ? undefined : `${value}px`)
  return jsx('section', {
    ref: element,
    class: props.class,
    hidden: closed.value,
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      transform: `translate3d(${props.x ?? 0}px, ${props.y ?? 0}px, 0)`,
      width: px(props.width),
      height: px(props.height),
    },
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

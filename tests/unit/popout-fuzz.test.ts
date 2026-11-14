// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager, WindowStage } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'
import type { DesktopController } from '../../src/dom/shared'
import { type PopoutHandle, type PopoutOptions, popout } from '../../src/plugins/popout'
import { breathe, fuzz } from './support/fuzz'
import { trackResources } from './support/resources'

const IDS = ['a', 'b', 'c'] as const
type Id = (typeof IDS)[number]

class Popup {
  readonly document = document.implementation.createHTMLDocument('popup')
  closed = false
  focused = 0
  private readonly listeners = new Set<() => void>()

  addEventListener(type: string, listener: () => void): void {
    if (type === 'pagehide') this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: () => void): void {
    this.listeners.delete(listener)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    for (const listener of [...this.listeners]) listener()
  }

  focus(): void {
    this.focused += 1
  }

  moveTo(): void {}
}

interface Request {
  popup: Popup
  resolve(popup: Popup): void
  reject(error: Error): void
}

interface Live {
  popup: Popup
  handle: PopoutHandle
  pip: boolean
  moved: boolean
  settled: boolean
  stage: WindowStage
  ours: boolean
  untouched: boolean
}

interface Model {
  open: Set<Id>
  live: Set<Id>
  pending: Set<Id>
}

interface Page {
  wm: WindowManager
  desktop: DesktopController
  root: HTMLElement
  popups: Popup[]
  blocked: boolean
  asking: Id | null
  requests: Map<Id, Request>
  promises: Map<Id, Promise<PopoutHandle>>
  options: Map<Id, PopoutOptions>
  live: Map<Id, Live>
  failures: string[]
}

type Step = fc.AsyncCommand<Model, Page>

async function settle(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve()
}

function sectionOf(page: Page, id: Id): HTMLElement {
  return page.root.querySelector(`[data-testid="window-${id}"]`) as HTMLElement
}

function contentOf(id: Id): HTMLElement {
  for (const doc of [document, ...known.map((popup) => popup.document)]) {
    const found = doc.getElementById(`content-${id}`)
    if (found) return found
  }
  throw new Error(`the content of ${id} is nowhere`)
}

let known: Popup[] = []

function mountWindow(page: Page, id: Id): void {
  const section = document.createElement('section')
  section.dataset.testid = `window-${id}`
  section.innerHTML =
    `<header data-wm-drag><span data-wm-title></span></header>` +
    `<div data-wm-content><p>before</p><div id="content-${id}">body of ${id}</div><p>after</p></div>`
  page.root.append(section)
  page.desktop.attachWindow(id, section)
}

function openWindow(page: Page, id: Id): void {
  page.wm.open({ id, title: `Window ${id}`, width: 320, height: 240 })
  mountWindow(page, id)
}

function arrive(page: Page, id: Id, popup: Popup, handle: PopoutHandle, pip: boolean): void {
  const options = page.options.get(id) ?? {}
  const stage = page.wm.get(id)?.stage
  if (stage === undefined) {
    page.failures.push(`${id}: a popup opened for a window that was already closed`)
    return
  }
  const before = page.live.get(id)?.stage ?? stage
  const live: Live = {
    popup,
    handle,
    pip,
    moved: options.mode !== 'container',
    settled: false,
    stage: before,
    ours: false,
    untouched: true,
  }
  void handle.closed.then(() => {
    live.settled = true
  })
  page.live.set(id, live)
}

function ended(page: Page, id: Id, why: string): void {
  const live = page.live.get(id)
  if (!live) return
  page.live.delete(id)
  page.promises.delete(id)
  if (!live.popup.closed) page.failures.push(`${id}: the popup stayed open after ${why}`)
  const win = page.wm.get(id)
  if (win && live.ours && live.untouched && win.stage !== live.stage) {
    page.failures.push(`${id}: after ${why} the window is ${win.stage}, it was ${live.stage}`)
  }
  void settle().then(() => {
    if (!live.settled) page.failures.push(`${id}: handle.closed never resolved after ${why}`)
  })
}

function drift(model: Model, page: Page): string[] {
  const found = page.failures.splice(0)
  const state = page.wm.getState()
  for (const id of IDS) {
    const win = state.windows[id]
    const live = page.live.get(id)
    if (!!win !== model.open.has(id))
      found.push(`${id}: open is ${!!win}, the model says otherwise`)
    if (!!live !== model.live.has(id)) {
      found.push(`${id}: a live popup is ${!!live}, the model says ${model.live.has(id)}`)
      continue
    }
    const section = sectionOf(page, id)
    const content = section ? contentOf(id) : null
    const box = section?.querySelector('[data-wm-content]')
    const markers = [...(box?.childNodes ?? [])].filter(
      (node) => node.nodeType === Node.COMMENT_NODE,
    ).length
    if (!live) {
      if (markers > 0) found.push(`${id}: a popout marker was left in the page`)
      if (content && content.ownerDocument !== document) {
        found.push(`${id}: its content was left in a popup`)
      } else if (content) {
        const order = [...(content.parentElement?.children ?? [])]
          .map((node) => node.tagName)
          .join()
        if (order !== 'P,DIV,P') found.push(`${id}: its content came back out of place (${order})`)
      }
      continue
    }
    if (!win) {
      found.push(`${id}: a popup is still open for a closed window`)
      continue
    }
    if (live.popup.closed) found.push(`${id}: its popup closed and nobody noticed`)
    const shown = win.title.replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '')
    if (live.popup.document.title !== shown) {
      found.push(`${id}: the popup is titled ${live.popup.document.title}, the window ${win.title}`)
    }
    if (live.handle.container.ownerDocument !== live.popup.document) {
      found.push(`${id}: the container is not in the popup`)
    }
    if (live.moved) {
      if (content?.parentElement !== live.handle.container) {
        found.push(`${id}: its content is not in the popup container`)
      }
      if (markers !== 1) found.push(`${id}: ${markers} markers hold its place in the page`)
    } else if (content?.ownerDocument !== document) {
      found.push(`${id}: container mode moved the content`)
    }
  }
  const openPopups = page.popups.filter((popup) => !popup.closed).length
  const expected = page.live.size + page.requests.size
  if (openPopups !== expected) {
    found.push(`${openPopups} popups are open, ${expected} are accounted for`)
  }
  return found
}

function step(
  name: string,
  check: (model: Readonly<Model>) => boolean,
  run: (model: Model, page: Page) => void | Promise<void>,
): Step {
  return {
    check,
    async run(model, page) {
      await run(model, page)
      await settle()
      const found = drift(model, page)
      if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${name}`)
    },
    toString: () => name,
  }
}

const opened = (id: Id) => (model: Readonly<Model>) => model.open.has(id)
const popped = (id: Id) => (model: Readonly<Model>) => model.live.has(id)
const always = () => true

function gone(model: Model, page: Page, id: Id, why: string): void {
  model.live.delete(id)
  ended(page, id, why)
}

function resync(model: Model, page: Page, why: string): void {
  const windows = page.wm.getState().windows
  for (const id of IDS) {
    if (windows[id]) {
      if (!model.open.has(id) && !sectionOf(page, id)) mountWindow(page, id)
      model.open.add(id)
      const live = page.live.get(id)
      if (live) live.untouched = false
    } else {
      model.open.delete(id)
      if (model.live.has(id)) gone(model, page, id, why)
      sectionOf(page, id)?.remove()
    }
  }
}

const pop = (id: Id, options: PopoutOptions, blocked: boolean) =>
  step(
    `popout(${id}, ${JSON.stringify(options)}${blocked ? ', blocked' : ''})`,
    opened(id),
    async (model, page) => {
      const pipApi = window.documentPictureInPicture !== undefined
      const wanted = options.target ?? 'auto'
      const usePip = wanted === 'pip' || (wanted === 'auto' && pipApi)
      const repeat = page.promises.get(id)
      const before = page.popups.length
      const stage = page.wm.get(id)?.stage as WindowStage
      page.blocked = blocked
      page.asking = id
      if (!repeat) page.options.set(id, options)
      const promise = popout(page.wm, id, contentOf(id), options)
      page.asking = null
      if (repeat) {
        if (page.popups.length !== before) throw new Error(`${id}: a second popup opened`)
        const live = page.live.get(id)
        if (live) {
          const focused = live.popup.focused
          const handle = await promise
          if (handle !== live.handle) throw new Error(`${id}: a repeated popout made a new handle`)
          if (live.popup.focused !== focused + 1)
            throw new Error(`${id}: the popup was not focused`)
        } else {
          promise.catch(() => {})
        }
        return
      }
      page.promises.set(id, promise)
      if (usePip && pipApi) {
        model.pending.add(id)
        const asked = (page.requests.get(id) as Request).popup
        promise.then(
          (handle) => arrive(page, id, asked, handle, true),
          () => page.promises.delete(id),
        )
        return
      }
      let handle: PopoutHandle
      try {
        handle = await promise
      } catch (error) {
        page.promises.delete(id)
        if (!(usePip || blocked)) throw error
        if (page.popups.length !== before) throw new Error(`${id}: a refused popout left a popup`)
        if (page.wm.get(id)?.stage !== stage) throw new Error(`${id}: a refused popout minimized`)
        return
      }
      if (usePip || blocked) throw new Error(`${id}: a popout that had to fail went through`)
      arrive(page, id, page.popups[page.popups.length - 1] as Popup, handle, false)
      const live = page.live.get(id) as Live
      live.stage = stage
      live.ours = options.minimizeWhilePopped !== false && stage !== 'minimized'
      const now = page.wm.get(id)?.stage
      if (now !== (live.ours ? 'minimized' : stage)) {
        throw new Error(`${id}: popped out from ${stage}, the window is now ${now}`)
      }
      model.live.add(id)
    },
  )

const pipArrives = (id: Id) =>
  step(
    `the picture-in-picture window for ${id} arrives`,
    (model) => model.pending.has(id),
    async (model, page) => {
      const request = page.requests.get(id) as Request
      const stage = page.wm.get(id)?.stage
      const options = page.options.get(id) ?? {}
      page.requests.delete(id)
      model.pending.delete(id)
      request.resolve(request.popup)
      await settle()
      const live = page.live.get(id)
      if (stage === undefined) {
        page.failures.length = 0
        if (live || !request.popup.closed) {
          throw new Error(`${id}: the window closed while its popup was on the way, yet it opened`)
        }
        page.promises.delete(id)
        return
      }
      if (!live) throw new Error(`${id}: the popout never resolved`)
      live.stage = stage
      live.ours = options.minimizeWhilePopped !== false && stage !== 'minimized'
      const now = page.wm.get(id)?.stage
      if (now !== (live.ours ? 'minimized' : stage)) {
        throw new Error(`${id}: arrived over a ${stage} window, which is now ${now}`)
      }
      model.live.add(id)
    },
  )

const pipFails = (id: Id) =>
  step(
    `the picture-in-picture request for ${id} is refused`,
    (model) => model.pending.has(id),
    async (model, page) => {
      const request = page.requests.get(id) as Request
      const stage = page.wm.get(id)?.stage
      page.requests.delete(id)
      model.pending.delete(id)
      request.popup.closed = true
      request.reject(new Error('the request was refused'))
      await settle()
      if (page.promises.has(id)) throw new Error(`${id}: a refused request is still remembered`)
      if (page.wm.get(id)?.stage !== stage) throw new Error(`${id}: a refused request minimized`)
    },
  )

const userCloses = (id: Id) =>
  step(`the user closes the popup of ${id}`, popped(id), (model, page) => {
    ;(page.live.get(id) as Live).popup.close()
    gone(model, page, id, 'the user closed the popup')
  })

const handleCloses = (id: Id) =>
  step(`handle.close(${id})`, popped(id), (model, page) => {
    ;(page.live.get(id) as Live).handle.close()
    gone(model, page, id, 'handle.close()')
  })

const windowCloses = (id: Id) =>
  step(`wm.close(${id})`, opened(id), (model, page) => {
    page.wm.close(id)
    model.open.delete(id)
    if (model.live.has(id)) gone(model, page, id, 'its window closed')
    sectionOf(page, id)?.remove()
  })

const windowOpens = (id: Id) =>
  step(
    `wm.open(${id})`,
    (model) => !model.open.has(id) && !model.pending.has(id),
    (model, page) => {
      openWindow(page, id)
      model.open.add(id)
    },
  )

const stageChange = (id: Id, action: 'minimize' | 'maximize' | 'restore') =>
  step(`wm.${action}(${id})`, opened(id), (_model, page) => {
    page.wm[action](id)
    const live = page.live.get(id)
    if (live) live.untouched = false
  })

const rename = (id: Id, title: string) =>
  step(`rename(${id}, ${JSON.stringify(title)})`, opened(id), (_model, page) => {
    page.wm.update(id, { title })
  })

const pageHides = () =>
  step('the page hides', always, (model, page) => {
    window.dispatchEvent(new Event('pagehide'))
    for (const id of IDS) {
      if (model.live.has(id) && !page.live.get(id)?.pip) gone(model, page, id, 'the page hid')
    }
  })

const travel = (direction: 'undo' | 'redo') =>
  step(
    `wm.${direction}()`,
    (model) => model.pending.size === 0,
    (model, page) => {
      page.wm[direction]()
      resync(model, page, `wm.${direction}()`)
    },
  )

const anyId = fc.constantFrom(...IDS)
const anyOptions: fc.Arbitrary<PopoutOptions> = fc.record(
  {
    target: fc.constantFrom('auto', 'pip', 'window'),
    mode: fc.constantFrom('move', 'container'),
    minimizeWhilePopped: fc.boolean(),
    copyStyles: fc.boolean(),
    width: fc.constantFrom(0, 200, 640, -5, Number.NaN),
    left: fc.integer({ min: -2000, max: 4000 }),
    screen: fc.constantFrom('current', 'other'),
  },
  { requiredKeys: [] },
)

const steps = [
  fc.tuple(anyId, anyOptions, fc.boolean()).map((args) => pop(...args)),
  fc.tuple(anyId, anyOptions, fc.constant(false)).map((args) => pop(...args)),
  fc.tuple(anyId, anyOptions, fc.constant(false)).map((args) => pop(...args)),
  anyId.map(pipArrives),
  anyId.map(pipArrives),
  anyId.map(pipFails),
  anyId.map(userCloses),
  anyId.map(handleCloses),
  anyId.map(windowCloses),
  anyId.map(windowOpens),
  fc
    .tuple(anyId, fc.constantFrom('minimize', 'maximize', 'restore'))
    .map((args) => stageChange(...args)),
  fc.tuple(anyId, fc.string()).map((args) => rename(...args)),
  fc.constant(pageHides()),
  fc.constantFrom('undo', 'redo').map(travel),
]

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  known = []
})

describe('windows popped out, closed, renamed and hidden at random', () => {
  it('always bring their content home and leave no popup or listener behind', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        fc.commands(steps, { maxCommands: 40, size: 'max' }),
        async (pipApi, screens, commands) => {
          const resources = trackResources()
          const root = document.createElement('div')
          document.body.append(root)
          const wm = createWindowManager({ viewport: { width: 1280, height: 800 } })
          const desktop = attachDesktop(wm, root, { autoViewport: false, announce: false })
          const page: Page = {
            wm,
            desktop,
            root,
            popups: [],
            blocked: false,
            asking: null,
            requests: new Map(),
            promises: new Map(),
            options: new Map(),
            live: new Map(),
            failures: [],
          }
          known = page.popups
          const make = (): Popup => {
            const popup = new Popup()
            page.popups.push(popup)
            return popup
          }
          vi.stubGlobal('open', () => (page.blocked ? null : make()))
          vi.stubGlobal(
            'documentPictureInPicture',
            pipApi
              ? {
                  requestWindow: () =>
                    new Promise<Popup>((resolve, reject) => {
                      page.requests.set(page.asking as Id, { popup: make(), resolve, reject })
                    }),
                }
              : undefined,
          )
          vi.stubGlobal(
            'getScreenDetails',
            screens
              ? async () => {
                  const screen = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }
                  return {
                    screens: [screen, { ...screen, availLeft: 1920 }],
                    currentScreen: screen,
                  }
                }
              : undefined,
          )
          try {
            const model: Model = { open: new Set(), live: new Set(), pending: new Set() }
            for (const id of IDS) {
              openWindow(page, id)
              model.open.add(id)
            }
            await fc.asyncModelRun(() => ({ model, real: page }), commands)
            for (const request of page.requests.values()) {
              request.popup.closed = true
              request.reject(new Error('the page is going away'))
            }
            for (const live of page.live.values()) live.handle.close()
            await settle()
            desktop.destroy()
            wm.destroy()
            const left = resources.leaks()
            if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
          } finally {
            resources.restore()
            root.remove()
            await breathe()
          }
        },
      ),
      fuzz(150),
    )
  }, 120_000)
})

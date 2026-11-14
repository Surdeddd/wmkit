// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { createDesktopBinder } from '../../src/dom/binder'
import { domDrift, stateDrift } from './support/dom-state'
import { stubFrames } from './support/frames'
import { fuzz, patience } from './support/fuzz'
import { trackResources } from './support/resources'

const IDS = ['a', 'b', 'c'] as const
type Id = (typeof IDS)[number]

type Action =
  | { do: 'desktop'; host: number }
  | { do: 'undesk' }
  | { do: 'bind'; id: Id; inPage: boolean }
  | { do: 'unbind'; slot: number }
  | { do: 'open' | 'close' | 'minimize' | 'restore'; id: Id }
  | { do: 'undo' }
  | { do: 'redo' }
  | { do: 'destroy' }

interface Bound {
  id: Id
  element: HTMLElement
  release(): void
}

function run(actions: Action[]): void {
  const frames = stubFrames()
  const resources = trackResources()
  const hosts = [document.createElement('main'), document.createElement('main')]
  document.body.append(...hosts)
  const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  let binder = createDesktopBinder(wm, { autoViewport: false, announce: false })
  let unbindDesktop: (() => void) | null = null
  let host: HTMLElement | null = null
  let bound: Bound[] = []

  const check = (after: string) => {
    frames.flush(2)
    const found = stateDrift(wm)
    const attached = [...document.querySelectorAll<HTMLElement>('[data-wm-window]')]
    if (!host) {
      if (attached.length > 0)
        found.push(`${attached.length} windows stay attached with no desktop`)
      if (binder.controller()) found.push('a controller outlived its desktop')
    } else {
      found.push(...domDrift(wm, document.body))
      if (binder.controller()?.element !== host)
        found.push('the controller sits on another element')
      for (const id of IDS) {
        const holders = bound.filter((entry) => entry.id === id)
        const live = attached.filter((node) => node.dataset.wmWindow === id)
        const expected = wm.get(id) && holders.length > 0 ? 1 : 0
        if (live.length !== expected) {
          found.push(`${id}: ${live.length} elements attached, expected ${expected}`)
          continue
        }
        const holder = live[0]
        if (!holder) continue
        if (!holders.some((entry) => entry.element === holder)) {
          found.push(`${id}: attached to an element that was unbound`)
        }
      }
    }
    if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${after}`)
  }

  try {
    for (const action of actions) {
      switch (action.do) {
        case 'desktop': {
          const target = hosts[action.host] as HTMLElement
          if (host) {
            let refused = false
            try {
              binder.bindDesktop(target)
            } catch {
              refused = true
            }
            if (!refused) throw new Error('a second desktop was bound')
          } else {
            unbindDesktop = binder.bindDesktop(target)
            host = target
          }
          break
        }
        case 'undesk':
          unbindDesktop?.()
          unbindDesktop = null
          host = null
          break
        case 'bind': {
          const element = document.createElement('section')
          element.innerHTML = '<header data-wm-drag><span data-wm-title></span></header>'
          if (action.inPage) (host ?? hosts[0])?.append(element)
          const entry: Bound = { id: action.id, element, release: () => {} }
          entry.release = binder.bindWindow(action.id, element)
          bound.push(entry)
          break
        }
        case 'unbind': {
          const entry = bound[action.slot % Math.max(bound.length, 1)]
          if (!entry) break
          bound = bound.filter((other) => other !== entry)
          entry.release()
          entry.element.remove()
          break
        }
        case 'open':
          if (!wm.get(action.id)) wm.open({ id: action.id, title: action.id })
          break
        case 'close':
        case 'minimize':
        case 'restore':
          wm[action.do](action.id)
          break
        case 'undo':
        case 'redo':
          wm[action.do]()
          break
        case 'destroy':
          binder.destroy()
          for (const entry of bound) entry.element.remove()
          bound = []
          unbindDesktop = null
          host = null
          binder = createDesktopBinder(wm, { autoViewport: false, announce: false })
          break
      }
      check(JSON.stringify(action))
    }
    binder.destroy()
    wm.destroy()
    const left = resources.leaks()
    if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
  } finally {
    binder.destroy()
    resources.restore()
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  }
}

const id = fc.constantFrom(...IDS)
const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.record({ do: fc.constant('desktop' as const), host: fc.constantFrom(0, 1) }),
  },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('undesk' as const) }) },
  {
    weight: 5,
    arbitrary: fc.record({ do: fc.constant('bind' as const), id, inPage: fc.boolean() }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ do: fc.constant('unbind' as const), slot: fc.nat({ max: 7 }) }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'open' as const,
        'open' as const,
        'close' as const,
        'minimize' as const,
        'restore' as const,
      ),
      id,
    }),
  },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('undo' as const) }) },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('redo' as const) }) },
  { weight: 1, arbitrary: fc.record({ do: fc.constant('destroy' as const) }) },
)

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('a desktop binder used the way adapters use it', () => {
  it(
    'keeps one element per open window however desktops and windows come and go',
    () => {
      fc.assert(
        fc.property(fc.array(action, { minLength: 1, maxLength: 70, size: 'max' }), run),
        fuzz(150),
      )
    },
    patience(120_000),
  )
})

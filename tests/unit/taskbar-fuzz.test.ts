// @vitest-environment jsdom
import fc from 'fast-check'
import { afterEach, describe, it } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { ManagerState, WindowManager, WindowState } from '../../src/core/types'
import { createTaskbar, type TaskbarOptions, taskbarMessages } from '../../src/plugins/taskbar'
import { rootOf, stateDrift } from './support/dom-state'
import { fuzz, patience } from './support/fuzz'
import { trackResources } from './support/resources'

const IDS = ['a', 'b', 'c', '7', '3'] as const
type Id = (typeof IDS)[number]

type Action =
  | { do: 'open'; id: Id; workspace: number; minimized: boolean; owner: Id | null }
  | {
      do: 'close' | 'focus' | 'minimize' | 'restore' | 'maximize' | 'ungroup' | 'tab' | 'rename'
      id: Id
    }
  | { do: 'group'; id: Id; other: Id }
  | { do: 'send'; id: Id; workspace: number }
  | { do: 'workspace'; workspace: number }
  | { do: 'undo' | 'redo' | 'closeAll' | 'blur' | 'reload' }
  | { do: 'click' | 'middle' | 'enter'; at: number }
  | {
      do: 'key'
      at: number
      key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'
    }

interface Shown {
  id: string
  title: string
  count: number
  focused: boolean
  stage: string
}

const id = fc.constantFrom(...IDS)
const workspace = fc.nat({ max: 2 })
const at = fc.nat({ max: 6 })
const action: fc.Arbitrary<Action> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      do: fc.constant('open' as const),
      id,
      workspace: fc.constantFrom(0, 0, 0, 1, 2),
      minimized: fc.boolean(),
      owner: fc.option(id, { nil: null }),
    }),
  },
  {
    weight: 10,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'close' as const,
        'focus' as const,
        'minimize' as const,
        'restore' as const,
        'maximize' as const,
        'ungroup' as const,
        'tab' as const,
        'rename' as const,
      ),
      id,
    }),
  },
  { weight: 3, arbitrary: fc.record({ do: fc.constant('group' as const), id, other: id }) },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('send' as const), id, workspace }) },
  { weight: 2, arbitrary: fc.record({ do: fc.constant('workspace' as const), workspace }) },
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constantFrom(
        'undo' as const,
        'redo' as const,
        'closeAll' as const,
        'blur' as const,
        'reload' as const,
      ),
    }),
  },
  {
    weight: 8,
    arbitrary: fc.record({
      do: fc.constantFrom('click' as const, 'middle' as const, 'enter' as const),
      at,
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      do: fc.constant('key' as const),
      at,
      key: fc.constantFrom(
        'ArrowLeft' as const,
        'ArrowRight' as const,
        'ArrowUp' as const,
        'ArrowDown' as const,
        'Home' as const,
        'End' as const,
      ),
    }),
  },
)

function expected(state: ManagerState, options: TaskbarOptions): Shown[] {
  const families = new Map<string, WindowState[]>()
  for (const win of Object.values(state.windows)) {
    const key = win.groupId ?? rootOf(state, win.id).id
    const family = families.get(key) ?? []
    family.push(win)
    families.set(key, family)
  }
  const lead = state.focusedId === null ? null : rootOf(state, state.focusedId).id
  return [...families.values()]
    .map((family) => {
      const groupId = (family[0] as WindowState).groupId
      const face =
        groupId === null
          ? rootOf(state, (family[0] as WindowState).id)
          : (state.windows[state.groups[groupId]?.activeId as string] as WindowState)
      return {
        face,
        count: groupId === null ? 1 : family.length,
        born: Math.min(...family.map((win) => win.openedSeq)),
      }
    })
    .filter(({ face }) => options.workspace === 'all' || face.workspace === state.workspace)
    .filter(({ face }) => options.show !== 'minimized' || face.stage === 'minimized')
    .sort((left, right) => left.born - right.born)
    .map(({ face, count }) => ({
      id: face.id,
      title: face.title,
      count,
      focused: lead === face.id,
      stage: face.stage,
    }))
}

function shown(bar: HTMLElement): Shown[] {
  return [...bar.children].map((child) => {
    const button = child as HTMLButtonElement
    return {
      id: button.dataset.wmTask as string,
      title: button.querySelector('[data-wm-task-title]')?.textContent as string,
      count: Number(button.querySelector('[data-wm-task-count]')?.textContent ?? 1),
      focused: button.hasAttribute('data-wm-focused'),
      stage: button.dataset.wmStage as string,
    }
  })
}

function drift(wm: WindowManager, bar: HTMLElement, options: TaskbarOptions): string[] {
  const found = stateDrift(wm)
  const want = expected(wm.getState(), options)
  const have = shown(bar)
  if (JSON.stringify(have) !== JSON.stringify(want)) {
    found.push(`the bar shows ${JSON.stringify(have)} for ${JSON.stringify(want)}`)
  }
  const buttons = [...bar.children] as HTMLButtonElement[]
  buttons.forEach((button, index) => {
    const entry = want[index]
    if (!entry) return
    const label = entry.count > 1 ? taskbarMessages.tabs(entry.title, entry.count) : null
    if (button.getAttribute('aria-label') !== label) found.push(`${entry.id} is named wrongly`)
    if (button.getAttribute('aria-pressed') !== String(entry.focused)) {
      found.push(`${entry.id} is pressed wrongly`)
    }
    if (button.type !== 'button') found.push(`${entry.id} is not a plain button`)
  })
  const stops = buttons.filter((button) => button.tabIndex === 0).length
  if (stops !== Math.min(1, buttons.length)) found.push(`${stops} tab stops for ${buttons.length}`)
  return found
}

function run(options: TaskbarOptions, actions: Action[]): void {
  const resources = trackResources()
  const wm = createWindowManager({ viewport: { width: 1200, height: 800 } })
  const bar = document.createElement('div')
  document.body.append(bar)
  const taskbar = createTaskbar(wm, bar, options)
  const faces = new Map<string, Element>()
  let renames = 0
  let saved = wm.serialize()
  try {
    for (const next of actions) {
      const state = wm.getState()
      const buttons = [...bar.children] as HTMLButtonElement[]
      const button = 'at' in next ? buttons[next.at % Math.max(1, buttons.length)] : undefined
      const target = button ? wm.get(button.dataset.wmTask as string) : undefined
      switch (next.do) {
        case 'open':
          if (!wm.get(next.id)) {
            wm.open({
              id: next.id,
              title: next.id,
              workspace: next.workspace,
              stage: next.minimized ? 'minimized' : 'normal',
              owner: next.owner ?? undefined,
            })
          }
          break
        case 'tab':
          wm.activateTab(next.id)
          break
        case 'rename':
          renames += 1
          wm.update(next.id, { title: `${next.id}${renames}` })
          break
        case 'group':
          wm.group([next.id, next.other])
          break
        case 'send':
          wm.moveToWorkspace(next.id, next.workspace)
          break
        case 'workspace':
          wm.setWorkspace(next.workspace)
          break
        case 'reload':
          saved = wm.hydrate(saved) ? wm.serialize() : saved
          break
        case 'click':
        case 'enter': {
          if (!button || !target) break
          if (next.do === 'enter') button.focus()
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          const after = wm.get(target.id)
          const leadOf = (now: ManagerState) =>
            now.focusedId === null ? null : rootOf(now, now.focusedId).id
          const front = leadOf(state) === target.id && target.stage !== 'minimized'
          if (front && target.minimizable && after?.stage !== 'minimized') {
            throw new Error(`a click on the focused ${target.id} did not minimize it`)
          }
          if (!front && wm.getState().focusedId !== target.id) {
            throw new Error(`a click on ${target.id} did not focus it`)
          }
          break
        }
        case 'middle':
          if (!button || !target) break
          button.dispatchEvent(
            new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
          )
          if (wm.get(target.id)) throw new Error(`a middle click left ${target.id} open`)
          break
        case 'key': {
          if (!button) break
          button.focus()
          button.dispatchEvent(
            new KeyboardEvent('keydown', { key: next.key, bubbles: true, cancelable: true }),
          )
          const now = [...bar.children].indexOf(document.activeElement as Element)
          const from = buttons.indexOf(button)
          const forward = next.key === 'ArrowRight' || next.key === 'ArrowDown'
          const want =
            next.key === 'Home'
              ? 0
              : next.key === 'End'
                ? buttons.length - 1
                : (from + (forward ? 1 : -1) + buttons.length) % buttons.length
          if (now !== want) throw new Error(`${next.key} went from ${from} to ${now}`)
          if (wm.getState() !== state) throw new Error(`${next.key} changed the desktop`)
          break
        }
        case 'undo':
        case 'redo':
        case 'closeAll':
        case 'blur':
          wm[next.do]()
          break
        default:
          wm[next.do](next.id)
      }
      const found = drift(wm, bar, options)
      for (const child of bar.children) {
        const win = wm.get((child as HTMLElement).dataset.wmTask as string) as WindowState
        const key = win.groupId ?? win.id
        const before = faces.get(key)
        if (before?.isConnected && before !== child) found.push(`${key} got a new button`)
        faces.set(key, child)
      }
      if (found.length > 0) throw new Error(`${found.join('\n')}\nafter: ${JSON.stringify(next)}`)
    }
    taskbar.destroy()
    if (bar.children.length > 0) throw new Error('buttons were left behind')
    const left = resources.leaks()
    if (left.length > 0) throw new Error(`left behind: ${left.join(', ')}`)
  } finally {
    taskbar.destroy()
    resources.restore()
    document.body.replaceChildren()
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('a taskbar under any run of opens, closes, tabs, workspaces, clicks and keys', () => {
  it(
    'shows what the manager holds, one button a window or group, one tab stop, and leaves nothing behind',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            show: fc.constantFrom('all' as const, 'minimized' as const),
            workspace: fc.constantFrom('current' as const, 'all' as const),
          }),
          fc.array(action, { minLength: 1, maxLength: 80, size: 'max' }),
          run,
        ),
        fuzz(200),
      )
    },
    patience(120_000),
  )
})

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WindowManager } from '../../src/core/types'
import { createDock, type Dock, type DockLayout, dockLayout } from '../../src/plugins/dock'
import { defineWmElements, type WmDesktopElement } from '../../src/plugins/elements'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

const DEFAULT: DockLayout = {
  root: {
    kind: 'split',
    id: 'main',
    axis: 'row',
    sizes: [0.58, 0.42],
    children: [
      {
        kind: 'split',
        id: 'left',
        axis: 'column',
        sizes: [0.34, 0.66],
        children: [
          { kind: 'stack', id: 'top', windows: ['kpis'], active: 'kpis' },
          { kind: 'stack', id: 'graph', windows: ['chart'], active: 'chart' },
        ],
      },
      {
        kind: 'split',
        id: 'right',
        axis: 'column',
        sizes: [0.55, 0.45],
        children: [
          { kind: 'stack', id: 'table', windows: ['orders'], active: 'orders' },
          { kind: 'stack', id: 'events', windows: ['log'], active: 'log' },
        ],
      },
    ],
  },
}
const IDS = ['kpis', 'chart', 'orders', 'log']

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  defineWmElements()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function dashboard(): { desktop: WmDesktopElement; wm: WindowManager; dock: Dock } {
  const holder = document.createElement('div')
  holder.innerHTML = `<wm-desktop>${IDS.map((id) => `<wm-window window-id="${id}" label="${id}"></wm-window>`).join('')}</wm-desktop>`
  document.body.append(holder)
  const desktop = holder.querySelector('wm-desktop') as WmDesktopElement
  const wm = desktop.manager as WindowManager
  wm.setViewport({ width: 1200, height: 700 })
  const dock = createDock(desktop.controller as NonNullable<WmDesktopElement['controller']>)
  dock.setLayout(DEFAULT)
  wm.clearHistory()
  return { desktop, wm, dock }
}

function panels(wm: WindowManager, dock: Dock): Record<string, string> {
  const area = { x: 0, y: 0, width: 1200, height: 700 }
  const placed = dockLayout.rects(dock.layout(), area, {
    sash: 6,
    minSize: { width: 0, height: 0 },
    minOf: () => ({ width: 160, height: 100 }),
  }).stacks
  const out: Record<string, string> = {}
  for (const id of IDS) {
    const win = wm.get(id)
    const stack = dockLayout.stackOf(dock.layout(), id)
    const rect = placed.find((entry) => entry.id === stack?.id)?.bounds
    out[id] = `${JSON.stringify(win?.bounds)} in ${JSON.stringify(rect)}`
  }
  return out
}

function reset(desktop: WmDesktopElement, wm: WindowManager, dock: Dock): void {
  wm.batch(() => {
    for (const node of desktop.querySelectorAll('wm-window[closed]')) node.removeAttribute('closed')
    dock.setLayout(DEFAULT)
  })
}

describe('the dashboard layout', () => {
  it('puts every panel back in its own place after one dropped onto another', () => {
    const { wm, dock } = dashboard()
    dock.dock('log', { stackId: 'graph' })
    expect(dockLayout.stackOf(dock.layout(), 'chart')?.windows).toEqual(['chart', 'log'])
    dock.setLayout(DEFAULT)
    const placed = panels(wm, dock)
    for (const id of IDS) {
      const [own, panel] = (placed[id] as string).split(' in ')
      expect(own, id).toBe(panel)
    }
    expect(new Set(IDS.map((id) => JSON.stringify(wm.get(id)?.bounds))).size).toBe(4)
    expect(wm.get('chart')?.groupId).toBeNull()
    expect(wm.get('log')?.groupId).toBeNull()
  })

  it('reopens a closed panel into its place in one undo step', () => {
    const { desktop, wm, dock } = dashboard()
    const orders = desktop.querySelector('wm-window[window-id="orders"]') as HTMLElement
    orders.setAttribute('closed', '')
    expect(wm.get('orders')).toBeUndefined()
    expect(dockLayout.windowsOf(dock.layout())).toEqual(['kpis', 'chart', 'log'])
    wm.clearHistory()
    reset(desktop, wm, dock)
    expect(orders.hasAttribute('closed')).toBe(false)
    expect(orders.dataset.wmWindow).toBe('orders')
    expect(dockLayout.windowsOf(dock.layout())).toEqual(IDS)
    const [own, panel] = (panels(wm, dock).orders as string).split(' in ')
    expect(own).toBe(panel)
    expect(wm.undo()).toBe(true)
    expect(wm.canUndo()).toBe(false)
    expect(wm.get('orders')).toBeUndefined()
  })

  it('switches the tabs of a stack from the strip, and a picked tab stays picked', () => {
    const { desktop, wm, dock } = dashboard()
    dock.dock('log', { stackId: 'graph' })
    const log = desktop.querySelector('wm-window[window-id="log"]') as HTMLElement
    const strip = log.shadowRoot?.querySelector('[part=tabs]') as HTMLElement
    expect(strip.hidden).toBe(false)
    const tab = strip.querySelector('[data-window-id="chart"]') as HTMLElement
    tab.click()
    expect(wm.getState().groups[wm.get('chart')?.groupId as string]?.activeId).toBe('chart')
    wm.setViewport({ width: 1100, height: 700 })
    dock.dock('kpis', { side: 'bottom' })
    expect(wm.getState().groups[wm.get('chart')?.groupId as string]?.activeId).toBe('chart')
    expect(dockLayout.stackOf(dock.layout(), 'log')?.active).toBe('chart')
  })
})

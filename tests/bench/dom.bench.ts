// @vitest-environment jsdom
import { bench, describe } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import type { WindowManager } from '../../src/core/types'
import { attachDesktop } from '../../src/dom/controller'

const VIEWPORT = { width: 1920, height: 1080 }

function desktop(count: number): { wm: WindowManager; destroy: () => void } {
  const element = document.createElement('div')
  document.body.append(element)
  const wm = createWindowManager({ viewport: VIEWPORT, historyLimit: 0 })
  const controller = attachDesktop(wm, element, {
    autoViewport: false,
    announce: false,
    keyboard: false,
  })
  for (let i = 0; i < count; i += 1) {
    wm.open({ id: `w${i}`, x: (i % 40) * 40, y: Math.floor(i / 40) * 30, width: 320, height: 240 })
    const node = document.createElement('section')
    node.innerHTML = '<header data-wm-drag><span data-wm-title>t</span></header>'
    element.append(node)
    controller.attachWindow(`w${i}`, node)
  }
  return {
    wm,
    destroy: () => {
      controller.destroy()
      element.remove()
    },
  }
}

describe('desktop sync', () => {
  for (const count of [50, 200, 800]) {
    bench(`move one window 200 times among ${count} attached`, () => {
      const { wm, destroy } = desktop(count)
      for (let i = 0; i < 200; i += 1) wm.move('w7', 100 + (i % 300), 100 + (i % 200))
      destroy()
    })
  }

  for (const count of [50, 200, 800]) {
    bench(`focus 200 different windows among ${count} attached`, () => {
      const { wm, destroy } = desktop(count)
      for (let i = 0; i < 200; i += 1) wm.focus(`w${i % count}`)
      destroy()
    })
  }
})

describe('manager hot paths', () => {
  for (const count of [200, 800]) {
    bench(`focus 500 different windows among ${count} headless`, () => {
      const wm = createWindowManager({ viewport: VIEWPORT, historyLimit: 0 })
      for (let i = 0; i < count; i += 1) wm.open({ id: `w${i}` })
      for (let i = 0; i < 500; i += 1) wm.focus(`w${i % count}`)
    })
  }

  bench('drag one member of a group among 200 windows', () => {
    const wm = createWindowManager({ viewport: VIEWPORT, historyLimit: 0 })
    for (let i = 0; i < 200; i += 1) wm.open({ id: `w${i}` })
    wm.group(['w0', 'w1', 'w2'])
    for (let i = 0; i < 500; i += 1) wm.move('w0', 100 + (i % 300), 100 + (i % 200))
  })

  bench('getState 2000 times on 800 windows', () => {
    const wm = createWindowManager({ viewport: VIEWPORT, historyLimit: 0 })
    for (let i = 0; i < 800; i += 1) wm.open({ id: `w${i}` })
    wm.group(['w0', 'w1'])
    for (let i = 0; i < 2000; i += 1) {
      wm.move('w5', 100 + (i % 200), 100)
      wm.getState()
    }
  })
})

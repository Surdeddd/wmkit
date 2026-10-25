// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WinBox, { type WinBoxOptions, winboxMessagesRu } from '../../src/plugins/winbox'

class StubObserver {
  observe(): void {}
  disconnect(): void {}
}

let root: HTMLElement
const opened: WinBox[] = []

function box(title?: string | WinBoxOptions, options: WinBoxOptions = {}): WinBox {
  const made =
    typeof title === 'object'
      ? new WinBox({ root, ...title })
      : new WinBox(title, { root, ...options })
  opened.push(made)
  return made
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubObserver)
  root = document.createElement('div')
  Object.defineProperty(root, 'clientWidth', { configurable: true, value: 1000 })
  Object.defineProperty(root, 'clientHeight', { configurable: true, value: 800 })
  document.body.append(root)
})

afterEach(() => {
  for (const made of opened.splice(0)) made.close(true)
  vi.unstubAllGlobals()
  WinBox.configure({ styles: true, messages: undefined, snap: undefined })
})

describe('creating a window', () => {
  it('accepts a title and options, options alone, WinBox.new and a call without new', () => {
    const a = box('First')
    const b = box({ title: 'Second' })
    const c = WinBox.new('Third', { root })
    const d = WinBox('Fourth', { root })
    opened.push(c, d)
    expect([a, b, c, d].map((made) => made.window.querySelector('.wb-title')?.textContent)).toEqual(
      ['First', 'Second', 'Third', 'Fourth'],
    )
    expect(d).toBeInstanceOf(WinBox)
    expect(a.window.classList.contains('winbox')).toBe(true)
    expect(a.window.id).toBe(a.id)
  })

  it('builds the WinBox markup with wmkit wiring on it', () => {
    const made = box('Markup')
    const header = made.window.querySelector('.wb-header') as HTMLElement
    expect(header.dataset.wmDrag).toBe('')
    expect(
      [...(made.window.querySelector('.wb-control')?.children ?? [])].map((n) => n.className),
    ).toEqual(['wb-min', 'wb-max', 'wb-full', 'wb-close'])
    expect(made.body.classList.contains('wb-body')).toBe(true)
    expect(made.body.dataset.wmContent).toBe('')
    expect(document.head.querySelector('style[data-wmkit-winbox]')).not.toBeNull()
  })

  it('reads sizes and positions from pixels, percentages and keywords', () => {
    const made = box('Sized', { width: '50%', height: 300, x: 'center', y: 'bottom' })
    expect([made.width, made.height, made.x, made.y]).toEqual([500, 300, 250, 500])
    const right = box('Right', { width: 200, height: 100, x: 'right', y: 20 })
    expect([right.x, right.y]).toEqual([800, 20])
    const plain = box('Default')
    expect([plain.width, plain.height, plain.x, plain.y]).toEqual([500, 400, 250, 200])
  })

  it('maps limits, a modal, and the control classes onto wmkit flags and CSS', () => {
    const made = box('Limited', {
      minwidth: 300,
      minheight: '25%',
      maxwidth: 900,
      maxheight: 700,
      class: 'no-min no-resize custom',
      modal: true,
    })
    const wm = WinBox.manager(root)
    const state = wm.get(made.id)
    expect(state?.minSize).toEqual({ width: 300, height: 200 })
    expect(state?.maxSize).toEqual({ width: 900, height: 700 })
    expect(state?.minimizable).toBe(false)
    expect(state?.resizable).toBe(false)
    expect(state?.layer).toBe('modal')
    expect(made.hasClass('custom')).toBe(true)
    expect(made.hasClass('modal')).toBe(true)
    expect(made.minwidth).toBe(300)
    made.minwidth = 320
    made.minheight = 210
    made.maxwidth = 950
    made.maxheight = 750
    expect(wm.get(made.id)?.minSize).toEqual({ width: 320, height: 210 })
    expect(wm.get(made.id)?.maxSize).toEqual({ width: 950, height: 750 })
    const array = box('Array', { class: ['no-move', 'no-close'] })
    expect(wm.get(array.id)?.draggable).toBe(false)
    expect(wm.get(array.id)?.closable).toBe(false)
  })

  it('fills its body from html, a url or a mounted node, and gives the node back on close', () => {
    const html = box('Html', { html: '<b>bold</b>' })
    expect(html.body.innerHTML).toBe('<b>bold</b>')
    const url = box('Url', { url: 'https://example.com/' })
    expect(url.body.querySelector('iframe')?.src).toBe('https://example.com/')
    const store = document.createElement('div')
    const node = document.createElement('p')
    const after = document.createElement('i')
    store.append(node, after)
    root.append(store)
    const mounted = box('Mount', { mount: node })
    expect(mounted.body.contains(node)).toBe(true)
    mounted.close()
    expect(node.parentNode).toBe(store)
    expect(node.nextSibling).toBe(after)
  })

  it('runs oncreate first, can start maximized, minimized or hidden, and keeps background, border and icon', () => {
    const seen: string[] = []
    const made = box('Created', {
      oncreate(options) {
        seen.push(String(options.title))
        options.title = 'Changed'
      },
      max: true,
      background: 'rgb(255, 0, 93)',
      border: 6,
      icon: 'icon.png',
    })
    expect(seen).toEqual(['Created'])
    expect(made.window.querySelector('.wb-title')?.textContent).toBe('Changed')
    expect(made.max).toBe(true)
    expect(made.hasClass('max')).toBe(true)
    expect(made.window.style.background).toContain('rgb(255, 0, 93)')
    expect(made.window.style.getPropertyValue('--wb-border')).toBe('6px')
    expect((made.window.querySelector('.wb-icon') as HTMLElement).style.display).toBe('block')
    const small = box('Small', { min: true, border: '1em' })
    expect(small.min).toBe(true)
    expect(small.window.style.getPropertyValue('--wb-border')).toBe('1em')
    const hidden = box('Hidden', { hidden: true })
    expect(hidden.hidden).toBe(true)
    expect(hidden.hasClass('hide')).toBe(true)
  })

  it('autosizes to its content plus the header', () => {
    const proto = HTMLElement.prototype
    Object.defineProperty(proto, 'scrollWidth', { configurable: true, get: () => 420 })
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => 260 })
    Object.defineProperty(proto, 'offsetHeight', { configurable: true, get: () => 35 })
    try {
      const made = box('Auto', { html: '<div>x</div>', autosize: true })
      expect([made.width, made.height]).toEqual([420, 295])
    } finally {
      for (const key of ['scrollWidth', 'scrollHeight', 'offsetHeight']) {
        delete (proto as unknown as Record<string, unknown>)[key]
      }
    }
  })
})

describe('edges', () => {
  it('takes the title from the options, or none at all', () => {
    const fromOptions = WinBox(undefined, { root, title: 'Options' })
    const untitled = WinBox({ root })
    opened.push(fromOptions, untitled)
    expect(fromOptions.window.querySelector('.wb-title')?.textContent).toBe('Options')
    expect(untitled.window.querySelector('.wb-title')?.textContent).toBe('')
  })

  it('reads zeros from a window that is already closed', () => {
    const made = box('Gone')
    made.close()
    expect([made.x, made.y, made.width, made.height, made.minwidth, made.minheight]).toEqual([
      0, 0, 0, 0, 0, 0,
    ])
  })

  it('puts a node back at the end when its old neighbour moved away', () => {
    const store = document.createElement('div')
    const node = document.createElement('p')
    const neighbour = document.createElement('i')
    store.append(node, neighbour)
    root.append(store)
    const made = box('Neighbour', { mount: node })
    root.append(neighbour)
    store.append(document.createElement('b'))
    made.unmount()
    expect(store.lastChild).toBe(node)
  })

  it('appends a control whose index is past the end', () => {
    const made = box('Far')
    made.addControl({ index: 99, class: 'wb-last' })
    expect(made.window.querySelector('.wb-control')?.lastElementChild?.className).toBe('wb-last')
  })
})

describe('callbacks', () => {
  it('reports focus, blur, move, resize and stage changes with the instance as this', () => {
    const log: string[] = []
    const options: WinBoxOptions = {
      onfocus(this: WinBox) {
        log.push(`focus ${this.id}`)
      },
      onblur(this: WinBox) {
        log.push(`blur ${this.id}`)
      },
      onmove(x, y) {
        log.push(`move ${x},${y}`)
      },
      onresize(width, height) {
        log.push(`resize ${width}x${height}`)
      },
      onminimize() {
        log.push('minimize')
      },
      onmaximize() {
        log.push('maximize')
      },
      onrestore() {
        log.push('restore')
      },
    }
    const a = box('A', { ...options, id: 'a' })
    const b = box('B', { ...options, id: 'b' })
    expect(log).toEqual(['focus a', 'blur a', 'focus b'])
    log.length = 0
    b.move(10, 20).resize(300, 200)
    expect(log).toEqual(['move 10,20', 'resize 300x200'])
    log.length = 0
    b.minimize()
    b.minimize(false)
    b.maximize()
    b.maximize(false)
    expect(log.filter((entry) => !/^(focus|blur)/.test(entry))).toEqual([
      'minimize',
      'restore',
      'maximize',
      'restore',
    ])
    expect(a.focused).toBe(false)
    expect(b.focused).toBe(true)
    b.blur()
    expect(b.focused).toBe(false)
    expect(b.hasClass('focus')).toBe(false)
    a.focus()
    expect(a.focused).toBe(true)
    a.focus(false)
    expect(a.focused).toBe(false)
    a.blur(false)
    expect(a.focused).toBe(true)
  })

  it('lets onclose veto a close unless it is forced', () => {
    const made = box('Guarded', { onclose: () => true })
    expect(made.close()).toBe(true)
    expect(WinBox.manager(root).get(made.id)).toBeDefined()
    expect(made.close(true)).toBeUndefined()
    expect(WinBox.manager(root).get(made.id)).toBeUndefined()
  })

  it('asks onclose when the close button is pressed', () => {
    let allow = false
    const made = box('Button', { onclose: () => !allow })
    const close = made.window.querySelector('.wb-close') as HTMLElement
    close.click()
    expect(WinBox.manager(root).get(made.id)).toBeDefined()
    allow = true
    close.click()
    expect(WinBox.manager(root).get(made.id)).toBeUndefined()
  })

  it('hides and shows with callbacks, and does nothing twice', () => {
    const log: string[] = []
    const made = box('Toggle', { onhide: () => log.push('hide'), onshow: () => log.push('show') })
    made.hide().hide()
    made.show().show()
    made.hide(false)
    made.show(false)
    made.hide(false)
    expect(log).toEqual(['hide', 'show', 'hide', 'show'])
  })
})

describe('methods and properties', () => {
  it('moves, resizes and renames through properties and chained calls', () => {
    const made = box('Props')
    made.x = 40
    made.y = 50
    made.width = 320
    made.height = 240
    expect([made.x, made.y, made.width, made.height]).toEqual([40, 50, 320, 240])
    made.move().resize()
    expect([made.x, made.y, made.width, made.height]).toEqual([40, 50, 320, 240])
    expect(made.setTitle('Renamed')).toBe(made)
    expect(WinBox.manager(root).get(made.id)?.title).toBe('Renamed')
    expect(made.setBackground('red').setUrl('about:blank').setIcon('x.png')).toBe(made)
    expect(made.index).toBeGreaterThanOrEqual(0)
    expect([made.top, made.right, made.bottom, made.left]).toEqual([0, 0, 0, 0])
    expect(made.maxwidth).toBe(Number.POSITIVE_INFINITY)
    expect(made.maxheight).toBe(Number.POSITIVE_INFINITY)
  })

  it('maps control classes added and removed later', () => {
    const made = box('Classes')
    const wm = WinBox.manager(root)
    made.addClass('no-max')
    expect(wm.get(made.id)?.maximizable).toBe(false)
    made.toggleClass('no-max')
    expect(wm.get(made.id)?.maximizable).toBe(true)
    made.toggleClass('dark')
    expect(made.hasClass('dark')).toBe(true)
    made.removeClass('dark')
    expect(made.hasClass('dark')).toBe(false)
  })

  it('adds and removes custom controls', () => {
    const made = box('Controls')
    const clicks: unknown[] = []
    made.addControl({
      index: 0,
      class: 'wb-pin',
      image: 'pin.svg',
      click(event, which) {
        clicks.push([this, which, event.type])
      },
    })
    made.addControl({ class: 'wb-plain' })
    const pin = made.window.querySelector('.wb-pin') as HTMLElement
    expect(pin.parentElement?.firstElementChild?.className).toBe('wb-plain')
    expect(pin.style.backgroundImage).toContain('pin.svg')
    pin.click()
    expect(clicks).toEqual([[made, made, 'click']])
    made.removeControl('wb-pin')
    expect(made.window.querySelector('.wb-pin')).toBeNull()
  })

  it('unmounts to a destination, or out of the page when the node had no home', () => {
    const made = box('Unmount')
    const loose = document.createElement('p')
    made.mount(loose)
    made.unmount()
    expect(loose.parentNode).toBeNull()
    const elsewhere = document.createElement('div')
    made.mount(loose).unmount(elsewhere)
    expect(loose.parentNode).toBe(elsewhere)
    expect(made.unmount()).toBe(made)
  })

  it('goes fullscreen through its body and follows fullscreenchange', () => {
    const log: string[] = []
    const made = box('Full', {
      onfullscreen: () => log.push('full'),
      onrestore: () => log.push('restore'),
    })
    const request = vi.fn(async () => {})
    made.body.requestFullscreen = request
    const exit = vi.fn(async () => {})
    document.exitFullscreen = exit
    made.fullscreen()
    expect(request).toHaveBeenCalled()
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: made.body })
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(made.full).toBe(true)
    expect(made.hasClass('full')).toBe(true)
    made.fullscreen()
    expect(request).toHaveBeenCalledTimes(1)
    made.restore()
    expect(exit).toHaveBeenCalled()
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    document.dispatchEvent(new Event('fullscreenchange'))
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(made.full).toBe(false)
    expect(log).toEqual(['full', 'restore'])
    ;(made.window.querySelector('.wb-full') as HTMLElement).click()
    expect(request).toHaveBeenCalledTimes(2)
    made.fullscreen(false)
    expect(exit).toHaveBeenCalledTimes(1)
  })
})

describe('the desktop around the windows', () => {
  it('keeps windows in focus order for WinBox.stack', () => {
    const a = box('A')
    const b = box('B')
    const c = box('C')
    a.focus()
    expect(WinBox.stack().slice(-3)).toEqual([b, c, a])
  })

  it('shows minimized windows in a strip that restores them', () => {
    const made = box('Strip')
    made.minimize()
    const strip = root.querySelector('.wb-strip') as HTMLElement
    const button = strip.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('Strip')
    button.click()
    expect(made.min).toBe(false)
    expect(strip.children).toHaveLength(0)
  })

  it('dims the page behind a modal', () => {
    const modal = box('Modal', { modal: true })
    const backdrop = root.querySelector('.wb-backdrop') as HTMLElement
    expect(backdrop.hidden).toBe(false)
    modal.close()
    expect(backdrop.hidden).toBe(true)
  })

  it('gives each inset set and overflow its own desktop', () => {
    box('Plain')
    box('Inset', { top: 50, left: '10%' })
    box('Overflow', { overflow: true })
    const layers = root.querySelectorAll<HTMLElement>('[data-winbox-root]')
    expect(layers).toHaveLength(3)
    expect(layers[1]?.style.top).toBe('50px')
    expect(layers[1]?.style.left).toBe('100px')
    expect(layers[0]?.style.position).toBe('absolute')
  })

  it('uses the whole viewport for the page body and can skip the bundled styles', () => {
    document.head.querySelector('style[data-wmkit-winbox]')?.remove()
    WinBox.configure({ styles: false, messages: winboxMessagesRu, snap: false })
    const made = new WinBox('Body')
    opened.push(made)
    expect(made.window.closest('[data-winbox-root]')?.parentElement).toBe(document.body)
    expect((made.window.closest('[data-winbox-root]') as HTMLElement).style.position).toBe('fixed')
    expect(document.head.querySelector('style[data-wmkit-winbox]')).toBeNull()
    expect(made.window.querySelector('.wb-close')?.getAttribute('aria-label')).toBe('Закрыть')
    expect(WinBox.manager().get(made.id)).toBeDefined()
  })
})

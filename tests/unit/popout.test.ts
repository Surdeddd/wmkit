// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWindowManager } from '../../src/core/manager'
import { isPopoutSupported, listScreens, popout } from '../../src/plugins/popout'

const VIEWPORT = { viewport: { width: 1000, height: 800 } }

interface FakeWindow {
  document: Document
  closed: boolean
  close: () => void
  focus: () => void
  moveTo: (x: number, y: number) => void
  addEventListener: (type: string, listener: () => void) => void
  hide: () => void
}

function fakeWindow(): FakeWindow {
  const listeners: Array<() => void> = []
  const win: FakeWindow = {
    document: document.implementation.createHTMLDocument('popout'),
    closed: false,
    close: vi.fn(() => {
      win.closed = true
    }),
    focus: vi.fn(),
    moveTo: vi.fn(),
    addEventListener: (type, listener) => {
      if (type === 'pagehide') listeners.push(listener)
    },
    hide: () => {
      for (const listener of listeners) listener()
    },
  }
  return win
}

function stubPip(target = fakeWindow()) {
  const requestWindow = vi.fn(async () => target as unknown as Window)
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    value: { requestWindow },
  })
  return { target, requestWindow }
}

function stubOpen(target: FakeWindow | null = fakeWindow()) {
  const open = vi.fn(() => target as unknown as Window | null)
  vi.stubGlobal('open', open)
  return { target: target as FakeWindow, open }
}

function setup(title = 'Popped') {
  const wm = createWindowManager(VIEWPORT)
  wm.open({ id: 'p', title, width: 300, height: 200 })
  const holder = document.createElement('div')
  const content = document.createElement('div')
  holder.append(content)
  document.body.append(holder)
  return { wm, holder, content }
}

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'documentPictureInPicture', {
    configurable: true,
    value: undefined,
  })
  Object.defineProperty(window, 'getScreenDetails', { configurable: true, value: undefined })
  document.body.replaceChildren()
  document.head.replaceChildren()
})

describe('support', () => {
  it('is never supported where there is no window', () => {
    vi.stubGlobal('window', undefined)
    try {
      expect(isPopoutSupported()).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reports each target on its own and either one for auto', () => {
    vi.stubGlobal('open', undefined)
    expect(isPopoutSupported()).toBe(false)
    expect(isPopoutSupported('window')).toBe(false)
    stubPip()
    expect(isPopoutSupported('pip')).toBe(true)
    expect(isPopoutSupported()).toBe(true)
    vi.unstubAllGlobals()
    expect(isPopoutSupported('window')).toBe(true)
  })

  it('refuses an unknown window, a missing target and a blocked popup', async () => {
    const { wm, content } = setup()
    await expect(popout(wm, 'ghost', content)).rejects.toThrow(/unknown window/)
    await expect(popout(wm, 'p', content, { target: 'pip' })).rejects.toThrow(/not supported/)
    vi.stubGlobal('open', undefined)
    await expect(popout(wm, 'p', content)).rejects.toThrow(/not supported/)
    stubOpen(null)
    await expect(popout(wm, 'p', content)).rejects.toThrow(/blocked/)
  })
})

describe('picture-in-picture', () => {
  it('moves content in and back, and keeps the window minimized meanwhile', async () => {
    const { target, requestWindow } = stubPip()
    const { wm, holder, content } = setup()
    const handle = await popout(wm, 'p', content)
    expect(handle.target).toBe('pip')
    expect(handle.pipWindow).toBe(handle.window)
    expect(requestWindow).toHaveBeenCalledWith({ width: 300, height: 200 })
    expect(content.ownerDocument).toBe(target.document)
    expect(handle.container.contains(content)).toBe(true)
    expect(target.document.title).toBe('Popped')
    expect(wm.get('p')?.stage).toBe('minimized')

    handle.close()
    handle.close()
    await handle.closed
    expect(target.close).toHaveBeenCalledTimes(1)
    expect(content.parentNode).toBe(holder)
    expect(wm.get('p')?.stage).toBe('normal')
  })

  it('leaves a window the user restored and maximized alone when the popout closes', async () => {
    const { target } = stubPip()
    const { wm, content } = setup()
    await popout(wm, 'p', content)
    wm.maximize('p')
    target.hide()
    expect(wm.get('p')?.stage).toBe('maximized')
  })

  it('does not minimize or restore when told not to', async () => {
    stubPip()
    const { wm, content } = setup()
    const handle = await popout(wm, 'p', content, { minimizeWhilePopped: false })
    expect(wm.get('p')?.stage).toBe('normal')
    handle.close()
    expect(wm.get('p')?.stage).toBe('normal')
  })
})

describe('popup window', () => {
  it('opens a sized popup when no picture-in-picture exists', async () => {
    const { target, open } = stubOpen()
    const { wm, content } = setup()
    const handle = await popout(wm, 'p', content, { width: 640, height: 480 })
    expect(handle.target).toBe('window')
    expect(open).toHaveBeenCalledWith('', '_blank', 'popup,width=640,height=480')
    expect(content.ownerDocument).toBe(target.document)
  })

  it('prefers the popup over picture-in-picture when asked', async () => {
    stubPip()
    const { open } = stubOpen()
    const { wm, content } = setup()
    expect((await popout(wm, 'p', content, { target: 'window' })).target).toBe('window')
    expect(open).toHaveBeenCalled()
  })

  function stubScreens(details: () => Promise<unknown>) {
    Object.defineProperty(window, 'getScreenDetails', { configurable: true, value: details })
  }

  function stubOpens() {
    const opened: FakeWindow[] = []
    const open = vi.fn(() => {
      const target = fakeWindow()
      opened.push(target)
      return target as unknown as Window
    })
    vi.stubGlobal('open', open)
    return { opened, open }
  }

  const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('opens at once and then centres the popup on another screen when the Window Management API allows it', async () => {
    const left = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }
    const right = { availLeft: 1920, availTop: 20, availWidth: 1280, availHeight: 1000 }
    stubScreens(async () => ({ screens: [left, right], currentScreen: left }))
    const { opened, open } = stubOpens()
    const { wm, content } = setup()

    const other = await popout(wm, 'p', content, { screen: 'other' })
    expect(open).toHaveBeenLastCalledWith('', '_blank', 'popup,width=300,height=200')
    await settled()
    expect(opened[0]?.moveTo).toHaveBeenCalledWith(2410, 420)
    other.close()

    const current = await popout(wm, 'p', content, { screen: 'current', top: 7 })
    await settled()
    expect(opened[1]?.moveTo).toHaveBeenCalledWith(810, 7)
    current.close()

    await popout(wm, 'p', content, { screen: right, top: 6 })
    expect(open).toHaveBeenLastCalledWith(
      '',
      '_blank',
      'popup,width=300,height=200,left=2410,top=6',
    )
    await settled()
    expect(opened[2]?.moveTo).not.toHaveBeenCalled()
    expect(await listScreens()).toEqual([left, right])
  })

  it('opens the popup inside the gesture, before the screen details arrive', () => {
    let answer: (details: unknown) => void = () => {}
    const details = vi.fn(() => new Promise((resolve) => (answer = resolve)))
    stubScreens(details)
    const { opened, open } = stubOpens()
    const { wm, content } = setup()

    void popout(wm, 'p', content, { screen: 'other' })
    expect(open).toHaveBeenCalledTimes(1)
    expect(details).toHaveBeenCalledTimes(1)
    expect(opened[0]?.moveTo).not.toHaveBeenCalled()
    answer({
      screens: [],
      currentScreen: { availLeft: 0, availTop: 0, availWidth: 300, availHeight: 200 },
    })
  })

  it('leaves a popup that closed before the screen details arrived alone', async () => {
    let answer: (details: unknown) => void = () => {}
    stubScreens(() => new Promise((resolve) => (answer = resolve)))
    const { opened } = stubOpens()
    const { wm, content } = setup()
    const handle = await popout(wm, 'p', content, { screen: 'other' })
    handle.close()
    const only = { availLeft: 0, availTop: 0, availWidth: 1000, availHeight: 800 }
    answer({ screens: [only], currentScreen: only })
    await settled()
    expect(opened[0]?.moveTo).not.toHaveBeenCalled()
  })

  it('stays on the current screen when there is only one', async () => {
    const only = { availLeft: 0, availTop: 0, availWidth: 1000, availHeight: 800 }
    stubScreens(async () => ({ screens: [only], currentScreen: only }))
    const { opened } = stubOpens()
    const { wm, content } = setup()
    await popout(wm, 'p', content, { screen: 'other' })
    await settled()
    expect(opened[0]?.moveTo).toHaveBeenCalledWith(350, 300)
  })

  it('falls back to the default placement when the API is missing or denied', async () => {
    const { opened, open } = stubOpens()
    const { wm, content } = setup()
    expect(await listScreens()).toBeNull()
    ;(await popout(wm, 'p', content, { screen: 'other' })).close()
    expect(open).toHaveBeenLastCalledWith('', '_blank', 'popup,width=300,height=200')
    stubScreens(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    expect(await listScreens()).toBeNull()
    await popout(wm, 'p', content, { screen: 'other' })
    expect(open).toHaveBeenLastCalledWith('', '_blank', 'popup,width=300,height=200')
    await settled()
    expect(opened[0]?.moveTo).not.toHaveBeenCalled()
    expect(opened[1]?.moveTo).not.toHaveBeenCalled()
  })

  it('closes every popup when the page itself goes away', async () => {
    const { target } = stubOpen()
    const { wm, holder, content } = setup()
    await popout(wm, 'p', content)
    window.dispatchEvent(new Event('pagehide'))
    expect(target.close).toHaveBeenCalled()
    expect(content.parentNode).toBe(holder)
  })
})

describe('staying in step with the window', () => {
  it('follows the title, and closes with the window', async () => {
    const { target } = stubPip()
    const { wm, content } = setup()
    const handle = await popout(wm, 'p', content)
    wm.update('p', { title: 'Renamed' })
    expect(target.document.title).toBe('Renamed')
    wm.close('p')
    await handle.closed
    expect(target.close).toHaveBeenCalled()
  })

  it('leaves the content where it is in container mode', async () => {
    const { target } = stubPip()
    const { wm, holder, content } = setup()
    const handle = await popout(wm, 'p', content, { mode: 'container' })
    expect(content.parentNode).toBe(holder)
    expect(handle.container.ownerDocument).toBe(target.document)
    expect(handle.container.dataset.wmPopout).toBe('p')
    handle.close()
    expect(content.parentNode).toBe(holder)
  })

  it('returns content into the window when its old place was rebuilt away', async () => {
    const { target } = stubPip()
    const { wm, holder, content } = setup()
    await popout(wm, 'p', content)
    holder.remove()
    const rebuilt = document.createElement('section')
    rebuilt.dataset.wmWindow = 'p'
    const slot = document.createElement('div')
    slot.dataset.wmContent = ''
    rebuilt.append(slot)
    document.body.append(rebuilt)
    target.hide()
    expect(content.parentNode).toBe(slot)
  })

  it('drops content it has nowhere to put back', async () => {
    const { target } = stubPip()
    const { wm, holder, content } = setup()
    await popout(wm, 'p', content)
    holder.remove()
    target.hide()
    expect(content.ownerDocument).toBe(target.document)
  })
})

describe('styles', () => {
  function sheet(cssText: string | null, owner: Node | null, extra: object = {}) {
    return {
      get cssRules() {
        if (cssText === null) throw new Error('cross-origin sheet')
        return [{ cssText }] as unknown as CSSRuleList
      },
      ownerNode: owner,
      disabled: false,
      media: { mediaText: '' },
      ...extra,
    } as unknown as CSSStyleSheet
  }

  it('carries sheets across with their media, skips disabled ones and links cross-origin ones', async () => {
    const source = document.implementation.createHTMLDocument('source')
    const link = source.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdn.example.com/theme.css'
    Object.defineProperty(source, 'styleSheets', {
      configurable: true,
      value: [
        sheet('.a{color:red}', null),
        sheet('.print{color:black}', null, { media: { mediaText: 'print' } }),
        sheet('.off{color:pink}', null, { disabled: true }),
        sheet(null, link),
        sheet(null, source.createElement('style')),
      ],
    })
    Object.defineProperty(source, 'adoptedStyleSheets', {
      configurable: true,
      value: [sheet('.b{color:blue}', null, { media: undefined })],
    })
    const { target } = stubPip()
    const wm = createWindowManager(VIEWPORT)
    wm.open({ id: 'p', title: 'Popped', width: 300, height: 200 })
    const content = source.createElement('div')
    source.body.append(content)

    await popout(wm, 'p', content, { minimizeWhilePopped: false })

    const styles = [...target.document.head.querySelectorAll('style')]
    expect(styles.map((node) => [node.textContent, node.media])).toEqual([
      ['.a{color:red}', ''],
      ['.print{color:black}', 'print'],
      ['.b{color:blue}', ''],
    ])
    expect(target.document.head.querySelector('link')?.href).toBe(
      'https://cdn.example.com/theme.css',
    )
  })

  it('copies nothing when the caller opts out', async () => {
    const { target } = stubPip()
    const style = document.createElement('style')
    style.textContent = '.leak{color:red}'
    document.head.append(style)
    const { wm, content } = setup()
    await popout(wm, 'p', content, { copyStyles: false })
    expect(target.document.head.querySelectorAll('style, link')).toHaveLength(0)
  })
})

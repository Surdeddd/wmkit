import { mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { constants, Script } from 'node:vm'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { builtinEnvironments } from 'vitest/environments'

const fixture = fileURLToPath(new URL('../fixtures/qwik-ssr/', import.meta.url))
const clientBuild = pathToFileURL(`${fixture}dist/client/build/`).href

type Render = (options: object) => Promise<{ html: string }>
let render: Render

async function installDom(): Promise<() => Promise<void>> {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {})
  return async () => {
    await env.teardown(globalThis)
  }
}

beforeAll(async () => {
  const configFile = `${fixture}vite.config.ts`
  mkdirSync(`${fixture}dist`, { recursive: true })
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('TMPDIR', `${fixture}dist`)
  try {
    await build({ configFile, logLevel: 'silent' })
    await build({ configFile, logLevel: 'silent', build: { ssr: true } })
  } finally {
    vi.unstubAllEnvs()
  }
  const server = await import(pathToFileURL(`${fixture}dist/server/entry.ssr.js`).href)
  render = server.default
}, 120_000)

describe('qwik adapter on the server', () => {
  it('renders the desktop and its window into HTML without a DOM', async () => {
    expect(typeof document, 'the server render ran with a DOM around').toBe('undefined')
    const { html } = await render({ base: '/build/' })
    const removeDom = await installDom()
    try {
      const page = new DOMParser().parseFromString(html, 'text/html')
      const container = page.querySelector('[q\\:container]') as HTMLElement
      expect(container.getAttribute('q:container')).toBe('paused')
      const desktop = page.querySelector('.desktop') as HTMLElement
      expect(desktop.hasAttribute('data-wm-desktop'), 'a controller ran on the server').toBe(false)
      expect(desktop.hasAttribute('on:qvisible')).toBe(true)

      const section = desktop.querySelector('section') as HTMLElement
      expect(section.style.position).toBe('absolute')
      expect(section.style.transform).toBe('translate3d(20px, 60px, 0)')
      expect(section.style.width).toBe('280px')
      expect(section.style.height).toBe('180px')
      expect(section.hidden).toBe(false)
      expect(section.className).toBe('plain')
      expect(section.hasAttribute('data-wm-window')).toBe(false)
      expect(section.querySelector('[data-wm-title]')?.textContent).toBe('Notes')
      expect(section.querySelector('[data-wm-controls] #notes-close')).not.toBeNull()
      expect(section.querySelector('[data-wm-content] #notes-body')?.textContent).toBe(
        'server content',
      )
      expect(page.querySelector('#count')?.textContent).toBe('0')
      expect(page.querySelector('script[type="qwik/json"]')).not.toBeNull()
    } finally {
      await removeDom()
    }
  })
})

describe('qwik adapter resumed on the client', () => {
  let removeDom: () => Promise<void>
  let serverBody: Element

  const section = () => document.querySelector('section') as HTMLElement
  const click = (id: string) =>
    document.getElementById(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

  beforeAll(async () => {
    const { html } = await render({ qwikLoader: 'inline', base: clientBuild })
    removeDom = await installDom()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly report: (entries: object[]) => void) {}
        observe(target: Element) {
          queueMicrotask(() => this.report([{ isIntersecting: true, target }]))
        }
        unobserve() {}
        disconnect() {}
      },
    )
    let readyState = 'loading'
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => readyState })
    document.body.innerHTML = html
    serverBody = document.querySelector('#notes-body') as Element
    for (const script of document.querySelectorAll('script')) {
      const type = script.getAttribute('type')
      if (type === 'qwik/json' || (type === 'module' && script.id !== 'qwikloader')) continue
      new Script(script.textContent ?? '', {
        importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
      }).runInThisContext()
    }
    readyState = 'complete'
    document.dispatchEvent(new Event('readystatechange'))
    await vi.waitFor(() => expect(section().dataset.wmWindow).toBe('notes'), { timeout: 5000 })
  }, 30_000)

  afterAll(async () => {
    vi.unstubAllGlobals()
    await removeDom()
  })

  it('binds the server-rendered desktop and window without rendering them again', () => {
    expect(document.querySelector('.desktop')?.hasAttribute('data-wm-desktop')).toBe(true)
    expect(document.querySelector('#notes-body'), 'the client replaced the server markup').toBe(
      serverBody,
    )
    expect(section().style.transform).toBe('translate3d(20px, 60px, 0)')
    expect(section().dataset.wmVariant, 'options$ did not reach the desktop').toBe('resumed')
    expect(document.querySelector('#count')?.textContent).toBe('1')
  })

  it('keeps a minimized window hidden while its props change', async () => {
    click('minimize')
    await vi.waitFor(() => expect(section().hidden).toBe(true))
    click('grow')
    await vi.waitFor(() => expect(document.querySelector('#width')?.textContent).toBe('320'))
    expect(section().hidden, 'a geometry prop change showed a minimized window').toBe(true)
    click('rename')
    await vi.waitFor(() => expect(section().getAttribute('aria-label')).toBe('Notes 1'))
    expect(section().hidden, 'a prop change showed a minimized window').toBe(true)

    click('restore')
    await vi.waitFor(() => expect(section().hidden).toBe(false))
  })

  it('moves the window when its geometry props change, keeping what the controller wrote', async () => {
    click('drag')
    await vi.waitFor(() => expect(section().style.transform).toBe('translate3d(200px, 150px, 0)'))
    const zIndex = section().style.zIndex
    expect(zIndex).not.toBe('')

    click('rename')
    await vi.waitFor(() => expect(section().getAttribute('aria-label')).toBe('Notes 2'))
    expect(section().querySelector('[data-wm-title]')?.textContent).toBe('Notes 2')
    expect(section().className).toBe('loud')
    expect(section().style.transform, 'a re-render put the window back').toBe(
      'translate3d(200px, 150px, 0)',
    )

    click('shift')
    await vi.waitFor(() =>
      expect(section().style.transform, 'the x prop did not move the window').toBe(
        'translate3d(120px, 150px, 0)',
      ),
    )
    expect(section().style.zIndex, 'the controller lost its stacking').toBe(zIndex)

    click('grow')
    await vi.waitFor(() => expect(section().style.width).toBe('360px'))
    expect(section().style.height).toBe('180px')
    expect(section().style.transform).toBe('translate3d(120px, 150px, 0)')
    expect(section().style.zIndex).toBe(zIndex)
  })

  it('hides a closed window and binds it again when its id reopens', async () => {
    click('notes-close')
    await vi.waitFor(() => expect(section().hidden).toBe(true))
    expect(section().dataset.wmWindow).toBeUndefined()
    await vi.waitFor(() => expect(document.querySelector('#count')?.textContent).toBe('0'))

    click('reopen')
    await vi.waitFor(() => expect(section().dataset.wmWindow).toBe('notes'))
    expect(section().hidden).toBe(false)
    expect(section().style.transform).toBe('translate3d(20px, 60px, 0)')
    await vi.waitFor(() => expect(document.querySelector('#count')?.textContent).toBe('1'))
  })
})

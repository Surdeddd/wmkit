import type { SnapZone, WindowInit, WindowManager } from '@surdeddd/wmkit'
import type { AppId, Dict } from './i18n'
import { highlight, snippets } from './snippets'

export type ThemeName = 'glass' | 'light' | 'retro'

export interface AppContext {
  wm: WindowManager
  dict(): Dict
  open(id: AppId): void
  reset(): void
  theme(): ThemeName
  setTheme(theme: ThemeName): void
  option(name: 'magnetism' | 'snap' | 'announce'): boolean
  setOption(name: 'magnetism' | 'snap' | 'announce', value: boolean): void
  size(): { width: number; height: number }
}

export interface AppInstance {
  destroy?(): void
  relabel?(): void
}

export interface AppSpec {
  id: AppId
  init(ctx: AppContext): WindowInit
  render(body: HTMLElement, ctx: AppContext): AppInstance | undefined
}

const ZONES: SnapZone[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
  'left-third',
  'center-third',
  'right-third',
]

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button(label: string, onClick: () => void, className?: string): HTMLButtonElement {
  const node = el('button', className, label)
  node.type = 'button'
  node.addEventListener('click', onClick)
  return node
}

interface Slot {
  width: number
  height: number
  x: number
  y: number
}

function place(ctx: AppContext, width: number, height: number, right: number, top: number): Slot {
  const box = ctx.size()
  const w = Math.min(width, Math.max(220, box.width - 24))
  const h = Math.min(height, Math.max(160, box.height - 24))
  const wanted = box.width < 720 ? Math.round(box.height * 0.42) : top
  return {
    width: w,
    height: h,
    x: Math.max(12, Math.min(box.width - w - 12, box.width - right)),
    y: Math.max(12, Math.min(Math.max(12, box.height - h - 12), wanted)),
  }
}

function centred(ctx: AppContext, width: number, height: number): Slot {
  const box = ctx.size()
  const w = Math.min(width, Math.max(220, box.width - 24))
  const h = Math.min(height, Math.max(160, box.height - 24))
  return {
    width: w,
    height: h,
    x: Math.max(12, Math.round((box.width - w) / 2)),
    y: Math.max(12, Math.round((box.height - h) / 2)),
  }
}

const readme: AppSpec = {
  id: 'readme',
  init(ctx) {
    return { title: 'readme.md', ...place(ctx, 384, 314, 800, 30), minWidth: 260 }
  },
  render(body, ctx) {
    const draw = () => {
      const copy = ctx.dict().readme
      body.replaceChildren()
      const lead = el('p')
      lead.append(el('strong', undefined, copy.lead))
      const text = el('p', 'app-note', copy.body)
      const badges = el('ul', 'badges')
      for (const [value, label] of copy.badges) {
        const item = el('li')
        item.append(el('b', undefined, value), document.createTextNode(` ${label}`))
        badges.append(item)
      }
      const actions = el('div', 'app-actions')
      actions.append(
        button('npm i @surdeddd/wmkit', () => {
          void navigator.clipboard?.writeText('pnpm add @surdeddd/wmkit')
        }),
        button('github ↗', () => {
          window.open('https://github.com/Surdeddd/wmkit', '_blank', 'noreferrer')
        }),
      )
      body.append(lead, text, badges, actions)
    }
    draw()
    return { relabel: draw }
  },
}

const terminal: AppSpec = {
  id: 'terminal',
  init(ctx) {
    return {
      title: 'terminal',
      ...place(ctx, 748, 322, 800, 364),
      minWidth: 260,
      minHeight: 150,
    }
  },
  render(body, ctx) {
    const wrap = el('div', 'term')
    const log = el('div', 'term-log')
    const form = el('form', 'term-form')
    const input = el('input')
    input.type = 'text'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', 'terminal input')
    form.append(input)
    wrap.append(log, form)
    body.replaceChildren(wrap)

    const history: string[] = []
    let cursor = 0

    const write = (text: string, kind: 'cmd' | 'out' | 'err' = 'out') => {
      log.append(el('div', kind, text))
      log.scrollTop = log.scrollHeight
    }

    const hello = () => {
      log.replaceChildren()
      write(ctx.dict().terminal.hello)
      write('help', 'cmd')
      write(ctx.dict().terminal.help)
    }
    hello()

    const run = (line: string) => {
      const copy = ctx.dict().terminal
      const [command = '', ...rest] = line.trim().split(/\s+/)
      const arg = rest.join(' ')
      const focused = ctx.wm.getState().focusedId
      switch (command) {
        case '':
          return
        case 'help':
          write(copy.help)
          return
        case 'clear':
          log.replaceChildren()
          return
        case 'open': {
          const win = ctx.wm.open({ title: arg || 'window', width: 300, height: 200 })
          write(`${win.id} · ${win.title}`)
          return
        }
        case 'close':
          write(ctx.wm.close(arg) ? `closed ${arg}` : `${copy.gone} ${arg}`, 'out')
          return
        case 'focus':
          write(ctx.wm.focus(arg) ? `focused ${arg}` : `${copy.gone} ${arg}`, 'out')
          return
        case 'snap': {
          if (!focused) return write('no focused window', 'err')
          if (!ZONES.includes(arg as SnapZone)) return write(`${copy.unknown} ${arg}`, 'err')
          ctx.wm.snap(focused, arg as SnapZone)
          write(`${focused} → ${arg}`)
          return
        }
        case 'tile':
        case 'cascade':
          ctx.wm.arrange(command)
          write(`arranged ${command}`)
          return
        case 'undo':
          write(ctx.wm.undo() ? 'undo' : 'nothing to undo')
          return
        case 'redo':
          write(ctx.wm.redo() ? 'redo' : 'nothing to redo')
          return
        case 'workspace': {
          const index = Number.parseInt(arg, 10)
          if (!Number.isInteger(index)) return write(`${copy.unknown} ${arg}`, 'err')
          ctx.wm.setWorkspace(index - 1)
          write(`workspace ${index}`)
          return
        }
        case 'theme': {
          if (arg !== 'glass' && arg !== 'light' && arg !== 'retro') {
            return write(`${copy.unknown} ${arg}`, 'err')
          }
          ctx.setTheme(arg)
          write(`theme ${arg}`)
          return
        }
        case 'state': {
          const state = ctx.wm.getState()
          write(
            `windows ${state.order.length} · focused ${state.focusedId ?? '—'} · workspace ${
              state.workspace + 1
            }`,
          )
          return
        }
        default:
          write(`${copy.unknown} ${command}`, 'err')
      }
    }

    const onSubmit = (event: Event) => {
      event.preventDefault()
      const line = input.value
      if (line.trim()) {
        write(line, 'cmd')
        history.push(line)
        cursor = history.length
        run(line)
      }
      input.value = ''
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      event.preventDefault()
      cursor = Math.min(history.length, Math.max(0, cursor + (event.key === 'ArrowUp' ? -1 : 1)))
      input.value = history[cursor] ?? ''
    }

    form.addEventListener('submit', onSubmit)
    input.addEventListener('keydown', onKey)

    return {
      relabel: hello,
      destroy() {
        form.removeEventListener('submit', onSubmit)
        input.removeEventListener('keydown', onKey)
      },
    }
  },
}

const inspector: AppSpec = {
  id: 'inspector',
  init(ctx) {
    return { title: 'inspector', ...place(ctx, 340, 314, 392, 30), minWidth: 240 }
  },
  render(body, ctx) {
    const tree = el('pre', 'state-tree')
    const heading = el('p', 'app-note')
    const list = el('ul', 'evlog')
    body.replaceChildren(tree, heading, list)

    const paint = () => {
      const state = ctx.wm.getState()
      const rows = state.order.slice(0, 8).map((id) => {
        const win = state.windows[id]
        if (!win) return ''
        const mark = id === state.focusedId ? '▸' : ' '
        const bounds = `${Math.round(win.bounds.x)},${Math.round(win.bounds.y)} ${Math.round(
          win.bounds.width,
        )}×${Math.round(win.bounds.height)}`
        return `${mark} <span class="k">${id}</span>  <span class="s">${win.stage}</span>  <span class="n">${bounds}</span>`
      })
      const hidden = state.order.length - Math.min(8, state.order.length)
      tree.innerHTML = [
        `<span class="s">workspace</span> <span class="n">${state.workspace + 1}</span>  <span class="s">windows</span> <span class="n">${state.order.length}</span>`,
        ...rows,
        hidden > 0 ? `  <span class="s">+${hidden} more</span>` : '',
      ]
        .filter(Boolean)
        .join('\n')
    }

    const relabel = () => {
      heading.textContent = ctx.dict().inspector.events
      if (list.childElementCount === 0) {
        const empty = el('li')
        empty.append(el('b', undefined, '—'), el('span', undefined, ctx.dict().inspector.empty))
        list.replaceChildren(empty)
      }
    }

    let empty = true
    const push = (name: string, detail: string) => {
      if (empty) {
        list.replaceChildren()
        empty = false
      }
      const item = el('li')
      item.append(el('b', undefined, name), el('span', undefined, detail))
      list.prepend(item)
      while (list.childElementCount > 40) list.lastElementChild?.remove()
    }

    const stops = [
      ctx.wm.subscribe(paint),
      ctx.wm.on('open', ({ window: win }) => push('open', win.id)),
      ctx.wm.on('close', ({ window: win }) => push('close', win.id)),
      ctx.wm.on('focus', ({ window: win }) => push('focus', win.id)),
      ctx.wm.on('stage', ({ window: win }) => push('stage', `${win.id} → ${win.stage}`)),
      ctx.wm.on('move', ({ window: win }) =>
        push('move', `${win.id} ${Math.round(win.bounds.x)},${Math.round(win.bounds.y)}`),
      ),
      ctx.wm.on('resize', ({ window: win }) =>
        push(
          'resize',
          `${win.id} ${Math.round(win.bounds.width)}×${Math.round(win.bounds.height)}`,
        ),
      ),
      ctx.wm.on('workspace', ({ workspace }) => push('workspace', String(workspace + 1))),
    ]

    paint()
    relabel()

    return {
      relabel,
      destroy() {
        for (const stop of stops) stop()
      },
    }
  },
}

const layouts: AppSpec = {
  id: 'layouts',
  init(ctx) {
    return { title: 'layouts', ...place(ctx, 318, 344, 1160, 96), minWidth: 260 }
  },
  render(body, ctx) {
    const zonesLabel = el('p', 'app-note')
    const pad = el('div', 'zone-pad')
    const arrangeLabel = el('p', 'app-note')
    const arrangeRow = el('div', 'app-actions')
    const historyLabel = el('p', 'app-note')
    const historyRow = el('div', 'app-actions')
    const savedLabel = el('p', 'app-note')
    const savedRow = el('div', 'layout-list')

    const active = () => ctx.wm.getState().focusedId

    for (const zone of ZONES) {
      const span = zone.endsWith('-third') ? 2 : zone === 'top' || zone === 'bottom' ? 2 : 2
      const node = button(zone.replace('-third', '⅓').replace('-', ' '), () => {
        const id = active()
        if (id) ctx.wm.snap(id, zone)
      })
      node.style.gridColumn = `span ${span}`
      pad.append(node)
    }

    const undoBtn = button('undo', () => ctx.wm.undo())
    const redoBtn = button('redo', () => ctx.wm.redo())
    historyRow.append(undoBtn, redoBtn)

    arrangeRow.append(
      button('tile', () => ctx.wm.arrange('tile')),
      button('cascade', () => ctx.wm.arrange('cascade')),
      button('center', () => {
        const id = active()
        if (id) ctx.wm.center(id)
      }),
    )

    const renderSaved = () => {
      const names = ctx.wm.layoutNames()
      savedRow.replaceChildren()
      if (names.length === 0) {
        savedRow.append(el('span', 'app-note', ctx.dict().layouts.none))
      }
      for (const name of names) {
        const chip = el('div', 'chip')
        const load = button(name, () => ctx.wm.loadLayout(name))
        load.style.background = 'none'
        load.style.border = '0'
        load.style.padding = '0'
        const remove = button('✕', () => {
          ctx.wm.deleteLayout(name)
          renderSaved()
        })
        chip.append(load, remove)
        savedRow.append(chip)
      }
    }

    const saveBtn = button('+', () => {
      ctx.wm.saveLayout(`layout ${ctx.wm.layoutNames().length + 1}`)
      renderSaved()
    })

    const savedHead = el('div', 'app-actions')
    savedHead.append(saveBtn)

    const relabel = () => {
      const copy = ctx.dict().layouts
      zonesLabel.textContent = copy.zones
      arrangeLabel.textContent = copy.arrange
      historyLabel.textContent = copy.history
      savedLabel.textContent = copy.saved
      saveBtn.textContent = copy.save
      renderSaved()
    }

    const sync = () => {
      undoBtn.disabled = !ctx.wm.canUndo()
      redoBtn.disabled = !ctx.wm.canRedo()
      undoBtn.style.opacity = undoBtn.disabled ? '0.4' : '1'
      redoBtn.style.opacity = redoBtn.disabled ? '0.4' : '1'
    }

    const stop = ctx.wm.subscribe(sync)
    body.replaceChildren(
      zonesLabel,
      pad,
      arrangeLabel,
      arrangeRow,
      historyLabel,
      historyRow,
      savedLabel,
      savedHead,
      savedRow,
    )
    relabel()
    sync()

    return { relabel, destroy: stop }
  },
}

const code: AppSpec = {
  id: 'code',
  init(ctx) {
    return { title: 'code.ts', ...place(ctx, 566, 396, 1000, 64), minWidth: 280 }
  },
  render(body) {
    const tabs = el('div', 'tabs')
    tabs.setAttribute('role', 'tablist')
    const pre = el('pre', 'code')
    body.replaceChildren(tabs, pre)

    const select = (id: string) => {
      const snippet = snippets.find((entry) => entry.id === id) ?? snippets[0]
      if (!snippet) return
      pre.innerHTML = highlight(snippet.code)
      for (const node of tabs.querySelectorAll('button')) {
        node.setAttribute('aria-selected', String(node.dataset.tab === snippet.id))
      }
    }

    for (const snippet of snippets) {
      const tab = button(snippet.label, () => select(snippet.id))
      tab.dataset.tab = snippet.id
      tab.setAttribute('role', 'tab')
      tabs.append(tab)
    }
    select('vanilla')
    return undefined
  },
}

const bench: AppSpec = {
  id: 'bench',
  init(ctx) {
    return { title: 'bench', ...place(ctx, 316, 262, 1180, 430) }
  },
  render(body, ctx) {
    const lead = el('p', 'app-note')
    const stats = el('dl', 'kv')
    const bar = el('div', 'bar')
    const fill = el('i')
    bar.append(fill)
    const note = el('p', 'app-note')
    const actions = el('div', 'app-actions')
    const run = button('', () => {
      const start = performance.now()
      ctx.wm.batch(() => {
        for (let i = 0; i < 50; i += 1) {
          ctx.wm.open({
            title: `bench ${i + 1}`,
            width: 180,
            height: 120,
            x: 20 + (i % 10) * 26,
            y: 20 + Math.floor(i / 10) * 26,
          })
        }
      })
      const commit = performance.now() - start
      requestAnimationFrame(() => {
        const painted = performance.now() - start
        render(commit, painted)
      })
    })
    actions.append(run)

    let lastCommit = 0
    let lastPainted = 0

    const render = (commit = lastCommit, painted = lastPainted) => {
      lastCommit = commit
      lastPainted = painted
      const copy = ctx.dict().bench
      stats.replaceChildren()
      const rows: Array<[string, string]> = [
        [copy.opened, commit ? `${commit.toFixed(1)} ms` : '—'],
        [copy.frame, painted ? `${painted.toFixed(1)} ms` : '—'],
        ['windows', String(ctx.wm.getState().order.length)],
      ]
      for (const [key, value] of rows) {
        stats.append(el('dt', undefined, key), el('dd', undefined, value))
      }
      fill.style.width = `${Math.min(100, (commit / 60) * 100)}%`
    }

    const relabel = () => {
      const copy = ctx.dict().bench
      lead.textContent = copy.lead
      note.textContent = copy.note
      run.textContent = copy.run
      render()
    }

    body.replaceChildren(lead, actions, stats, bar, note)
    relabel()
    const stop = ctx.wm.subscribe(() => render())
    return { relabel, destroy: stop }
  },
}

const paint: AppSpec = {
  id: 'paint',
  init(ctx) {
    return { title: 'paint', ...place(ctx, 372, 279, 560, 300), aspectRatio: 4 / 3, minWidth: 220 }
  },
  render(body, ctx) {
    const wrap = el('div', 'paint-wrap')
    const lead = el('p', 'app-note')
    const canvas = el('canvas')
    const tools = el('div', 'swatches')
    wrap.append(lead, canvas, tools)
    body.replaceChildren(wrap)

    const palette = ['#d3ff4e', '#63c9ff', '#ff8a3d', '#ff6a4d', '#e7eaf0']
    let color = palette[0] as string
    const swatches = palette.map((value) =>
      button('', () => {
        color = value
        for (const node of tools.querySelectorAll<HTMLButtonElement>('button[data-swatch]')) {
          node.setAttribute('aria-pressed', String(node.dataset.swatch === value))
        }
      }),
    )
    swatches.forEach((node, index) => {
      const value = palette[index] as string
      node.dataset.swatch = value
      node.style.background = value
      node.setAttribute('aria-pressed', String(index === 0))
      node.setAttribute('aria-label', `colour ${index + 1}`)
      tools.append(node)
    })
    const clear = button(
      '',
      () => {
        const ctx2d = canvas.getContext('2d')
        ctx2d?.clearRect(0, 0, canvas.width, canvas.height)
      },
      'app-btn',
    )
    tools.append(clear)

    let drawing = false
    let last: { x: number; y: number } | null = null

    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvas.width,
        y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      }
    }

    const onDown = (event: PointerEvent) => {
      drawing = true
      last = point(event)
      canvas.setPointerCapture(event.pointerId)
    }
    const onMove = (event: PointerEvent) => {
      if (!drawing || !last) return
      const next = point(event)
      const ctx2d = canvas.getContext('2d')
      if (ctx2d) {
        ctx2d.strokeStyle = color
        ctx2d.lineWidth = 2.5
        ctx2d.lineCap = 'round'
        ctx2d.beginPath()
        ctx2d.moveTo(last.x, last.y)
        ctx2d.lineTo(next.x, next.y)
        ctx2d.stroke()
      }
      last = next
    }
    const onUp = () => {
      drawing = false
      last = null
    }

    canvas.width = 480
    canvas.height = 300
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    const relabel = () => {
      lead.textContent = ctx.dict().paint.lead
      clear.textContent = ctx.dict().paint.clear
    }
    relabel()

    return {
      relabel,
      destroy() {
        canvas.removeEventListener('pointerdown', onDown)
        canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerup', onUp)
        canvas.removeEventListener('pointercancel', onUp)
      },
    }
  },
}

const settings: AppSpec = {
  id: 'settings',
  init(ctx) {
    return { title: 'settings', ...place(ctx, 328, 246, 700, 128) }
  },
  render(body, ctx) {
    const rows: Array<{ node: HTMLElement; label: HTMLElement; sync(): void }> = []

    const themeRow = el('div', 'setting')
    const themeLabel = el('span')
    const themeSeg = el('div', 'seg')
    const themeButtons = (['glass', 'light', 'retro'] as ThemeName[]).map((name) =>
      button(name, () => ctx.setTheme(name)),
    )
    themeSeg.append(...themeButtons)
    themeRow.append(themeLabel, themeSeg)
    rows.push({
      node: themeRow,
      label: themeLabel,
      sync() {
        themeButtons.forEach((node, index) => {
          const name = (['glass', 'light', 'retro'] as ThemeName[])[index]
          node.setAttribute('aria-pressed', String(ctx.theme() === name))
        })
      },
    })

    const toggles: Array<'magnetism' | 'snap' | 'announce'> = ['magnetism', 'snap', 'announce']
    const toggleRows = toggles.map((name) => {
      const row = el('div', 'setting')
      const label = el('span')
      const seg = el('div', 'seg')
      const on = button('', () => ctx.setOption(name, true))
      const off = button('', () => ctx.setOption(name, false))
      seg.append(on, off)
      row.append(label, seg)
      return {
        name,
        node: row,
        label,
        sync() {
          const copy = ctx.dict().settings
          on.textContent = copy.on
          off.textContent = copy.off
          on.setAttribute('aria-pressed', String(ctx.option(name)))
          off.setAttribute('aria-pressed', String(!ctx.option(name)))
        },
      }
    })

    const resetRow = el('div', 'app-actions')
    const resetBtn = button('', () => ctx.reset())
    resetRow.append(resetBtn)

    body.replaceChildren(themeRow, ...toggleRows.map((row) => row.node), resetRow)

    const relabel = () => {
      const copy = ctx.dict().settings
      themeLabel.textContent = copy.theme
      for (const row of toggleRows) {
        row.label.textContent = copy[row.name]
        row.sync()
      }
      resetBtn.textContent = ctx.dict().menus[1]?.items[3]?.label ?? 'reset'
      for (const row of rows) row.sync()
    }
    relabel()

    return { relabel }
  },
}

const shortcuts: AppSpec = {
  id: 'shortcuts',
  init(ctx) {
    return { title: 'shortcuts', ...centred(ctx, 386, 348), layer: 'floating' }
  },
  render(body, ctx) {
    const grid = el('div', 'keys')
    body.replaceChildren(grid)
    const relabel = () => {
      grid.replaceChildren()
      for (const [keys, action] of ctx.dict().shortcuts) {
        grid.append(el('kbd', undefined, keys), el('span', undefined, action))
      }
    }
    relabel()
    return { relabel }
  },
}

export const apps: AppSpec[] = [
  readme,
  terminal,
  inspector,
  layouts,
  code,
  bench,
  paint,
  settings,
  shortcuts,
]

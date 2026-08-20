import { attachDesktop, createWindowManager, type WindowManager } from '@surdeddd/wmkit'
import { skin } from '@surdeddd/wmkit/chrome'
import type { Dict } from './i18n'

export interface BuilderDeps {
  dict(): Dict
  themeTemplate(): string
  currentTheme(): string
  toDesktop(template: string, shadow: boolean, styles: string): void
}

export interface BuilderController {
  relabel(): void
  syncTheme(name: string): void
}

const SCOPE = '[data-wm-desktop] [data-wm-window][data-wm-skin="custom"]'

const MAC_TEMPLATE = `<section>
  <header data-wm-drag>
    <span class="lights">
      <button type="button" data-wm-close aria-label="Close {{title}}"></button>
      <button type="button" data-wm-minimize aria-label="Minimize {{title}}"></button>
      <button type="button" data-wm-maximize aria-label="Maximize {{title}}"></button>
    </span>
    <span data-wm-title>{{title}}</span>
    <span class="lights-spacer"></span>
  </header>
  <div data-wm-content></div>
</section>`

const MAC_CSS = `${SCOPE} {
  background: #f5f5f7;
  color: #1d1d1f;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
${SCOPE} [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: linear-gradient(#ececee, #dededf);
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px 12px 0 0;
}
${SCOPE} .lights {
  display: flex;
  gap: 8px;
}
${SCOPE} .lights button {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 0;
  cursor: pointer;
}
${SCOPE} [data-wm-close] { background: #ff5f57; }
${SCOPE} [data-wm-minimize] { background: #febc2e; }
${SCOPE} [data-wm-maximize] { background: #28c840; }
${SCOPE} [data-wm-title] {
  flex: 1;
  text-align: center;
  font: 600 13px/1.2 system-ui, sans-serif;
  color: #3a3a3c;
  text-transform: none;
  letter-spacing: 0;
}
${SCOPE} .lights-spacer { width: 52px; }
${SCOPE} [data-wm-content] {
  background: #fff;
  border-radius: 0 0 12px 12px;
  padding: 14px 16px;
  font: 13px/1.5 system-ui, sans-serif;
}`

const WIN95_TEMPLATE = `<section>
  <header data-wm-drag>
    <span data-wm-title>{{title}}</span>
    <span class="w95">
      <button type="button" data-wm-minimize aria-label="Minimize {{title}}">_</button>
      <button type="button" data-wm-maximize aria-label="Maximize {{title}}">□</button>
      <button type="button" data-wm-close aria-label="Close {{title}}">×</button>
    </span>
  </header>
  <div data-wm-content></div>
</section>`

const WIN95_CSS = `${SCOPE} {
  background: #c0c0c0;
  color: #000;
  border: 2px solid;
  border-color: #fff #404040 #404040 #fff;
  border-radius: 0;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.55);
  font-family: Tahoma, "MS Sans Serif", sans-serif;
}
${SCOPE} [data-wm-drag] {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px 3px 8px;
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #fff;
}
${SCOPE} [data-wm-title] {
  flex: 1;
  font: 700 12px/1.4 Tahoma, sans-serif;
  text-transform: none;
  letter-spacing: 0.02em;
}
${SCOPE} .w95 { display: flex; gap: 2px; }
${SCOPE} .w95 button {
  width: 18px;
  height: 16px;
  padding: 0;
  font: 700 11px/1 Tahoma, sans-serif;
  background: #c0c0c0;
  color: #000;
  border: 2px solid;
  border-color: #fff #404040 #404040 #fff;
  cursor: pointer;
}
${SCOPE} [data-wm-content] {
  padding: 12px;
  font: 12px/1.5 Tahoma, sans-serif;
}`

const TERMINAL_TEMPLATE = `<section>
  <header data-wm-drag>
    <span data-wm-title>{{title}}</span>
    <button type="button" class="tx" data-wm-close aria-label="Close {{title}}">[x]</button>
  </header>
  <div data-wm-content></div>
</section>`

const TERMINAL_CSS = `${SCOPE} {
  background: #050b07;
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.6);
  border-radius: 8px;
  box-shadow: 0 0 28px rgba(34, 197, 94, 0.25);
  font-family: ui-monospace, Menlo, monospace;
}
${SCOPE} [data-wm-drag] {
  display: flex;
  align-items: center;
  padding: 7px 12px;
  background: rgba(34, 197, 94, 0.1);
  border-bottom: 1px solid rgba(74, 222, 128, 0.35);
  text-transform: lowercase;
  letter-spacing: 0.1em;
}
${SCOPE} [data-wm-title] {
  flex: 1;
  font: 600 12px/1.4 ui-monospace, Menlo, monospace;
}
${SCOPE} .tx {
  background: transparent;
  color: #4ade80;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
${SCOPE} .tx:hover { color: #a7f3d0; }
${SCOPE} [data-wm-content] {
  padding: 12px 14px;
  font: 12px/1.6 ui-monospace, Menlo, monospace;
}`

const CARD_TEMPLATE = `<section>
  <header data-wm-drag><span data-wm-title>{{title}}</span></header>
  <div data-wm-content></div>
</section>`

const CARD_CSS = `${SCOPE} {
  background: rgba(255, 255, 255, 0.09);
  -webkit-backdrop-filter: blur(20px) saturate(1.3);
  backdrop-filter: blur(20px) saturate(1.3);
  color: #f4f6fb;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
${SCOPE} [data-wm-drag] {
  padding: 12px 18px 4px;
  font: 600 11px/1 system-ui, sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(244, 246, 251, 0.7);
}
${SCOPE} [data-wm-content] {
  padding: 10px 18px 16px;
  font: 13px/1.55 system-ui, sans-serif;
}`

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

function quote(source: string): string {
  return source.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

export function initBuilder(deps: BuilderDeps): BuilderController {
  const host = document.querySelector<HTMLElement>('#builder-app')
  if (!host) return { relabel() {}, syncTheme() {} }

  const presets: Record<string, { template: () => string; css: string }> = {
    theme: { template: () => deps.themeTemplate(), css: '' },
    mac: { template: () => MAC_TEMPLATE, css: MAC_CSS },
    win95: { template: () => WIN95_TEMPLATE, css: WIN95_CSS },
    terminal: { template: () => TERMINAL_TEMPLATE, css: TERMINAL_CSS },
    card: { template: () => CARD_TEMPLATE, css: CARD_CSS },
  }

  const controls = el('div', 'builder-controls')
  const presetRow = el('div', 'builder-layouts')
  const markupLabel = el('label', 'builder-label')
  const markupText = el('span', 'builder-label-text')
  const editor = el('textarea', 'builder-editor')
  editor.rows = 11
  editor.spellcheck = false
  markupLabel.append(markupText, editor)

  const cssLabel = el('label', 'builder-label')
  const cssText = el('span', 'builder-label-text')
  const cssBox = el('textarea', 'builder-editor builder-css')
  cssBox.rows = 9
  cssBox.spellcheck = false
  cssLabel.append(cssText, cssBox)

  const geoRow = el('div', 'builder-geo')
  const geoTitle = el('span', 'builder-label-text')
  const axes = (['x', 'y', 'width', 'height'] as const).map(() => {
    const wrap = el('label', 'builder-axis')
    const name = el('span')
    const input = el('input')
    input.type = 'number'
    input.step = '10'
    wrap.append(name, input)
    return { wrap, name, input }
  })
  geoRow.append(geoTitle, ...axes.map((axis) => axis.wrap))

  const shadowRow = el('label', 'builder-toggle')
  const shadowBox = el('input')
  shadowBox.type = 'checkbox'
  const shadowText = el('span')
  shadowRow.append(shadowBox, shadowText)
  const shadowHint = el('p', 'builder-hint')

  const actions = el('div', 'builder-actions')
  const toDesktopBtn = el('button', 'btn btn-primary')
  toDesktopBtn.type = 'button'
  const copyBtn = el('button', 'btn')
  copyBtn.type = 'button'
  actions.append(toDesktopBtn, copyBtn)
  const status = el('p', 'builder-status')
  status.setAttribute('role', 'status')

  controls.append(presetRow, markupLabel, cssLabel, geoRow, shadowRow, shadowHint, actions, status)

  const stage = el('div', 'builder-stage')
  stage.dataset.theme = deps.currentTheme()
  host.replaceChildren(controls, stage)

  const previewWm: WindowManager = createWindowManager()
  const previewDesktop = attachDesktop(previewWm, stage, { announce: false })
  const contentTitle = el('p', 'builder-window-lead')
  const contentBody = el('p', 'builder-window-body')

  const stageWidth = Math.max(stage.clientWidth, 320)
  previewWm.open({
    id: 'preview',
    title: 'window',
    x: Math.max(16, Math.round((stageWidth - 380) / 3)),
    y: 28,
    width: Math.min(380, stageWidth - 48),
    height: 250,
  })

  let applied = { template: '', css: '', shadow: false }

  function applyPreview(): void {
    const template = editor.value
    const css = cssBox.value
    const shadow = shadowBox.checked
    if (applied.template === template && applied.css === css && applied.shadow === shadow) return
    if (!previewWm.get('preview')) {
      previewWm.open({ id: 'preview', title: 'window', x: 24, y: 28, width: 340, height: 240 })
    }
    document.head.querySelector('style[data-wm-skin-styles="custom"]')?.remove()
    try {
      const built = skin({
        name: 'custom',
        template,
        shadow,
        ...(css.trim() === '' ? {} : { styles: css }),
      })
      const mountedPreview = previewDesktop.mountWindow('preview', built, { removeOnClose: true })
      if (!mountedPreview.content.contains(contentTitle)) {
        mountedPreview.content.replaceChildren(contentTitle, contentBody)
      }
      applied = { template, css, shadow }
      status.textContent = ''
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error)
    }
  }

  let debounce = 0
  function queueApply(): void {
    window.clearTimeout(debounce)
    debounce = window.setTimeout(applyPreview, 400)
  }
  editor.addEventListener('input', queueApply)
  cssBox.addEventListener('input', queueApply)
  shadowBox.addEventListener('change', () => {
    shadowHint.hidden = !shadowBox.checked
    applyPreview()
  })

  function pressPreset(id: string): void {
    const preset = presets[id]
    if (!preset) return
    editor.value = preset.template()
    cssBox.value = preset.css
    for (const chip of presetRow.querySelectorAll('button')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.preset === id))
    }
    applyPreview()
  }

  for (const id of Object.keys(presets)) {
    const chip = el('button', 'builder-chip')
    chip.type = 'button'
    chip.dataset.preset = id
    chip.addEventListener('click', () => pressPreset(id))
    presetRow.append(chip)
  }

  const fields = ['x', 'y', 'width', 'height'] as const
  for (const [index, axis] of axes.entries()) {
    axis.input.addEventListener('change', () => {
      const value = Number.parseInt(axis.input.value, 10)
      if (!Number.isFinite(value)) return
      const field = fields[index] as (typeof fields)[number]
      if (field === 'x' || field === 'y') {
        const win = previewWm.get('preview')
        if (!win) return
        previewWm.move(
          'preview',
          field === 'x' ? value : win.bounds.x,
          field === 'y' ? value : win.bounds.y,
        )
      } else {
        previewWm.resize('preview', { [field]: value })
      }
    })
  }

  previewWm.subscribe(() => {
    const win = previewWm.get('preview')
    if (!win) return
    const values = [win.bounds.x, win.bounds.y, win.bounds.width, win.bounds.height]
    for (const [index, axis] of axes.entries()) {
      if (document.activeElement === axis.input) continue
      axis.input.value = String(Math.round(values[index] ?? 0))
    }
  })

  toDesktopBtn.addEventListener('click', () => {
    try {
      deps.toDesktop(editor.value, shadowBox.checked, cssBox.value)
      status.textContent = ''
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error)
    }
  })

  copyBtn.addEventListener('click', () => {
    const css = cssBox.value.trim()
    const lines = [
      "import { createWindowManager, attachDesktop } from '@surdeddd/wmkit'",
      "import { skin } from '@surdeddd/wmkit/chrome'",
      '',
      'const mine = skin({',
      "  name: 'mine',",
      ...(shadowBox.checked ? ['  shadow: true,'] : []),
      ...(css === '' ? [] : ['  styles: `', quote(css), '`,']),
      '  template: `',
      quote(editor.value),
      '`,',
      '})',
      '',
      'const wm = createWindowManager()',
      'const desktop = attachDesktop(wm, document.querySelector("#desktop"), { skins: { mine } })',
      "wm.open({ id: 'app', title: 'My window', width: 380, height: 250 })",
      "desktop.mountWindow('app', 'mine')",
    ]
    const code = lines.join('\n')
    const done = () => {
      status.textContent = deps.dict().builderUi.copied
    }
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {})
  })

  function relabel(): void {
    const copy = deps.dict().builderUi
    markupText.textContent = copy.markup
    cssText.textContent = copy.css
    cssBox.placeholder = `${SCOPE} { border-color: hotpink; }`
    geoTitle.textContent = copy.geometry
    for (const [index, axis] of axes.entries()) {
      axis.name.textContent = copy.axes[index] ?? ''
      axis.input.setAttribute('aria-label', copy.axes[index] ?? '')
    }
    shadowText.textContent = copy.shadow
    shadowHint.textContent = copy.shadowHint
    shadowHint.hidden = !shadowBox.checked
    toDesktopBtn.textContent = copy.toDesktop
    copyBtn.textContent = copy.copy
    editor.setAttribute('aria-label', copy.markup)
    cssBox.setAttribute('aria-label', copy.css)
    for (const chip of presetRow.querySelectorAll<HTMLButtonElement>('button')) {
      const entry = copy.presets.find(([id]) => id === chip.dataset.preset)
      chip.textContent = entry?.[1] ?? chip.dataset.preset ?? ''
    }
    contentTitle.textContent = copy.windowTitle
    contentBody.textContent = copy.windowBody
    const win = previewWm.get('preview')
    if (win) previewWm.update('preview', { title: copy.windowTitle })
  }

  relabel()
  pressPreset('mac')

  return {
    relabel,
    syncTheme(name) {
      stage.dataset.theme = name
    },
  }
}

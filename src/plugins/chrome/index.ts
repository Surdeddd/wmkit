import type { WindowState } from '../../core/types'
import type { SkinMount, WindowSkin } from '../../dom/shared'
import { type ChromeMessages, chromeMessages } from './messages'
import { compileTemplate } from './template'

export type { ChromeMessages } from './messages'
export { chromeMessages, chromeMessagesRu } from './messages'
export { compileTemplate } from './template'

export interface SkinSpec {
  template: string
  styles?: string
  shadow?: boolean
  name?: string
}

const SLOT = '[data-wm-content]'
const SLOT_PATTERN = /data-wm-content\b/g

const BAD_SLOT_COUNT = 'wmkit: a skin template needs exactly one [data-wm-content]'
const BAD_STRUCTURE =
  'wmkit: a skin template needs a single root element that holds its [data-wm-content]'
const UNSCOPED_STYLES = 'wmkit: a skin with styles needs a name to scope them to'

function valuesOf(win: WindowState): Record<string, string> {
  const variant = win.meta.variant
  return {
    id: win.id,
    title: win.title,
    stage: win.stage,
    layer: win.layer,
    workspace: String(win.workspace),
    variant: typeof variant === 'string' ? variant : '',
  }
}

function injectStyles(doc: Document, name: string, styles: string): void {
  if (doc.head.querySelector(`style[data-wm-skin-styles="${name}"]`)) return
  const tag = doc.createElement('style')
  tag.dataset.wmSkinStyles = name
  tag.textContent = styles
  doc.head.append(tag)
}

export function skin(spec: SkinSpec): WindowSkin {
  if ((spec.template.match(SLOT_PATTERN) ?? []).length !== 1) throw new Error(BAD_SLOT_COUNT)
  if (spec.styles !== undefined && spec.name === undefined) throw new Error(UNSCOPED_STYLES)
  const render = compileTemplate(spec.template)
  const sheets = new WeakMap<Document, CSSStyleSheet>()

  function adopt(root: ShadowRoot, doc: Document, css: string): void {
    if (typeof CSSStyleSheet.prototype.replaceSync !== 'function') {
      const tag = doc.createElement('style')
      tag.textContent = css
      root.prepend(tag)
      return
    }
    let sheet = sheets.get(doc)
    if (!sheet) {
      sheet = new CSSStyleSheet()
      sheet.replaceSync(css)
      sheets.set(doc, sheet)
    }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
  }

  return ({ doc, window: win }): SkinMount => {
    const holder = doc.createElement('template')
    holder.innerHTML = render(valuesOf(win))
    const built = holder.content.firstElementChild as HTMLElement | null
    const slot =
      built === null ? null : built.matches(SLOT) ? built : built.querySelector<HTMLElement>(SLOT)
    if (built === null || slot === null) throw new Error(BAD_STRUCTURE)

    if (spec.shadow !== true) {
      if (spec.name !== undefined) built.dataset.wmSkin = spec.name
      if (spec.styles !== undefined) injectStyles(doc, spec.name as string, spec.styles)
      return { element: built, content: slot }
    }

    const element = doc.createElement('div')
    if (spec.name !== undefined) element.dataset.wmSkin = spec.name
    const root = element.attachShadow({ mode: 'open' })
    root.append(built)
    slot.replaceWith(doc.createElement('slot'))
    if (spec.styles !== undefined) adopt(root, doc, spec.styles)
    const content = doc.createElement('div')
    content.dataset.wmContent = ''
    element.append(content)
    return { element, content }
  }
}

export function windowChrome(messages: ChromeMessages = chromeMessages): WindowSkin {
  return skin({
    name: 'wmkit',
    template:
      '<section>' +
      '<header data-wm-drag>' +
      '<span data-wm-title>{{title}}</span>' +
      '<span data-wm-controls>' +
      `<button type="button" data-wm-minimize aria-label="${messages.minimize}"></button>` +
      `<button type="button" data-wm-maximize aria-label="${messages.maximize}"></button>` +
      `<button type="button" data-wm-close aria-label="${messages.close}"></button>` +
      '</span>' +
      '</header>' +
      '<div data-wm-content></div>' +
      '</section>',
  })
}

export const defaultSkin: WindowSkin = windowChrome()

export const barebones: WindowSkin = skin({
  name: 'barebones',
  template:
    '<section>' +
    '<header data-wm-drag><span data-wm-title>{{title}}</span></header>' +
    '<div data-wm-content></div>' +
    '</section>',
})

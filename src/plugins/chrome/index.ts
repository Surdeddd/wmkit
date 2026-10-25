import type { WindowState } from '../../core/types'
import type { SkinMount, WindowSkin } from '../../dom/shared'
import { type ChromeMessages, chromeMessages } from './messages'
import { compile, escapeHtml } from './template'

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

export function skin(spec: SkinSpec): WindowSkin {
  const { render, attributes } = compile(spec.template)
  if (attributes.filter((name) => name === 'data-wm-content').length !== 1) {
    throw new Error(BAD_SLOT_COUNT)
  }
  if (spec.styles !== undefined && spec.name === undefined) throw new Error(UNSCOPED_STYLES)
  const sheets = new WeakMap<Document, CSSStyleSheet>()
  const worn = new WeakMap<Document, { tag: HTMLStyleElement; count: number }>()

  function wear(doc: Document): () => void {
    let held = worn.get(doc)
    if (!held) {
      const tag = doc.createElement('style')
      tag.dataset.wmSkinStyles = spec.name
      tag.textContent = spec.styles as string
      doc.head.append(tag)
      held = { tag, count: 0 }
      worn.set(doc, held)
    }
    const owner = held
    owner.count += 1
    let released = false
    return () => {
      if (released) return
      released = true
      owner.count -= 1
      if (owner.count > 0) return
      owner.tag.remove()
      worn.delete(doc)
    }
  }

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
    const built = holder.content.firstElementChild as HTMLElement
    const slot =
      holder.content.childElementCount !== 1
        ? null
        : built.matches(SLOT)
          ? built
          : built.querySelector<HTMLElement>(SLOT)
    if (slot === null) throw new Error(BAD_STRUCTURE)

    if (spec.shadow !== true) {
      if (spec.name !== undefined) built.dataset.wmSkin = spec.name
      const destroy = spec.styles === undefined ? undefined : wear(doc)
      return { element: built, content: slot, destroy }
    }

    const element = doc.createElement('div')
    if (spec.name !== undefined) element.dataset.wmSkin = spec.name
    const root = element.attachShadow({ mode: 'open' })
    const projection = doc.createElement('slot')
    if (slot === built) root.append(projection)
    else {
      slot.replaceWith(projection)
      root.append(...built.childNodes)
    }
    if (spec.styles !== undefined) adopt(root, doc, spec.styles)
    element.append(slot)
    return { element, content: slot }
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
      `<button type="button" data-wm-minimize aria-label="${escapeHtml(messages.minimize)}"></button>` +
      `<button type="button" data-wm-maximize aria-label="${escapeHtml(messages.maximize)}"></button>` +
      `<button type="button" data-wm-close aria-label="${escapeHtml(messages.close)}"></button>` +
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

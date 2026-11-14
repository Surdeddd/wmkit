import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { defineWmElements, type WmDesktopElement } from '@surdeddd/wmkit/elements'
import { type ThemeName, themeNames, themeStyle } from '@surdeddd/wmkit/themes'

const asked = new URLSearchParams(location.search).get('theme')
const name = themeNames.find((theme) => theme === asked) ?? ('glass' satisfies ThemeName)

const sheet = document.createElement('style')
sheet.textContent = themeStyle(name)
document.head.append(sheet)

const plain = document.querySelector('#plain') as HTMLElement
const wm = createWindowManager()
const desktop = attachDesktop(wm, plain, { animation: false, announce: false })

for (const [id, title, x, y] of [
  ['behind', 'Behind', 70, 80],
  ['front', 'In the page', 16, 16],
] as const) {
  wm.open({ id, title, x, y, width: 260, height: 170 })
  const el = document.createElement('section')
  el.innerHTML = `
    <header data-wm-drag>
      <span data-wm-title></span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize" type="button"></button>
        <button data-wm-maximize aria-label="Maximize" type="button"></button>
        <button data-wm-close aria-label="Close" type="button"></button>
      </span>
    </header>
    <div data-wm-content><p>content</p></div>
  `
  plain.append(el)
  desktop.attachWindow(id, el)
}

defineWmElements()
const sealed = document.querySelector('#sealed') as WmDesktopElement
sealed.styles = themeStyle(name, { shadow: true })
sealed.manager?.focus('front')
document.documentElement.dataset.theme = name

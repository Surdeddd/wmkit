import { attachDesktop, createWindowManager } from '@surdeddd/wmkit'
import { skin } from '@surdeddd/wmkit/chrome'
import { createDevtools } from '@surdeddd/wmkit/devtools'
import { createDock } from '@surdeddd/wmkit/dock'
import { defineWmElements, type WmDesktopElement } from '@surdeddd/wmkit/elements'
import { createLayoutPicker, linkSnapped } from '@surdeddd/wmkit/layouts'
import { createSwitcher } from '@surdeddd/wmkit/switcher'
import { createTaskbar } from '@surdeddd/wmkit/taskbar'
import { themeStyle } from '@surdeddd/wmkit/themes'
import WinBox from '@surdeddd/wmkit/winbox'
import '@surdeddd/wmkit/themes/glass.css'

const violations: string[] = []
document.addEventListener('securitypolicyviolation', (event) => {
  violations.push(`${event.violatedDirective} ${event.blockedURI}`)
})

const desktopEl = document.querySelector('#desktop') as HTMLElement
const wm = createWindowManager()
const taskbar = createTaskbar(wm, document.querySelector('#taskbar') as HTMLElement)
const desktop = attachDesktop(wm, desktopEl, {
  minimizeTarget: (win) => taskbar.targetOf(win),
})
const dressed = skin({
  name: 'dressed',
  template:
    '<section><header data-wm-drag><span data-wm-title>{{title}}</span>' +
    '<button data-wm-minimize aria-label="Minimize" type="button"></button>' +
    '<button data-wm-maximize aria-label="Maximize" type="button"></button>' +
    '<button data-wm-close aria-label="Close" type="button"></button></header>' +
    '<div data-wm-content></div></section>',
  styles: '[data-wm-skin=dressed] [data-wm-content] { padding: 12px; }',
})
const sealedSkin = skin({
  name: 'sealed',
  shadow: true,
  template: '<section><header data-wm-drag></header><div data-wm-content></div></section>',
  styles: 'section { display: flex; flex-direction: column; height: 100%; }',
})

for (const [id, title, x] of [
  ['one', 'One', 40],
  ['two', 'Two', 380],
] as const) {
  wm.open({ id, title, x, y: 60, width: 300, height: 200 })
  const mounted = desktop.mountWindow(id, dressed)
  mounted.content.textContent = `Content of ${title}`
}
wm.open({ id: 'three', title: 'Three', x: 200, y: 300, width: 260, height: 160 })
desktop.mountWindow('three', sealedSkin).content.textContent = 'In a shadow root'

const dock = createDock(desktop)
const devtools = createDevtools(wm)
const picker = createLayoutPicker(desktop, { hover: false })
const link = linkSnapped(desktop)
const switcher = createSwitcher(desktop, { animation: 60 })
const box = new WinBox('Box', {
  root: document.querySelector('#boxes') as HTMLElement,
  html: '<em id="boxed">written as html</em>',
  x: 600,
  y: 20,
  width: 220,
  height: 140,
})

defineWmElements()
const sealed = document.querySelector('#sealed') as WmDesktopElement
sealed.styles = themeStyle('glass', { shadow: true })

declare global {
  interface Window {
    __csp: {
      violations: string[]
      wm: typeof wm
      dock: typeof dock
      picker: typeof picker
      switcher: typeof switcher
      devtools: typeof devtools
      link: typeof link
      box: typeof box
    }
  }
}
window.__csp = { violations, wm, dock, picker, switcher, devtools, link, box }
document.documentElement.dataset.ready = ''

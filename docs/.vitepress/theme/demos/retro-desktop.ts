import type { DesktopBinder, WindowManager, WindowState } from '@surdeddd/wmkit'
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import retro from '@surdeddd/wmkit/themes/retro.css?inline'
import { createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FRAME, injectCss } from './style'

const CSS = `
.wm-demo .win95 { position: absolute; inset: 0; display: flex; flex-direction: column; background: #008080; font: 13px "MS Sans Serif", Tahoma, system-ui; }
.wm-demo .win95-desktop { position: relative; flex: 1; min-height: 0; }
.wm-demo .win95-bar { display: flex; gap: 4px; padding: 3px; background: #c0c0c0; border-top: 2px solid #fff; }
.wm-demo .win95-bar button, .wm-demo .win95-menu button { background: #c0c0c0; border: 2px outset #fff; padding: 2px 10px; color: #000; cursor: pointer; }
.wm-demo .win95-bar button[aria-pressed="true"] { border-style: inset; background: #d8d8d8; }
.wm-demo .win95-menu { position: absolute; left: 3px; bottom: 34px; margin: 0; padding: 3px; list-style: none; background: #c0c0c0; border: 2px outset #fff; z-index: 2147483647; }
.wm-demo .win95-menu button { display: block; width: 160px; text-align: left; border: 0; }
.wm-demo .win95-menu button:hover { background: #000080; color: #fff; }
.wm-demo .win95 textarea { width: 100%; height: 100%; resize: none; border: 0; font: inherit; }
`

const programs: Record<string, { title: string; width: number; height: number; text: string }> = {
  notepad: {
    title: 'Notepad',
    width: 300,
    height: 200,
    text: 'Dear diary, today I dragged a window.',
  },
  readme: {
    title: 'Readme.txt',
    width: 280,
    height: 180,
    text: 'Built with wmkit and the retro theme.',
  },
  about: { title: 'About', width: 260, height: 160, text: 'Double-click a titlebar to maximize.' },
}

function Window({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
  const ref = useWmWindowRef(binder, win.id)
  const program = programs[win.meta.program as string]
  return h(
    'section',
    { ref },
    h(
      'header',
      { 'data-wm-drag': '' },
      h('span', { 'data-wm-title': '' }, win.title),
      h(
        'span',
        { 'data-wm-controls': '' },
        h('button', { 'data-wm-minimize': '', 'aria-label': 'Minimize', type: 'button' }),
        h('button', { 'data-wm-maximize': '', 'aria-label': 'Maximize', type: 'button' }),
        h('button', { 'data-wm-close': '', 'aria-label': 'Close', type: 'button' }),
      ),
    ),
    h(
      'div',
      { 'data-wm-content': '' },
      h('textarea', { defaultValue: program?.text, 'aria-label': win.title }),
    ),
  )
}

function Taskbar({ wm, onStart }: { wm: WindowManager; onStart: () => void }) {
  const state = useWmState(wm)
  const windows = Object.values(state.windows).sort((a, b) => a.openedSeq - b.openedSeq)
  return h(
    'nav',
    { className: 'win95-bar', 'aria-label': 'Taskbar' },
    h('button', { type: 'button', onClick: onStart }, 'Start'),
    windows.map((win) =>
      h(
        'button',
        {
          key: win.id,
          type: 'button',
          'data-task': win.id,
          'aria-pressed': state.focusedId === win.id && win.stage !== 'minimized',
          onClick: () =>
            state.focusedId === win.id && win.stage !== 'minimized'
              ? wm.minimize(win.id)
              : wm.focus(win.id),
        },
        win.title,
      ),
    ),
  )
}

function App() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm, {
    minimizeTarget: (win) => document.querySelector(`.win95 [data-task="${win.id}"]`),
  })
  const state = useWmState(wm)
  const [menu, setMenu] = useState(false)
  const launch = (program: string) => {
    const { text: _text, ...init } = programs[program] as (typeof programs)[string]
    wm.open({ ...init, meta: { program } })
    setMenu(false)
  }
  return h(
    'div',
    { className: 'win95' },
    h(
      'div',
      { ref, className: 'win95-desktop' },
      Object.values(state.windows).map((win) => h(Window, { key: win.id, binder, win })),
    ),
    menu
      ? h(
          'ul',
          { className: 'win95-menu', role: 'menu' },
          Object.keys(programs).map((program) =>
            h(
              'li',
              { key: program, role: 'none' },
              h(
                'button',
                { type: 'button', role: 'menuitem', onClick: () => launch(program) },
                programs[program]?.title,
              ),
            ),
          ),
        )
      : null,
    h(Taskbar, { wm, onStart: () => setMenu(!menu) }),
  )
}

export function mount(element: HTMLElement): () => void {
  const drop = injectCss(FRAME + retro + CSS)
  const root = createRoot(element)
  root.render(h(App))
  return () => {
    root.unmount()
    drop()
  }
}

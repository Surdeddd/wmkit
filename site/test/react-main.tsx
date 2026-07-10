import type { DesktopBinder, WindowManager, WindowState } from '@surdeddd/wmkit'
import { useDesktop, useWindowManager, useWmState, useWmWindowRef } from '@surdeddd/wmkit/react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@surdeddd/wmkit/themes/glass.css'

function Win({ binder, win }: { binder: DesktopBinder; win: WindowState }) {
  const ref = useWmWindowRef(binder, win.id)
  return (
    <section ref={ref} data-testid={`window-${win.id}`}>
      <header data-wm-drag>
        <span data-wm-title>{win.title}</span>
        <span data-wm-controls>
          <button data-wm-minimize aria-label="Minimize" type="button" />
          <button data-wm-maximize aria-label="Maximize" type="button" />
          <button data-wm-close aria-label="Close" type="button" />
        </span>
      </header>
      <div data-wm-content>
        <p>React window {win.id}</p>
        <p data-testid={`pos-${win.id}`}>
          {Math.round(win.bounds.x)},{Math.round(win.bounds.y)}
        </p>
      </div>
    </section>
  )
}

function Taskbar({ wm }: { wm: WindowManager }) {
  const state = useWmState(wm)
  const minimized = Object.values(state.windows).filter((win) => win.stage === 'minimized')
  return (
    <div
      style={{ display: 'flex', gap: 6, padding: 8, minHeight: 44 }}
      role="toolbar"
      aria-label="Taskbar"
    >
      {minimized.map((win) => (
        <button key={win.id} type="button" data-task={win.id} onClick={() => wm.focus(win.id)}>
          {win.title}
        </button>
      ))}
    </div>
  )
}

function App() {
  const wm = useWindowManager()
  const { ref, binder } = useDesktop(wm)
  const state = useWmState(wm)
  const [counter, setCounter] = useState(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, padding: 8 }}>
        <button
          id="btn-open"
          type="button"
          onClick={() => {
            const next = counter + 1
            setCounter(next)
            wm.open({ id: `r${next}`, title: `React ${next}`, width: 320, height: 220 })
          }}
        >
          open
        </button>
        <span data-testid="window-count">{state.order.length}</span>
      </div>
      <div ref={ref} style={{ flex: 1, minHeight: 0 }}>
        {state.order.map((id) => {
          const win = state.windows[id]
          return win ? <Win key={id} binder={binder} win={win} /> : null
        })}
      </div>
      <Taskbar wm={wm} />
    </div>
  )
}

const rootEl = document.querySelector('#root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

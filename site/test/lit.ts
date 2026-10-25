import { createDesktopBinder, createWindowManager } from '@surdeddd/wmkit'
import { WmStateController, wmDesktop, wmWindow } from '@surdeddd/wmkit/lit'
import { html, LitElement } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import '@surdeddd/wmkit/themes/glass.css'

const wm = createWindowManager()
const binder = createDesktopBinder(wm)

class TestDesktop extends LitElement {
  private readonly view = new WmStateController(this, wm)
  private counter = 0

  override createRenderRoot(): HTMLElement {
    return this
  }

  private open(): void {
    this.counter += 1
    wm.open({ id: `w${this.counter}`, title: `Lit ${this.counter}`, width: 320, height: 220 })
  }

  override render() {
    const { order, windows } = this.view.state
    const minimized = Object.values(windows).filter((win) => win.stage === 'minimized')
    return html`<div style="display: flex; flex-direction: column; height: 100%">
      <div style="display: flex; gap: 8px; padding: 8px">
        <button id="btn-open" type="button" @click=${() => this.open()}>open</button>
        <span data-testid="window-count">${order.length}</span>
      </div>
      <div ${wmDesktop(binder)} style="flex: 1; min-height: 0">
        ${repeat(
          Object.values(windows),
          (win) => win.id,
          (win) => {
            const id = win.id
            return html`<section ${wmWindow(binder, id)} data-testid=${`window-${id}`}>
            <header data-wm-drag>
              <span data-wm-title>${win.title}</span>
              <span data-wm-controls>
                <button data-wm-minimize aria-label="Minimize" type="button"></button>
                <button data-wm-maximize aria-label="Maximize" type="button"></button>
                <button data-wm-close aria-label="Close" type="button"></button>
              </span>
            </header>
            <div data-wm-content>
              <p data-testid=${`pos-${id}`}>${Math.round(win.bounds.x)},${Math.round(win.bounds.y)}</p>
            </div>
          </section>`
          },
        )}
      </div>
      <div role="toolbar" aria-label="Taskbar" style="display: flex; gap: 6px; padding: 8px">
        ${minimized.map(
          (win) =>
            html`<button type="button" data-task=${win.id} @click=${() => wm.focus(win.id)}>${win.title}</button>`,
        )}
      </div>
    </div>`
  }
}

customElements.define('test-desktop', TestDesktop)
const root = document.querySelector('#root') as HTMLElement
root.append(document.createElement('test-desktop'))

import '@angular/compiler'
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  provideZonelessChangeDetection,
} from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { WindowState } from '@surdeddd/wmkit'
import {
  type AngularDesktop,
  createDesktop,
  useWindowManager as createManager,
  useWmState as followState,
} from '@surdeddd/wmkit/angular'
import '@surdeddd/wmkit/themes/glass.css'

const Win = Component({
  selector: 'section[wmWin]',
  standalone: true,
  inputs: ['win', 'dk'],
  template: `
    <header data-wm-drag>
      <span data-wm-title>{{ win.title }}</span>
      <span data-wm-controls>
        <button data-wm-minimize aria-label="Minimize" type="button"></button>
        <button data-wm-maximize aria-label="Maximize" type="button"></button>
        <button data-wm-close aria-label="Close" type="button"></button>
      </span>
    </header>
    <div data-wm-content>
      <p [attr.data-testid]="'pos-' + win.id">{{ round(win.bounds.x) }},{{ round(win.bounds.y) }}</p>
    </div>
  `,
})(
  class WinComponent {
    declare win: WindowState
    declare dk: AngularDesktop
    round = Math.round

    constructor() {
      const host = inject(ElementRef).nativeElement as HTMLElement
      const lifetime = inject(DestroyRef)
      afterNextRender(() => {
        this.dk.window(this.win.id, undefined, lifetime)(host)
      })
    }
  },
)

const App = Component({
  selector: '[id=root]',
  standalone: true,
  imports: [Win],
  template: `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="display:flex;gap:8px;padding:8px">
        <button id="btn-open" type="button" (click)="open()">open</button>
        <span data-testid="window-count">{{ state().order.length }}</span>
      </div>
      <div class="desk" style="flex:1;min-height:0">
        @for (win of windows(); track win.id) {
          <section wmWin [win]="win" [dk]="dk" [attr.data-testid]="'window-' + win.id"></section>
        }
      </div>
      <div role="toolbar" aria-label="Taskbar" style="display:flex;gap:6px;padding:8px">
        @for (win of minimized(); track win.id) {
          <button type="button" [attr.data-task]="win.id" (click)="wm.focus(win.id)">
            {{ win.title }}
          </button>
        }
      </div>
    </div>
  `,
})(
  class AppComponent {
    wm = createManager()
    state = followState(this.wm)
    dk = createDesktop(this.wm)
    windows = computed(() => Object.values(this.state().windows))
    minimized = computed(() => this.windows().filter((win) => win.stage === 'minimized'))
    counter = 0

    constructor() {
      Object.assign(window, { __wm: this.wm })
      const host = inject(ElementRef).nativeElement as HTMLElement
      const lifetime = inject(DestroyRef)
      afterNextRender(() => {
        this.dk.desktop(host.querySelector('.desk') as HTMLElement, lifetime)
      })
    }

    open(): void {
      this.counter += 1
      this.wm.open({
        id: `w${this.counter}`,
        title: `Angular ${this.counter}`,
        width: 320,
        height: 220,
      })
    }
  },
)

void bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] })

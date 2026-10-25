import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue'

type Mount = (element: HTMLElement) => () => void

function demo(name: string, load: () => Promise<{ mount: Mount }>, height = 380) {
  return defineComponent({
    name,
    setup() {
      const host = ref<HTMLElement>()
      let stop: (() => void) | null = null
      let gone = false
      onMounted(async () => {
        const { mount } = await load()
        if (!gone && host.value) stop = mount(host.value)
      })
      onBeforeUnmount(() => {
        gone = true
        stop?.()
      })
      return () =>
        h('div', {
          ref: host,
          class: 'vp-raw wm-demo',
          'data-demo': name,
          style: { position: 'relative', height: `${height}px`, margin: '16px 0' },
        })
    },
  })
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component(
      'ReactWindowDemo',
      demo('react-window', () => import('./demos/react-window')),
    )
    app.component(
      'RetroDesktopDemo',
      demo('retro-desktop', () => import('./demos/retro-desktop'), 420),
    )
    app.component(
      'WinBoxDemo',
      demo('winbox', () => import('./demos/winbox')),
    )
  },
} satisfies Theme

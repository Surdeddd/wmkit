import '@surdeddd/wmkit/themes/glass.css'
import { defineWmElements } from '@surdeddd/wmkit/elements'
import { retroShadowTheme } from '@surdeddd/wmkit/themes'

const persistKey = new URLSearchParams(location.search).get('persist')
if (persistKey) document.querySelector('wm-desktop')?.setAttribute('persist', persistKey)
defineWmElements()

declare global {
  interface Window {
    __themes: { retroShadowTheme: string }
  }
}
window.__themes = { retroShadowTheme }

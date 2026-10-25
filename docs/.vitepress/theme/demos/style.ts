export function injectCss(css: string): () => void {
  const style = document.createElement('style')
  style.dataset.wmDemo = ''
  style.textContent = css
  document.head.append(style)
  return () => style.remove()
}

export const FRAME = `
.wm-demo { border: 1px solid var(--vp-c-divider); border-radius: 12px; overflow: hidden; }
.wm-demo [data-wm-desktop] { position: absolute; inset: 0; }
.wm-demo button { font: inherit; }
`

import WinBox from '@surdeddd/wmkit/winbox'
import { FRAME, injectCss } from './style'

export function mount(element: HTMLElement): () => void {
  const drop = injectCss(`${FRAME}.wm-demo[data-demo="winbox"] { background: #1d2230; }`)
  const windows = [
    new WinBox('Hello', {
      root: element,
      x: 24,
      y: 24,
      width: 280,
      height: 180,
      html: '<p style="padding:12px">new WinBox(title, options)</p>',
    }),
    new WinBox({
      title: 'Centered',
      root: element,
      x: 'center',
      y: 'center',
      width: '45%',
      height: '45%',
      background: '#7c4dff',
      html: '<p style="padding:12px">x: "center", width: "45%"</p>',
    }),
  ]
  return () => {
    for (const win of windows) win.close(true)
    drop()
  }
}

import WinBox from '@surdeddd/wmkit/winbox'

declare global {
  interface Window {
    WinBox: typeof WinBox
    examples: Record<string, () => WinBox>
  }
}

window.WinBox = WinBox
window.examples = {
  basic: () => new WinBox('Window Title'),
  new: () => WinBox.new('Window Title'),
  options: () => new WinBox({ title: 'Window Title' }),
  call: () => {
    const winbox = WinBox()
    winbox.setTitle('Window Title')
    return winbox
  },
  color: () => new WinBox('Custom Color', { background: '#ff005d' }),
  modal: () => new WinBox({ title: 'Modal Window', modal: true }),
  mount: () =>
    new WinBox('Mount DOM', { mount: document.getElementById('content') as HTMLElement }),
  html: () => new WinBox('Set innerHTML', { html: '<h1>Lorem Ipsum</h1>' }),
  url: () =>
    new WinBox('Open URL', {
      url: `data:text/html,${encodeURIComponent('<body style="margin:0"><input id="field"></body>')}`,
    }),
  sized: () =>
    new WinBox({
      title: 'Custom Position / Size',
      x: 'center',
      y: 'center',
      width: '50%',
      height: '50%',
    }),
  viewport: () =>
    new WinBox('Custom Viewport', {
      x: 'center',
      y: 'center',
      top: 50,
      right: 50,
      bottom: 50,
      left: 50,
    }),
  classes: () =>
    new WinBox('Control Classes', {
      class: ['no-min', 'no-max', 'no-full', 'no-resize', 'no-move'],
    }),
}

import { jsx } from '@builder.io/qwik'
import { type RenderToStringOptions, renderToString } from '@builder.io/qwik/server'
import { Root } from './root'

export default function render(options: RenderToStringOptions) {
  return renderToString(jsx(Root, {}), { containerTagName: 'div', ...options })
}

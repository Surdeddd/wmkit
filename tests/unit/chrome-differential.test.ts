// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { compileTemplate } from '../../src/plugins/chrome'

const BENIGN = 'Notes'
const HOSTILE = [
  'x onmouseover=alert(1)//',
  'x" onmouseover="alert(1)',
  '</textarea><img src=x onerror=alert(1)>',
  '</title></svg><img src=x onerror=alert(1)>',
]
const MARKER = 'qz7mark'
const INERT = /^(aria-|data-)|^(title|alt|class|id|role|lang|dir|for|value|placeholder|label)$/i
const SVG = 'http://www.w3.org/2000/svg'
const MATHML = 'http://www.w3.org/1998/Math/MathML'
const RAW = ['textarea', 'title', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'script']

const CONTEXT = [
  '<svg>',
  '<svg/>',
  '<svg a=b/>',
  '<svg viewBox="0 0 1 1">',
  '</svg>',
  '<g>',
  '</g>',
  '<path d="M0"/>',
  '<foreignObject>',
  '</foreignObject>',
  '<desc>',
  '</desc>',
  '<title>',
  '</title>',
  '<title/>',
  '<math>',
  '</math>',
  '<mi>',
  '</mi>',
  '<annotation-xml encoding="text/html">',
  '</annotation-xml>',
  '<select>',
  '</select>',
  '<p>',
  '</p>',
  '</br>',
  '<div>',
  '</div>',
  '<b>',
  '</b>',
  '<span>',
  '<font color=red>',
  '<font>',
  '<table>',
  '<template>',
  '</template>',
  '<img>',
  'x',
  '{{title}}',
  '<i title="{{title}}">',
  "<i data-k='{{title}}'>",
  '<![CDATA[x]]>',
  '<!--c-->',
  '<textarea>t</textarea>',
  '<style>s</style>',
  '<SVG>',
  '<Title>',
  '<FOREIGNOBJECT>',
  '<svg a="b"/>',
  '<svg / >',
  '<a>',
  '</a>',
  '<nobr>',
  '<li>',
  '<tr>',
  '</td>',
  '</table>',
  '<div/>',
  '<br/>',
  '<option>',
  '<template><svg>',
]

function probes(raw: string): string[] {
  return [
    `<${raw}><a title="</${raw}><img src=x onerror={{title}}>"></${raw}>`,
    `<${raw}><a onclick="</${raw}>{{title}}"></a></${raw}>`,
    `<${raw}><a onclick="</${raw}>{{title}}">`,
    '<![CDATA[><img src=x onerror="//]]>{{title}}">',
    '<![CDATA[><b title="]]><img src=x onerror={{title}}>">',
    '<a title="]]><img src=x onerror={{title}}>">',
    '{{title}}',
    '<i title="{{title}}">{{title}}</i>',
    '<title>{{title}}</title>',
    '<title/>{{title}}<a title="</title><img src=x onerror={{title}}>">',
    '<svg><title>{{title}}</title></svg>',
  ]
}

function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function parse(html: string): DocumentFragment {
  const holder = document.createElement('template')
  holder.innerHTML = html
  return holder.content
}

function shape(root: ParentNode): string {
  return [...root.children]
    .map((el) => {
      const ns = el.namespaceURI === SVG ? 'svg:' : el.namespaceURI === MATHML ? 'math:' : ''
      const inner = el instanceof HTMLTemplateElement ? el.content : el
      return `${ns}${el.localName}[${el.getAttributeNames().sort().join(',')}](${shape(inner)})`
    })
    .join('')
}

function leaks(root: Node): string[] {
  const found: string[] = []
  const visit = (node: Node) => {
    if (node instanceof Element) {
      for (const name of node.getAttributeNames()) {
        if (node.getAttribute(name)?.includes(MARKER) && !INERT.test(name)) found.push(`@${name}`)
      }
      const children =
        node instanceof HTMLTemplateElement ? node.content.childNodes : node.childNodes
      for (const child of children) visit(child)
    } else if (node.nodeValue?.includes(MARKER)) {
      const parent = node.parentNode as Element | null
      const raw = parent?.localName === 'script' || parent?.localName === 'style'
      if (node.nodeType !== Node.TEXT_NODE || raw) found.push(`#${parent?.localName ?? 'root'}`)
    }
  }
  for (const child of root.childNodes) visit(child)
  return found
}

function compiled(template: string): ((values: Record<string, string>) => string) | null {
  try {
    return compileTemplate(template)
  } catch {
    return null
  }
}

function differs(template: string): string | null {
  const render = compiled(template)
  if (render === null) return null
  const leaked = leaks(parse(render({ title: MARKER })))
  if (leaked.length > 0) return `${template}  ⟶ the title lands in ${leaked.join(' ')}`
  const base = shape(parse(render({ title: BENIGN })))
  for (const title of HOSTILE) {
    if (shape(parse(render({ title }))) !== base)
      return `${template}  ⟶ the tree changes for ${title}`
  }
  return null
}

describe('template compiler against the HTML parser', () => {
  it('refuses the known foreign-content escapes', () => {
    for (const template of [
      '<svg><p><textarea><a title="</textarea><img src=x onerror={{title}}>"></textarea></svg>',
      '<svg><foreignObject><xmp><a title="</xmp><img src=x onerror={{title}}>"></xmp></foreignObject></svg>',
      '<svg><p><title><a title="</title><img src=x onerror={{title}}>"></title></svg>',
      '<svg a=b/><style><a onclick="</style>{{title}}"></a></style>',
      '<select><svg></select><xmp><a title="</xmp><img src=x onerror={{title}}>"></xmp>',
      '<math><mi><xmp><a title="</xmp><img src=x onerror={{title}}>"></xmp></mi></math>',
      '<div><svg><g></div><textarea><a title="</textarea><img src=x onerror={{title}}>"></textarea>',
      '<svg><foreignObject><div></foreignObject><![CDATA[><img src=x onerror="//]]>{{title}}">',
      '<svg><title><b><svg></svg></title><![CDATA[><img src=x onerror="//]]>{{title}}">',
      '<a><svg><foreignObject><a></a></foreignObject><![CDATA[><img src=x onerror="//]]>{{title}}">',
      '<select></select><svg><title><b>{{title}}</b></title></svg>',
      '<select></select><title/><a title="</title><img src=x onerror={{title}}>">',
    ]) {
      expect(compiled(template), template).toBeNull()
    }
  })

  it('still compiles titled icons, plain inline SVG and HTML inside foreignObject', () => {
    for (const template of [
      '<svg><title>{{title}}</title></svg>',
      '<button aria-label="Close {{title}}"><svg viewBox="0 0 16 16" aria-hidden="true"><title>{{title}}</title><path d="M2 2l12 12"/><g class="x"><circle r="1"/></g></svg></button><span>{{title}}</span>',
      '<svg><use href="#close"/></svg>{{title}}<svg><rect width="1" height="1"></rect></svg><b title="{{title}}">{{title}}</b>',
      '<svg><foreignObject><div class="{{variant}}" title="{{title}}"><b>{{title}}</b></div><p data-id="{{id}}">{{title}}</p></foreignObject></svg>{{title}}',
      '<svg><foreignObject><div>{{title}}<img src="a.png"><br></div></foreignObject></svg><textarea>t</textarea>{{title}}',
      '<select><option>{{title}}</option></select><svg><title>{{title}}</title></svg>',
      '<svg><foreignObject><div><b>x</div></foreignObject></svg><svg><title>{{title}}</title></svg>',
      '<math><mi>{{title}}</mi></math><svg><title>{{title}}</title></svg>{{title}}',
    ]) {
      expect(compiled(template), template).not.toBeNull()
      expect(differs(template), template).toBeNull()
    }
  })

  it('agrees with the parser on every generated template it accepts', () => {
    const random = rng(20261110)
    const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T
    const context = (most: number) => {
      let out = ''
      for (let k = Math.floor(random() * (most + 1)); k > 0; k -= 1) out += pick(CONTEXT)
      return out
    }
    const failures: string[] = []
    let accepted = 0
    let foreign = 0
    for (let n = 0; n < 1200; n += 1) {
      const template = context(5) + pick(probes(pick(RAW))) + context(2)
      if (compiled(template) === null) continue
      accepted += 1
      if (/<(svg|math)[\s>]/.test(template)) foreign += 1
      const failure = differs(template)
      if (failure) failures.push(failure)
    }
    expect(failures).toEqual([])
    expect(accepted).toBeGreaterThan(300)
    expect(foreign).toBeGreaterThan(100)
  })
})

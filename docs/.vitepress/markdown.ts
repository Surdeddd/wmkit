interface InlineToken {
  attrSet(name: string, value: string): void
}

type InlineRule = (
  tokens: InlineToken[],
  index: number,
  options: unknown,
  env: unknown,
  self: unknown,
) => string

interface InlineRenderer {
  renderer: { rules: { code_inline?: InlineRule } }
}

export function rawInlineCode(md: InlineRenderer): void {
  const render = md.renderer.rules.code_inline
  if (!render) return
  md.renderer.rules.code_inline = (tokens, index, options, env, self) => {
    tokens[index]?.attrSet('v-pre', '')
    return render(tokens, index, options, env, self)
  }
}

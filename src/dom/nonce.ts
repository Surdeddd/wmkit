let given: string | null = null

export function setStyleNonce(nonce: string | null): void {
  given = nonce
}

export function styleNonce(doc: Document): string | undefined {
  if (given) return given
  const holder = doc.querySelector<HTMLElement>(
    'meta[property="csp-nonce"],meta[name="csp-nonce"],script[nonce],style[nonce]',
  )
  return holder?.nonce || holder?.getAttribute('content') || undefined
}

export function nonced<T extends HTMLElement>(node: T, from: Document = node.ownerDocument): T {
  const nonce = styleNonce(from)
  if (nonce) node.nonce = nonce
  return node
}

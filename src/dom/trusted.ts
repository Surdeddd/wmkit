interface Policy {
  createHTML(html: string): unknown
}

interface Factory {
  createPolicy(name: string, rules: { createHTML(html: string): string }): Policy
}

const policies = new WeakMap<Factory, Policy | null>()

export function trustedHtml(view: Window | null, html: string): string {
  const factory = (view as { trustedTypes?: Factory } | null)?.trustedTypes
  if (!factory) return html
  let policy = policies.get(factory)
  if (policy === undefined) {
    try {
      policy = factory.createPolicy('wmkit', { createHTML: (value) => value })
    } catch {
      policy = null
    }
    policies.set(factory, policy)
  }
  return policy ? (policy.createHTML(html) as string) : html
}

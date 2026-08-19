const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] as string)
}

export function compileTemplate(template: string): (values: Record<string, string>) => string {
  const parts = template.split(/\{\{\s*([a-z]+)\s*\}\}/i)
  return (values) =>
    parts.map((part, index) => (index % 2 === 0 ? part : escapeHtml(values[part] ?? ''))).join('')
}

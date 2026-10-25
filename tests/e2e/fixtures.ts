import { test as base } from '@playwright/test'

export type { Page } from '@playwright/test'
export { expect } from '@playwright/test'

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
    )
    await context.route('https://fonts.gstatic.com/**', (route) => route.abort())
    await use(context)
  },
})

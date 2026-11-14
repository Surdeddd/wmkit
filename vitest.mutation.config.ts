import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        'tests/unit/adapters-qwik.test.ts',
        'tests/unit/api-surface.test.ts',
        'tests/unit/claims.test.ts',
        'tests/unit/docs-code.test.ts',
        'tests/unit/docs.test.ts',
        'tests/unit/landing-idle.test.ts',
        'tests/unit/site-build.test.ts',
        'tests/unit/site.test.ts',
        'tests/unit/themes.test.ts',
        'tests/unit/types.test.ts',
      ],
    },
  }),
)

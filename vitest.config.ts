import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', '{apps,packages,demos}/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      thresholds: { 'packages/core/src/container.ts': { branches: 100 } },
    },
  },
});

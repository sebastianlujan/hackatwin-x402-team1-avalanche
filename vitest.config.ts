import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'default',
          include: ['test/**/*.test.ts', '{apps,packages,demos}/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/*.nightly.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'nightly',
          include: ['{apps,packages,demos}/**/*.nightly.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**'],
      thresholds: { 'packages/core/src/container.ts': { branches: 100 } },
    },
  },
});

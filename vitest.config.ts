import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { 'server-only': resolve(import.meta.dirname, 'test/stubs/server-only.ts') } },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'default',
          include: ['{apps,packages,demos}/**/*.test.{ts,tsx}', 'e2e/protocol/src/local/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.nightly.test.ts', '**/*.fork.test.ts', '**/*.local.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'fork',
          include: ['{apps,packages,demos,e2e}/**/*.fork.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'local',
          include: ['e2e/protocol/src/local/**/*.local.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 120_000,
          hookTimeout: 120_000,
          fileParallelism: false,
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

import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

/** Manual Flair ladder runner — not part of normal `pnpm test:unit`. */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['scripts/simulate-flair.ts'],
      fileParallelism: false,
      // Show simulation progress in the terminal.
      disableConsoleIntercept: true,
      // Individual game searches are slow; the test sets its own timeout.
      testTimeout: 6 * 60 * 60 * 1000,
      hookTimeout: 120_000,
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)

/**
 * CLI wrapper for Flair ladder simulation.
 * Maps `--games=N` etc. to FLAIR_SIM_* env vars (vitest workers do not see argv).
 *
 *   pnpm simulate
 *   pnpm simulate -- --games=8
 *   pnpm simulate -- --games=4 --pairs=beginner:novice,club:solid
 *   pnpm simulate -- --max-upset=0.25
 */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const vitestPkg = dirname(require.resolve('vitest/package.json'))
const vitestCli = join(vitestPkg, 'vitest.mjs')

const env = { ...process.env }

for (const arg of process.argv.slice(2)) {
  if (arg === '--') {
    continue
  }
  const m = /^--([^=]+)=(.*)$/.exec(arg)
  if (!m) {
    console.error(`Unknown simulate arg: ${arg}`)
    console.error('Expected: --games=N --pairs=lower:higher,... --max-upset=0.35')
    process.exit(2)
  }
  const key = `FLAIR_SIM_${m[1].toUpperCase().replace(/-/g, '_')}`
  env[key] = m[2]
}

const child = spawn(
  process.execPath,
  [vitestCli, 'run', '--config', 'vitest.simulate.config.ts'],
  {
    cwd: root,
    env,
    stdio: 'inherit',
  },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLozzaPlayEngine } from '@/engines/lozza/client'
import { DEFAULT_LOZZA_CONFIG_ID, getLozzaConfig } from '@/engines/lozza/configs'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

class FakeWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: ErrorEvent) => void) | null = null
  readonly commands: string[] = []
  terminated = false
  private bestmove = 'bestmove e2e4'
  goLatch: Promise<void> | null = null

  constructor(_url?: string | URL) {}

  postMessage(data: unknown) {
    const cmd = String(data)
    this.commands.push(cmd)

    queueMicrotask(async () => {
      if (this.terminated) {
        return
      }
      if (cmd === 'uci') {
        this.emit('uciok')
      } else if (cmd === 'isready') {
        this.emit('readyok')
      } else if (cmd.startsWith('go ')) {
        if (this.goLatch) {
          await this.goLatch
        }
        if (!this.terminated) {
          this.emit(this.bestmove)
        }
      }
    })
  }

  terminate() {
    this.terminated = true
  }

  emit(line: string) {
    this.onmessage?.(new MessageEvent('message', { data: line }))
  }
}

describe('lozza engine', () => {
  let workers: FakeWorker[]

  beforeEach(() => {
    workers = []
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        const w = new FakeWorker(url)
        workers.push(w)
        return w
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes levels 1–9 and Beth', () => {
    expect(DEFAULT_LOZZA_CONFIG_ID).toBe('level-1')
    expect(getLozzaConfig('beth').go).toBe('go depth 12')
    expect(getLozzaConfig('level-5').go).toBe('go depth 5')
  })

  it('playSearch returns bestmove after go depth', async () => {
    const eng = createLozzaPlayEngine()
    const move = await eng.playSearch({ fen: START_FEN, configId: 'level-3' })
    expect(move).toEqual({ from: 'e2', to: 'e4' })
    expect(workers[0]!.commands.some((c) => c === 'go depth 3')).toBe(true)
  })

  it('stopAndDrain terminates the worker (no UCI stop)', async () => {
    const eng = createLozzaPlayEngine()
    const first = await eng.playSearch({ fen: START_FEN, configId: 'level-1' })
    expect(first).toEqual({ from: 'e2', to: 'e4' })
    expect(workers).toHaveLength(1)
    const firstWorker = workers[0]!

    await eng.stopAndDrain()
    expect(firstWorker.terminated).toBe(true)
    expect(firstWorker.commands).not.toContain('stop')

    const second = await eng.playSearch({ fen: START_FEN, configId: 'level-2' })
    expect(second).toEqual({ from: 'e2', to: 'e4' })
    expect(workers).toHaveLength(2)
    expect(workers[1]!.commands.some((c) => c === 'go depth 2')).toBe(true)
  })

  it('cancel mid-search resolves null and recycles', async () => {
    let releaseGo!: () => void
    const latch = new Promise<void>((resolve) => {
      releaseGo = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        const w = new FakeWorker(url)
        w.goLatch = latch
        workers.push(w)
        return w
      }),
    )

    const eng = createLozzaPlayEngine()
    const searchP = eng.playSearch({ fen: START_FEN, configId: 'level-1' })
    await vi.waitFor(() => expect(workers[0]?.commands.some((c) => c.startsWith('go '))).toBe(true))

    await eng.stopAndDrain()
    expect(await searchP).toBeNull()
    expect(workers[0]!.terminated).toBe(true)

    releaseGo()
  })
})

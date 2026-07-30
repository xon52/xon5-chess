import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getBrowserStockfishBackend,
  setBrowserStockfishBackend,
} from '@/engine/stockfish/browser'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

class FakeWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: ErrorEvent) => void) | null = null
  readonly commands: string[] = []
  goLatch: Promise<void> | null = null
  evalInfoLines: string[] = []
  flairInfoLines: string[] = []
  private bestmove = 'bestmove e2e4'
  private activeGoToken: symbol | null = null
  suppressStopAck = false

  constructor(_url?: string | URL) {}

  postMessage(data: unknown) {
    const cmd = String(data)
    this.commands.push(cmd)

    queueMicrotask(async () => {
      if (cmd === 'uci') {
        this.emit('option name UCI_LimitStrength type check default false')
        this.emit('option name Skill Level type spin default 20 min 0 max 20')
        this.emit('uciok')
      } else if (cmd === 'isready') {
        this.emit('readyok')
      } else if (cmd.startsWith('go ')) {
        const token = Symbol('go')
        this.activeGoToken = token
        if (this.goLatch) {
          await this.goLatch
        }
        if (this.activeGoToken !== token) {
          return
        }
        this.activeGoToken = null
        if (cmd.includes('movetime 500')) {
          for (const line of this.evalInfoLines) {
            this.emit(line)
          }
        } else if (this.flairInfoLines.length > 0) {
          for (const line of this.flairInfoLines) {
            this.emit(line)
          }
        }
        this.emit(this.bestmove)
      } else if (cmd === 'stop') {
        this.activeGoToken = null
        if (!this.suppressStopAck) {
          this.emit('bestmove (none)')
        }
      }
    })
  }

  terminate() {}

  setBestmove(line: string) {
    this.bestmove = line
  }

  setEvalInfo(lines: string[]) {
    this.evalInfoLines = lines
  }

  setFlairInfo(lines: string[]) {
    this.flairInfoLines = lines
  }

  emit(line: string) {
    this.onmessage?.(new MessageEvent('message', { data: line }))
  }
}

describe('stockfish backend', () => {
  let lastWorker: FakeWorker | null

  beforeEach(() => {
    lastWorker = null
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setBrowserStockfishBackend(null)
  })

  it('returns empty for a second flairSearch while busy', async () => {
    let releaseGo!: () => void
    const latch = new Promise<void>((resolve) => {
      releaseGo = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = latch
        lastWorker.setFlairInfo(['info depth 8 multipv 1 score cp 40 pv e7e5'])
        lastWorker.setBestmove('bestmove e7e5')
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)

    const client = getBrowserStockfishBackend()
    const first = client.multipvSearch({ fen: START_FEN, depth: 8, multipv: 3 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    const second = await client.multipvSearch({ fen: START_FEN, depth: 8, multipv: 3 })
    expect(second).toEqual([])

    releaseGo()
    await expect(first).resolves.toEqual([
      { move: { from: 'e7', to: 'e5' }, score: { kind: 'cp', value: 40 } },
    ])
  })

  it('evalSearch uses movetime 500 and MultiPV 1', async () => {
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.setEvalInfo(['info depth 12 score cp 35'])
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)

    const score = await getBrowserStockfishBackend().evalSearch({ fen: START_FEN })
    expect(score).toEqual({ kind: 'cp', value: 35 })
    expect(lastWorker!.commands).toContain('setoption name MultiPV value 1')
    expect(lastWorker!.commands).toContain('go movetime 500')
  })

  it('flairSearch preempts eval', async () => {
    let releaseEval!: () => void
    const evalLatch = new Promise<void>((resolve) => {
      releaseEval = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = evalLatch
        lastWorker.setEvalInfo(['info depth 8 score cp 10'])
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)

    const client = getBrowserStockfishBackend()
    const evalPromise = client.evalSearch({ fen: START_FEN })
    await vi.waitFor(() =>
      expect(lastWorker?.commands.some((c) => c.includes('movetime'))).toBe(true),
    )

    lastWorker!.goLatch = null
    lastWorker!.setFlairInfo(['info depth 8 multipv 1 score cp 20 pv d2d4'])
    lastWorker!.setBestmove('bestmove d2d4')
    const flairPromise = client.multipvSearch({ fen: START_FEN, depth: 8, multipv: 3 })
    releaseEval()

    await expect(evalPromise).resolves.toBeNull()
    await expect(flairPromise).resolves.toEqual([
      { move: { from: 'd2', to: 'd4' }, score: { kind: 'cp', value: 20 } },
    ])
  })

  it('stopAndDrain waits for stop bestmove', async () => {
    let releaseGo!: () => void
    const latch = new Promise<void>((resolve) => {
      releaseGo = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = latch
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)

    const client = getBrowserStockfishBackend()
    const flairPromise = client.multipvSearch({ fen: START_FEN, depth: 8, multipv: 3 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    const drain = client.stopAndDrain()
    releaseGo()
    await expect(flairPromise).resolves.toEqual([])
    await drain
    expect(lastWorker!.commands).toContain('stop')
  })

  it('multipvSearch aggregates exact MultiPV scores', async () => {
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.setFlairInfo([
          'info depth 8 multipv 1 score cp 40 pv e2e4',
          'info depth 8 multipv 2 score cp -100 pv a2a3',
          'info depth 8 multipv 2 score cp -50 lowerbound pv a2a3',
        ])
        lastWorker.setBestmove('bestmove e2e4')
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)

    const lines = await getBrowserStockfishBackend().multipvSearch({
      fen: START_FEN,
      depth: 8,
      multipv: 12,
    })
    expect(lines).toEqual([
      { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
      { move: { from: 'a2', to: 'a3' }, score: { kind: 'cp', value: -100 } },
    ])
    expect(lastWorker!.commands).toContain('setoption name Skill Level value 20')
    expect(lastWorker!.commands).toContain('setoption name MultiPV value 12')
    expect(lastWorker!.commands).toContain('go depth 8')
  })

  it('evalSearch after flair restores MultiPV 1', async () => {
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.setFlairInfo(['info depth 8 multipv 1 score cp 10 pv e2e4'])
        lastWorker.setEvalInfo(['info depth 12 score cp 22'])
        return lastWorker
      }),
    )
    setBrowserStockfishBackend(null)

    const client = getBrowserStockfishBackend()
    await client.multipvSearch({ fen: START_FEN, depth: 8, multipv: 12 })
    const score = await client.evalSearch({ fen: START_FEN })
    expect(score).toEqual({ kind: 'cp', value: 22 })

    const multipvCmds = lastWorker!.commands.filter((c) => c.includes('MultiPV'))
    expect(multipvCmds.at(-1)).toBe('setoption name MultiPV value 1')
  })
})

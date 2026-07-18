import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getEngineClient, setEngineClient } from '@/engine/stockfishClient'

class FakeWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null
  onerror: ((ev: ErrorEvent) => void) | null = null
  readonly commands: string[] = []
  /** When set, `go` waits for this before emitting bestmove (unless stopped). */
  goLatch: Promise<void> | null = null
  /** Info lines emitted before bestmove on eval (`go movetime`). */
  evalInfoLines: string[] = []
  private bestmove = 'bestmove e2e4'
  /** Active latched go; cleared on stop so the latched completion is skipped. */
  private activeGoToken: symbol | null = null
  /** When true, `stop` cancels the go but does not emit a bestmove ack. */
  suppressStopAck = false

  constructor(_url?: string | URL) {}

  postMessage(data: unknown) {
    const cmd = String(data)
    this.commands.push(cmd)

    queueMicrotask(async () => {
      if (cmd === 'uci') {
        this.emit('option name UCI_LimitStrength type check default false')
        this.emit('option name UCI_Elo type spin default 1320 min 1320 max 3190')
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
        // Stop cancelled this go — do not emit its bestmove.
        if (this.activeGoToken !== token) {
          return
        }
        this.activeGoToken = null
        if (cmd.includes('movetime 500')) {
          for (const line of this.evalInfoLines) {
            this.emit(line)
          }
        }
        this.emit(this.bestmove)
      } else if (cmd === 'stop') {
        // Distinct stop ack — not the search’s planned bestmove.
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

  emit(line: string) {
    this.onmessage?.(new MessageEvent('message', { data: line }))
  }
}

describe('stockfishClient', () => {
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
    setEngineClient(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setEngineClient(null)
  })

  it('returns null for a second playSearch while busy', async () => {
    let releaseGo!: () => void
    const latch = new Promise<void>((resolve) => {
      releaseGo = resolve
    })

    // Recreate client after configuring latch via Worker ctor.
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = latch
        lastWorker.setBestmove('bestmove e7e5')
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    const first = client.playSearch({ fen, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    const second = await client.playSearch({ fen, elo: 1200 })
    expect(second).toBeNull()

    releaseGo()
    await expect(first).resolves.toEqual({ from: 'e7', to: 'e5' })
  })

  it('applies UCI_LimitStrength and Elo for play searches in range', async () => {
    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const move = await client.playSearch({ fen, elo: 1500 })
    expect(move).toEqual({ from: 'e2', to: 'e4' })

    expect(lastWorker!.commands).toContain('setoption name UCI_LimitStrength value true')
    expect(lastWorker!.commands).toContain('setoption name UCI_Elo value 1500')
    expect(lastWorker!.commands.some((c) => c.startsWith('go movetime'))).toBe(true)
  })

  it('uses Skill+depth fallback for default Elo 1200 (below UCI_Elo min 1320)', async () => {
    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    await client.playSearch({ fen, elo: 1200 })

    expect(lastWorker!.commands).toContain('setoption name UCI_LimitStrength value false')
    expect(lastWorker!.commands).toContain('setoption name Skill Level value 9')
    expect(lastWorker!.commands).toContain('go depth 11')
    expect(lastWorker!.commands.some((c) => c.includes('UCI_Elo'))).toBe(false)
  })

  it('falls back to Skill+depth at Elo 500 (below UCI_Elo min)', async () => {
    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    await client.playSearch({ fen, elo: 500 })

    expect(lastWorker!.commands).toContain('setoption name UCI_LimitStrength value false')
    expect(lastWorker!.commands).toContain('setoption name Skill Level value 0')
    expect(lastWorker!.commands).toContain('go depth 6')
    expect(lastWorker!.commands.some((c) => c.includes('UCI_Elo'))).toBe(false)
  })

  it('applies UCI_Elo at Elo 2000 (within UCI_Elo range)', async () => {
    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    await client.playSearch({ fen, elo: 2000 })

    expect(lastWorker!.commands).toContain('setoption name UCI_LimitStrength value true')
    expect(lastWorker!.commands).toContain('setoption name UCI_Elo value 2000')
    expect(lastWorker!.commands).toContain('go movetime 1000')
  })

  it('evalSearch uses uncapped movetime 500 with LimitStrength false and Skill Level max', async () => {
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.setEvalInfo(['info depth 12 score cp 35'])
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const score = await client.evalSearch({ fen })

    expect(score).toEqual({ kind: 'cp', value: 35 })
    expect(lastWorker!.commands).toContain('setoption name UCI_LimitStrength value false')
    expect(lastWorker!.commands).toContain('setoption name Skill Level value 20')
    expect(lastWorker!.commands).toContain('go movetime 500')
  })

  it('evalSearch preempts in-flight eval', async () => {
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
    setEngineClient(null)

    const client = getEngineClient()
    const fenA = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const fenB = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e3 0 1'

    const first = client.evalSearch({ fen: fenA })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go movetime'))).toBe(true))

    // Change info for the second search after preempt.
    lastWorker!.setEvalInfo(['info depth 12 score cp 99'])
    lastWorker!.goLatch = null

    const second = client.evalSearch({ fen: fenB })
    await vi.waitFor(() => expect(lastWorker!.commands).toContain('stop'))

    releaseEval()

    await expect(first).resolves.toBeNull()
    await expect(second).resolves.toEqual({ kind: 'cp', value: 99 })

    const goEvalCount = lastWorker!.commands.filter((c) => c === 'go movetime 500').length
    expect(goEvalCount).toBe(2)
  })

  it('playSearch preempts eval (stop then play, not early null)', async () => {
    let releaseEval!: () => void
    const evalLatch = new Promise<void>((resolve) => {
      releaseEval = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = evalLatch
        lastWorker.setEvalInfo(['info depth 10 score cp 50'])
        lastWorker.setBestmove('bestmove e7e5')
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

    const evalPromise = client.evalSearch({ fen })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go movetime'))).toBe(true))

    const playPromise = client.playSearch({ fen, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker!.commands).toContain('stop'))

    // Drain completes via stop's bestmove (none); releasing the latch must not
    // supply the play result.
    releaseEval()

    await expect(evalPromise).resolves.toBeNull()

    const stopIdx = lastWorker!.commands.indexOf('stop')
    const playGoIdx = lastWorker!.commands.findIndex(
      (c, i) => i > stopIdx && c.startsWith('go '),
    )
    expect(playGoIdx).toBeGreaterThan(stopIdx)

    const playMove = await playPromise
    expect(playMove).toEqual({ from: 'e7', to: 'e5' })
  })

  it('stop ack after eval drain does not satisfy playSearch', async () => {
    let releaseEval!: () => void
    const evalLatch = new Promise<void>((resolve) => {
      releaseEval = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = evalLatch
        lastWorker.setEvalInfo(['info depth 10 score cp 50'])
        // Planned eval/play go bestmove is a2a3 — must NOT be confused with stop ack.
        lastWorker.setBestmove('bestmove a2a3')
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

    const evalPromise = client.evalSearch({ fen })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go movetime'))).toBe(true))

    const playPromise = client.playSearch({ fen, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker!.commands).toContain('stop'))
    // Play must not resolve from stop's bestmove (none).
    await expect(evalPromise).resolves.toBeNull()

    releaseEval()
    lastWorker!.goLatch = null

    const playMove = await playPromise
    expect(playMove).toEqual({ from: 'a2', to: 'a3' })
    expect(playMove).not.toBeNull()
  })

  it('stop() while eval sends UCI stop and resolves null', async () => {
    let releaseGo!: () => void
    const latch = new Promise<void>((resolve) => {
      releaseGo = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = latch
        lastWorker.setEvalInfo(['info depth 6 score cp 20'])
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const evalPromise = client.evalSearch({ fen })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go movetime'))).toBe(true))

    client.stop()
    await expect(evalPromise).resolves.toBeNull()
    expect(lastWorker!.commands).toContain('stop')

    releaseGo()
  })

  it('stopAndDrain then evalSearch: stop before eval go; stop-ack does not resolve eval', async () => {
    let releasePlay!: () => void
    const playLatch = new Promise<void>((resolve) => {
      releasePlay = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = playLatch
        lastWorker.setBestmove('bestmove e7e5')
        lastWorker.setEvalInfo(['info depth 10 score cp 42'])
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

    const playPromise = client.playSearch({ fen, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    const drainPromise = client.stopAndDrain()
    await vi.waitFor(() => expect(lastWorker!.commands).toContain('stop'))
    await expect(playPromise).resolves.toBeNull()
    await drainPromise

    lastWorker!.goLatch = null
    const evalPromise = client.evalSearch({ fen })
    const score = await evalPromise

    expect(score).toEqual({ kind: 'cp', value: 42 })
    const stopIdx = lastWorker!.commands.indexOf('stop')
    const evalGoIdx = lastWorker!.commands.findIndex(
      (c, i) => i > stopIdx && c === 'go movetime 500',
    )
    expect(evalGoIdx).toBeGreaterThan(stopIdx)

    releasePlay()
  })

  it('stale bestmove while draining settles drain only; subsequent playSearch gets its own go', async () => {
    let releasePlay!: () => void
    const playLatch = new Promise<void>((resolve) => {
      releasePlay = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = playLatch
        lastWorker.suppressStopAck = true
        lastWorker.setBestmove('bestmove e7e5')
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fenA = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    const fenB = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1'

    const first = client.playSearch({ fen: fenA, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    const drain = client.stopAndDrain()
    await vi.waitFor(() => expect(lastWorker!.commands).toContain('stop'))
    await expect(first).resolves.toBeNull()

    lastWorker!.suppressStopAck = false
    lastWorker!.goLatch = null
    lastWorker!.setBestmove('bestmove d7d5')

    // New play waits on drain; orphan e7e5 (cancelled search) must only finish the drain.
    const second = client.playSearch({ fen: fenB, elo: 1200 })
    lastWorker!.emit('bestmove e7e5')
    await drain

    const move = await second
    expect(move).toEqual({ from: 'd7', to: 'd5' })
    expect(move).not.toEqual({ from: 'e7', to: 'e5' })

    const stopIdx = lastWorker!.commands.indexOf('stop')
    const secondGoIdx = lastWorker!.commands.findIndex(
      (c, i) => i > stopIdx && c.startsWith('go '),
    )
    expect(secondGoIdx).toBeGreaterThan(stopIdx)

    releasePlay()
  })

  it('stopAndDrain marks draining before clearing so search bestmove settles drain', async () => {
    let releasePlay!: () => void
    const playLatch = new Promise<void>((resolve) => {
      releasePlay = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = playLatch
        lastWorker.suppressStopAck = true
        lastWorker.setBestmove('bestmove e7e5')
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

    const playPromise = client.playSearch({ fen, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    const drain = client.stopAndDrain()
    await vi.waitFor(() => expect(lastWorker!.commands).toContain('stop'))
    await expect(playPromise).resolves.toBeNull()

    // Search bestmove (not a separate stop-ack) must finish the drain — proves
    // pendings were cleared only after job === draining.
    lastWorker!.emit('bestmove e7e5')
    await drain

    lastWorker!.goLatch = null
    lastWorker!.suppressStopAck = false
    lastWorker!.setEvalInfo(['info depth 8 score cp 10'])
    lastWorker!.setBestmove('bestmove (none)')
    const score = await client.evalSearch({ fen })
    expect(score).toEqual({ kind: 'cp', value: 10 })

    releasePlay()
  })

  it('playSearch after sync stop() awaits drain before starting a new go', async () => {
    let releasePlay!: () => void
    const playLatch = new Promise<void>((resolve) => {
      releasePlay = resolve
    })

    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.goLatch = playLatch
        lastWorker.setBestmove('bestmove e7e5')
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'

    const first = client.playSearch({ fen, elo: 1200 })
    await vi.waitFor(() => expect(lastWorker?.commands.some((c) => c.startsWith('go '))).toBe(true))

    client.stop()
    await expect(first).resolves.toBeNull()
    expect(lastWorker!.commands).toContain('stop')

    lastWorker!.goLatch = null
    lastWorker!.setBestmove('bestmove d7d5')
    const second = client.playSearch({ fen, elo: 1200 })

    const stopIdx = lastWorker!.commands.indexOf('stop')
    await second
    const playGoAfterStop = lastWorker!.commands.findIndex(
      (c, i) => i > stopIdx && c.startsWith('go '),
    )
    expect(playGoAfterStop).toBeGreaterThan(stopIdx)

    releasePlay()
  })

  it('does not surface play info scores as eval results', async () => {
    vi.stubGlobal(
      'Worker',
      vi.fn(function (this: unknown, url?: string | URL) {
        lastWorker = new FakeWorker(url)
        lastWorker.setEvalInfo(['info depth 8 score cp 12'])
        return lastWorker
      }),
    )
    setEngineClient(null)

    const client = getEngineClient()
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    await client.playSearch({ fen, elo: 500 })
    expect(lastWorker!.commands.some((c) => c.startsWith('go depth'))).toBe(true)

    const evalScore = await client.evalSearch({ fen })
    expect(evalScore).toEqual({ kind: 'cp', value: 12 })
  })
})

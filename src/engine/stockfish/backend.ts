import {
  MultipvAggregator,
  parseInfoScore,
  planEvalSearch,
  planMultipvSearch,
  type MultipvScoredLine,
  type UciScore,
} from '@/engine/uci'

/** Eval search budget (SPEC §5). Not strength-capped. */
export const EVAL_MOVETIME_MS = 500

export type StockfishTransport = {
  send(cmd: string): void
  /** Replace the line handler (boot vs steady-state). */
  setLineHandler(handler: (line: string) => void): void
  /** Run UCI handshake until readyok. */
  ready(): Promise<void>
  terminate?(): void
}

export type StockfishBackend = {
  multipvSearch(opts: {
    fen: string
    depth: number
    multipv: number
    searchmoves?: string[]
  }): Promise<MultipvScoredLine[]>
  evalSearch(opts: { fen: string }): Promise<UciScore | null>
  notifyNewGame(): void
  stop(): void
  stopAndDrain(): Promise<void>
}

type SearchJob = 'idle' | 'multipv' | 'eval' | 'draining'

type PendingMultipv = {
  seq: number
  aggregator: MultipvAggregator
  resolve: (lines: MultipvScoredLine[]) => void
}

type PendingEval = {
  seq: number
  resolve: (score: UciScore | null) => void
}

/**
 * Shared Stockfish job machine over a transport (Worker or Node npm engine).
 * Transport must already support send / setLineHandler / ready.
 */
export const createStockfishBackend = (transport: StockfishTransport): StockfishBackend => {
  let job: SearchJob = 'idle'
  let searchSeq = 0
  let ready: Promise<void> | null = null
  let pendingMultipv: PendingMultipv | null = null
  let pendingEval: PendingEval | null = null
  let latestEvalScore: UciScore | null = null
  let stopAck: { resolve: () => void } | null = null
  let drainPromise: Promise<void> | null = null

  const send = (cmd: string) => {
    transport.send(cmd)
  }

  const sendPlan = (plan: { setOptions: string[]; go: string }) => {
    for (const cmd of plan.setOptions) {
      send(cmd)
    }
  }

  const clearPendingsNull = () => {
    if (pendingMultipv) {
      const { resolve } = pendingMultipv
      pendingMultipv = null
      resolve([])
    }
    if (pendingEval) {
      const { resolve } = pendingEval
      pendingEval = null
      latestEvalScore = null
      resolve(null)
    }
  }

  const finishMultipv = (seq: number) => {
    const { aggregator, resolve } = pendingMultipv!
    pendingMultipv = null
    job = 'idle'
    resolve(seq === searchSeq ? aggregator.rankedLines() : [])
  }

  const finishEval = (seq: number) => {
    const { resolve } = pendingEval!
    pendingEval = null
    job = 'idle'
    resolve(seq === searchSeq ? latestEvalScore : null)
    latestEvalScore = null
  }

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    if (job === 'eval' && pendingEval) {
      const score = parseInfoScore(trimmed)
      if (score) {
        latestEvalScore = score
      }
    }

    if (job === 'multipv' && pendingMultipv) {
      pendingMultipv.aggregator.ingest(trimmed)
    }

    if (trimmed.startsWith('bestmove ')) {
      if (pendingEval && job === 'eval') {
        finishEval(pendingEval.seq)
        return
      }
      if (pendingMultipv && job === 'multipv') {
        finishMultipv(pendingMultipv.seq)
        return
      }
      if (job === 'draining' && stopAck) {
        const { resolve } = stopAck
        stopAck = null
        job = 'idle'
        resolve()
      }
    }
  }

  transport.setLineHandler(handleLine)

  const ensureReady = (): Promise<void> => {
    if (ready) {
      return ready
    }
    ready = transport.ready().catch((err) => {
      ready = null
      transport.terminate?.()
      throw err
    })
    return ready
  }

  const startDrain = (): Promise<void> => {
    if (drainPromise) {
      return drainPromise
    }
    if (job === 'idle') {
      return Promise.resolve()
    }
    if (job === 'draining') {
      return drainPromise ?? Promise.resolve()
    }

    job = 'draining'
    drainPromise = new Promise<void>((resolve) => {
      stopAck = { resolve }
    }).finally(() => {
      drainPromise = null
    })

    clearPendingsNull()
    send('stop')
    return drainPromise
  }

  const stopCurrentSearch = async (): Promise<void> => {
    if (job === 'idle') {
      return
    }
    await startDrain()
  }

  const stop = () => {
    searchSeq++
    if (job === 'multipv' || job === 'eval') {
      void startDrain()
      return
    }
    clearPendingsNull()
  }

  const stopAndDrain = async (): Promise<void> => {
    searchSeq++
    await stopCurrentSearch()
  }

  const notifyNewGame = () => {
    void ensureReady().then(() => {
      send('ucinewgame')
    })
  }

  const multipvSearch = async (opts: {
    fen: string
    depth: number
    multipv: number
    searchmoves?: string[]
  }): Promise<MultipvScoredLine[]> => {
    await ensureReady()

    if (job === 'eval' || job === 'draining') {
      await stopCurrentSearch()
    } else if (job === 'multipv') {
      return []
    }

    if (job !== 'idle') {
      return []
    }

    const seq = ++searchSeq
    job = 'multipv'
    const plan = planMultipvSearch({
      depth: opts.depth,
      multipv: opts.multipv,
      searchmoves: opts.searchmoves,
    })
    sendPlan(plan)
    send(`position fen ${opts.fen}`)

    return new Promise<MultipvScoredLine[]>((resolve) => {
      pendingMultipv = {
        seq,
        aggregator: new MultipvAggregator({ exactOnly: true }),
        resolve,
      }
      send(plan.go)
    })
  }

  const evalSearch = async (opts: { fen: string }): Promise<UciScore | null> => {
    await ensureReady()

    if (job === 'eval' || job === 'draining') {
      await stopCurrentSearch()
    } else if (job === 'multipv') {
      return null
    }

    if (job !== 'idle') {
      return null
    }

    const seq = ++searchSeq
    job = 'eval'
    latestEvalScore = null
    const plan = planEvalSearch(EVAL_MOVETIME_MS)
    sendPlan(plan)
    send(`position fen ${opts.fen}`)

    return new Promise<UciScore | null>((resolve) => {
      pendingEval = { seq, resolve }
      send(plan.go)
    })
  }

  return { multipvSearch, evalSearch, notifyNewGame, stop, stopAndDrain }
}

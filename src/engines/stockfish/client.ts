import stockfishJsUrl from 'stockfish/bin/stockfish-18-lite-single.js?url'
import stockfishWasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url'

import {
  MultipvAggregator,
  parseBestMoveLine,
  parseInfoScore,
  planEvalSearch,
  planFlairSearch,
  planPlaySearch,
  type MultipvScoredLine,
  type UciMove,
  type UciScore,
} from '@/engines/shared/uci'
import type { EvalEngine, PlayEngine } from '@/engines/types'
import { getStockfishConfig } from '@/engines/stockfish/configs'

/** Eval search budget (SPEC §5). Not strength-capped. */
export const EVAL_MOVETIME_MS = 500

export type StockfishInternal = {
  playSearchRaw(opts: { fen: string; skill: number; depth: number }): Promise<UciMove | null>
  flairSearchRaw(opts: {
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

type SearchJob = 'idle' | 'play' | 'flair' | 'eval' | 'draining'

type PendingPlay = {
  seq: number
  resolve: (move: UciMove | null) => void
}

type PendingFlair = {
  seq: number
  aggregator: MultipvAggregator
  resolve: (lines: MultipvScoredLine[]) => void
}

type PendingEval = {
  seq: number
  resolve: (score: UciScore | null) => void
}

type StopAck = {
  resolve: () => void
}

const createStockfishWorker = (): Worker => {
  const url = `${stockfishJsUrl}#${encodeURIComponent(stockfishWasmUrl)}`
  return new Worker(url)
}

export const createStockfishInternal = (): StockfishInternal => {
  let worker: Worker | null = null
  let ready: Promise<void> | null = null
  let job: SearchJob = 'idle'
  let searchSeq = 0
  let pendingPlay: PendingPlay | null = null
  let pendingFlair: PendingFlair | null = null
  let pendingEval: PendingEval | null = null
  let latestEvalScore: UciScore | null = null
  let stopAck: StopAck | null = null
  let drainPromise: Promise<void> | null = null

  const send = (cmd: string) => {
    worker?.postMessage(cmd)
  }

  const sendPlan = (plan: { setOptions: string[]; go: string }) => {
    for (const cmd of plan.setOptions) {
      send(cmd)
    }
  }

  const clearPendingsNull = () => {
    if (pendingPlay) {
      const { resolve } = pendingPlay
      pendingPlay = null
      resolve(null)
    }
    if (pendingFlair) {
      const { resolve } = pendingFlair
      pendingFlair = null
      resolve([])
    }
    if (pendingEval) {
      const { resolve } = pendingEval
      pendingEval = null
      latestEvalScore = null
      resolve(null)
    }
  }

  const finishPlay = (seq: number, bestmoveLine: string) => {
    const { resolve } = pendingPlay!
    pendingPlay = null
    job = 'idle'
    resolve(seq === searchSeq ? parseBestMoveLine(bestmoveLine) : null)
  }

  const finishFlair = (seq: number) => {
    const { aggregator, resolve } = pendingFlair!
    pendingFlair = null
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

    if (job === 'flair' && pendingFlair) {
      pendingFlair.aggregator.ingest(trimmed)
    }

    if (trimmed.startsWith('bestmove ')) {
      if (pendingEval && job === 'eval') {
        finishEval(pendingEval.seq)
        return
      }
      if (pendingPlay && job === 'play') {
        finishPlay(pendingPlay.seq, trimmed)
        return
      }
      if (pendingFlair && job === 'flair') {
        finishFlair(pendingFlair.seq)
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

  const onMessage = (ev: MessageEvent) => {
    const data = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
    for (const part of data.split('\n')) {
      handleLine(part)
    }
  }

  const ensureReady = (): Promise<void> => {
    if (ready) {
      return ready
    }

    ready = new Promise<void>((resolve, reject) => {
      const w = createStockfishWorker()
      worker = w

      let settled = false
      const finishOk = () => {
        if (settled) {
          return
        }
        settled = true
        w.onmessage = onMessage
        resolve()
      }
      const finishErr = (err: unknown) => {
        if (settled) {
          return
        }
        settled = true
        reject(err)
      }

      w.onmessage = (ev: MessageEvent) => {
        onMessage(ev)
        const data = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
        for (const part of data.split('\n')) {
          const line = part.trim()
          if (line === 'uciok') {
            send('isready')
          } else if (line === 'readyok') {
            finishOk()
          }
        }
      }
      w.onerror = (err) => {
        finishErr(err instanceof ErrorEvent ? (err.error ?? err.message) : err)
      }

      send('uci')
    }).catch((err) => {
      ready = null
      worker?.terminate()
      worker = null
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
    if (job === 'play' || job === 'flair' || job === 'eval') {
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

  const isBusyPlayLike = () => job === 'play' || job === 'flair'

  const playSearchRaw = async (opts: {
    fen: string
    skill: number
    depth: number
  }): Promise<UciMove | null> => {
    await ensureReady()

    if (job === 'eval' || job === 'draining') {
      await stopCurrentSearch()
    } else if (isBusyPlayLike()) {
      return null
    }

    if (job !== 'idle') {
      return null
    }

    const seq = ++searchSeq
    job = 'play'
    const plan = planPlaySearch({ skill: opts.skill, depth: opts.depth })
    sendPlan(plan)
    send(`position fen ${opts.fen}`)

    return new Promise<UciMove | null>((resolve) => {
      pendingPlay = { seq, resolve }
      send(plan.go)
    })
  }

  const flairSearchRaw = async (opts: {
    fen: string
    depth: number
    multipv: number
    searchmoves?: string[]
  }): Promise<MultipvScoredLine[]> => {
    await ensureReady()

    if (job === 'eval' || job === 'draining') {
      await stopCurrentSearch()
    } else if (isBusyPlayLike()) {
      return []
    }

    if (job !== 'idle') {
      return []
    }

    const seq = ++searchSeq
    job = 'flair'
    const plan = planFlairSearch({
      depth: opts.depth,
      multipv: opts.multipv,
      searchmoves: opts.searchmoves,
    })
    sendPlan(plan)
    send(`position fen ${opts.fen}`)

    return new Promise<MultipvScoredLine[]>((resolve) => {
      pendingFlair = {
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
    } else if (isBusyPlayLike()) {
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

  return { playSearchRaw, flairSearchRaw, evalSearch, notifyNewGame, stop, stopAndDrain }
}

let internal: StockfishInternal = createStockfishInternal()

export const getStockfishInternal = (): StockfishInternal => internal

/** Tests: replace the Stockfish singleton internals. Pass null to restore. */
export const setStockfishInternal = (next: StockfishInternal | null) => {
  internal = next ?? createStockfishInternal()
}

export const createStockfishPlayEngine = (): PlayEngine => ({
  id: 'stockfish',
  playSearch: async ({ fen, configId }) => {
    const cfg = getStockfishConfig(configId)
    return getStockfishInternal().playSearchRaw({
      fen,
      skill: cfg.playSkill,
      depth: cfg.playDepth,
    })
  },
  notifyNewGame: () => getStockfishInternal().notifyNewGame(),
  stop: () => getStockfishInternal().stop(),
  stopAndDrain: () => getStockfishInternal().stopAndDrain(),
})

export const createStockfishEvalEngine = (): EvalEngine => ({
  evalSearch: (opts) => getStockfishInternal().evalSearch(opts),
  stop: () => getStockfishInternal().stop(),
  stopAndDrain: () => getStockfishInternal().stopAndDrain(),
  notifyNewGame: () => getStockfishInternal().notifyNewGame(),
})

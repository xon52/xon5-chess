/**
 * Node Stockfish backend for Flair simulation (no browser Worker).
 * Uses the stockfish npm package's lite-single WASM build.
 */
import { createRequire } from 'node:module'

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
} from '../src/engines/shared/uci'
import type { StockfishInternal } from '../src/engines/stockfish/client'
import { EVAL_MOVETIME_MS } from '../src/engines/stockfish/client'

type NodeEngine = {
  listener: ((line: string) => void) | null
  sendCommand: (cmd: string) => void
  terminate?: () => void
}

type InitStockfish = (flavor?: string) => Promise<NodeEngine>

const require = createRequire(import.meta.url)
const initStockfish = require('stockfish') as InitStockfish

type SearchJob = 'idle' | 'play' | 'flair' | 'eval' | 'draining'

export const createNodeStockfishInternal = async (): Promise<StockfishInternal> => {
  const engine = await initStockfish('lite-single')

  let job: SearchJob = 'idle'
  let searchSeq = 0
  let ready: Promise<void> | null = null
  let pendingPlay: {
    seq: number
    resolve: (move: UciMove | null) => void
  } | null = null
  let pendingFlair: {
    seq: number
    aggregator: MultipvAggregator
    resolve: (lines: MultipvScoredLine[]) => void
  } | null = null
  let pendingEval: {
    seq: number
    resolve: (score: UciScore | null) => void
  } | null = null
  let latestEvalScore: UciScore | null = null
  let stopAck: { resolve: () => void } | null = null
  let drainPromise: Promise<void> | null = null

  const send = (cmd: string) => {
    engine.sendCommand(cmd)
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

  engine.listener = (raw) => {
    for (const part of String(raw).split('\n')) {
      handleLine(part)
    }
  }

  const ensureReady = (): Promise<void> => {
    if (ready) {
      return ready
    }
    ready = new Promise<void>((resolve, reject) => {
      let settled = false
      const finishOk = () => {
        if (settled) {
          return
        }
        settled = true
        resolve()
      }
      const onBoot = (raw: string) => {
        for (const part of String(raw).split('\n')) {
          const line = part.trim()
          handleLine(line)
          if (line === 'uciok') {
            send('isready')
          } else if (line === 'readyok') {
            engine.listener = (msg) => {
              for (const p of String(msg).split('\n')) {
                handleLine(p)
              }
            }
            finishOk()
          }
        }
      }
      engine.listener = onBoot
      try {
        send('uci')
      } catch (err) {
        if (!settled) {
          settled = true
          reject(err)
        }
      }
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

  await ensureReady()

  return {
    playSearchRaw,
    flairSearchRaw,
    evalSearch,
    notifyNewGame,
    stop,
    stopAndDrain,
  }
}

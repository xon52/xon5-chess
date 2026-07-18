import stockfishJsUrl from 'stockfish/bin/stockfish-18-lite-single.js?url'
import stockfishWasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url'

import {
  parseBestMoveLine,
  parseInfoScore,
  parseUciEloRange,
  parseUciOptionName,
  planEvalSearch,
  planPlaySearch,
  type UciEloRange,
  type UciMove,
  type UciScore,
} from '@/engine/uci'

/** Preferred play budget when UCI_LimitStrength is available (not reused for M8 eval).
 * Product choice for play; SPEC §5 only pins eval at `go movetime 500` (M8). */
export const PLAY_MOVETIME_MS = 1000

/** Eval search budget (SPEC §5). Not Elo-capped. */
export const EVAL_MOVETIME_MS = 500

export type EngineClient = {
  playSearch(opts: { fen: string; elo: number }): Promise<UciMove | null>
  evalSearch(opts: { fen: string }): Promise<UciScore | null>
  notifyNewGame(): void
  /** Fire-and-forget cancel; may leave the worker draining. Prefer stopAndDrain when resuming. */
  stop(): void
  /** Cancel any in-flight search and wait for the worker’s stop bestmove (SPEC §5). */
  stopAndDrain(): Promise<void>
}

type SearchJob = 'idle' | 'play' | 'eval' | 'draining'

type PendingPlay = {
  seq: number
  resolve: (move: UciMove | null) => void
}

type PendingEval = {
  seq: number
  resolve: (score: UciScore | null) => void
}

type StopAck = {
  resolve: () => void
}

const createStockfishWorker = (): Worker => {
  // Stockfish reads the wasm URL from location.hash (omit `,worker` = main UCI worker).
  const url = `${stockfishJsUrl}#${encodeURIComponent(stockfishWasmUrl)}`
  return new Worker(url)
}

const createDefaultClient = (): EngineClient => {
  let worker: Worker | null = null
  let ready: Promise<void> | null = null
  const optionNames = new Set<string>()
  let uciEloRange: UciEloRange | null = null
  let job: SearchJob = 'idle'
  let searchSeq = 0
  let pendingPlay: PendingPlay | null = null
  let pendingEval: PendingEval | null = null
  let latestEvalScore: UciScore | null = null
  let stopAck: StopAck | null = null
  /** In-flight drain after stop / preempt; searches must await this before a new go. */
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
    if (pendingEval) {
      const { resolve } = pendingEval
      pendingEval = null
      latestEvalScore = null
      resolve(null)
    }
  }

  const finishPlay = (seq: number, line: string) => {
    const { resolve } = pendingPlay!
    pendingPlay = null
    job = 'idle'
    resolve(seq === searchSeq ? parseBestMoveLine(line) : null)
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

    const option = parseUciOptionName(trimmed)
    if (option) {
      optionNames.add(option)
    }
    const eloRange = parseUciEloRange(trimmed)
    if (eloRange) {
      uciEloRange = eloRange
    }

    if (job === 'eval' && pendingEval) {
      const score = parseInfoScore(trimmed)
      if (score) {
        latestEvalScore = score
      }
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

  /**
   * Begin draining an in-flight play/eval search (SPEC §5 mutex).
   * Concurrent callers share the same drain promise.
   */
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

    // Mark draining before clearing pendings so a concurrent bestmove is discarded
    // into stopAck rather than dropped or applied as a normal finish.
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

  /**
   * Stop an in-flight eval or play search and wait for the worker’s stop
   * `bestmove` before allowing another search (SPEC §5 mutex).
   */
  const stopCurrentSearch = async (): Promise<void> => {
    if (job === 'idle') {
      return
    }
    await startDrain()
  }

  /** Fire-and-forget cancel; leaves the worker draining so a later search can await it. */
  const stop = () => {
    searchSeq++
    if (job === 'play' || job === 'eval') {
      void startDrain()
      return
    }
    clearPendingsNull()
  }

  /** Cancel any search and wait until the worker’s stop bestmove is drained. */
  const stopAndDrain = async (): Promise<void> => {
    searchSeq++
    // Do not clear pendings here — startDrain marks job draining first so a
    // concurrent bestmove settles the stop ack instead of being dropped (§5).
    await stopCurrentSearch()
  }

  const notifyNewGame = () => {
    void ensureReady().then(() => {
      send('ucinewgame')
    })
  }

  const playSearch = async (opts: {
    fen: string
    elo: number
  }): Promise<UciMove | null> => {
    await ensureReady()

    if (job === 'eval' || job === 'draining') {
      await stopCurrentSearch()
    } else if (job === 'play') {
      return null
    }

    // Re-check after await: another call may have started, or stop() may have run.
    if (job !== 'idle') {
      return null
    }

    const seq = ++searchSeq
    job = 'play'
    const plan = planPlaySearch(opts.elo, optionNames, uciEloRange, PLAY_MOVETIME_MS)
    sendPlan(plan)
    send(`position fen ${opts.fen}`)

    return new Promise<UciMove | null>((resolve) => {
      pendingPlay = { seq, resolve }
      send(plan.go)
    })
  }

  const evalSearch = async (opts: { fen: string }): Promise<UciScore | null> => {
    await ensureReady()

    if (job === 'eval' || job === 'draining') {
      await stopCurrentSearch()
    } else if (job === 'play') {
      // Do not cancel play for eval; the store holds win% while thinking.
      return null
    }

    // Re-check after await: another call may have started, or stop() may have run.
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

  return { playSearch, evalSearch, notifyNewGame, stop, stopAndDrain }
}

let client: EngineClient = createDefaultClient()

export const getEngineClient = (): EngineClient => client

/** Replace the engine client (tests). Pass `null` to restore the default Stockfish client. */
export const setEngineClient = (next: EngineClient | null) => {
  client = next ?? createDefaultClient()
}

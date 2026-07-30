import lozzaUrl from '@/engines/lozza/vendor/lozza.js?url'

import { parseBestMoveLine, type UciMove } from '@/engines/shared/uci'
import type { PlayEngine } from '@/engines/types'
import { getLozzaConfig } from '@/engines/lozza/configs'

/**
 * Lozza UCI play engine.
 * Lozza does not support `stop` — cancel recycles the Worker.
 */

type PendingPlay = {
  seq: number
  resolve: (move: UciMove | null) => void
}

export const createLozzaPlayEngine = (): PlayEngine => {
  let worker: Worker | null = null
  let ready: Promise<void> | null = null
  let searchSeq = 0
  let pending: PendingPlay | null = null
  let busy = false

  const send = (cmd: string) => {
    worker?.postMessage(cmd)
  }

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('bestmove ') || !pending) {
      return
    }
    const { seq, resolve } = pending
    pending = null
    busy = false
    resolve(seq === searchSeq ? parseBestMoveLine(trimmed) : null)
  }

  const onMessage = (ev: MessageEvent) => {
    const data = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
    for (const part of data.split('\n')) {
      handleLine(part)
    }
  }

  const recycleWorker = () => {
    worker?.terminate()
    worker = null
    ready = null
    if (pending) {
      const { resolve } = pending
      pending = null
      resolve(null)
    }
    busy = false
  }

  const ensureReady = (): Promise<void> => {
    if (ready) {
      return ready
    }
    ready = new Promise<void>((resolve, reject) => {
      const w = new Worker(lozzaUrl)
      worker = w
      let settled = false

      w.onmessage = (ev: MessageEvent) => {
        onMessage(ev)
        const data = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
        for (const part of data.split('\n')) {
          const line = part.trim()
          if (line === 'uciok') {
            send('isready')
          } else if (line === 'readyok') {
            if (!settled) {
              settled = true
              resolve()
            }
          }
        }
      }
      w.onerror = (err) => {
        if (!settled) {
          settled = true
          reject(err instanceof ErrorEvent ? (err.error ?? err.message) : err)
        }
      }
      send('uci')
    }).catch((err) => {
      recycleWorker()
      throw err
    })
    return ready
  }

  const stop = () => {
    searchSeq++
    recycleWorker()
  }

  const stopAndDrain = async (): Promise<void> => {
    stop()
  }

  return {
    id: 'lozza',
    playSearch: async ({ fen, configId }) => {
      await ensureReady()
      if (busy) {
        return null
      }
      const cfg = getLozzaConfig(configId)
      const seq = ++searchSeq
      busy = true
      send(`position fen ${fen}`)

      return new Promise<UciMove | null>((resolve) => {
        pending = { seq, resolve }
        send(cfg.go)
      })
    },
    notifyNewGame: () => {
      void ensureReady().then(() => {
        send('ucinewgame')
      })
    },
    stop,
    stopAndDrain,
  }
}

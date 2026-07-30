import stockfishJsUrl from 'stockfish/bin/stockfish-18-lite-single.js?url'
import stockfishWasmUrl from 'stockfish/bin/stockfish-18-lite-single.wasm?url'

import {
  createStockfishBackend,
  type StockfishBackend,
  type StockfishTransport,
} from '@/engine/stockfish/backend'

const createStockfishWorker = (): Worker => {
  const url = `${stockfishJsUrl}#${encodeURIComponent(stockfishWasmUrl)}`
  return new Worker(url)
}

/** Browser Worker transport for Stockfish WASM. */
export const createBrowserStockfishTransport = (): StockfishTransport => {
  let worker: Worker | null = null
  let lineHandler: ((line: string) => void) | null = null
  let readyPromise: Promise<void> | null = null

  const dispatch = (raw: string) => {
    for (const part of raw.split('\n')) {
      lineHandler?.(part)
    }
  }

  return {
    send(cmd: string) {
      worker?.postMessage(cmd)
    },
    setLineHandler(handler: (line: string) => void) {
      lineHandler = handler
    },
    ready(): Promise<void> {
      if (readyPromise) {
        return readyPromise
      }
      readyPromise = new Promise<void>((resolve, reject) => {
        const w = createStockfishWorker()
        worker = w

        let settled = false
        const finishOk = () => {
          if (settled) {
            return
          }
          settled = true
          w.onmessage = (ev: MessageEvent) => {
            const data = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
            dispatch(data)
          }
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
          const data = typeof ev.data === 'string' ? ev.data : String(ev.data ?? '')
          dispatch(data)
          for (const part of data.split('\n')) {
            const line = part.trim()
            if (line === 'uciok') {
              w.postMessage('isready')
            } else if (line === 'readyok') {
              finishOk()
            }
          }
        }
        w.onerror = (err) => {
          finishErr(err instanceof ErrorEvent ? (err.error ?? err.message) : err)
        }

        w.postMessage('uci')
      }).catch((err) => {
        readyPromise = null
        worker?.terminate()
        worker = null
        throw err
      })
      return readyPromise
    },
    terminate() {
      worker?.terminate()
      worker = null
      readyPromise = null
    },
  }
}

export const createBrowserStockfishBackend = (): StockfishBackend =>
  createStockfishBackend(createBrowserStockfishTransport())

let browserBackend: StockfishBackend | null = null

/** Lazy singleton — no Worker until first search. */
export const getBrowserStockfishBackend = (): StockfishBackend => {
  if (!browserBackend) {
    browserBackend = createBrowserStockfishBackend()
  }
  return browserBackend
}

/** Tests: replace or clear the browser backend singleton. */
export const setBrowserStockfishBackend = (next: StockfishBackend | null) => {
  browserBackend = next
}

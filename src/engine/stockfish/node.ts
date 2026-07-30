/**
 * Node Stockfish backend (no browser Worker).
 * Uses the stockfish npm package's lite-single WASM build.
 */
import { createRequire } from 'node:module'

import {
  createStockfishBackend,
  type StockfishBackend,
  type StockfishTransport,
} from '@/engine/stockfish/backend'

type NodeEngine = {
  listener: ((line: string) => void) | null
  sendCommand: (cmd: string) => void
  terminate?: () => void
}

type InitStockfish = (flavor?: string) => Promise<NodeEngine>

const require = createRequire(import.meta.url)
const initStockfish = require('stockfish') as InitStockfish

export const createNodeStockfishTransport = async (): Promise<StockfishTransport> => {
  const engine = await initStockfish('lite-single')
  let lineHandler: ((line: string) => void) | null = null
  let readyPromise: Promise<void> | null = null

  engine.listener = (raw) => {
    for (const part of String(raw).split('\n')) {
      lineHandler?.(part)
    }
  }

  return {
    send(cmd: string) {
      engine.sendCommand(cmd)
    },
    setLineHandler(handler: (line: string) => void) {
      lineHandler = handler
    },
    ready(): Promise<void> {
      if (readyPromise) {
        return readyPromise
      }
      readyPromise = new Promise<void>((resolve, reject) => {
        let settled = false
        const finishOk = () => {
          if (settled) {
            return
          }
          settled = true
          lineHandler = userHandler
          resolve()
        }
        const onBoot = (line: string) => {
          const trimmed = line.trim()
          if (trimmed === 'uciok') {
            engine.sendCommand('isready')
          } else if (trimmed === 'readyok') {
            finishOk()
          }
        }
        const userHandler = lineHandler
        lineHandler = (line) => {
          userHandler?.(line)
          onBoot(line)
        }
        try {
          engine.sendCommand('uci')
        } catch (err) {
          readyPromise = null
          if (!settled) {
            settled = true
            reject(err)
          }
        }
      })
      return readyPromise
    },
    terminate() {
      engine.terminate?.()
      readyPromise = null
    },
  }
}

export const createNodeStockfishBackend = async (): Promise<StockfishBackend> => {
  const transport = await createNodeStockfishTransport()
  const backend = createStockfishBackend(transport)
  await transport.ready()
  return backend
}

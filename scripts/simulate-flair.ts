/**
 * Manual Flair ladder simulation: adjacent levels play each other.
 *
 * Usage:
 *   pnpm simulate
 *   pnpm simulate -- --games=8
 *   pnpm simulate -- --games=4 --pairs=beginner:novice,club:solid
 *   pnpm simulate -- --max-upset=0.25
 *
 * Exits non-zero if any adjacent pair's lower-wins rate exceeds --max-upset
 * (default 0.35). Draws do not count as upsets.
 */
import { Chess, type Square } from 'chess.js'
import { afterAll, beforeAll, test } from 'vitest'

import { createFlairPlayEngine } from '../src/engines/flair/client'
import { FLAIR_CONFIGS } from '../src/engines/flair/configs'
import { resetFlairMatchLog } from '../src/engines/flair/log'
import type { UciMove } from '../src/engines/shared/uci'
import { setStockfishInternal } from '../src/engines/stockfish/client'
import type { PlayEngine } from '../src/engines/types'
import { createNodeStockfishInternal } from './nodeStockfishInternal'

type Result = '1-0' | '0-1' | '1/2-1/2'

type PairStats = {
  lowerId: string
  higherId: string
  games: number
  lowerWins: number
  higherWins: number
  draws: number
}

const MAX_PLIES = 400
const DEFAULT_GAMES = 4
const DEFAULT_MAX_UPSET = 0.35

const parseArg = (name: string): string | undefined => {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  if (hit) {
    return hit.slice(prefix.length)
  }
  const envKey = `FLAIR_SIM_${name.toUpperCase().replace(/-/g, '_')}`
  const fromEnv = process.env[envKey]
  return fromEnv && fromEnv.length > 0 ? fromEnv : undefined
}

const resolveOptions = () => {
  const gamesPerPair = Math.max(1, Number(parseArg('games') ?? DEFAULT_GAMES) || DEFAULT_GAMES)
  const maxUpset = Math.min(
    1,
    Math.max(0, Number(parseArg('max-upset') ?? DEFAULT_MAX_UPSET) || DEFAULT_MAX_UPSET),
  )
  return { gamesPerPair, maxUpset, pairs: parsePairs() }
}

const allAdjacentPairs = (): Array<{ lowerId: string; higherId: string }> => {
  const pairs: Array<{ lowerId: string; higherId: string }> = []
  for (let i = 0; i < FLAIR_CONFIGS.length - 1; i++) {
    pairs.push({
      lowerId: FLAIR_CONFIGS[i]!.id,
      higherId: FLAIR_CONFIGS[i + 1]!.id,
    })
  }
  return pairs
}

const parsePairs = (): Array<{ lowerId: string; higherId: string }> => {
  const raw = parseArg('pairs')
  if (!raw) {
    return allAdjacentPairs()
  }
  const ids = new Set(FLAIR_CONFIGS.map((c) => c.id))
  return raw.split(',').map((token) => {
    const [lowerId, higherId] = token.trim().split(':')
    if (!lowerId || !higherId || !ids.has(lowerId) || !ids.has(higherId)) {
      throw new Error(
        `Invalid --pairs entry "${token}". Use lower:higher ids from: ${[...ids].join(', ')}`,
      )
    }
    return { lowerId, higherId }
  })
}

const recentFromHistory = (chess: Chess): UciMove[] =>
  (
    chess.history({ verbose: true }) as Array<{
      from: Square
      to: Square
      promotion?: string
    }>
  )
    .slice(-6)
    .map((m) => ({
      from: m.from,
      to: m.to,
      promotion:
        m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
          ? m.promotion
          : undefined,
    }))

const playGame = async (
  engine: PlayEngine,
  whiteId: string,
  blackId: string,
): Promise<Result> => {
  const chess = new Chess()
  engine.notifyNewGame()
  resetFlairMatchLog()

  let plies = 0
  while (!chess.isGameOver() && plies < MAX_PLIES) {
    const configId = chess.turn() === 'w' ? whiteId : blackId
    const move = await engine.playSearch({
      fen: chess.fen(),
      configId,
      recentMoves: recentFromHistory(chess),
    })
    if (!move) {
      throw new Error(`Engine returned null at ply ${plies} (${configId}) fen=${chess.fen()}`)
    }
    const played = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    })
    if (!played) {
      throw new Error(
        `Illegal move ${move.from}${move.to}${move.promotion ?? ''} at ply ${plies}`,
      )
    }
    plies++
  }

  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? '0-1' : '1-0'
  }
  return '1/2-1/2'
}

const label = (id: string) => FLAIR_CONFIGS.find((c) => c.id === id)?.label ?? id

/** Progress goes to stdout so vitest reporters don't hide it. */
const say = (msg: string) => {
  process.stdout.write(`${msg}\n`)
}

let engine: PlayEngine
let restoreLog: (() => void) | undefined

beforeAll(async () => {
  const realLog = console.log.bind(console)
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[flair]')) {
      return
    }
    realLog(...args)
  }
  restoreLog = () => {
    console.log = realLog
  }

  const sf = await createNodeStockfishInternal()
  setStockfishInternal(sf)
  engine = createFlairPlayEngine()
}, 120_000)

afterAll(async () => {
  await engine?.stopAndDrain()
  setStockfishInternal(null)
  restoreLog?.()
})

test(
  'Flair adjacent levels: lower rarely beats higher',
  async () => {
    const { gamesPerPair, maxUpset, pairs } = resolveOptions()
    const started = Date.now()
    const allStats: PairStats[] = []

    say(
      `\nFlair ladder simulation — ${gamesPerPair} games/pair, max upset ${(maxUpset * 100).toFixed(0)}%\n`,
    )

    for (const { lowerId, higherId } of pairs) {
      const stats: PairStats = {
        lowerId,
        higherId,
        games: 0,
        lowerWins: 0,
        higherWins: 0,
        draws: 0,
      }

      for (let g = 0; g < gamesPerPair; g++) {
        // Alternate colors so lower isn't stuck as Black.
        const lowerIsWhite = g % 2 === 0
        const whiteId = lowerIsWhite ? lowerId : higherId
        const blackId = lowerIsWhite ? higherId : lowerId
        const result = await playGame(engine, whiteId, blackId)
        stats.games++

        const lowerWon =
          (lowerIsWhite && result === '1-0') || (!lowerIsWhite && result === '0-1')
        const higherWon =
          (lowerIsWhite && result === '0-1') || (!lowerIsWhite && result === '1-0')

        if (lowerWon) {
          stats.lowerWins++
        } else if (higherWon) {
          stats.higherWins++
        } else {
          stats.draws++
        }

        const upsetMark = lowerWon ? ' UPSET' : ''
        say(
          `  ${label(lowerId)} vs ${label(higherId)}  game ${g + 1}/${gamesPerPair}` +
            `  (${lowerIsWhite ? 'lower=White' : 'lower=Black'})  ${result}${upsetMark}`,
        )
      }

      allStats.push(stats)
      const upsetRate = stats.lowerWins / stats.games
      say(
        `  → ${label(lowerId)} wins ${stats.lowerWins}, ${label(higherId)} wins ${stats.higherWins},` +
          ` draws ${stats.draws}  (upset ${(upsetRate * 100).toFixed(0)}%)\n`,
      )
    }

    say('Summary')
    say('-------')
    let failed = false
    for (const s of allStats) {
      const upsetRate = s.lowerWins / s.games
      const ok = upsetRate <= maxUpset
      if (!ok) {
        failed = true
      }
      say(
        `${ok ? 'OK' : 'FAIL'}  ${label(s.lowerId)} < ${label(s.higherId)}` +
          `  lower ${s.lowerWins}/${s.games} (${(upsetRate * 100).toFixed(0)}%)` +
          `  higher ${s.higherWins}  draws ${s.draws}`,
      )
    }
    say(
      `\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s` +
        ` (threshold: lower wins ≤ ${(maxUpset * 100).toFixed(0)}% of games)\n`,
    )

    if (failed) {
      throw new Error(
        `One or more pairs exceeded max upset rate of ${(maxUpset * 100).toFixed(0)}%`,
      )
    }
  },
  // Full ladder can take a long time (each ply = 2 Stockfish MultiPV searches).
  6 * 60 * 60 * 1000,
)

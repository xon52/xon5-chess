import { Chess, type Square } from 'chess.js'

import type { PlayEngine } from '@/engines/types'
import type { UciMove } from '@/engines/shared/uci'
import { classifyLines } from '@/engines/flair/classify'
import { clampFlairMultipvCap, getFlairConfig } from '@/engines/flair/configs'
import {
  formatFlairMove,
  recordFlairMove,
} from '@/engines/flair/log'
import { buildCandidateMoves } from '@/engines/flair/recency'
import { sampleClassifiedMove } from '@/engines/flair/sample'
import { getStockfishInternal } from '@/engines/stockfish/client'

const toUciToken = (m: UciMove) => formatFlairMove(m)

const legalUciMoves = (fen: string): UciMove[] => {
  const chess = new Chess(fen)
  return (chess.moves({ verbose: true }) as Array<{
    from: Square
    to: Square
    promotion?: string
  }>).map((m) => ({
    from: m.from,
    to: m.to,
    promotion:
      m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
        ? m.promotion
        : undefined,
  }))
}

export const createFlairPlayEngine = (): PlayEngine => ({
  id: 'flair',
  playSearch: async ({ fen, configId, recentMoves = [] }) => {
    const cfg = getFlairConfig(configId)
    const legal = legalUciMoves(fen)
    if (legal.length === 0) {
      return null
    }
    if (legal.length === 1) {
      const move = legal[0]!
      recordFlairMove({
        side: 'computer',
        quality: 'only-legal',
        move: formatFlairMove(move),
      })
      return move
    }

    const cap = clampFlairMultipvCap(cfg.multipvCap, legal.length)
    const sf = getStockfishInternal()

    // 1) Shallow "what do I look at?" list (beginner tunnel: depth 1).
    const shallowLines = await sf.flairSearchRaw({
      fen,
      depth: cfg.candidateDepth,
      multipv: cap,
    })
    const shallowMoves = shallowLines.map((l) => l.move)
    const candidates = buildCandidateMoves(shallowMoves, legal, recentMoves, cap)
    const searchmoves = candidates.map(toUciToken)

    // 2) Deep CP scoring restricted to that candidate set.
    const scoredLines = await sf.flairSearchRaw({
      fen,
      depth: cfg.scoreDepth,
      multipv: Math.min(candidates.length, cap),
      searchmoves,
    })

    if (scoredLines.length === 0) {
      recordFlairMove({ side: 'computer', quality: 'empty-multipv', move: '' })
      return null
    }

    const classified = classifyLines(scoredLines)
    const sampled = sampleClassifiedMove(classified, cfg.weights, {
      recentMoves,
      recencyBias: cfg.recencyBias,
      preferBest: cfg.preferBest === true,
    })

    if (!sampled || !classified) {
      const fallback = scoredLines[0]!.move
      recordFlairMove({
        side: 'computer',
        quality: 'fallback',
        move: formatFlairMove(fallback),
      })
      return fallback
    }

    const chosenLine = classified.lines.find(
      (line) =>
        line.move.from === sampled.move.from &&
        line.move.to === sampled.move.to &&
        (line.move.promotion ?? undefined) === (sampled.move.promotion ?? undefined),
    )

    recordFlairMove({
      side: 'computer',
      quality: sampled.quality,
      move: formatFlairMove(sampled.move),
      swingCp: chosenLine?.swingCp,
      score: chosenLine?.score,
      inBucket: classified.buckets[sampled.quality].length,
    })

    return sampled.move
  },
  notifyNewGame: () => getStockfishInternal().notifyNewGame(),
  stop: () => getStockfishInternal().stop(),
  stopAndDrain: () => getStockfishInternal().stopAndDrain(),
})

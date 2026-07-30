import { Chess, type Square } from 'chess.js'

import { classifyLines } from '@/engine/flair/classify'
import { clampFlairMultipvCap, getFlairConfig } from '@/engine/flair/configs'
import { formatFlairMove, recordFlairMove } from '@/engine/flair/log'
import { buildCandidateMoves } from '@/engine/flair/recency'
import { sampleClassifiedMove } from '@/engine/flair/sample'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import type { UciMove } from '@/engine/uci'

const toUciToken = (m: UciMove) => formatFlairMove(m)

const legalUciMoves = (fen: string): UciMove[] => {
  const chess = new Chess(fen)
  return (
    chess.moves({ verbose: true }) as Array<{
      from: Square
      to: Square
      promotion?: string
    }>
  ).map((m) => ({
    from: m.from,
    to: m.to,
    promotion:
      m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
        ? m.promotion
        : undefined,
  }))
}

/** Flair play pipeline: candidates → deep score → classify → sample. */
export const flairPlaySearch = async (
  backend: StockfishBackend,
  opts: { fen: string; difficultyId: string; recentMoves?: UciMove[] },
): Promise<UciMove | null> => {
  const { fen, difficultyId, recentMoves = [] } = opts
  const cfg = getFlairConfig(difficultyId)
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

  const shallowLines = await backend.multipvSearch({
    fen,
    depth: cfg.candidateDepth,
    multipv: cap,
  })
  const shallowMoves = shallowLines.map((l) => l.move)
  const candidates = buildCandidateMoves(shallowMoves, legal, recentMoves, cap)
  const searchmoves = candidates.map(toUciToken)

  const scoredLines = await backend.multipvSearch({
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
}

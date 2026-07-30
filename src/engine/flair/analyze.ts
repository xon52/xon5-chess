import { Chess } from 'chess.js'

import { classifyLines } from '@/engine/flair/classify'
import { FLAIR_ANALYSIS } from '@/engine/flair/configs'
import { formatFlairMove, type FlairMoveLog } from '@/engine/flair/log'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import type { UciMove } from '@/engine/uci'

const sameMove = (a: UciMove, b: UciMove): boolean =>
  a.from === b.from && a.to === b.to && (a.promotion ?? undefined) === (b.promotion ?? undefined)

/** Classify a played move against full-board MultiPV on the pre-move FEN. */
export const analyzePlayedMove = async (
  backend: StockfishBackend,
  fenBefore: string,
  move: UciMove,
): Promise<Omit<FlairMoveLog, 'side'>> => {
  const chess = new Chess(fenBefore)
  const legalCount = chess.moves().length
  const formatted = formatFlairMove(move)

  if (legalCount === 0) {
    return { quality: 'unclassified', move: formatted }
  }
  if (legalCount === 1) {
    return { quality: 'only-legal', move: formatted }
  }

  const lines = await backend.multipvSearch({
    fen: fenBefore,
    depth: FLAIR_ANALYSIS.depth,
    multipv: Math.min(legalCount, FLAIR_ANALYSIS.multipvCap),
  })

  if (lines.length === 0) {
    return { quality: 'unclassified', move: formatted }
  }

  const classified = classifyLines(lines)
  const hit = classified?.lines.find((line) => sameMove(line.move, move))
  if (!hit || !classified) {
    return { quality: 'outside-multipv', move: formatted }
  }

  return {
    quality: hit.quality,
    move: formatted,
    swingCp: hit.swingCp,
    score: hit.score,
    inBucket: classified.buckets[hit.quality].length,
  }
}

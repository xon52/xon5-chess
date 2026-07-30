import { Chess } from 'chess.js'

import { classifyLines } from '@/engines/flair/classify'
import { FLAIR_ANALYSIS } from '@/engines/flair/configs'
import type { UciMove, UciScore } from '@/engines/shared/uci'
import { getStockfishInternal } from '@/engines/stockfish/client'

export type FlairSide = 'human' | 'computer'

export type FlairLogQuality =
  | MoveQuality
  | 'only-legal'
  | 'outside-multipv'
  | 'unclassified'
  | 'fallback'
  | 'empty-multipv'

export type FlairMoveLog = {
  side: FlairSide
  quality: FlairLogQuality
  move: string
  swingCp?: number
  score?: UciScore
  inBucket?: number
}

const SAMPLED_QUALITIES: MoveQuality[] = [
  'brilliant',
  'great',
  'good',
  'poor',
  'mistake',
  'blunder',
]

let entries: FlairMoveLog[] = []
let statsPrinted = false

export const formatFlairMove = (move: {
  from: string
  to: string
  promotion?: string
}) => `${move.from}${move.to}${move.promotion ?? ''}`

const sameMove = (a: UciMove, b: UciMove): boolean =>
  a.from === b.from && a.to === b.to && (a.promotion ?? undefined) === (b.promotion ?? undefined)

export const resetFlairMatchLog = () => {
  entries = []
  statsPrinted = false
}

export const getFlairMatchLog = (): readonly FlairMoveLog[] => entries

export const recordFlairMove = (entry: FlairMoveLog) => {
  entries.push(entry)
  console.log('[flair]', entry)
}

/** Classify a played move against MultiPV on the pre-move FEN. */
export const analyzePlayedMove = async (
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

  const lines = await getStockfishInternal().flairSearchRaw({
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

const phaseOf = (index: number, n: number): 'early' | 'mid' | 'end' => {
  if (n <= 1) {
    return 'early'
  }
  const earlyEnd = Math.ceil(n / 3)
  const midEnd = Math.ceil((2 * n) / 3)
  if (index < earlyEnd) {
    return 'early'
  }
  if (index < midEnd) {
    return 'mid'
  }
  return 'end'
}

const emptyCounts = (): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const q of SAMPLED_QUALITIES) {
    out[q] = 0
  }
  return out
}

const summarizeSide = (side: FlairSide) => {
  const sideEntries = entries.filter((e) => e.side === side)
  const sampled = sideEntries.filter((e) =>
    (SAMPLED_QUALITIES as string[]).includes(e.quality),
  )
  const n = sampled.length
  const byPhase: Record<'early' | 'mid' | 'end', Record<string, number>> = {
    early: emptyCounts(),
    mid: emptyCounts(),
    end: emptyCounts(),
  }
  const phaseTotals = { early: 0, mid: 0, end: 0 }

  sampled.forEach((entry, index) => {
    const phase = phaseOf(index, n)
    byPhase[phase][entry.quality] = (byPhase[phase][entry.quality] ?? 0) + 1
    phaseTotals[phase]++
  })

  const overall = emptyCounts()
  for (const entry of sampled) {
    overall[entry.quality] = (overall[entry.quality] ?? 0) + 1
  }

  const pct = (count: number, total: number) =>
    total === 0 ? '0%' : `${Math.round((100 * count) / total)}%`

  const formatPhase = (phase: 'early' | 'mid' | 'end') => {
    const total = phaseTotals[phase]
    const parts = SAMPLED_QUALITIES.filter((q) => (byPhase[phase][q] ?? 0) > 0).map(
      (q) => `${q} ${byPhase[phase][q]} (${pct(byPhase[phase][q]!, total)})`,
    )
    return { total, mix: parts.join(' · ') || '(none)' }
  }

  return {
    side,
    totalSampled: n,
    skipped: sideEntries.length - n,
    overall: Object.fromEntries(
      SAMPLED_QUALITIES.filter((q) => (overall[q] ?? 0) > 0).map((q) => [
        q,
        `${overall[q]} (${pct(overall[q]!, n)})`,
      ]),
    ),
    early: formatPhase('early'),
    mid: formatPhase('mid'),
    end: formatPhase('end'),
  }
}

/** Print early/mid/end quality counts for human and computer. Idempotent per match. */
export const printFlairMatchStats = () => {
  if (statsPrinted || entries.length === 0) {
    return
  }
  statsPrinted = true
  console.log('[flair] match stats', {
    human: summarizeSide('human'),
    computer: summarizeSide('computer'),
  })
}

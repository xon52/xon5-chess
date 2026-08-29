import { Chess, type Square } from 'chess.js'

import { OPENING_CATALOG, type OpeningEntry, type OpeningSide } from '@/engine/opening/catalog'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import { formatFlairMove } from '@/engine/flair/log'
import {
  parseUciMove,
  scoreToComparableCp,
  type UciMove,
  type UciScore,
} from '@/engine/uci'

/** Book move may lag Stockfish best by at most this many STM cp. */
export const BOOK_MAX_SWING_CP = -80

/** Depth for book safety MultiPV searches. */
export const BOOK_SAFETY_DEPTH = 8

/** Max openings (by rank) allowed per difficulty. 0 = book off. */
export const BOOK_TOP_N: Readonly<Record<string, number>> = {
  beginner: 0,
  novice: 5,
  club: 15,
  solid: 30,
  expert: 50,
  master: 50,
  grandmaster: 50,
}

export type BookReply = {
  move: UciMove
  rank: number
  eco: string
  name: string
}

export type OpeningMatch = {
  eco: string
  name: string
  side: OpeningSide
  /** How many plies matched (=== history length when in book). */
  ply: number
}

export type OpeningSideLabels = {
  white: string
  black: string
}

/** Board key: placement, side, castling, ep — ignore clocks. */
export const fenKey = (fen: string): string => fen.split(/\s+/).slice(0, 4).join(' ')

export const bookTopNForDifficulty = (difficultyId: string): number =>
  BOOK_TOP_N[difficultyId] ?? 0

export const formatOpeningLabel = (match: OpeningMatch | null): string =>
  match ? `${match.eco} ${match.name}` : ''

/** True when history is an exact prefix of the opening line (still in that book). */
const historyIsPrefixOf = (
  uciHistory: readonly string[],
  opening: OpeningEntry,
): boolean => {
  if (uciHistory.length === 0 || uciHistory.length > opening.uci.length) {
    return false
  }
  for (let i = 0; i < uciHistory.length; i++) {
    if (opening.uci[i] !== uciHistory[i]) {
      return false
    }
  }
  return true
}

const pickBestOpening = (
  openings: readonly OpeningEntry[],
  historyLen: number,
): OpeningMatch | null => {
  let best: OpeningMatch | null = null
  let bestRank = Number.POSITIVE_INFINITY
  let bestComplete = false

  for (const opening of openings) {
    if (historyLen < 2 && opening.uci.length > historyLen) {
      continue
    }
    const complete = historyLen >= opening.uci.length
    const deeper = historyLen > (best?.ply ?? 0)
    const sameDepth = historyLen === best?.ply
    const betterComplete = sameDepth && complete && !bestComplete
    const betterRank = sameDepth && complete === bestComplete && opening.rank < bestRank
    if (deeper || betterComplete || betterRank) {
      best = {
        eco: opening.eco,
        name: opening.name,
        side: opening.side,
        ply: historyLen,
      }
      bestRank = opening.rank
      bestComplete = complete
    }
  }
  return best
}

/**
 * Live book only: history must be a prefix of the opening.
 * Out of book → both empty. White / Black may each have a row.
 */
export const resolveOpeningSideLabels = (
  uciHistory: readonly string[],
  catalog: readonly OpeningEntry[] = OPENING_CATALOG,
): OpeningSideLabels => {
  if (uciHistory.length === 0) {
    return { white: '', black: '' }
  }

  const live = catalog.filter((o) => historyIsPrefixOf(uciHistory, o))
  if (live.length === 0) {
    return { white: '', black: '' }
  }

  return {
    white: formatOpeningLabel(
      pickBestOpening(
        live.filter((o) => o.side === 'w'),
        uciHistory.length,
      ),
    ),
    black: formatOpeningLabel(
      pickBestOpening(
        live.filter((o) => o.side === 'b'),
        uciHistory.length,
      ),
    ),
  }
}

/** Best single live match (either side). Null when out of book. */
export const resolveOpeningFromUci = (
  uciHistory: readonly string[],
  catalog: readonly OpeningEntry[] = OPENING_CATALOG,
): OpeningMatch | null => {
  const live = catalog.filter((o) => historyIsPrefixOf(uciHistory, o))
  return pickBestOpening(live, uciHistory.length)
}

const moveKey = (m: UciMove) => formatFlairMove(m)

const applyUci = (chess: Chess, token: string): boolean => {
  const parsed = parseUciMove(token)
  if (!parsed) {
    return false
  }
  try {
    chess.move({
      from: parsed.from as Square,
      to: parsed.to as Square,
      promotion: parsed.promotion,
    })
    return true
  } catch {
    return false
  }
}

type IndexEntry = BookReply

const buildIndex = (
  catalog: readonly OpeningEntry[],
): Map<string, IndexEntry[]> => {
  const index = new Map<string, IndexEntry[]>()

  for (const opening of catalog) {
    const chess = new Chess()
    for (const token of opening.uci) {
      const key = fenKey(chess.fen())
      const parsed = parseUciMove(token)
      if (!parsed) {
        break
      }
      const reply: IndexEntry = {
        move: parsed,
        rank: opening.rank,
        eco: opening.eco,
        name: opening.name,
      }
      const list = index.get(key) ?? []
      list.push(reply)
      index.set(key, list)
      if (!applyUci(chess, token)) {
        break
      }
    }
  }

  return index
}

const replyIndex = buildIndex(OPENING_CATALOG)

/**
 * Book continuations for this FEN, filtered by difficulty popularity cap.
 * Duplicate UCIs keep the best (lowest) rank.
 */
export const lookupBookReplies = (
  fen: string,
  difficultyId: string,
): BookReply[] => {
  const topN = bookTopNForDifficulty(difficultyId)
  if (topN <= 0) {
    return []
  }

  const raw = replyIndex.get(fenKey(fen)) ?? []
  const bestByMove = new Map<string, BookReply>()
  for (const reply of raw) {
    if (reply.rank > topN) {
      continue
    }
    const key = moveKey(reply.move)
    const prev = bestByMove.get(key)
    if (!prev || reply.rank < prev.rank) {
      bestByMove.set(key, reply)
    }
  }
  return [...bestByMove.values()]
}

export const isBookMoveSafe = (bookScore: UciScore, bestScore: UciScore): boolean => {
  if (bookScore.kind === 'mate' && bookScore.value < 0) {
    return false
  }
  const swing = scoreToComparableCp(bookScore) - scoreToComparableCp(bestScore)
  return swing >= BOOK_MAX_SWING_CP
}

/** Weighted sample: weight = 1/rank. */
export const sampleByPopularity = <T extends { rank: number }>(
  items: readonly T[],
  rng: () => number = Math.random,
): T | null => {
  if (items.length === 0) {
    return null
  }
  const weights = items.map((item) => 1 / item.rank)
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) {
      return items[i]!
    }
  }
  return items[items.length - 1]!
}

/**
 * Try a book move for this position. Returns null to fall through to Flair.
 */
export const tryBookMove = async (
  backend: StockfishBackend,
  opts: {
    fen: string
    difficultyId: string
    rng?: () => number
  },
): Promise<{ move: UciMove; reply: BookReply; swingCp: number; score: UciScore } | null> => {
  const replies = lookupBookReplies(opts.fen, opts.difficultyId)
  if (replies.length === 0) {
    return null
  }

  const bestLines = await backend.multipvSearch({
    fen: opts.fen,
    depth: BOOK_SAFETY_DEPTH,
    multipv: 1,
  })
  const best = bestLines[0]
  if (!best) {
    return null
  }

  const searchmoves = replies.map((r) => moveKey(r.move))
  const bookLines = await backend.multipvSearch({
    fen: opts.fen,
    depth: BOOK_SAFETY_DEPTH,
    multipv: Math.min(replies.length, searchmoves.length),
    searchmoves,
  })

  const scoreByMove = new Map<string, UciScore>()
  for (const line of bookLines) {
    scoreByMove.set(moveKey(line.move), line.score)
  }

  const safe: Array<BookReply & { score: UciScore; swingCp: number }> = []
  for (const reply of replies) {
    const score = scoreByMove.get(moveKey(reply.move))
    if (!score) {
      continue
    }
    if (!isBookMoveSafe(score, best.score)) {
      continue
    }
    safe.push({
      ...reply,
      score,
      swingCp: scoreToComparableCp(score) - scoreToComparableCp(best.score),
    })
  }

  const picked = sampleByPopularity(safe, opts.rng)
  if (!picked) {
    return null
  }

  return {
    move: picked.move,
    reply: picked,
    swingCp: picked.swingCp,
    score: picked.score,
  }
}

/** UCI tokens from verbose chess.js history. */
export const uciHistoryFromVerbose = (
  history: Array<{ from: string; to: string; promotion?: string }>,
): string[] =>
  history.map((m) => {
    const promo =
      m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
        ? m.promotion
        : ''
    return `${m.from}${m.to}${promo}`
  })

import { describe, expect, it, vi } from 'vitest'
import { Chess } from 'chess.js'

import { OPENING_CATALOG } from '@/engine/opening/catalog'
import {
  BOOK_MAX_SWING_CP,
  bookTopNForDifficulty,
  fenKey,
  formatOpeningLabel,
  isBookMoveSafe,
  lookupBookReplies,
  resolveOpeningFromUci,
  resolveOpeningSideLabels,
  sampleByPopularity,
  tryBookMove,
  uciHistoryFromVerbose,
} from '@/engine/opening/book'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import { parseUciMove } from '@/engine/uci'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('opening catalog', () => {
  it('has ~50 legal main lines from startpos', () => {
    expect(OPENING_CATALOG.length).toBeGreaterThanOrEqual(45)
    expect(OPENING_CATALOG.length).toBeLessThanOrEqual(55)
    for (const opening of OPENING_CATALOG) {
      const chess = new Chess()
      for (const token of opening.uci) {
        const parsed = parseUciMove(token)
        expect(parsed, `${opening.name}: ${token}`).not.toBeNull()
        expect(() =>
          chess.move({
            from: parsed!.from,
            to: parsed!.to,
            promotion: parsed!.promotion,
          }),
        ).not.toThrow()
      }
    }
  })
})

describe('opening book lookup', () => {
  it('returns startpos replies for expert and none for beginner', () => {
    expect(lookupBookReplies(START_FEN, 'beginner')).toEqual([])
    expect(bookTopNForDifficulty('beginner')).toBe(0)

    const expert = lookupBookReplies(START_FEN, 'expert')
    const moves = new Set(expert.map((r) => `${r.move.from}${r.move.to}`))
    expect(moves.has('e2e4')).toBe(true)
    expect(moves.has('d2d4')).toBe(true)
    expect(moves.has('c2c4')).toBe(true)
  })

  it('limits novice to top-5 ranks only', () => {
    const novice = lookupBookReplies(START_FEN, 'novice')
    expect(novice.length).toBeGreaterThan(0)
    expect(novice.every((r) => r.rank <= 5)).toBe(true)
    // Grob (rank 30) / English (14) must not appear for novice
    expect(novice.some((r) => r.move.from === 'g2' && r.move.to === 'g4')).toBe(false)
    expect(novice.some((r) => r.move.from === 'c2' && r.move.to === 'c4')).toBe(false)
  })

  it('returns empty for out-of-book fen', () => {
    const chess = new Chess()
    chess.move('a3')
    chess.move('a6')
    expect(lookupBookReplies(chess.fen(), 'expert')).toEqual([])
  })

  it('fenKey ignores half/fullmove clocks', () => {
    expect(fenKey(START_FEN)).toBe(fenKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 5 9'))
  })
})

describe('opening name resolution', () => {
  it('names Italian / Sicilian prefixes', () => {
    const italian = resolveOpeningFromUci(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'])
    expect(italian?.name).toBe('Italian Game')
    expect(formatOpeningLabel(italian)).toBe('C50 Italian Game')

    const sicilian = resolveOpeningFromUci(['e2e4', 'c7c5'])
    expect(sicilian?.name).toBe('Sicilian Defense')
  })

  it('does not name after a single shared e4 ply', () => {
    expect(resolveOpeningFromUci(['e2e4'])).toBeNull()
  })

  it('names one-move openings immediately', () => {
    expect(resolveOpeningFromUci(['c2c4'])?.name).toBe('English Opening')
  })

  it('clears when leaving theory', () => {
    expect(resolveOpeningFromUci(['e2e4', 'c7c5', 'a2a3'])).toBeNull()
  })

  it('returns null at ply 0', () => {
    expect(resolveOpeningFromUci([])).toBeNull()
    expect(formatOpeningLabel(null)).toBe('')
  })

  it('can show White and Black rows independently', () => {
    const both = resolveOpeningSideLabels(['d2d4', 'd7d5', 'c2c4'])
    expect(both.white).toBe("D06 Queen's Gambit")
    expect(both.black).toBe("D30 Queen's Gambit Declined")

    const blackOnly = resolveOpeningSideLabels(['e2e4', 'c7c5'])
    // White may still be on Alapin; Black is in the Sicilian.
    expect(blackOnly.white).toBe('B22 Sicilian, Alapin')
    expect(blackOnly.black).toBe('B20 Sicilian Defense')

    const out = resolveOpeningSideLabels(['e2e4', 'c7c5', 'a2a3'])
    expect(out).toEqual({ white: '', black: '' })
  })

  it('uciHistoryFromVerbose matches catalog tokens', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('c5')
    const uci = uciHistoryFromVerbose(
      chess.history({ verbose: true }) as Array<{
        from: string
        to: string
        promotion?: string
      }>,
    )
    expect(uci).toEqual(['e2e4', 'c7c5'])
  })
})

describe('opening book safety', () => {
  it('rejects moves worse than BOOK_MAX_SWING_CP vs best', () => {
    expect(
      isBookMoveSafe({ kind: 'cp', value: -200 }, { kind: 'cp', value: 40 }),
    ).toBe(false)
    expect(
      isBookMoveSafe({ kind: 'cp', value: 0 }, { kind: 'cp', value: 40 }),
    ).toBe(true)
    expect(BOOK_MAX_SWING_CP).toBe(-80)
  })

  it('rejects losing mates', () => {
    expect(
      isBookMoveSafe({ kind: 'mate', value: -2 }, { kind: 'cp', value: 0 }),
    ).toBe(false)
  })

  it('tryBookMove accepts safe book and skips unsafe', async () => {
    const multipvSearch = vi
      .fn()
      // best unrestricted
      .mockResolvedValueOnce([
        { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
      ])
      // book candidates scored
      .mockResolvedValueOnce([
        { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
        { move: { from: 'd2', to: 'd4' }, score: { kind: 'cp', value: -200 } },
      ])

    const backend: StockfishBackend = {
      multipvSearch,
      evalSearch: vi.fn(async () => null),
      notifyNewGame: vi.fn(),
      stop: vi.fn(),
      stopAndDrain: vi.fn(async () => {}),
    }

    const hit = await tryBookMove(backend, {
      fen: START_FEN,
      difficultyId: 'novice',
      rng: () => 0,
    })
    expect(hit).not.toBeNull()
    expect(hit!.move).toEqual({ from: 'e2', to: 'e4' })
    expect(hit!.swingCp).toBe(0)
  })

  it('tryBookMove returns null when all book moves are unsafe', async () => {
    const multipvSearch = vi
      .fn()
      .mockResolvedValueOnce([
        { move: { from: 'a2', to: 'a3' }, score: { kind: 'cp', value: 50 } },
      ])
      .mockResolvedValueOnce([
        { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: -200 } },
        { move: { from: 'd2', to: 'd4' }, score: { kind: 'cp', value: -250 } },
      ])

    const backend: StockfishBackend = {
      multipvSearch,
      evalSearch: vi.fn(async () => null),
      notifyNewGame: vi.fn(),
      stop: vi.fn(),
      stopAndDrain: vi.fn(async () => {}),
    }

    const hit = await tryBookMove(backend, {
      fen: START_FEN,
      difficultyId: 'novice',
    })
    expect(hit).toBeNull()
  })

  it('sampleByPopularity prefers lower ranks', () => {
    const items = [
      { rank: 1, id: 'a' },
      { rank: 100, id: 'b' },
    ]
    // roll near 0 → first weight (1/1 dominates)
    expect(sampleByPopularity(items, () => 0.01)?.id).toBe('a')
  })
})

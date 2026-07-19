import { describe, expect, it } from 'vitest'

import {
  fenSideToMove,
  MultipvAggregator,
  parseBestMoveLine,
  parseInfoScore,
  parseMultipvInfoLine,
  parseUciMove,
  planEvalSearch,
  planPlaySearch,
  scoreToWhiteBlackPct,
} from '@/engine/uci'

const DEFAULT_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('uci helpers', () => {
  it('parses quiet and promotion UCI moves', () => {
    expect(parseUciMove('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined })
    expect(parseUciMove('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' })
    expect(parseUciMove('a2a1N')).toEqual({ from: 'a2', to: 'a1', promotion: 'n' })
    expect(parseUciMove('not-a-move')).toBeNull()
  })

  it('parses bestmove lines including ponder', () => {
    expect(parseBestMoveLine('bestmove e2e4')).toEqual({
      from: 'e2',
      to: 'e4',
      promotion: undefined,
    })
    expect(parseBestMoveLine('bestmove e7e8q ponder e2e4')).toEqual({
      from: 'e7',
      to: 'e8',
      promotion: 'q',
    })
    expect(parseBestMoveLine('bestmove (none)')).toBeNull()
    expect(parseBestMoveLine('info depth 12')).toBeNull()
  })

  it('plans skill+depth play searches and raises depth so Skill Level can fire', () => {
    expect(planPlaySearch({ skill: 0, depth: 1 })).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value false',
        'setoption name Skill Level value 0',
        'setoption name MultiPV value 1',
      ],
      go: 'go depth 1',
    })
    expect(planPlaySearch({ skill: 9, depth: 6 })).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value false',
        'setoption name Skill Level value 9',
        'setoption name MultiPV value 1',
      ],
      go: 'go depth 10',
    })
  })

  it('plans uncapped eval search with MultiPV 1', () => {
    expect(planEvalSearch(500)).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value false',
        'setoption name Skill Level value 20',
        'setoption name MultiPV value 1',
      ],
      go: 'go movetime 500',
    })
  })

  it('reads side to move from FEN', () => {
    expect(
      fenSideToMove('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'),
    ).toBe('b')
    expect(fenSideToMove(DEFAULT_POSITION)).toBe('w')
  })

  it('parses multipv info lines and aggregates by max depth', () => {
    expect(
      parseMultipvInfoLine('info depth 4 multipv 2 score cp 10 pv d2d4 e7e5'),
    ).toEqual({
      multipv: 2,
      depth: 4,
      move: { from: 'd2', to: 'd4', promotion: undefined },
    })
    expect(parseMultipvInfoLine('info depth 4 score cp 10 pv e2e4')).toBeNull()

    const agg = new MultipvAggregator()
    agg.ingest('info depth 3 multipv 1 score cp 20 pv e2e4')
    agg.ingest('info depth 3 multipv 2 score cp 10 pv d2d4')
    agg.ingest('info depth 4 multipv 1 score cp 25 pv e2e4')
    // Stale multipv 2 at depth 3 must not appear; missing #2 at depth 4 → prefix of 1.
    expect(agg.rankedMoves()).toEqual([{ from: 'e2', to: 'e4', promotion: undefined }])
    agg.ingest('info depth 4 multipv 2 score cp 12 pv d2d4')
    expect(agg.rankedMoves()).toEqual([
      { from: 'e2', to: 'e4', promotion: undefined },
      { from: 'd2', to: 'd4', promotion: undefined },
    ])
    // Gap at multipv 2 stops contiguous prefix.
    const gappy = new MultipvAggregator()
    gappy.ingest('info depth 5 multipv 1 score cp 1 pv e2e4')
    gappy.ingest('info depth 5 multipv 3 score cp 0 pv c2c4')
    expect(gappy.rankedMoves()).toEqual([{ from: 'e2', to: 'e4', promotion: undefined }])
  })

  it('parses info score lines including bound tags', () => {
    expect(parseInfoScore('info depth 12 score cp 35 nodes 1')).toEqual({
      kind: 'cp',
      value: 35,
    })
    expect(parseInfoScore('info depth 20 score mate -3 pv e2e4')).toEqual({
      kind: 'mate',
      value: -3,
    })
    expect(parseInfoScore('info depth 1 score cp 0 lowerbound')).toEqual({
      kind: 'cp',
      value: 0,
    })
    expect(parseInfoScore('info depth 1 score cp 200 upperbound')).toEqual({
      kind: 'cp',
      value: 200,
    })
    expect(parseInfoScore('bestmove e2e4')).toBeNull()
  })

  it('converts cp and mate scores to White/Black % (K=400)', () => {
    expect(scoreToWhiteBlackPct({ kind: 'cp', value: 0 }, 'w')).toEqual({
      white: 50,
      black: 50,
    })

    expect(scoreToWhiteBlackPct({ kind: 'cp', value: 400 }, 'w')).toEqual({
      white: 91,
      black: 9,
    })
    expect(scoreToWhiteBlackPct({ kind: 'cp', value: -400 }, 'w')).toEqual({
      white: 9,
      black: 91,
    })

    expect(scoreToWhiteBlackPct({ kind: 'cp', value: 400 }, 'b')).toEqual({
      white: 9,
      black: 91,
    })

    expect(scoreToWhiteBlackPct({ kind: 'mate', value: 2 }, 'w')).toEqual({
      white: 100,
      black: 0,
    })
    expect(scoreToWhiteBlackPct({ kind: 'mate', value: -1 }, 'w')).toEqual({
      white: 0,
      black: 100,
    })
    expect(scoreToWhiteBlackPct({ kind: 'mate', value: 1 }, 'b')).toEqual({
      white: 0,
      black: 100,
    })

    const pct = scoreToWhiteBlackPct({ kind: 'cp', value: 120 }, 'w')
    expect(pct.black).toBe(100 - pct.white)
  })
})

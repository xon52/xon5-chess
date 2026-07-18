import { describe, expect, it } from 'vitest'

import {
  canUseLimitStrengthElo,
  eloToSkillDepth,
  fenSideToMove,
  parseBestMoveLine,
  parseInfoScore,
  parseUciEloRange,
  parseUciMove,
  parseUciOptionName,
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

  it('parses UCI option names', () => {
    expect(parseUciOptionName('option name UCI_Elo type spin default 1320 min 1320 max 3190')).toBe(
      'UCI_Elo',
    )
    expect(parseUciOptionName('option name Skill Level type spin default 20 min 0 max 20')).toBe(
      'Skill Level',
    )
    expect(parseUciOptionName('uciok')).toBeNull()
  })

  it('parses UCI_Elo min/max spin range', () => {
    expect(
      parseUciEloRange('option name UCI_Elo type spin default 1320 min 1320 max 3190'),
    ).toEqual({ min: 1320, max: 3190 })
    expect(parseUciEloRange('option name Skill Level type spin default 20 min 0 max 20')).toBeNull()
    expect(parseUciEloRange('option name UCI_Elo type spin default 1320')).toBeNull()
  })

  it('maps Elo to Skill + depth fallback table values', () => {
    expect(eloToSkillDepth(500)).toEqual({ skill: 0, depth: 6 })
    expect(eloToSkillDepth(1200)).toEqual({ skill: 9, depth: 11 })
    expect(eloToSkillDepth(2000)).toEqual({ skill: 20, depth: 16 })
  })

  it('decides LimitStrength vs Skill+depth from options and Elo range', () => {
    const options = new Set(['UCI_LimitStrength', 'UCI_Elo', 'Skill Level'])
    const range = { min: 1320, max: 3190 }

    expect(canUseLimitStrengthElo(1500, options, range)).toBe(true)
    expect(canUseLimitStrengthElo(1200, options, range)).toBe(false)
    expect(canUseLimitStrengthElo(500, options, range)).toBe(false)
    expect(canUseLimitStrengthElo(1500, new Set(['Skill Level']), range)).toBe(false)
    expect(canUseLimitStrengthElo(1500, options, null)).toBe(true)
  })

  it('plans LimitStrength play when Elo is in range', () => {
    const options = new Set(['UCI_LimitStrength', 'UCI_Elo'])
    expect(planPlaySearch(1500, options, { min: 1320, max: 3190 }, 1000)).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value true',
        'setoption name UCI_Elo value 1500',
      ],
      go: 'go movetime 1000',
    })
  })

  it('plans Skill+depth play below UCI_Elo min (including default 1200)', () => {
    const options = new Set(['UCI_LimitStrength', 'UCI_Elo', 'Skill Level'])
    const range = { min: 1320, max: 3190 }

    expect(planPlaySearch(1200, options, range, 1000)).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value false',
        'setoption name Skill Level value 9',
      ],
      go: 'go depth 11',
    })
    expect(planPlaySearch(500, options, range, 1000)).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value false',
        'setoption name Skill Level value 0',
      ],
      go: 'go depth 6',
    })
  })

  it('plans uncapped eval search', () => {
    expect(planEvalSearch(500)).toEqual({
      setOptions: [
        'setoption name UCI_LimitStrength value false',
        'setoption name Skill Level value 20',
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

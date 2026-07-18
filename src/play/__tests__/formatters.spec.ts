import { describe, expect, it } from 'vitest'

import { buildEvalChartPaths } from '@/play/evalChart'
import {
  formatEvalDisplay,
  formatFigurineSan,
  formatStatusText,
  plyColor,
} from '@/play/formatters'

describe('formatEvalDisplay', () => {
  it('shows 50 / 50 when White % is unknown', () => {
    expect(formatEvalDisplay(null, null)).toBe('50 / 50')
  })

  it('formats White / Black percentages', () => {
    expect(formatEvalDisplay(62, 38)).toBe('62 / 38')
  })
})

describe('formatFigurineSan', () => {
  it('uses white/black glyphs for piece moves', () => {
    expect(formatFigurineSan('Nf3', 'w')).toBe('♘f3')
    expect(formatFigurineSan('Nf6', 'b')).toBe('♞f6')
    expect(formatFigurineSan('Nxf3+', 'w')).toBe('♘xf3+')
  })

  it('prefixes pawn moves with a pawn glyph', () => {
    expect(formatFigurineSan('e4', 'w')).toBe('♙e4')
    expect(formatFigurineSan('e5', 'b')).toBe('♟e5')
    expect(formatFigurineSan('exd5', 'w')).toBe('♙exd5')
  })

  it('keeps castling as O-O / O-O-O', () => {
    expect(formatFigurineSan('O-O', 'w')).toBe('O-O')
    expect(formatFigurineSan('O-O-O+', 'b')).toBe('O-O-O+')
  })

  it('figurines promotion pieces', () => {
    expect(formatFigurineSan('a8=Q', 'w')).toBe('♙a8=♕')
    expect(formatFigurineSan('a1=N', 'b')).toBe('♟a1=♞')
  })
})

describe('plyColor', () => {
  it('maps even plies to White and odd to Black', () => {
    expect(plyColor(0)).toBe('w')
    expect(plyColor(1)).toBe('b')
  })
})

describe('buildEvalChartPaths', () => {
  it('returns empty paths for an empty series', () => {
    const paths = buildEvalChartPaths([], { width: 100, height: 40 })
    expect(paths.green).toBe('')
    expect(paths.red).toBe('')
  })

  it('marks White-favored segments green and Black-favored red', () => {
    const paths = buildEvalChartPaths(
      [
        { ply: 2, white: 60 },
        { ply: 4, white: 70 },
        { ply: 6, white: 40 },
        { ply: 8, white: 30 },
      ],
      { width: 100, height: 40, padX: 0, padY: 0 },
    )
    expect(paths.green).toContain('M')
    expect(paths.red).toContain('M')
    expect(paths.green.length).toBeGreaterThan(0)
    expect(paths.red.length).toBeGreaterThan(0)
  })

  it('starts a fresh subpath when the favored side resumes after a cross', () => {
    const paths = buildEvalChartPaths(
      [
        { ply: 2, white: 70 },
        { ply: 4, white: 30 },
        { ply: 6, white: 70 },
      ],
      { width: 100, height: 40, padX: 0, padY: 0 },
    )
    expect(paths.green.match(/M/g)?.length).toBe(2)
    expect(paths.red.match(/M/g)?.length).toBe(1)
  })
})

describe('formatStatusText', () => {
  it('shows ready state before a game starts', () => {
    expect(
      formatStatusText({
        gameStarted: false,
        status: { kind: 'playing' },
        turn: 'w',
      }),
    ).toBe('Ready to play')
  })

  it('maps checkmate winners', () => {
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'checkmate', winner: 'w' },
        turn: 'b',
      }),
    ).toBe('Checkmate — White wins')
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'checkmate', winner: 'b' },
        turn: 'w',
      }),
    ).toBe('Checkmate — Black wins')
  })

  it('maps draw reasons', () => {
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'draw', reason: 'stalemate' },
        turn: 'b',
      }),
    ).toBe('Draw — stalemate')
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'draw', reason: 'insufficient' },
        turn: 'w',
      }),
    ).toBe('Draw — insufficient material')
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'draw', reason: 'fifty-move' },
        turn: 'w',
      }),
    ).toBe('Draw — fifty-move rule')
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'draw', reason: 'threefold' },
        turn: 'w',
      }),
    ).toBe('Draw — threefold repetition')
  })

  it('shows side to move while playing', () => {
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'playing' },
        turn: 'w',
      }),
    ).toBe('White to move')
    expect(
      formatStatusText({
        gameStarted: true,
        status: { kind: 'playing' },
        turn: 'b',
      }),
    ).toBe('Black to move')
  })
})

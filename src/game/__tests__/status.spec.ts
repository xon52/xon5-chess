import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'

import { deriveStatus } from '@/game/status'

const load = (fen: string) => {
  const chess = new Chess()
  chess.load(fen)
  return chess
}

describe('deriveStatus', () => {
  it('returns playing for the starting position', () => {
    expect(deriveStatus(new Chess())).toEqual({ kind: 'playing' })
  })

  it('detects checkmate', () => {
    // Fool's mate position: Black just delivered Qh4#.
    const chess = load('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
    expect(deriveStatus(chess)).toEqual({ kind: 'checkmate', winner: 'b' })
  })

  it('detects stalemate', () => {
    expect(deriveStatus(load('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({
      kind: 'draw',
      reason: 'stalemate',
    })
  })

  it('detects insufficient material', () => {
    expect(deriveStatus(load('8/8/8/8/8/8/4k3/4K3 w - - 0 1'))).toEqual({
      kind: 'draw',
      reason: 'insufficient',
    })
  })

  it('detects fifty-move draw', () => {
    expect(
      deriveStatus(load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 100 1')),
    ).toEqual({ kind: 'draw', reason: 'fifty-move' })
  })

  it('detects threefold repetition', () => {
    const chess = new Chess()
    const cycle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'] as const
    for (const san of [...cycle, ...cycle]) {
      chess.move(san)
    }
    expect(deriveStatus(chess)).toEqual({ kind: 'draw', reason: 'threefold' })
  })
})

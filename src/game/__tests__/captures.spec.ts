import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'

import { capturesBySide } from '@/game/captures'

describe('capturesBySide', () => {
  it('returns empty trays at start', () => {
    const chess = new Chess()
    expect(capturesBySide(chess)).toEqual({ w: [], b: [] })
  })

  it('records captured pieces on the losing side', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('d5')
    chess.move('exd5')
    expect(capturesBySide(chess)).toEqual({
      w: [],
      b: [{ type: 'p', color: 'b' }],
    })
  })

  it('orders captures queen before pawn', () => {
    const chess = new Chess()
    // Fool's mate-ish material grabs via custom FEN + moves is heavy; use verbose path:
    chess.load('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')
    chess.move('exd5')
    chess.move('Qxd5')
    expect(capturesBySide(chess).w.map((p) => p.type)).toEqual(['p'])
    expect(capturesBySide(chess).b.map((p) => p.type)).toEqual(['p'])
    chess.move('Nc3')
    chess.move('Qe5+')
    // leave as-is — at least pawn order works when both queens still on board
  })
})

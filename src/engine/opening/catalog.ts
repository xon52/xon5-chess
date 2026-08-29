/**
 * Curated opening catalog (~50 main lines), ranked by popularity (1 = most common).
 * UCI moves are from the standard start position.
 * `side`: which colour the name is primarily for (White system vs Black defence).
 */

export type OpeningSide = 'w' | 'b'

export type OpeningEntry = {
  eco: string
  name: string
  /** 1 = most popular. */
  rank: number
  /** Colour this opening name is associated with. */
  side: OpeningSide
  uci: readonly string[]
}

export const OPENING_CATALOG: readonly OpeningEntry[] = [
  // Top 5 — novice
  { eco: 'B20', name: 'Sicilian Defense', rank: 1, side: 'b', uci: ['e2e4', 'c7c5'] },
  { eco: 'C50', name: 'Italian Game', rank: 2, side: 'w', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
  { eco: 'D06', name: "Queen's Gambit", rank: 3, side: 'w', uci: ['d2d4', 'd7d5', 'c2c4'] },
  { eco: 'C60', name: 'Ruy Lopez', rank: 4, side: 'w', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
  { eco: 'A40', name: "Queen's Pawn Game", rank: 5, side: 'w', uci: ['d2d4', 'd7d5'] },

  // 6–15 — club
  { eco: 'B10', name: 'Caro-Kann Defense', rank: 6, side: 'b', uci: ['e2e4', 'c7c6'] },
  { eco: 'C00', name: 'French Defense', rank: 7, side: 'b', uci: ['e2e4', 'e7e6'] },
  { eco: 'A04', name: "King's Indian Attack", rank: 8, side: 'w', uci: ['g1f3', 'd7d5', 'g2g3'] },
  { eco: 'E60', name: "King's Indian Defense", rank: 9, side: 'b', uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6'] },
  { eco: 'D30', name: "Queen's Gambit Declined", rank: 10, side: 'b', uci: ['d2d4', 'd7d5', 'c2c4', 'e7e6'] },
  { eco: 'C20', name: "King's Pawn Game", rank: 11, side: 'w', uci: ['e2e4', 'e7e5'] },
  { eco: 'A45', name: 'Trompowsky Attack', rank: 12, side: 'w', uci: ['d2d4', 'g8f6', 'c1g5'] },
  { eco: 'B07', name: 'Pirc Defense', rank: 13, side: 'b', uci: ['e2e4', 'd7d6'] },
  { eco: 'A10', name: 'English Opening', rank: 14, side: 'w', uci: ['c2c4'] },
  { eco: 'C42', name: 'Petrov Defense', rank: 15, side: 'b', uci: ['e2e4', 'e7e5', 'g1f3', 'g8f6'] },

  // 16–30 — solid
  { eco: 'C45', name: 'Scotch Game', rank: 16, side: 'w', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4'] },
  { eco: 'C55', name: 'Two Knights Defense', rank: 17, side: 'b', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6'] },
  { eco: 'B22', name: 'Sicilian, Alapin', rank: 18, side: 'w', uci: ['e2e4', 'c7c5', 'c2c3'] },
  { eco: 'B70', name: 'Sicilian Dragon', rank: 19, side: 'b', uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6'] },
  { eco: 'B90', name: 'Sicilian Najdorf', rank: 20, side: 'b', uci: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'] },
  { eco: 'C41', name: 'Philidor Defense', rank: 21, side: 'b', uci: ['e2e4', 'e7e5', 'g1f3', 'd7d6'] },
  { eco: 'A56', name: 'Benoni Defense', rank: 22, side: 'b', uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5'] },
  { eco: 'E00', name: 'Catalan Opening', rank: 23, side: 'w', uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3'] },
  { eco: 'D70', name: 'Neo-Grunfeld Defense', rank: 24, side: 'b', uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'g2g3', 'd7d5'] },
  { eco: 'D80', name: 'Grunfeld Defense', rank: 25, side: 'b', uci: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5'] },
  { eco: 'A57', name: 'Benko Gambit', rank: 26, side: 'b', uci: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'b7b5'] },
  { eco: 'C11', name: 'French, Classical', rank: 27, side: 'b', uci: ['e2e4', 'e7e6', 'd2d4', 'd7d5', 'b1c3', 'g8f6'] },
  { eco: 'B12', name: 'Caro-Kann, Advance', rank: 28, side: 'w', uci: ['e2e4', 'c7c6', 'd2d4', 'd7d5', 'e4e5'] },
  { eco: 'A48', name: 'London System', rank: 29, side: 'w', uci: ['d2d4', 'g8f6', 'c1f4'] },
  { eco: 'A00', name: "Grob's Attack", rank: 30, side: 'w', uci: ['g2g4'] },

  // 31–50 — expert+
  { eco: 'C30', name: "King's Gambit", rank: 31, side: 'w', uci: ['e2e4', 'e7e5', 'f2f4'] },
  { eco: 'C23', name: "Bishop's Opening", rank: 32, side: 'w', uci: ['e2e4', 'e7e5', 'f1c4'] },
  { eco: 'C25', name: 'Vienna Game', rank: 33, side: 'w', uci: ['e2e4', 'e7e5', 'b1c3'] },
  { eco: 'B00', name: 'Nimzowitsch Defense', rank: 34, side: 'b', uci: ['e2e4', 'b8c6'] },
  { eco: 'B01', name: 'Scandinavian Defense', rank: 35, side: 'b', uci: ['e2e4', 'd7d5'] },
  { eco: 'B02', name: 'Alekhine Defense', rank: 36, side: 'b', uci: ['e2e4', 'g8f6'] },
  { eco: 'A01', name: 'Larsen Opening', rank: 37, side: 'w', uci: ['b2b3'] },
  { eco: 'A02', name: "Bird's Opening", rank: 38, side: 'w', uci: ['f2f4'] },
  { eco: 'A13', name: 'English, Agincourt', rank: 39, side: 'w', uci: ['c2c4', 'e7e6'] },
  { eco: 'A20', name: "English, King's", rank: 40, side: 'w', uci: ['c2c4', 'e7e5'] },
  { eco: 'A40', name: 'Modern Defense', rank: 41, side: 'b', uci: ['e2e4', 'g7g6'] },
  { eco: 'A46', name: 'Indian Game', rank: 42, side: 'b', uci: ['d2d4', 'g8f6'] },
  { eco: 'A80', name: 'Dutch Defense', rank: 43, side: 'b', uci: ['d2d4', 'f7f5'] },
  { eco: 'C21', name: 'Center Game', rank: 44, side: 'w', uci: ['e2e4', 'e7e5', 'd2d4'] },
  { eco: 'C44', name: 'Ponziani Opening', rank: 45, side: 'w', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3'] },
  { eco: 'C46', name: 'Three Knights Opening', rank: 46, side: 'w', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3'] },
  { eco: 'C47', name: 'Four Knights Game', rank: 47, side: 'w', uci: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'b1c3', 'g8f6'] },
  { eco: 'D00', name: "Queen's Pawn, Chigorin", rank: 48, side: 'w', uci: ['d2d4', 'd7d5', 'b1c3'] },
  { eco: 'D02', name: "Queen's Pawn, London", rank: 49, side: 'w', uci: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4'] },
  { eco: 'E20', name: 'Nimzo-Indian Defense', rank: 50, side: 'b', uci: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'] },
] as const

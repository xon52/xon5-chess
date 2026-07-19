export type UciMove = {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export type UciScore = {
  kind: 'cp' | 'mate'
  value: number
}

/** Ordered setoption / go commands for one search. */
export type UciCommandPlan = {
  setOptions: string[]
  go: string
}

/** Logistic constant for win% (SPEC §7). */
export const EVAL_LOGISTIC_K = 400

/** Parse a UCI move token like `e2e4` or `e7e8q`. */
export const parseUciMove = (token: string): UciMove | null => {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(token.trim())
  if (!m) {
    return null
  }
  const promotion = m[3]?.toLowerCase()
  return {
    from: m[1]!.toLowerCase(),
    to: m[2]!.toLowerCase(),
    promotion:
      promotion === 'q' || promotion === 'r' || promotion === 'b' || promotion === 'n'
        ? promotion
        : undefined,
  }
}

/** Parse a `bestmove e2e4` / `bestmove e7e8q ponder e2e4` line. */
export const parseBestMoveLine = (line: string): UciMove | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('bestmove ')) {
    return null
  }
  const rest = trimmed.slice('bestmove '.length).trim()
  if (!rest || rest === '(none)') {
    return null
  }
  const token = rest.split(/\s+/)[0]!
  return parseUciMove(token)
}

/** Side to move from a FEN string (field 2). */
export const fenSideToMove = (fen: string): 'w' | 'b' => {
  const stm = fen.trim().split(/\s+/)[1]
  return stm === 'b' ? 'b' : 'w'
}

/**
 * Parse UCI `info` score lines (`score cp N` / `score mate N`), including
 * bound-tagged lines. Returns null for non-score info.
 */
export const parseInfoScore = (line: string): UciScore | null => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('info ')) {
    return null
  }
  const m = /\bscore (cp|mate) (-?\d+)\b/.exec(trimmed)
  if (!m) {
    return null
  }
  return { kind: m[1] as 'cp' | 'mate', value: Number(m[2]) }
}

/**
 * Convert a UCI score (side-to-move perspective) to whole-number White/Black %.
 * SPEC §7: normalize to White, K = 400, mates → 100/0 or 0/100.
 */
export const scoreToWhiteBlackPct = (
  score: UciScore,
  sideToMove: 'w' | 'b',
): { white: number; black: number } => {
  if (score.kind === 'mate') {
    const stmWins = score.value > 0
    const whiteWins = sideToMove === 'w' ? stmWins : !stmWins
    return whiteWins ? { white: 100, black: 0 } : { white: 0, black: 100 }
  }

  let cp = score.value
  if (sideToMove === 'b') {
    cp = -cp
  }

  const pWhite = 1 / (1 + 10 ** (-cp / EVAL_LOGISTIC_K))
  const white = Math.round(100 * pWhite)
  return { white, black: 100 - white }
}

/** Build setoption + go for a skill+depth play search (product difficulty bands). */
export const planPlaySearch = (opts: { skill: number; depth: number }): UciCommandPlan => {
  // Stockfish applies Skill Level at depth === 1 + skill; search must reach that ply.
  const depth = Math.max(opts.depth, opts.skill + 1)
  return {
    setOptions: [
      'setoption name UCI_LimitStrength value false',
      `setoption name Skill Level value ${opts.skill}`,
    ],
    go: `go depth ${depth}`,
  }
}

/** Build setoption + go for an uncapped eval search (SPEC §5 / §7). */
export const planEvalSearch = (evalMovetimeMs: number): UciCommandPlan => ({
  setOptions: [
    'setoption name UCI_LimitStrength value false',
    'setoption name Skill Level value 20',
  ],
  go: `go movetime ${evalMovetimeMs}`,
})

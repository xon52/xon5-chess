export type UciMove = {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export type SkillDepthCaps = {
  skill: number
  depth: number
}

export type UciScore = {
  kind: 'cp' | 'mate'
  value: number
}

export type UciEloRange = { min: number; max: number }

/** Ordered setoption / go commands for one search. */
export type UciCommandPlan = {
  setOptions: string[]
  go: string
}

/** Logistic constant for win% (SPEC §7). */
export const EVAL_LOGISTIC_K = 400

/**
 * Fallback when UCI_LimitStrength / UCI_Elo are unavailable, or Elo is outside
 * the engine’s UCI_Elo spin range (SPEC §6; includes default 1200 on Stockfish 18
 * lite-single, which advertises UCI_Elo min 1320).
 *
 * | Elo  | Skill | Depth |
 * | ---- | ----- | ----- |
 * | 500  | 0     | 6     |
 * | 1200 | 9     | 11    |
 * | 2000 | 20    | 16    |
 *
 * skill = round((elo - 500) / 1500 * 20) → 0–20
 * depth = round(6 + (elo - 500) / 1500 * 10) → 6–16
 */
export const eloToSkillDepth = (elo: number): SkillDepthCaps => {
  const t = (elo - 500) / 1500
  return {
    skill: Math.round(t * 20),
    depth: Math.round(6 + t * 10),
  }
}

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

/** Collect option names advertised after `uci` / before `uciok`. */
export const parseUciOptionName = (line: string): string | null => {
  const m = /^option name (.+) type /.exec(line.trim())
  return m?.[1] ?? null
}

/** Parse `option name UCI_Elo … min N max M` spin bounds. */
export const parseUciEloRange = (line: string): UciEloRange | null => {
  if (!line.includes('option name UCI_Elo ')) {
    return null
  }
  const min = / min (-?\d+)/.exec(line)
  const max = / max (-?\d+)/.exec(line)
  if (!min || !max) {
    return null
  }
  return { min: Number(min[1]), max: Number(max[1]) }
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

/**
 * True when play can use native UCI_LimitStrength / UCI_Elo.
 * UI Elo is 500–2000 step 50. Stockfish 18 lite-single advertises UCI_Elo min
 * 1320, so Elo below the spin min uses Skill+depth (§6 fallback).
 */
export const canUseLimitStrengthElo = (
  elo: number,
  optionNames: ReadonlySet<string>,
  uciEloRange: UciEloRange | null,
): boolean => {
  if (!optionNames.has('UCI_LimitStrength') || !optionNames.has('UCI_Elo')) {
    return false
  }
  if (uciEloRange && (elo < uciEloRange.min || elo > uciEloRange.max)) {
    return false
  }
  return true
}

/** Build setoption + go for an Elo-capped play search (SPEC §6). */
export const planPlaySearch = (
  elo: number,
  optionNames: ReadonlySet<string>,
  uciEloRange: UciEloRange | null,
  playMovetimeMs: number,
): UciCommandPlan => {
  if (canUseLimitStrengthElo(elo, optionNames, uciEloRange)) {
    return {
      setOptions: [
        'setoption name UCI_LimitStrength value true',
        `setoption name UCI_Elo value ${elo}`,
      ],
      go: `go movetime ${playMovetimeMs}`,
    }
  }
  // SPEC §6 fallback (also used when Elo is outside the engine’s UCI_Elo spin range).
  const { skill, depth } = eloToSkillDepth(elo)
  return {
    setOptions: [
      'setoption name UCI_LimitStrength value false',
      `setoption name Skill Level value ${skill}`,
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

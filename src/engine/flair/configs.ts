/**
 * Flair play-strength configs: quality-bucket weights + MultiPV search knobs.
 */

export type MoveQuality =
  | 'brilliant'
  | 'great'
  | 'good'
  | 'poor'
  | 'mistake'
  | 'blunder'

export type FlairQualityWeights = Record<MoveQuality, number>

export type FlairClassifyThresholds = {
  /** Swing >= 0 and gap to 2nd best >= this → brilliant. */
  brilliantGapCp: number
  /** Swing >= this (and not brilliant) → great. */
  greatMinSwing: number
  /** Swing >= this (below great) → good. */
  goodMinSwing: number
  /** Swing >= this (below good) → poor. */
  poorMinSwing: number
  /** Swing >= this (below poor) → mistake; else blunder. */
  mistakeMinSwing: number
}

export type FlairConfig = {
  id: string
  label: string
  weights: FlairQualityWeights
  /** Shallow depth for the "moves I bother to look at" list. */
  candidateDepth: number
  /** Deep depth for CP / swing scoring of those candidates. */
  scoreDepth: number
  /** 0 = whole-board uniform in-bucket; 1 = strong tunnel vision / takebacks. */
  recencyBias: number
  multipvCap: number
  /**
   * When true, pick highest swingCp inside the rolled bucket (near Stockfish).
   * When false, brilliant/great/good/poor use recency/uniform sampling.
   */
  preferBest?: boolean
}

export const FLAIR_THRESHOLDS: FlairClassifyThresholds = {
  brilliantGapCp: 150,
  greatMinSwing: -25,
  goodMinSwing: -55,
  poorMinSwing: -90,
  /** Only truly collapsing swings count as blunders. */
  mistakeMinSwing: -300,
}

/**
 * Floor for MultiPV candidate count. Below this, takebacks + a shallow line can
 * still leave almost no real choice (and cap 1 was effectively "hope the forced
 * line isn't a bad recapture"). 3 leaves room for engine lines + a takeback.
 */
export const FLAIR_MIN_MULTIPV_CAP = 3

/**
 * Beginner → GM ramp:
 * - Lower levels: poor/mistake + high recency + shallow candidates
 * - Upper levels: great-dominant; brilliant weight ramps up so unique shots
 *   are often taken when the bucket is non-empty (waterfall sampling)
 * - Missing higher tiers fall to the next best — not flat-renormalize into trash
 * scoreDepth stays high so labels stay honest.
 */
export const FLAIR_CONFIGS: readonly FlairConfig[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    // Soften vs Novice: less great/good, more poor/mistake/blunder.
    weights: { brilliant: 0, great: 3, good: 16, poor: 55, mistake: 22, blunder: 4 },
    candidateDepth: 1,
    scoreDepth: 8,
    recencyBias: 0.95,
    multipvCap: 6,
  },
  {
    id: 'novice',
    label: 'Novice',
    weights: { brilliant: 2, great: 12, good: 35, poor: 34, mistake: 14, blunder: 2 },
    candidateDepth: 1,
    scoreDepth: 8,
    recencyBias: 0.65,
    multipvCap: 6,
  },
  {
    id: 'club',
    label: 'Club',
    weights: { brilliant: 5, great: 28, good: 40, poor: 17, mistake: 9, blunder: 1 },
    candidateDepth: 2,
    scoreDepth: 8,
    recencyBias: 0.35,
    multipvCap: 6,
  },
  {
    id: 'solid',
    label: 'Solid',
    // Mild soften vs Club→Expert (halfway from the stronger Solid).
    weights: { brilliant: 10, great: 45, good: 32, poor: 8, mistake: 5, blunder: 0 },
    candidateDepth: 4,
    scoreDepth: 8,
    recencyBias: 0.17,
    multipvCap: 5,
  },
  {
    id: 'expert',
    label: 'Expert',
    // Keep enough punch to beat Solid; Master/GM separate via weights (same MultiPV floor).
    weights: { brilliant: 28, great: 58, good: 12, poor: 2, mistake: 0, blunder: 0 },
    candidateDepth: 8,
    scoreDepth: 8,
    recencyBias: 0,
    multipvCap: 3,
  },
  {
    id: 'master',
    label: 'Master',
    // Deeper than Expert; still samples among near-equal greats (not pure engine).
    weights: { brilliant: 50, great: 48, good: 2, poor: 0, mistake: 0, blunder: 0 },
    candidateDepth: 10,
    scoreDepth: 12,
    recencyBias: 0,
    multipvCap: 3,
  },
  {
    id: 'grandmaster',
    label: 'Grandmaster',
    // Near full Stockfish: deep search + always best-in-bucket among MultiPV≥3.
    weights: { brilliant: 90, great: 10, good: 0, poor: 0, mistake: 0, blunder: 0 },
    candidateDepth: 12,
    scoreDepth: 14,
    recencyBias: 0,
    multipvCap: 3,
    preferBest: true,
  },
] as const

export const DEFAULT_FLAIR_CONFIG_ID = 'beginner'

/** Defaults used by human-move analysis (full-board deep MultiPV). */
export const FLAIR_ANALYSIS = {
  depth: 8,
  multipvCap: 6,
} as const

const byId = new Map(FLAIR_CONFIGS.map((c) => [c.id, c]))

export const clampFlairMultipvCap = (cap: number, legalCount: number): number =>
  Math.min(legalCount, Math.max(FLAIR_MIN_MULTIPV_CAP, Math.floor(cap)))

export const getFlairConfig = (id: string): FlairConfig =>
  byId.get(id) ?? FLAIR_CONFIGS[0]!

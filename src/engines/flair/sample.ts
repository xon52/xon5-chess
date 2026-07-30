import type { UciMove } from '@/engines/shared/uci'
import type { ClassifiedLine, ClassifyResult } from '@/engines/flair/classify'
import type { FlairQualityWeights, MoveQuality } from '@/engines/flair/configs'
import { pickWithRecency } from '@/engines/flair/recency'

export type SampleResult = {
  move: UciMove
  quality: MoveQuality
  /** True when a higher tier was empty and mass fell to a lower one. */
  renormalized: boolean
  activeWeights: Partial<FlairQualityWeights>
  fallback: boolean
}

export type SampleOptions = {
  recentMoves?: readonly UciMove[]
  recencyBias?: number
  /** Prefer highest swingCp in-bucket (near-engine); skips recency/uniform. */
  preferBest?: boolean
  rng?: () => number
}

const QUALITIES: MoveQuality[] = ['brilliant', 'great', 'good', 'poor', 'mistake', 'blunder']

const bestBySwing = (bucket: ClassifiedLine[]): ClassifiedLine =>
  bucket.reduce((best, line) => (line.swingCp > best.swingCp ? line : best))

/**
 * Mistake/blunder: least-bad (avoid random suicide).
 * preferBest: always best swing in-bucket (GM ≈ Stockfish).
 * Else: recency-weighted when bias > 0 (tunnel vision / takebacks).
 */
const pickFromBucket = (
  quality: MoveQuality,
  bucket: ClassifiedLine[],
  recentMoves: readonly UciMove[],
  recencyBias: number,
  preferBest: boolean,
  rng: () => number,
) => {
  if (preferBest || quality === 'mistake' || quality === 'blunder') {
    return bestBySwing(bucket)
  }
  return pickWithRecency(bucket, recentMoves, recencyBias, rng)
}

/**
 * Waterfall sample: walk brilliant → … → blunder among non-empty buckets.
 * At each tier, P(stop) = w[q] / sum(w[r] for remaining non-empty tiers).
 * Missing brilliant does not dump into mistake — mass falls to the next best tier.
 */
export const sampleClassifiedMove = (
  classified: ClassifyResult | null,
  weights: FlairQualityWeights,
  opts: SampleOptions = {},
): SampleResult | null => {
  const rng = opts.rng ?? Math.random
  const recentMoves = opts.recentMoves ?? []
  const recencyBias = opts.recencyBias ?? 0
  const preferBest = opts.preferBest === true

  if (!classified || classified.lines.length === 0) {
    return null
  }

  const available: MoveQuality[] = []
  const activeWeights: Partial<FlairQualityWeights> = {}
  for (const q of QUALITIES) {
    const w = Math.max(0, weights[q])
    if (w <= 0 || classified.buckets[q].length === 0) {
      continue
    }
    available.push(q)
    activeWeights[q] = w
  }

  if (available.length === 0) {
    const root = classified.lines[0]!
    return {
      move: root.move,
      quality: root.quality,
      renormalized: false,
      activeWeights: {},
      fallback: true,
    }
  }

  const skippedHigher = QUALITIES.some(
    (q) => Math.max(0, weights[q]) > 0 && classified.buckets[q].length === 0,
  )

  let chosen: MoveQuality = available[available.length - 1]!
  for (let i = 0; i < available.length; i++) {
    const q = available[i]!
    const isLast = i === available.length - 1
    let denom = 0
    for (let j = i; j < available.length; j++) {
      denom += activeWeights[available[j]!]!
    }
    const pStop = activeWeights[q]! / denom
    if (isLast || rng() < pStop) {
      chosen = q
      break
    }
  }

  const bucket = classified.buckets[chosen]
  const line = pickFromBucket(chosen, bucket, recentMoves, recencyBias, preferBest, rng)
  return {
    move: line.move,
    quality: chosen,
    renormalized: skippedHigher,
    activeWeights,
    fallback: false,
  }
}

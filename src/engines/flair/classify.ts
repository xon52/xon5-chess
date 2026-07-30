import { scoreToComparableCp, type MultipvScoredLine, type UciScore } from '@/engines/shared/uci'
import {
  FLAIR_THRESHOLDS,
  type FlairClassifyThresholds,
  type MoveQuality,
} from '@/engines/flair/configs'

export type ClassifiedLine = {
  move: MultipvScoredLine['move']
  score: UciScore
  comparableCp: number
  swingCp: number
  quality: MoveQuality
}

export type ClassifyResult = {
  lines: ClassifiedLine[]
  rootComparableCp: number
  brilliantGapCp: number | null
  buckets: Record<MoveQuality, ClassifiedLine[]>
}

const emptyBuckets = (): Record<MoveQuality, ClassifiedLine[]> => ({
  brilliant: [],
  great: [],
  good: [],
  poor: [],
  mistake: [],
  blunder: [],
})

const qualityForSwing = (
  swingCp: number,
  brilliantGapCp: number | null,
  thresholds: FlairClassifyThresholds,
): MoveQuality => {
  if (
    swingCp >= 0 &&
    brilliantGapCp !== null &&
    brilliantGapCp >= thresholds.brilliantGapCp
  ) {
    return 'brilliant'
  }
  if (swingCp >= thresholds.greatMinSwing) {
    return 'great'
  }
  if (swingCp >= thresholds.goodMinSwing) {
    return 'good'
  }
  if (swingCp >= thresholds.poorMinSwing) {
    return 'poor'
  }
  if (swingCp >= thresholds.mistakeMinSwing) {
    return 'mistake'
  }
  return 'blunder'
}

/**
 * Classify MultiPV lines by STM signed swing vs root (multipv 1).
 * Brilliant: root line with gap to 2nd best >= threshold.
 */
export const classifyLines = (
  scored: MultipvScoredLine[],
  thresholds: FlairClassifyThresholds = FLAIR_THRESHOLDS,
): ClassifyResult | null => {
  if (scored.length === 0) {
    return null
  }

  const root = scored[0]!
  const rootComparableCp = scoreToComparableCp(root.score)
  const second = scored[1]
  const brilliantGapCp =
    second !== undefined ? rootComparableCp - scoreToComparableCp(second.score) : null

  const buckets = emptyBuckets()
  const lines: ClassifiedLine[] = scored.map((line) => {
    const comparableCp = scoreToComparableCp(line.score)
    const swingCp = comparableCp - rootComparableCp
    const quality = qualityForSwing(swingCp, brilliantGapCp, thresholds)
    const classified: ClassifiedLine = {
      move: line.move,
      score: line.score,
      comparableCp,
      swingCp,
      quality,
    }
    buckets[quality].push(classified)
    return classified
  })

  return { lines, rootComparableCp, brilliantGapCp, buckets }
}

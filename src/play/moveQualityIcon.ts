import type { FlairLogQuality } from '@/engine/flair/log'

export type MoveQualityIcon = {
  kind: 'double-up' | 'up' | 'down' | 'double-down' | 'circle'
  tone: 'brilliant' | 'great' | 'good' | 'poor' | 'mistake' | 'blunder' | 'neutral'
  label: string
}

/** Map Flair quality labels to move-list icons. */
export const moveQualityIcon = (quality: FlairLogQuality): MoveQualityIcon => {
  switch (quality) {
    case 'brilliant':
      return { kind: 'double-up', tone: 'brilliant', label: 'Brilliant' }
    case 'great':
      return { kind: 'up', tone: 'great', label: 'Great' }
    case 'good':
      return { kind: 'up', tone: 'good', label: 'Good' }
    case 'poor':
      return { kind: 'down', tone: 'poor', label: 'Poor' }
    case 'mistake':
      return { kind: 'down', tone: 'mistake', label: 'Mistake' }
    case 'blunder':
      return { kind: 'double-down', tone: 'blunder', label: 'Blunder' }
    default:
      return { kind: 'circle', tone: 'neutral', label: 'Forced / unclassified' }
  }
}

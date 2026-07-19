/** Product difficulty bands (source of truth). Cap: skill ≤ 8, depth ≤ 8. */

export type DifficultyId =
  | 's0-d1'
  | 's0-d2'
  | 's1-d3'
  | 's3-d4'
  | 's4-d5'
  | 's6-d7'
  | 's8-d8'

export type DifficultyPreset = {
  id: DifficultyId
  /** Display string for skill (may be a range). */
  skillDisplay: string
  /** Display string for depth (may be a range). */
  depthDisplay: string
  /** Display string for estimated Elo range. */
  eloDisplay: string
  /** Concrete UCI Skill Level for play searches. */
  playSkill: number
  /** Concrete UCI go depth for play searches. */
  playDepth: number
  profile: string
}

export const DIFFICULTY_PRESETS: readonly DifficultyPreset[] = [
  {
    id: 's0-d1',
    skillDisplay: '0',
    depthDisplay: '1',
    eloDisplay: '100 – 300',
    playSkill: 0,
    playDepth: 1,
    profile: 'True beginner; hangs pieces instantly; no calculation.',
  },
  {
    id: 's0-d2',
    skillDisplay: '0',
    depthDisplay: '2 – 3',
    eloDisplay: '400 – 600',
    playSkill: 0,
    playDepth: 2,
    profile: 'Captures free pieces; still walks into basic 1-move blunders.',
  },
  {
    id: 's1-d3',
    skillDisplay: '1 – 2',
    depthDisplay: '3 – 4',
    eloDisplay: '700 – 900',
    playSkill: 1,
    playDepth: 3,
    profile: 'Plays basic openings; misses simple 2-move forks and tactics.',
  },
  {
    id: 's3-d4',
    skillDisplay: '3',
    depthDisplay: '4 – 5',
    eloDisplay: '1000 – 1200',
    playSkill: 3,
    playDepth: 4,
    profile: 'Punishes obvious mistakes; vulnerable to long-term pressure.',
  },
  {
    id: 's4-d5',
    skillDisplay: '4 – 5',
    depthDisplay: '5 – 6',
    eloDisplay: '1300 – 1500',
    playSkill: 4,
    playDepth: 5,
    profile: 'Solid tactical awareness; struggles with deep positional play.',
  },
  {
    id: 's6-d7',
    skillDisplay: '6 – 7',
    depthDisplay: '7 – 8',
    eloDisplay: '1600 – 1700',
    playSkill: 6,
    playDepth: 7,
    profile: 'Strong club player; active pieces; rare tactical oversight.',
  },
  {
    id: 's8-d8',
    skillDisplay: '8',
    depthDisplay: '8',
    eloDisplay: '1800 – 2100',
    playSkill: 8,
    playDepth: 8,
    profile: 'Hard to beat; mostly tactical errors under time pressure.',
  },
] as const

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 's0-d1'

const byId = new Map(DIFFICULTY_PRESETS.map((p) => [p.id, p]))

export const getDifficulty = (id: DifficultyId): DifficultyPreset => {
  return byId.get(id) ?? DIFFICULTY_PRESETS[0]!
}

/** Label for dropdown options: Skill · Depth · Elo range. */
export const formatDifficultyLabel = (preset: DifficultyPreset): string =>
  `Skill ${preset.skillDisplay} · Depth ${preset.depthDisplay} · Elo ${preset.eloDisplay}`

export const resolveDifficultyId = (raw: unknown): DifficultyId => {
  if (typeof raw === 'string' && byId.has(raw as DifficultyId)) {
    return raw as DifficultyId
  }
  return DEFAULT_DIFFICULTY_ID
}

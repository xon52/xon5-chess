/**
 * Product difficulty presets (source of truth).
 *
 * Softness comes from Stockfish **Skill Level** (0–20): it randomly prefers
 * weaker candidates but only within a score window — it will not casually hang
 * a queen the way MultiPV “pick the Nth line” sampling can.
 *
 * Calibration (weaken ← → strengthen):
 * - Lower playSkill / playDepth to weaken.
 * - Raise playSkill / playDepth to strengthen.
 * - Search depth is raised to at least skill+1 so Skill Level can engage.
 */

export type DifficultyId =
  | 'level-1'
  | 'level-2'
  | 'level-3'
  | 'level-4'
  | 'level-5'
  | 'level-6'
  | 'level-7'
  | 'level-8'
  | 'level-9'
  | 'level-10'

export type DifficultyPreset = {
  id: DifficultyId
  /** Short display name for the dropdown. */
  name: string
  /** UCI Skill Level (0–20): how often weaker-but-not-catastrophic moves are chosen. */
  playSkill: number
  /** Requested go depth (raised to skill+1 at search time if needed). */
  playDepth: number
  profile: string
}

export const DIFFICULTY_PRESETS: readonly DifficultyPreset[] = [
  {
    id: 'level-1',
    name: 'Beginner',
    playSkill: 0,
    playDepth: 1,
    profile: 'Very weak; frequent simple mistakes.',
  },
  {
    id: 'level-2',
    name: 'Novice',
    playSkill: 1,
    playDepth: 2,
    profile: 'Still shaky; misses short tactics.',
  },
  {
    id: 'level-3',
    name: 'Early club',
    playSkill: 3,
    playDepth: 3,
    profile: 'Basic openings; misses simple forks and threats.',
  },
  {
    id: 'level-4',
    name: 'Club',
    playSkill: 5,
    playDepth: 4,
    profile: 'Punishes some mistakes; still drifts into weaker choices.',
  },
  {
    id: 'level-5',
    name: 'Solid',
    playSkill: 7,
    playDepth: 5,
    profile: 'Solid tactics; occasional oversight.',
  },
  {
    id: 'level-6',
    name: 'Strong club',
    playSkill: 9,
    playDepth: 6,
    profile: 'Strong club player; rare blunders, active pieces.',
  },
  {
    id: 'level-7',
    name: 'Expert',
    playSkill: 12,
    playDepth: 8,
    profile: 'Near-expert; oversights are uncommon.',
  },
  {
    id: 'level-8',
    name: 'Master',
    playSkill: 15,
    playDepth: 10,
    profile: 'Very strong; mostly accurate play.',
  },
  {
    id: 'level-9',
    name: 'Grandmaster',
    playSkill: 18,
    playDepth: 12,
    profile: 'Near full strength; tiny Skill cushion.',
  },
  {
    id: 'level-10',
    name: 'Maximum',
    playSkill: 20,
    playDepth: 14,
    profile: 'Full Skill Level; deep search.',
  },
] as const

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 'level-1'

/** Legacy skill+depth band ids → new level ids. */
const LEGACY_DIFFICULTY_IDS: Readonly<Record<string, DifficultyId>> = {
  's0-d1': 'level-1',
  's0-d2': 'level-2',
  's1-d3': 'level-3',
  's3-d4': 'level-4',
  's4-d5': 'level-5',
  's6-d7': 'level-6',
  's8-d8': 'level-7',
}

const byId = new Map(DIFFICULTY_PRESETS.map((p) => [p.id, p]))

export const getDifficulty = (id: DifficultyId): DifficultyPreset => {
  return byId.get(id) ?? DIFFICULTY_PRESETS[0]!
}

/** Label for dropdown options: name · skill · depth. */
export const formatDifficultyLabel = (preset: DifficultyPreset): string =>
  `${preset.name} · Skill ${preset.playSkill} · Depth ${preset.playDepth}`

export const resolveDifficultyId = (raw: unknown): DifficultyId => {
  if (typeof raw !== 'string') {
    return DEFAULT_DIFFICULTY_ID
  }
  if (byId.has(raw as DifficultyId)) {
    return raw as DifficultyId
  }
  const mapped = LEGACY_DIFFICULTY_IDS[raw]
  if (mapped) {
    return mapped
  }
  return DEFAULT_DIFFICULTY_ID
}

/**
 * Stockfish play-strength configs (Skill Level + depth).
 * Search depth is raised to at least skill+1 inside planPlaySearch so Skill engages.
 */

export type StockfishConfig = {
  id: string
  label: string
  playSkill: number
  playDepth: number
  profile: string
}

export const STOCKFISH_CONFIGS: readonly StockfishConfig[] = [
  {
    id: 'level-1',
    label: 'Beginner · Skill 0 · Depth 1',
    playSkill: 0,
    playDepth: 1,
    profile: 'Very weak; frequent simple mistakes.',
  },
  {
    id: 'level-2',
    label: 'Novice · Skill 1 · Depth 2',
    playSkill: 1,
    playDepth: 2,
    profile: 'Still shaky; misses short tactics.',
  },
  {
    id: 'level-3',
    label: 'Early club · Skill 3 · Depth 3',
    playSkill: 3,
    playDepth: 3,
    profile: 'Basic openings; misses simple forks and threats.',
  },
  {
    id: 'level-4',
    label: 'Club · Skill 5 · Depth 4',
    playSkill: 5,
    playDepth: 4,
    profile: 'Punishes some mistakes; still drifts into weaker choices.',
  },
  {
    id: 'level-5',
    label: 'Solid · Skill 7 · Depth 5',
    playSkill: 7,
    playDepth: 5,
    profile: 'Solid tactics; occasional oversight.',
  },
  {
    id: 'level-6',
    label: 'Strong club · Skill 9 · Depth 6',
    playSkill: 9,
    playDepth: 6,
    profile: 'Strong club player; rare blunders, active pieces.',
  },
  {
    id: 'level-7',
    label: 'Expert · Skill 12 · Depth 8',
    playSkill: 12,
    playDepth: 8,
    profile: 'Near-expert; oversights are uncommon.',
  },
  {
    id: 'level-8',
    label: 'Master · Skill 15 · Depth 10',
    playSkill: 15,
    playDepth: 10,
    profile: 'Very strong; mostly accurate play.',
  },
  {
    id: 'level-9',
    label: 'Grandmaster · Skill 18 · Depth 12',
    playSkill: 18,
    playDepth: 12,
    profile: 'Near full strength; tiny Skill cushion.',
  },
  {
    id: 'level-10',
    label: 'Maximum · Skill 20 · Depth 14',
    playSkill: 20,
    playDepth: 14,
    profile: 'Full Skill Level; deep search.',
  },
] as const

export const DEFAULT_STOCKFISH_CONFIG_ID = 'level-1'

const byId = new Map(STOCKFISH_CONFIGS.map((c) => [c.id, c]))

/** Legacy product band ids from before multi-engine. */
const LEGACY_IDS: Readonly<Record<string, string>> = {
  's0-d1': 'level-1',
  's0-d2': 'level-2',
  's1-d3': 'level-3',
  's3-d4': 'level-4',
  's4-d5': 'level-5',
  's6-d7': 'level-6',
  's8-d8': 'level-7',
}

export const resolveStockfishConfigId = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    return DEFAULT_STOCKFISH_CONFIG_ID
  }
  if (byId.has(raw)) {
    return raw
  }
  return LEGACY_IDS[raw] ?? DEFAULT_STOCKFISH_CONFIG_ID
}

export const getStockfishConfig = (id: string): StockfishConfig =>
  byId.get(resolveStockfishConfigId(id)) ?? STOCKFISH_CONFIGS[0]!

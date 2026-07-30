/**
 * Heuristic (chess.js) beginner/novice move pickers — no Worker.
 */

export type HeuristicConfig = {
  id: string
  label: string
  /** Depth hint for hang / freebie bias (1 = true beginner). */
  depth: number
}

export const HEURISTIC_CONFIGS: readonly HeuristicConfig[] = [
  {
    id: 'beginner',
    label: 'Beginner',
    depth: 1,
  },
  {
    id: 'novice',
    label: 'Novice',
    depth: 2,
  },
] as const

export const DEFAULT_HEURISTIC_CONFIG_ID = 'beginner'

const byId = new Map(HEURISTIC_CONFIGS.map((c) => [c.id, c]))

export const getHeuristicConfig = (id: string): HeuristicConfig =>
  byId.get(id) ?? HEURISTIC_CONFIGS[0]!

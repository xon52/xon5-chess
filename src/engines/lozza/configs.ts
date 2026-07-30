/**
 * Lozza strength configs — mapped to UCI go commands approximating Lozza UI levels 1–9 + Beth.
 */

export type LozzaConfig = {
  id: string
  label: string
  /** Full UCI go command, e.g. `go depth 3`. */
  go: string
}

export const LOZZA_CONFIGS: readonly LozzaConfig[] = [
  { id: 'level-1', label: 'Level 1', go: 'go depth 1' },
  { id: 'level-2', label: 'Level 2', go: 'go depth 2' },
  { id: 'level-3', label: 'Level 3', go: 'go depth 3' },
  { id: 'level-4', label: 'Level 4', go: 'go depth 4' },
  { id: 'level-5', label: 'Level 5', go: 'go depth 5' },
  { id: 'level-6', label: 'Level 6', go: 'go depth 6' },
  { id: 'level-7', label: 'Level 7', go: 'go depth 7' },
  { id: 'level-8', label: 'Level 8', go: 'go depth 8' },
  { id: 'level-9', label: 'Level 9', go: 'go depth 9' },
  { id: 'beth', label: 'Beth', go: 'go depth 12' },
] as const

export const DEFAULT_LOZZA_CONFIG_ID = 'level-1'

const byId = new Map(LOZZA_CONFIGS.map((c) => [c.id, c]))

export const getLozzaConfig = (id: string): LozzaConfig =>
  byId.get(id) ?? LOZZA_CONFIGS[0]!

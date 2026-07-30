import type { PlayEngine } from '@/engines/types'
import { getHeuristicConfig } from '@/engines/heuristic/configs'
import { pickHeuristicMove } from '@/engines/heuristic/picker'

export const createHeuristicPlayEngine = (): PlayEngine => ({
  id: 'heuristic',
  playSearch: async ({ fen, configId }) => {
    const cfg = getHeuristicConfig(configId)
    return pickHeuristicMove(fen, cfg.depth)
  },
  notifyNewGame: () => {},
  stop: () => {},
  stopAndDrain: async () => {},
})

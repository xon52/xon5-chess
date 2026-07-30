import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { Chess, type Color, type Square } from 'chess.js'

import {
  getEvalEngine,
  getPlayEngine,
  resolveConfigId,
  resolveEngineId,
} from '@/engines/registry'
import type { EngineId } from '@/engines/types'
import { fenSideToMove, scoreToWhiteBlackPct } from '@/engines/shared/uci'
import {
  analyzePlayedMove,
  printFlairMatchStats,
  recordFlairMove,
  resetFlairMatchLog,
} from '@/engines/flair/log'
import {
  buildLegalDests,
  canUndo as canUndoPlies,
  getLastMove,
  isPromotionMove as chessIsPromotionMove,
} from '@/game/board'
import {
  DEFAULT_CONFIG_ID,
  DEFAULT_ENGINE_ID,
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveEngineSelection,
  seedDefaultPrefs,
  type ActiveColor,
} from '@/game/prefs'
import { deriveStatus, type GameStatus } from '@/game/status'

export type { GameStatus } from '@/game/status'
export type { ActiveColor } from '@/game/prefs'
export type { EngineId } from '@/engines/types'

export type TryMoveInput = {
  from: Square | string
  to: Square | string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export type TryMoveResult = { ok: true; san: string } | { ok: false }

export const useGameStore = defineStore('game', () => {
  const prefs = loadPrefs()
  const chess = new Chess()

  const fen = ref(chess.fen())
  const turn = ref<Color>(chess.turn())
  const history = ref<string[]>([])
  const status = ref<GameStatus>({ kind: 'playing' })
  const humanColor = ref<'w' | 'b' | null>(null)
  const activeColor = ref<ActiveColor>(prefs.activeColor)
  const engineId = ref<EngineId>(prefs.engineId)
  const configId = ref<string>(prefs.configId)
  const engineThinking = ref(false)
  const whiteWinPct = ref<number | null>(null)
  const evalPctByHistoryLength = ref(new Map<number, number>())
  let playSearchGeneration = 0
  let evalSearchGeneration = 0

  const blackWinPct = computed(() =>
    whiteWinPct.value === null ? null : 100 - whiteWinPct.value,
  )

  const evalSeries = computed(() => {
    const maxPly = history.value.length
    const points: { ply: number; white: number }[] = []
    for (const [ply, white] of evalPctByHistoryLength.value) {
      if (ply >= 2 && ply <= maxPly) {
        points.push({ ply, white })
      }
    }
    return points.sort((a, b) => a.ply - b.ply)
  })

  const bumpEvalSearchGeneration = () => {
    evalSearchGeneration++
  }

  const recordEvalPct = (white: number) => {
    whiteWinPct.value = white
    const next = new Map(evalPctByHistoryLength.value)
    next.set(history.value.length, white)
    evalPctByHistoryLength.value = next
  }

  const restoreEvalPct = () => {
    const n = history.value.length
    if (n < 2) {
      whiteWinPct.value = null
      return
    }
    whiteWinPct.value = evalPctByHistoryLength.value.get(n) ?? null
  }

  const clearEvalHistory = () => {
    evalPctByHistoryLength.value = new Map()
    whiteWinPct.value = null
  }

  const syncFromChess = () => {
    fen.value = chess.fen()
    turn.value = chess.turn()
    history.value = chess.history()
    status.value = deriveStatus(chess)
  }

  const currentPlayEngine = () => getPlayEngine(engineId.value)

  const invalidatePlaySearch = (): Promise<void> => {
    playSearchGeneration++
    engineThinking.value = false
    return currentPlayEngine().stopAndDrain()
  }

  const canRequestEvalSearch = (): boolean =>
    humanColor.value !== null && history.value.length >= 2 && !engineThinking.value

  const requestEvalSearch = () => {
    if (!canRequestEvalSearch()) {
      return
    }

    const generation = evalSearchGeneration
    const positionFen = fen.value
    const sideToMove = fenSideToMove(positionFen)

    void getEvalEngine()
      .evalSearch({ fen: positionFen })
      .then((score) => {
        if (generation !== evalSearchGeneration) {
          return
        }
        if (!score) {
          return
        }
        const { white } = scoreToWhiteBlackPct(score, sideToMove)
        recordEvalPct(white)
      })
      .catch((err) => {
        console.error('[game] eval search failed', err)
      })
  }

  const isHumanTurn = computed(
    () =>
      humanColor.value !== null &&
      status.value.kind === 'playing' &&
      turn.value === humanColor.value,
  )

  const orientation = computed(() => (activeColor.value === 'b' ? 'black' : 'white'))

  const legalDests = computed(() => {
    void fen.value
    void humanColor.value
    if (!isHumanTurn.value) {
      return new Map<Square, Square[]>()
    }
    return buildLegalDests(chess)
  })

  const lastMove = computed((): [Square, Square] | undefined => {
    void fen.value
    return getLastMove(chess)
  })

  const requestEngineMove = () => {
    if (
      humanColor.value === null ||
      isHumanTurn.value ||
      status.value.kind !== 'playing' ||
      engineThinking.value
    ) {
      return
    }

    const generation = ++playSearchGeneration
    bumpEvalSearchGeneration()
    engineThinking.value = true
    const positionFen = fen.value
    const play = currentPlayEngine()
    const cfg = configId.value
    const recentMoves = (
      chess.history({ verbose: true }) as Array<{
        from: string
        to: string
        promotion?: string
      }>
    )
      .slice(-6)
      .map((m) => ({
        from: m.from,
        to: m.to,
        promotion:
          m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
            ? m.promotion
            : undefined,
      }))

    void play
      .playSearch({ fen: positionFen, configId: cfg, recentMoves })
      .then((move) => {
        if (generation !== playSearchGeneration) {
          return
        }
        if (
          !move ||
          humanColor.value === null ||
          isHumanTurn.value ||
          status.value.kind !== 'playing'
        ) {
          if (move === null) {
            console.warn('[game] play search returned no move')
          }
          return
        }
        const result = applyEngineMove(move)
        if (!result.ok) {
          console.warn('[game] illegal engine bestmove ignored', move)
        } else {
          bumpEvalSearchGeneration()
          if (status.value.kind !== 'playing') {
            printFlairMatchStats()
          }
        }
      })
      .catch((err) => {
        console.error('[game] play search failed', err)
      })
      .finally(() => {
        if (generation === playSearchGeneration) {
          engineThinking.value = false
          requestEvalSearch()
        }
      })
  }

  const applyLegalMove = (input: TryMoveInput): TryMoveResult => {
    if (status.value.kind !== 'playing') {
      return { ok: false }
    }

    try {
      const move = chess.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion,
      })
      syncFromChess()
      return { ok: true, san: move.san }
    } catch {
      return { ok: false }
    }
  }

  const tryMove = (input: TryMoveInput): TryMoveResult => {
    if (!isHumanTurn.value) {
      return { ok: false }
    }

    const fenBefore = fen.value
    const result = applyLegalMove(input)
    if (!result.ok) {
      return result
    }

    bumpEvalSearchGeneration()

    const afterHuman = () => {
      if (status.value.kind !== 'playing') {
        printFlairMatchStats()
        if (history.value.length >= 2) {
          requestEvalSearch()
        }
        return
      }
      if (!isHumanTurn.value) {
        requestEngineMove()
      }
    }

    if (engineId.value === 'flair') {
      const move = {
        from: String(input.from).toLowerCase(),
        to: String(input.to).toLowerCase(),
        promotion: input.promotion,
      }
      void analyzePlayedMove(fenBefore, move)
        .then((analysis) => {
          recordFlairMove({ side: 'human', ...analysis })
        })
        .catch((err) => {
          console.error('[flair] human analyze failed', err)
        })
        .finally(afterHuman)
    } else {
      afterHuman()
    }

    return result
  }

  const isPromotionMove = (from: string, to: string): boolean => {
    void fen.value
    return chessIsPromotionMove(chess, from, to)
  }

  const applyEngineMove = (input: TryMoveInput): TryMoveResult => {
    if (humanColor.value === null || isHumanTurn.value) {
      return { ok: false }
    }
    return applyLegalMove(input)
  }

  const undoPly = (): boolean => {
    const undone = chess.undo()
    if (!undone) {
      return false
    }
    syncFromChess()
    return true
  }

  const undoPlies = (n: number): number => {
    let undone = 0
    for (let i = 0; i < n; i++) {
      if (!undoPly()) {
        break
      }
      undone++
    }
    return undone
  }

  const canUndo = computed(() => canUndoPlies(humanColor.value, history.value.length))

  const undoUntilHumanTurn = (): boolean => {
    const color = humanColor.value
    if (color === null || !canUndo.value) {
      return false
    }

    const drain = invalidatePlaySearch()
    bumpEvalSearchGeneration()
    resetFlairMatchLog()

    do {
      if (!undoPly()) {
        break
      }
    } while (history.value.length > 0 && turn.value !== color)

    if (turn.value === color) {
      restoreEvalPct()
      void drain.then(() => {
        if (turn.value === color && canRequestEvalSearch()) {
          requestEvalSearch()
        }
      })
    }

    return turn.value === color
  }

  /**
   * Switch play engine and/or config. Updates prefs immediately; drains the prior
   * engine, then notifies the new one and may resume play on the engine's turn.
   */
  const setEngineSelection = (nextEngine: EngineId | string, nextConfig?: string) => {
    const eng = resolveEngineId(nextEngine)
    const cfg = resolveConfigId(eng, nextConfig ?? configId.value)
    if (eng === engineId.value && cfg === configId.value) {
      return
    }

    const prev = getPlayEngine(engineId.value)
    playSearchGeneration++
    bumpEvalSearchGeneration()
    engineThinking.value = false

    engineId.value = eng
    configId.value = cfg
    saveEngineSelection(eng, cfg)

    void prev.stopAndDrain().then(() => {
      const play = getPlayEngine(eng)
      play.notifyNewGame()
      getEvalEngine().notifyNewGame?.()

      if (
        humanColor.value !== null &&
        status.value.kind === 'playing' &&
        !isHumanTurn.value
      ) {
        requestEngineMove()
      }
    })
  }

  const flipBoard = () => {
    if (humanColor.value !== null && status.value.kind !== 'playing') {
      return
    }

    const next: ActiveColor = activeColor.value === 'w' ? 'b' : 'w'
    activeColor.value = next
    saveActiveColor(next)

    if (humanColor.value !== null) {
      humanColor.value = next
      if (status.value.kind === 'playing') {
        void invalidatePlaySearch().then(() => {
          if (
            humanColor.value === next &&
            status.value.kind === 'playing' &&
            !isHumanTurn.value
          ) {
            requestEngineMove()
          }
        })
      }
    }
  }

  const reset = () => {
    void invalidatePlaySearch()
    bumpEvalSearchGeneration()
    clearEvalHistory()
    resetFlairMatchLog()
    chess.reset()
    humanColor.value = null
    syncFromChess()
  }

  const newGame = () => {
    const drain = invalidatePlaySearch()
    bumpEvalSearchGeneration()
    clearEvalHistory()
    resetFlairMatchLog()
    chess.reset()
    humanColor.value = activeColor.value
    syncFromChess()
    void drain.then(() => {
      currentPlayEngine().notifyNewGame()
      getEvalEngine().notifyNewGame?.()
      if (!isHumanTurn.value && status.value.kind === 'playing') {
        requestEngineMove()
      }
    })
  }

  const startFirstVisitIfNeeded = (): boolean => {
    if (hasStoredPrefs()) {
      return false
    }
    activeColor.value = 'w'
    engineId.value = DEFAULT_ENGINE_ID
    configId.value = DEFAULT_CONFIG_ID
    seedDefaultPrefs()
    if (humanColor.value === null) {
      newGame()
      return true
    }
    return false
  }

  const loadFen = (fenString: string): boolean => {
    try {
      chess.load(fenString)
      syncFromChess()
      return true
    } catch {
      return false
    }
  }

  return {
    fen,
    turn,
    history,
    status,
    humanColor,
    activeColor,
    engineId,
    configId,
    engineThinking,
    whiteWinPct,
    blackWinPct,
    evalSeries,
    isHumanTurn,
    orientation,
    legalDests,
    lastMove,
    canUndo,
    tryMove,
    isPromotionMove,
    applyEngineMove,
    undoPly,
    undoPlies,
    undoUntilHumanTurn,
    setEngineSelection,
    flipBoard,
    reset,
    newGame,
    startFirstVisitIfNeeded,
    loadFen,
    requestEngineMove,
    requestEvalSearch,
  }
})

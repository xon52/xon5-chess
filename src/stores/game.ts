import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { Chess, type Color, type Square } from 'chess.js'

import { getEngineClient } from '@/engine/stockfishClient'
import { fenSideToMove, scoreToWhiteBlackPct } from '@/engine/uci'
import {
  buildLegalDests,
  canUndo as canUndoPlies,
  getLastMove,
  isPromotionMove as chessIsPromotionMove,
} from '@/game/board'
import {
  DEFAULT_DIFFICULTY_ID,
  getDifficulty,
  resolveDifficultyId,
  type DifficultyId,
} from '@/game/difficulty'
import {
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveDifficulty,
  seedDefaultPrefs,
  type ActiveColor,
} from '@/game/prefs'
import { deriveStatus, type GameStatus } from '@/game/status'

export type { GameStatus } from '@/game/status'
export type { DifficultyId } from '@/game/difficulty'
export type { ActiveColor } from '@/game/prefs'

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
  /** Null until Start begins a session (start gate). */
  const humanColor = ref<'w' | 'b' | null>(null)
  /** Side the human plays / board bottom; persisted across sessions. */
  const activeColor = ref<ActiveColor>(prefs.activeColor)
  /** Play-strength band id; persisted; kept across resign/reset. */
  const difficultyId = ref<DifficultyId>(prefs.difficultyId)
  /** True while a play search is in flight. */
  const engineThinking = ref(false)
  /**
   * Latest completed eval White win % for the current position.
   * Null → UI shows 50/50 when the eval bar is visible.
   */
  const whiteWinPct = ref<number | null>(null)
  /**
   * Completed eval White % keyed by history length (ply count).
   * Reactive so the live win% graph can subscribe; also used for undo restore.
   */
  const evalPctByHistoryLength = ref(new Map<number, number>())
  /** Bumped to ignore stale bestmove results after undo / reset / newGame. */
  let playSearchGeneration = 0
  /** Bumped on position changes so stale eval scores are ignored. */
  let evalSearchGeneration = 0

  const blackWinPct = computed(() =>
    whiteWinPct.value === null ? null : 100 - whiteWinPct.value,
  )

  const difficulty = computed(() => getDifficulty(difficultyId.value))

  /** Completed eval points for the live graph (ply ≤ current history length). */
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

  /**
   * Cancel in-flight play search so a late bestmove cannot apply. Returns when drained.
   * Clears engineThinking immediately so mid-think Undo unlocks the board (§9.3);
   * board lock for engine-to-move still uses !isHumanTurn.
   */
  const invalidatePlaySearch = (): Promise<void> => {
    playSearchGeneration++
    engineThinking.value = false
    return getEngineClient().stopAndDrain()
  }

  /** True when an eval search may run (SPEC §7 visibility + no play search). */
  const canRequestEvalSearch = (): boolean =>
    humanColor.value !== null && history.value.length >= 2 && !engineThinking.value

  /** Start a 500ms eval search on the current position (not strength-capped). */
  const requestEvalSearch = () => {
    if (!canRequestEvalSearch()) {
      return
    }

    const generation = evalSearchGeneration
    const positionFen = fen.value
    const sideToMove = fenSideToMove(positionFen)

    void getEngineClient()
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

  /** Legal move destinations for chessground; empty when locked or over. */
  const legalDests = computed(() => {
    // Depend on fen/status/human so dests stay in sync after every ply.
    void fen.value
    void humanColor.value
    if (!isHumanTurn.value) {
      return new Map<Square, Square[]>()
    }
    return buildLegalDests(chess)
  })

  /** Last ply [from, to] for chessground highlighting; undefined at start. */
  const lastMove = computed((): [Square, Square] | undefined => {
    void fen.value
    return getLastMove(chess)
  })

  /**
   * Start a play search when it is the engine’s turn.
   * Illegal / null bestmove: log and leave board locked for Undo / Resign (no auto-retry).
   */
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
    const preset = getDifficulty(difficultyId.value)

    void getEngineClient()
      .playSearch({
        fen: positionFen,
        skill: preset.playSkill,
        depth: preset.playDepth,
      })
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
    // Claimable draws (fifty-move / threefold) still have legal moves in chess.js;
    // refuse once the store has marked the game terminal.
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

    const result = applyLegalMove(input)
    if (result.ok) {
      bumpEvalSearchGeneration()
      if (status.value.kind === 'playing' && !isHumanTurn.value) {
        requestEngineMove()
      } else if (status.value.kind !== 'playing' && history.value.length >= 2) {
        requestEvalSearch()
      }
    }
    return result
  }

  /** True when from→to is a legal pawn promotion (any promotion piece). */
  const isPromotionMove = (from: string, to: string): boolean => {
    void fen.value
    return chessIsPromotionMove(chess, from, to)
  }

  /**
   * Apply a legal move on the engine’s turn (tests + Stockfish replies).
   * Rejects when no color is chosen or it is the human’s turn.
   */
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

  /**
   * Undo plies until it is the human’s side to move (by color, including terminal).
   * No mutation when canUndo is false. Cancels in-flight play (drain) then resumes eval.
   */
  const undoUntilHumanTurn = (): boolean => {
    const color = humanColor.value
    if (color === null || !canUndo.value) {
      return false
    }

    const drain = invalidatePlaySearch()
    bumpEvalSearchGeneration()

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

  const setDifficultyId = (id: DifficultyId | string) => {
    const next = resolveDifficultyId(id)
    difficultyId.value = next
    saveDifficulty(next)
  }

  /**
   * Flip board / side. No-op when the game is over (mate/draw).
   * Mid-game: updates humanColor to match; cancels in-flight play and may request an engine move.
   */
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

  /** Back to start gate: starting position, no human session. Keeps difficulty + activeColor. */
  const reset = () => {
    void invalidatePlaySearch()
    bumpEvalSearchGeneration()
    clearEvalHistory()
    chess.reset()
    humanColor.value = null
    syncFromChess()
  }

  /** Start a game as activeColor with the current difficulty band. */
  const newGame = () => {
    const drain = invalidatePlaySearch()
    bumpEvalSearchGeneration()
    clearEvalHistory()
    chess.reset()
    humanColor.value = activeColor.value
    syncFromChess()
    // ucinewgame only after stop bestmove is drained (§5 / UCI).
    void drain.then(() => {
      getEngineClient().notifyNewGame()
      if (!isHumanTurn.value && status.value.kind === 'playing') {
        requestEngineMove()
      }
    })
  }

  /**
   * First Play visit with no persisted prefs: seed defaults (lowest / White) and start a game.
   * Returns true when a game was auto-started.
   */
  const startFirstVisitIfNeeded = (): boolean => {
    if (hasStoredPrefs()) {
      return false
    }
    activeColor.value = 'w'
    difficultyId.value = DEFAULT_DIFFICULTY_ID
    seedDefaultPrefs()
    if (humanColor.value === null) {
      newGame()
      return true
    }
    return false
  }

  /** Load a FEN position (for tests and later tooling). Returns false if invalid. */
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
    difficultyId,
    difficulty,
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
    setDifficultyId,
    flipBoard,
    reset,
    newGame,
    startFirstVisitIfNeeded,
    loadFen,
    requestEngineMove,
    requestEvalSearch,
  }
})

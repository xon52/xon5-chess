<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

import ChessBoard from '@/components/ChessBoard.vue'
import type { BoardMove } from '@/components/ChessBoard.vue'
import NewGameChooser from '@/components/NewGameChooser.vue'
import PlayModal from '@/components/PlayModal.vue'
import PlayMoveHistory from '@/components/PlayMoveHistory.vue'
import { ELO_DEFAULT, snapElo } from '@/game/elo'
import { formatStatusText, type PromotionPiece } from '@/play/formatters'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const {
  fen,
  turn,
  history,
  status,
  legalDests,
  lastMove,
  humanColor,
  elo,
  isHumanTurn,
  engineThinking,
  orientation,
  canUndo,
  whiteWinPct,
  blackWinPct,
  evalSeries,
} = storeToRefs(game)

type PanelAction = 'idle' | 'chooser' | 'resign-confirm' | 'promote'

const panelAction = ref<PanelAction>('idle')
const chooserColor = ref<'w' | 'b'>('w')
const chooserElo = ref(ELO_DEFAULT)
const pendingPromotion = ref<{ from: string; to: string } | null>(null)

const gameStarted = computed(() => humanColor.value !== null)

/** Terminal checkmate or draw — session still active until New Game Start or Undo-then-Resign. */
const gameOver = computed(() => gameStarted.value && status.value.kind !== 'playing')

const showMoves = computed(() => history.value.length > 0)

/** Read-only Elo while a game is active (including resign/promote modals); hide in New Game chooser. */
const showEloDisplay = computed(() => gameStarted.value && panelAction.value !== 'chooser')

const modalOpen = computed(
  () => panelAction.value === 'resign-confirm' || panelAction.value === 'promote',
)

const modalMode = computed(() =>
  panelAction.value === 'promote' ? ('promote' as const) : ('resign-confirm' as const),
)

/** Lock input on engine turn / think, when the game is over, and while a blocking modal is open. */
const boardLocked = computed(
  () =>
    !isHumanTurn.value ||
    engineThinking.value ||
    gameOver.value ||
    modalOpen.value,
)

/** Promoting side keeps the cburnett icons matching the human’s pieces. */
const promoColorClass = computed(() => (turn.value === 'b' ? 'black' : 'white'))

const statusText = computed(() =>
  formatStatusText({
    gameStarted: gameStarted.value,
    status: status.value,
    turn: turn.value,
  }),
)

const movableColor = computed(() => (humanColor.value === 'b' ? 'black' : 'white'))

const openChooser = () => {
  chooserColor.value = 'w'
  chooserElo.value = elo.value
  panelAction.value = 'chooser'
}

const clearPendingPromotion = () => {
  pendingPromotion.value = null
  if (panelAction.value === 'promote') {
    panelAction.value = 'idle'
  }
}

const cancelPanelAction = () => {
  if (panelAction.value === 'promote') {
    clearPendingPromotion()
    return
  }
  panelAction.value = 'idle'
}

const startNewGame = () => {
  clearPendingPromotion()
  game.newGame({ color: chooserColor.value, elo: snapElo(chooserElo.value) })
  panelAction.value = 'idle'
}

const openResignConfirm = () => {
  if (modalOpen.value || gameOver.value) {
    return
  }
  panelAction.value = 'resign-confirm'
}

const confirmResign = () => {
  clearPendingPromotion()
  game.reset()
  panelAction.value = 'idle'
}

/** Undo until it is the human’s turn (store owns ply count / invariant). */
const onUndo = () => {
  if (modalOpen.value) {
    return
  }
  game.undoUntilHumanTurn()
}

const onBoardMove = ({ from, to }: BoardMove) => {
  if (boardLocked.value) {
    return
  }
  if (game.isPromotionMove(from, to)) {
    pendingPromotion.value = { from, to }
    panelAction.value = 'promote'
    return
  }
  game.tryMove({ from, to })
  // Store is source of truth; ChessBoard watches fen/dests and snaps back on reject.
}

const choosePromotion = (piece: PromotionPiece) => {
  const pending = pendingPromotion.value
  if (!pending || panelAction.value !== 'promote') {
    return
  }
  const result = game.tryMove({ from: pending.from, to: pending.to, promotion: piece })
  if (result.ok) {
    clearPendingPromotion()
  }
}
</script>

<template>
  <main class="play">
    <div class="play__stage">
      <div class="play__board" aria-label="Chess board">
        <ChessBoard
          :fen="fen"
          :turn="turn"
          :orientation="orientation"
          :dests="legalDests"
          :last-move="lastMove"
          :view-only="boardLocked"
          :movable-color="movableColor"
          @move="onBoardMove"
        />
      </div>

      <aside class="play__panel">
        <p class="play__status">{{ statusText }}</p>

        <p v-if="showEloDisplay" class="play__elo-display" aria-label="Engine strength">
          <span class="play__elo-label">Elo</span>
          <span class="play__elo-value">{{ elo }}</span>
        </p>

        <PlayMoveHistory
          v-if="showMoves"
          :history="history"
          :white-win-pct="whiteWinPct"
          :black-win-pct="blackWinPct"
          :eval-series="evalSeries"
        />

        <NewGameChooser
          v-if="panelAction === 'chooser'"
          v-model:color="chooserColor"
          v-model:elo="chooserElo"
          @start="startNewGame"
          @cancel="cancelPanelAction"
        />

        <div v-else-if="gameStarted && !modalOpen" class="play__actions">
          <button
            v-if="gameOver"
            type="button"
            class="play__btn play__btn--active"
            @click="openChooser"
          >
            New Game
          </button>
          <button
            v-else
            type="button"
            class="play__btn play__btn--active"
            @click="openResignConfirm"
          >
            Resign
          </button>
          <button
            type="button"
            class="play__btn"
            :class="{ 'play__btn--active': canUndo }"
            :disabled="!canUndo"
            @click="onUndo"
          >
            Undo
          </button>
        </div>

        <div v-else-if="!gameStarted" class="play__actions">
          <button type="button" class="play__btn play__btn--active" @click="openChooser">
            New Game
          </button>
        </div>
      </aside>
    </div>

    <PlayModal
      v-if="modalOpen"
      :mode="modalMode"
      :promo-color-class="promoColorClass"
      @choose="choosePromotion"
      @confirm="confirmResign"
      @cancel="cancelPanelAction"
    />
  </main>
</template>

<style scoped>
.play {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  flex: 1;
  padding: clamp(1rem, 3vw, 2rem);
  animation: play-enter 0.7s var(--ease-out) both;
}

.play__stage {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(1.25rem, 3vw, 2.5rem);
  width: min(100%, 56rem);
}

.play__board {
  flex: 1 1 18rem;
  max-width: min(100%, 28rem);
  aspect-ratio: 1;
  padding: 0.65rem;
  background: linear-gradient(145deg, var(--color-walnut-light), var(--color-board-edge));
  box-shadow:
    0 1.25rem 2.5rem rgb(0 0 0 / 0.35),
    inset 0 1px 0 rgb(255 255 255 / 0.12);
  animation: board-rise 0.85s var(--ease-out) 0.15s both;
}

/* Isolate chessground from flex/padding quirks so pieces map 1:1 onto squares. */
.play__board :deep(.cg-wrap) {
  width: 100%;
  height: 100%;
}

.play__panel {
  flex: 1 1 14rem;
  max-width: 18rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 0.25rem;
  animation: panel-fade 0.8s var(--ease-out) 0.25s both;
}

.play__status {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-ivory);
}

.play__elo-display {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.65rem;
  margin: 0;
}

.play__elo-label {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ivory-muted);
}

.play__elo-value {
  font-variant-numeric: tabular-nums;
  min-width: 2.5rem;
  text-align: right;
  color: var(--color-ivory);
}

.play__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.play__btn {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border: 1px solid rgb(232 220 200 / 0.28);
  border-radius: 0;
  background: transparent;
  color: var(--color-ivory-muted);
  cursor: not-allowed;
}

.play__btn--active {
  color: var(--color-ivory);
  cursor: pointer;
}

.play__btn--active:hover {
  border-color: rgb(232 220 200 / 0.55);
  background: rgb(232 220 200 / 0.08);
}

@keyframes play-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Opacity only — transform on this ancestor skews chessground piece bounds. */
@keyframes board-rise {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes panel-fade {
  from {
    opacity: 0;
    transform: translateX(0.5rem);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 40rem) {
  .play__panel {
    max-width: min(100%, 28rem);
    width: 100%;
  }

  @keyframes panel-fade {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>

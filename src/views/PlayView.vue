<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import BoardHintArrow from '@/components/BoardHintArrow.vue'
import ChessBoard from '@/components/ChessBoard.vue'
import type { BoardMove } from '@/components/ChessBoard.vue'
import PlayEndgame from '@/components/PlayEndgame.vue'
import PlayModal from '@/components/PlayModal.vue'
import PlaySidePanel from '@/components/PlaySidePanel.vue'
import { formatStatusText, type PromotionPiece } from '@/play/formatters'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
game.ensurePlaySession()

const {
  fen,
  turn,
  history,
  moveQualities,
  status,
  legalDests,
  lastMove,
  humanColor,
  difficultyId,
  boardTheme,
  panelPinned,
  panelOpen,
  showMoveQualities,
  isHumanTurn,
  engineThinking,
  hintThinking,
  hintMove,
  orientation,
  canUndo,
  whiteWinPct,
  blackWinPct,
  evalSeries,
  captureTrays,
} = storeToRefs(game)

type PanelAction = 'idle' | 'resign-confirm' | 'promote'

const panelAction = ref<PanelAction>('idle')
const pendingPromotion = ref<{ from: string; to: string } | null>(null)
const endgameDismissed = ref(false)

const gameStarted = computed(() => humanColor.value !== null)

/** Terminal checkmate or draw — session still active until Start or Undo-then-Resign. */
const gameOver = computed(() => gameStarted.value && status.value.kind !== 'playing')

const canFlip = computed(() => !gameOver.value)

const modalOpen = computed(
  () => panelAction.value === 'resign-confirm' || panelAction.value === 'promote',
)

const modalMode = computed(() =>
  panelAction.value === 'promote' ? ('promote' as const) : ('resign-confirm' as const),
)

const endgameKind = computed((): 'win' | 'loss' | 'draw' | null => {
  if (!gameOver.value || endgameDismissed.value) {
    return null
  }
  const s = status.value
  if (s.kind === 'draw') {
    return 'draw'
  }
  if (s.kind === 'checkmate' && humanColor.value) {
    return s.winner === humanColor.value ? 'win' : 'loss'
  }
  return null
})

watch(gameOver, (over) => {
  if (!over) {
    endgameDismissed.value = false
  }
})

/** Lock input on engine turn / think, when the game is over, and while a blocking modal is open. */
const boardLocked = computed(
  () =>
    !isHumanTurn.value ||
    engineThinking.value ||
    gameOver.value ||
    modalOpen.value ||
    endgameKind.value !== null,
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

const canHint = computed(
  () =>
    gameStarted.value &&
    !gameOver.value &&
    isHumanTurn.value &&
    !engineThinking.value &&
    !hintThinking.value &&
    !modalOpen.value,
)

const mateSideClass = computed(() => {
  if (status.value.kind !== 'checkmate') {
    return null
  }
  return status.value.winner === 'w' ? 'play__board--mate-b' : 'play__board--mate-w'
})

const panelVisible = computed(() => panelPinned.value || panelOpen.value)

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
  endgameDismissed.value = false
  game.newGame()
  panelAction.value = 'idle'
}

const openResignConfirm = () => {
  if (modalOpen.value || gameOver.value || endgameKind.value) {
    return
  }
  panelAction.value = 'resign-confirm'
}

const confirmResign = () => {
  clearPendingPromotion()
  game.reset()
  panelAction.value = 'idle'
}

const onFlip = () => {
  if (!canFlip.value) {
    return
  }
  game.flipBoard()
}

const onUndo = () => {
  if (modalOpen.value) {
    return
  }
  endgameDismissed.value = true
  game.undoUntilHumanTurn()
}

const onHint = () => {
  game.requestHint()
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

const dismissEndgame = () => {
  endgameDismissed.value = true
  startNewGame()
}
</script>

<template>
  <main class="play" :class="{ 'play--pinned': panelPinned && panelVisible }">
    <div
      class="play__stage"
      :class="{ 'play__stage--pinned': panelPinned && panelVisible }"
    >
      <div class="play__board-column">
        <div
          class="play__board"
          :class="[
            boardTheme === 'grey' ? 'board-theme-grey' : 'board-theme-classic',
            mateSideClass,
          ]"
          aria-label="Chess board"
        >
          <div class="play__board-surface">
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
            <BoardHintArrow
              v-if="hintMove"
              :from="hintMove.from"
              :to="hintMove.to"
              :piece="hintMove.piece"
              :orientation="orientation"
            />
            <PlayEndgame
              v-if="endgameKind"
              :kind="endgameKind"
              @dismiss="dismissEndgame"
            />
          </div>
        </div>
      </div>

      <div
        class="play__drawer"
        :class="{
          'play__drawer--open': panelVisible,
          'play__drawer--pinned': panelPinned && panelVisible,
          'play__drawer--overlay': !panelPinned,
        }"
      >
        <PlaySidePanel
          :open="panelVisible"
          :pinned="panelPinned"
          :status-text="statusText"
          :difficulty-id="difficultyId"
          :game-started="gameStarted"
          :game-over="gameOver"
          :can-flip="canFlip"
          :can-undo="canUndo"
          :can-hint="canHint"
          :hint-thinking="hintThinking"
          :actions-visible="!modalOpen"
          :board-theme="boardTheme"
          :history="history"
          :move-qualities="moveQualities"
          :show-move-qualities="showMoveQualities"
          :white-win-pct="whiteWinPct"
          :black-win-pct="blackWinPct"
          :eval-series="evalSeries"
          :captures-left="captureTrays.left"
          :captures-right="captureTrays.right"
          @close="game.setPanelOpen(false)"
          @update:pinned="game.setPanelPinned($event)"
          @update:show-move-qualities="game.setShowMoveQualities($event)"
          @update:board-theme="game.setBoardTheme($event)"
          @difficulty-change="game.setDifficultyId($event)"
          @start="startNewGame"
          @resign="openResignConfirm"
          @flip="onFlip"
          @undo="onUndo"
          @hint="onHint"
        />
      </div>
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
  align-items: stretch;
  justify-content: center;
  gap: 0;
  flex: 1;
  min-height: 0;
  padding: clamp(1rem, 3vw, 2rem);
  animation: play-enter 0.7s var(--ease-out) both;
  overflow: hidden;
}

/* Pinned: flush to the nav/edges so the drawer reads as chrome, not a floating card. */
.play--pinned {
  padding: 0;
}

.play__stage {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.play__stage--pinned {
  justify-content: stretch;
}

.play__board-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.play--pinned .play__board-column {
  padding: clamp(1rem, 3vw, 2rem);
}

.play__board {
  position: relative;
  width: min(100%, 28rem);
  max-width: 28rem;
  aspect-ratio: 1;
  padding: 0.65rem;
  background: linear-gradient(145deg, var(--color-walnut-light), var(--color-board-edge));
  box-shadow:
    0 1.25rem 2.5rem rgb(0 0 0 / 0.35),
    inset 0 1px 0 rgb(255 255 255 / 0.12);
  animation: board-rise 0.85s var(--ease-out) 0.15s both;
}

.play__board.board-theme-grey {
  background: linear-gradient(145deg, #6e6e6e, #3a3a3a);
}

/* Content box only — hint overlay must share this box with chessground, not the frame padding. */
.play__board-surface {
  position: relative;
  width: 100%;
  height: 100%;
}

/* Isolate chessground from flex/padding quirks so pieces map 1:1 onto squares. */
.play__board-surface :deep(.cg-wrap) {
  width: 100%;
  height: 100%;
}

/* Tip the checkmated king without fighting chessground translate transforms. */
.play__board--mate-w :deep(piece.king.white),
.play__board--mate-b :deep(piece.king.black) {
  rotate: 270deg;
  transition: rotate 0.45s var(--ease-out);
}

.play__drawer {
  flex: 0 0 0;
  width: 0;
  min-height: 0;
  overflow: hidden;
  z-index: 20;
  transition: flex-basis 0.28s var(--ease-out), width 0.28s var(--ease-out);
}

.play__drawer--pinned.play__drawer--open {
  flex: 0 0 18rem;
  width: 18rem;
  align-self: stretch;
  overflow: hidden;
}

.play__drawer--overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 18rem;
  max-width: min(18rem, 100vw);
  padding-top: 3.6rem; /* below app nav */
  transform: translateX(100%);
  transition: transform 0.28s var(--ease-out);
  pointer-events: none;
}

.play__drawer--overlay.play__drawer--open {
  transform: translateX(0);
  pointer-events: auto;
}

.play__drawer :deep(.side-panel) {
  height: 100%;
  width: 100%;
  min-height: 0;
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

@media (max-width: 40rem) {
  .play__drawer--pinned.play__drawer--open {
    flex-basis: min(18rem, 100%);
    width: min(18rem, 100%);
  }
}
</style>

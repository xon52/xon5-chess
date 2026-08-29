<script setup lang="ts">
import { computed, ref } from 'vue'

import PlayMoveHistory from '@/components/PlayMoveHistory.vue'
import { DIFFICULTY_OPTIONS } from '@/engine'
import type { EvalPoint } from '@/play/evalChart'
import type { FlairLogQuality } from '@/engine'
import type { BoardTheme, CapturedPiece } from '@/stores/game'

const props = defineProps<{
  open: boolean
  pinned: boolean
  statusText: string
  openingWhiteLabel: string
  openingBlackLabel: string
  difficultyId: string
  gameStarted: boolean
  gameOver: boolean
  canFlip: boolean
  canUndo: boolean
  canHint: boolean
  hintThinking: boolean
  actionsVisible: boolean
  boardTheme: BoardTheme
  history: string[]
  moveQualities: FlairLogQuality[]
  showMoveQualities: boolean
  humanColor: 'w' | 'b' | null
  whiteWinPct: number | null
  blackWinPct: number | null
  evalSeries: EvalPoint[]
  capturesLeft: CapturedPiece[]
  capturesRight: CapturedPiece[]
}>()

const emit = defineEmits<{
  close: []
  'update:pinned': [value: boolean]
  'update:showMoveQualities': [value: boolean]
  'update:boardTheme': [value: BoardTheme]
  difficultyChange: [id: string]
  start: []
  resign: []
  flip: []
  undo: []
  hint: []
}>()

type SectionId = 'control' | 'colour' | 'moves' | 'stats'

const openSection = ref<SectionId | null>('control')

const toggleSection = (id: SectionId) => {
  openSection.value = openSection.value === id ? null : id
}

const configOptions = DIFFICULTY_OPTIONS

const showMoves = computed(() => props.history.length > 0)

const onConfigChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('difficultyChange', target.value)
}

const setTheme = (theme: BoardTheme) => {
  emit('update:boardTheme', theme)
}

const pieceName = (type: string) => {
  switch (type) {
    case 'q':
      return 'queen'
    case 'r':
      return 'rook'
    case 'b':
      return 'bishop'
    case 'n':
      return 'knight'
    default:
      return 'pawn'
  }
}
</script>

<template>
  <aside
    class="side-panel"
    :class="{
      'side-panel--open': open,
      'side-panel--pinned': pinned,
    }"
    aria-label="Game panel"
  >
    <div class="side-panel__chrome">
      <button
        type="button"
        class="side-panel__icon-btn"
        :aria-pressed="pinned"
        :aria-label="pinned ? 'Unpin panel' : 'Pin panel'"
        :title="pinned ? 'Unpin panel' : 'Pin panel'"
        @click="emit('update:pinned', !pinned)"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            v-if="pinned"
            fill="currentColor"
            d="M16 4v6.5l2.2 2.2V14h-4.7V21h-1V14H7.8v-1.3L10 10.5V4h6zm-1 1h-4v5.8l-2 2V13h8v-.2l-2-2V5z"
          />
          <path
            v-else
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linejoin="round"
            d="M9 3.5h6v6.2l2.4 2.4V14H13.5v6.5h-3V14H6.6v-1.9L9 9.7V3.5z"
          />
        </svg>
      </button>
      <button
        v-if="!pinned"
        type="button"
        class="side-panel__icon-btn"
        aria-label="Close panel"
        title="Close panel"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            d="M6.5 6.5l11 11M17.5 6.5l-11 11"
          />
        </svg>
      </button>
    </div>

    <div class="side-panel__accordion">
      <section class="side-panel__section">
        <button
          type="button"
          class="side-panel__heading"
          :aria-expanded="openSection === 'control'"
          @click="toggleSection('control')"
        >
          <span>Game Control</span>
          <span class="side-panel__chevron" aria-hidden="true">{{
            openSection === 'control' ? '▾' : '▸'
          }}</span>
        </button>
        <div v-show="openSection === 'control'" class="side-panel__body">
          <p class="side-panel__status">{{ statusText }}</p>

          <label class="side-panel__field">
            <span class="side-panel__label">Difficulty</span>
            <select
              class="side-panel__select"
              :value="difficultyId"
              aria-label="Difficulty"
              @change="onConfigChange"
            >
              <option v-for="opt in configOptions" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </label>

          <div v-if="actionsVisible" class="side-panel__actions">
            <button
              v-if="!gameStarted || gameOver"
              type="button"
              class="side-panel__btn side-panel__btn--active"
              @click="emit('start')"
            >
              Start
            </button>
            <button
              v-else
              type="button"
              class="side-panel__btn side-panel__btn--active"
              @click="emit('resign')"
            >
              Resign
            </button>
            <button
              type="button"
              class="side-panel__btn"
              :class="{ 'side-panel__btn--active': canFlip }"
              :disabled="!canFlip"
              @click="emit('flip')"
            >
              Flip
            </button>
            <button
              v-if="gameStarted"
              type="button"
              class="side-panel__btn"
              :class="{ 'side-panel__btn--active': canUndo }"
              :disabled="!canUndo"
              @click="emit('undo')"
            >
              Undo
            </button>
            <button
              v-if="gameStarted && !gameOver"
              type="button"
              class="side-panel__btn"
              :class="{ 'side-panel__btn--active': canHint }"
              :disabled="!canHint"
              @click="emit('hint')"
            >
              {{ hintThinking ? '…' : 'Hint' }}
            </button>
          </div>
        </div>
      </section>

      <section class="side-panel__section">
        <button
          type="button"
          class="side-panel__heading"
          :aria-expanded="openSection === 'colour'"
          @click="toggleSection('colour')"
        >
          <span>Board Colour</span>
          <span class="side-panel__chevron" aria-hidden="true">{{
            openSection === 'colour' ? '▾' : '▸'
          }}</span>
        </button>
        <div v-show="openSection === 'colour'" class="side-panel__body">
          <fieldset class="side-panel__themes">
            <legend class="side-panel__label">Theme</legend>
            <label class="theme-swatch">
              <input
                type="radio"
                name="board-theme"
                value="classic"
                class="theme-swatch__input"
                :checked="boardTheme === 'classic'"
                @change="setTheme('classic')"
              />
              <span
                class="theme-swatch__board theme-swatch__board--classic"
                aria-hidden="true"
              >
                <span /><span /><span /><span />
              </span>
              <span class="theme-swatch__name">Classic</span>
            </label>
            <label class="theme-swatch">
              <input
                type="radio"
                name="board-theme"
                value="grey"
                class="theme-swatch__input"
                :checked="boardTheme === 'grey'"
                @change="setTheme('grey')"
              />
              <span
                class="theme-swatch__board theme-swatch__board--grey"
                aria-hidden="true"
              >
                <span /><span /><span /><span />
              </span>
              <span class="theme-swatch__name">Greyscale</span>
            </label>
          </fieldset>
        </div>
      </section>

      <section class="side-panel__section">
        <button
          type="button"
          class="side-panel__heading"
          :aria-expanded="openSection === 'moves'"
          @click="toggleSection('moves')"
        >
          <span>Move List</span>
          <span class="side-panel__chevron" aria-hidden="true">{{
            openSection === 'moves' ? '▾' : '▸'
          }}</span>
        </button>
        <div v-show="openSection === 'moves'" class="side-panel__body">
          <PlayMoveHistory
            v-if="showMoves"
            :history="history"
            :move-qualities="moveQualities"
            :show-move-qualities="showMoveQualities"
            :opening-white-label="openingWhiteLabel"
            :opening-black-label="openingBlackLabel"
            :human-color="humanColor"
            :white-win-pct="whiteWinPct"
            :black-win-pct="blackWinPct"
            :eval-series="evalSeries"
            @update:show-move-qualities="emit('update:showMoveQualities', $event)"
          />
          <p v-else class="side-panel__empty">No moves yet.</p>
        </div>
      </section>

      <section class="side-panel__section">
        <button
          type="button"
          class="side-panel__heading"
          :aria-expanded="openSection === 'stats'"
          @click="toggleSection('stats')"
        >
          <span>Game Stats</span>
          <span class="side-panel__chevron" aria-hidden="true">{{
            openSection === 'stats' ? '▾' : '▸'
          }}</span>
        </button>
        <div v-show="openSection === 'stats'" class="side-panel__body">
          <div class="side-panel__captures" aria-label="Captured pieces">
            <div class="side-panel__capture-col" aria-label="Your losses">
              <span
                v-for="(cap, i) in capturesLeft"
                :key="`L${i}-${cap.type}`"
                class="cg-wrap side-panel__capture"
                aria-hidden="true"
              >
                <piece :class="[pieceName(cap.type), cap.color === 'w' ? 'white' : 'black']" />
              </span>
            </div>
            <div
              class="side-panel__capture-col side-panel__capture-col--right"
              aria-label="Opponent losses"
            >
              <span
                v-for="(cap, i) in capturesRight"
                :key="`R${i}-${cap.type}`"
                class="cg-wrap side-panel__capture"
                aria-hidden="true"
              >
                <piece :class="[pieceName(cap.type), cap.color === 'w' ? 'white' : 'black']" />
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 18rem;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  padding: 0.85rem 0.95rem;
  background: linear-gradient(180deg, rgb(18 40 28 / 0.98), rgb(10 22 16 / 0.99));
  border-left: 1px solid rgb(232 220 200 / 0.16);
  box-shadow: -0.75rem 0 2rem rgb(0 0 0 / 0.35);
  overflow: hidden;
}

.side-panel--pinned {
  box-shadow: none;
  border-left: 1px solid rgb(232 220 200 / 0.14);
  background: rgb(15 36 25 / 0.72);
  backdrop-filter: blur(8px);
}

.side-panel__chrome {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  flex: 0 0 auto;
}

.side-panel__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgb(232 220 200 / 0.28);
  background: transparent;
  color: var(--color-ivory-muted);
  cursor: pointer;
}

.side-panel__icon-btn:hover,
.side-panel__icon-btn[aria-pressed='true'] {
  color: var(--color-ivory);
  border-color: rgb(232 220 200 / 0.5);
  background: rgb(232 220 200 / 0.08);
}

.side-panel__accordion {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.side-panel__section {
  border-bottom: 1px solid rgb(232 220 200 / 0.12);
  padding-bottom: 0.2rem;
}

.side-panel__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.55rem 0;
  border: 0;
  background: transparent;
  color: var(--color-ivory);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-align: left;
  cursor: pointer;
}

.side-panel__heading:hover {
  color: var(--color-ivory-muted);
}

.side-panel__chevron {
  color: var(--color-ivory-muted);
  font-size: 0.75rem;
}

.side-panel__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.15rem 0 0.65rem;
}

.side-panel__status {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-ivory);
}

.side-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.side-panel__label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ivory-muted);
}

.side-panel__select {
  width: 100%;
  padding: 0.45rem 0.5rem;
  border: 1px solid rgb(232 220 200 / 0.28);
  border-radius: 0;
  background: var(--color-felt-deep);
  color: var(--color-ivory);
  color-scheme: dark;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.side-panel__select option {
  background: var(--color-ink);
  color: var(--color-ivory);
}

.side-panel__themes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.side-panel__themes .side-panel__label {
  width: 100%;
  padding: 0;
  margin-bottom: 0.15rem;
}

.theme-swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

.theme-swatch__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.theme-swatch__board {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 3.25rem;
  height: 3.25rem;
  border: 2px solid rgb(232 220 200 / 0.28);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
}

.theme-swatch__input:focus-visible + .theme-swatch__board {
  outline: 2px solid var(--color-ivory);
  outline-offset: 2px;
}

.theme-swatch__input:checked + .theme-swatch__board {
  border-color: var(--color-ivory);
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 0.2),
    0 0 0 1px var(--color-ivory);
}

.theme-swatch__board--classic span:nth-child(1),
.theme-swatch__board--classic span:nth-child(4) {
  background: #f0d9b5;
}

.theme-swatch__board--classic span:nth-child(2),
.theme-swatch__board--classic span:nth-child(3) {
  background: #b58863;
}

.theme-swatch__board--grey span:nth-child(1),
.theme-swatch__board--grey span:nth-child(4) {
  background: #c8c8c8;
}

.theme-swatch__board--grey span:nth-child(2),
.theme-swatch__board--grey span:nth-child(3) {
  background: #8a8a8a;
}

.theme-swatch__name {
  font-size: 0.75rem;
  color: var(--color-ivory-muted);
}

.theme-swatch__input:checked ~ .theme-swatch__name {
  color: var(--color-ivory);
}

.side-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.side-panel__btn {
  flex: 1 1 auto;
  min-width: 4.25rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid rgb(232 220 200 / 0.28);
  border-radius: 0;
  background: transparent;
  color: var(--color-ivory-muted);
  cursor: not-allowed;
}

.side-panel__btn--active {
  color: var(--color-ivory);
  cursor: pointer;
}

.side-panel__btn--active:hover {
  border-color: rgb(232 220 200 / 0.55);
  background: rgb(232 220 200 / 0.08);
}

.side-panel__empty {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-ivory-muted);
}

.side-panel__captures {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2rem;
}

.side-panel__capture-col {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem;
  flex: 1;
  align-content: flex-start;
}

.side-panel__capture-col--right {
  justify-content: flex-end;
}

.side-panel__capture {
  position: relative;
  display: block;
  width: 1.55rem;
  height: 1.55rem;
}

.side-panel__capture :deep(piece) {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none;
}
</style>

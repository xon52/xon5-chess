<script setup lang="ts">
import { ELO_MAX, ELO_MIN, ELO_STEP, snapElo } from '@/game/elo'

const color = defineModel<'w' | 'b'>('color', { required: true })
const elo = defineModel<number>('elo', { required: true })

const emit = defineEmits<{
  start: []
  cancel: []
}>()

const onEloInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  elo.value = snapElo(Number(target.value))
}
</script>

<template>
  <div class="play__action-panel" role="group" aria-label="New game options">
    <fieldset class="play__color">
      <legend class="play__color-legend">Play as</legend>
      <label class="play__color-option">
        <input v-model="color" type="radio" name="human-color" value="w" />
        White
      </label>
      <label class="play__color-option">
        <input v-model="color" type="radio" name="human-color" value="b" />
        Black
      </label>
    </fieldset>

    <label class="play__elo">
      <span class="play__elo-label">Elo</span>
      <input
        class="play__elo-slider"
        type="range"
        :min="ELO_MIN"
        :max="ELO_MAX"
        :step="ELO_STEP"
        :value="elo"
        @input="onEloInput"
      />
      <span class="play__elo-value">{{ elo }}</span>
    </label>

    <div class="play__actions">
      <button type="button" class="play__btn play__btn--active" @click="emit('start')">
        Start
      </button>
      <button type="button" class="play__btn play__btn--active" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.play__action-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.play__elo {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.65rem;
}

.play__elo-label,
.play__color-legend {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-ivory-muted);
}

.play__elo-slider {
  width: 100%;
  accent-color: var(--color-walnut-light);
  cursor: pointer;
}

.play__elo-value {
  font-variant-numeric: tabular-nums;
  min-width: 2.5rem;
  text-align: right;
  color: var(--color-ivory);
}

.play__color {
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.play__color-legend {
  width: 100%;
  padding: 0;
}

.play__color-option {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.95rem;
  color: var(--color-ivory);
  cursor: pointer;
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
</style>

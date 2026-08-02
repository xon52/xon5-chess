<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import confetti from 'canvas-confetti'

import {
  randomDrawButton,
  randomLossButton,
  randomWinButton,
} from '@/play/endgameCopy'

const props = defineProps<{
  kind: 'win' | 'loss' | 'draw'
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const title = computed(() => {
  if (props.kind === 'win') {
    return 'You won'
  }
  if (props.kind === 'loss') {
    return 'You died'
  }
  return 'Even stevens.'
})

const buttonLabel = computed(() => {
  if (props.kind === 'win') {
    return randomWinButton()
  }
  if (props.kind === 'loss') {
    return randomLossButton()
  }
  return randomDrawButton()
})

const fireWinConfetti = () => {
  const opts = {
    particleCount: 70,
    spread: 55,
    startVelocity: 45,
    gravity: 0.9,
    ticks: 200,
    colors: ['#e8dcc8', '#c4b49a', '#6fbf73', '#f0d9b5', '#d4a574'],
  }
  confetti({ ...opts, origin: { x: 0.08, y: 1 } })
  confetti({ ...opts, origin: { x: 0.92, y: 1 } })
}

onMounted(() => {
  if (props.kind === 'win') {
    fireWinConfetti()
  }
})

watch(
  () => props.kind,
  (kind) => {
    if (kind === 'win') {
      fireWinConfetti()
    }
  },
)
</script>

<template>
  <div
    class="endgame"
    :class="`endgame--${kind}`"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
  >
    <div class="endgame__backdrop" aria-hidden="true" />
    <div v-if="kind === 'draw'" class="endgame__shimmer" aria-hidden="true" />
    <div class="endgame__dialog">
      <p class="endgame__title">{{ title }}</p>
      <button type="button" class="endgame__btn" @click="emit('dismiss')">
        {{ buttonLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.endgame {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.endgame__backdrop {
  position: absolute;
  inset: 0;
}

.endgame--loss .endgame__backdrop {
  background: rgb(0 0 0 / 0);
  animation: endgame-darken 1.1s var(--ease-out) forwards;
}

.endgame--win .endgame__backdrop,
.endgame--draw .endgame__backdrop {
  background: rgb(12 10 8 / 0.35);
}

.endgame__shimmer {
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(220 220 230 / 0.55) 0%,
    rgb(180 185 195 / 0.2) 45%,
    transparent 70%
  );
  animation: endgame-shimmer 1.4s var(--ease-out) both;
  pointer-events: none;
}

.endgame__dialog {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  min-width: min(100%, 14rem);
  padding: 1.25rem 1.5rem;
  background: linear-gradient(160deg, var(--color-walnut-light), var(--color-board-edge));
  border: 1px solid rgb(232 220 200 / 0.22);
  box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.45);
}

.endgame--loss .endgame__dialog {
  background: linear-gradient(160deg, #2a1818, #120808);
  border-color: rgb(180 80 80 / 0.35);
  animation: endgame-fade-in 1.2s var(--ease-out) 0.35s both;
}

.endgame--win .endgame__dialog,
.endgame--draw .endgame__dialog {
  animation: endgame-fade-in 0.55s var(--ease-out) both;
}

.endgame__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 500;
  color: var(--color-ivory);
  text-align: center;
}

.endgame--loss .endgame__title {
  color: #e8c8c8;
}

.endgame__btn {
  min-width: 8rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid rgb(232 220 200 / 0.35);
  border-radius: 0;
  background: transparent;
  color: var(--color-ivory);
  cursor: pointer;
}

.endgame__btn:hover {
  border-color: rgb(232 220 200 / 0.6);
  background: rgb(232 220 200 / 0.08);
}

@keyframes endgame-darken {
  to {
    background: rgb(0 0 0 / 0.72);
  }
}

@keyframes endgame-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes endgame-shimmer {
  from {
    opacity: 0;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

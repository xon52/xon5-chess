<script setup lang="ts">
import { PROMOTION_CHOICES, type PromotionPiece } from '@/play/formatters'

defineProps<{
  mode: 'promote' | 'resign-confirm'
  promoColorClass: 'white' | 'black'
}>()

const emit = defineEmits<{
  choose: [piece: PromotionPiece]
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div
    class="play__modal"
    role="dialog"
    aria-modal="true"
    :aria-label="mode === 'promote' ? 'Choose promotion piece' : 'Confirm resign'"
  >
    <div class="play__modal-backdrop" aria-hidden="true" />
    <div class="play__modal-dialog">
      <template v-if="mode === 'promote'">
        <p class="play__action-prompt">Promote to</p>
        <div class="play__actions play__actions--promo">
          <button
            v-for="choice in PROMOTION_CHOICES"
            :key="choice.piece"
            type="button"
            class="play__btn play__btn--active play__promo-btn"
            :aria-label="`Promote to ${choice.label}`"
            @click="emit('choose', choice.piece)"
          >
            <span class="cg-wrap play__promo-icon" aria-hidden="true">
              <piece :class="[choice.name, promoColorClass]" />
            </span>
          </button>
        </div>
        <div class="play__actions">
          <button type="button" class="play__btn play__btn--active" @click="emit('cancel')">
            Cancel
          </button>
        </div>
      </template>
      <template v-else>
        <p class="play__action-prompt">Resign and end this game?</p>
        <div class="play__actions">
          <button type="button" class="play__btn play__btn--active" @click="emit('confirm')">
            Confirm
          </button>
          <button type="button" class="play__btn play__btn--active" @click="emit('cancel')">
            Cancel
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.play__action-prompt {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-ivory);
}

.play__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.play__actions--promo {
  margin-top: 0;
}

.play__promo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  padding: 0.35rem;
}

.play__promo-icon {
  position: relative;
  display: block;
  width: 2.5rem;
  height: 2.5rem;
}

.play__promo-icon :deep(piece) {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none;
}

.play__modal {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.play__modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(12 10 8 / 0.62);
}

.play__modal-dialog {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: min(100%, 16rem);
  max-width: 20rem;
  padding: 1.1rem 1.25rem;
  background: linear-gradient(160deg, var(--color-walnut-light), var(--color-board-edge));
  box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 0.45);
  border: 1px solid rgb(232 220 200 / 0.22);
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

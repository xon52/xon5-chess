<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  from: string
  to: string
  /** chess.js piece type: n = knight → L arrow */
  piece: string
  orientation: 'white' | 'black'
}>()

const wrapEl = ref<HTMLElement | null>(null)
const boardW = ref(0)
const boardH = ref(0)

let observer: ResizeObserver | null = null

const measure = () => {
  const el = wrapEl.value?.parentElement
  if (!el) {
    return
  }
  boardW.value = el.clientWidth
  boardH.value = el.clientHeight
}

onMounted(() => {
  measure()
  const parent = wrapEl.value?.parentElement
  if (parent && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => measure())
    observer.observe(parent)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

watch(
  () => [props.from, props.to, props.orientation] as const,
  () => measure(),
)

const fileIndex = (sq: string) => sq.charCodeAt(0) - 'a'.charCodeAt(0)
const rankIndex = (sq: string) => Number(sq[1]) - 1

const squareCenter = (sq: string): { x: number; y: number } => {
  const cellX = (boardW.value || 1) / 8
  const cellY = (boardH.value || 1) / 8
  let file = fileIndex(sq)
  let rank = rankIndex(sq)
  if (props.orientation === 'black') {
    file = 7 - file
    rank = 7 - rank
  }
  return {
    x: (file + 0.5) * cellX,
    y: (7 - rank + 0.5) * cellY,
  }
}

const squareRect = (sq: string): { x: number; y: number; w: number; h: number } => {
  const cellX = (boardW.value || 1) / 8
  const cellY = (boardH.value || 1) / 8
  const c = squareCenter(sq)
  return { x: c.x - cellX / 2, y: c.y - cellY / 2, w: cellX, h: cellY }
}

const isKnight = computed(() => props.piece === 'n')

const pathD = computed(() => {
  const a = squareCenter(props.from)
  const b = squareCenter(props.to)
  if (!isKnight.value) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  }

  const cellX = (boardW.value || 1) / 8
  const cellY = (boardH.value || 1) / 8
  const dx = b.x - a.x
  const dy = b.y - a.y
  let midX = a.x
  let midY = a.y
  if (Math.abs(dx) > Math.abs(dy)) {
    midX = a.x + Math.sign(dx || 1) * 2 * cellX
    midY = a.y
  } else {
    midX = a.x
    midY = a.y + Math.sign(dy || 1) * 2 * cellY
  }
  return `M ${a.x} ${a.y} L ${midX} ${midY} L ${b.x} ${b.y}`
})

const arrowHead = computed(() => {
  const a = squareCenter(props.from)
  const b = squareCenter(props.to)
  let x1 = a.x
  let y1 = a.y
  if (isKnight.value) {
    const cellX = (boardW.value || 1) / 8
    const cellY = (boardH.value || 1) / 8
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.abs(dx) > Math.abs(dy)) {
      x1 = a.x + Math.sign(dx) * 2 * cellX
      y1 = a.y
    } else {
      x1 = a.x
      y1 = a.y + Math.sign(dy) * 2 * cellY
    }
  }
  const angle = Math.atan2(b.y - y1, b.x - x1)
  const len = Math.max(8, Math.min(boardW.value, boardH.value) * 0.035)
  const left = {
    x: b.x - len * Math.cos(angle - Math.PI / 6),
    y: b.y - len * Math.sin(angle - Math.PI / 6),
  }
  const right = {
    x: b.x - len * Math.cos(angle + Math.PI / 6),
    y: b.y - len * Math.sin(angle + Math.PI / 6),
  }
  return `M ${b.x} ${b.y} L ${left.x} ${left.y} M ${b.x} ${b.y} L ${right.x} ${right.y}`
})

const fromRect = computed(() => squareRect(props.from))
const toRect = computed(() => squareRect(props.to))
const ready = computed(() => boardW.value > 0 && boardH.value > 0)
</script>

<template>
  <div ref="wrapEl" class="hint-arrow" aria-hidden="true">
    <svg
      v-if="ready"
      class="hint-arrow__svg"
      :viewBox="`0 0 ${boardW} ${boardH}`"
      preserveAspectRatio="none"
    >
      <rect
        class="hint-arrow__sq"
        :x="fromRect.x"
        :y="fromRect.y"
        :width="fromRect.w"
        :height="fromRect.h"
      />
      <rect
        class="hint-arrow__sq"
        :x="toRect.x"
        :y="toRect.y"
        :width="toRect.w"
        :height="toRect.h"
      />
      <path class="hint-arrow__line" :d="pathD" fill="none" />
      <path class="hint-arrow__head" :d="arrowHead" fill="none" />
    </svg>
  </div>
</template>

<style scoped>
.hint-arrow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.hint-arrow__svg {
  display: block;
  width: 100%;
  height: 100%;
}

.hint-arrow__sq {
  fill: rgb(255 255 255 / 0.28);
}

.hint-arrow__line,
.hint-arrow__head {
  stroke: #fff;
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 2px rgb(0 0 0 / 0.55));
}
</style>

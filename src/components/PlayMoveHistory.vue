<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { buildEvalChartPaths, type EvalPoint } from '@/play/evalChart'
import {
  formatEvalDisplay,
  formatFigurineSan,
  plyColor,
} from '@/play/formatters'
import { moveQualityIcon } from '@/play/moveQualityIcon'
import type { FlairLogQuality } from '@/engine'

const props = defineProps<{
  history: string[]
  moveQualities: FlairLogQuality[]
  showMoveQualities: boolean
  whiteWinPct: number | null
  blackWinPct: number | null
  evalSeries: EvalPoint[]
}>()

const emit = defineEmits<{
  'update:showMoveQualities': [value: boolean]
}>()

const CHART_W = 200
const CHART_H = 64

const showGraph = computed(() => props.history.length >= 2)

const evalTitle = computed(() =>
  formatEvalDisplay(props.whiteWinPct, props.blackWinPct),
)

const chartPaths = computed(() =>
  buildEvalChartPaths(props.evalSeries, {
    width: CHART_W,
    height: CHART_H,
    padX: 6,
    padY: 6,
  }),
)

const figurinePlies = computed(() =>
  props.history.map((san, i) => {
    const color = plyColor(i)
    const quality = props.moveQualities[i]
    return {
      san,
      color,
      figurine: formatFigurineSan(san, color),
      icon: quality ? moveQualityIcon(quality) : null,
    }
  }),
)

const historyListEl = ref<HTMLElement | null>(null)

watch(
  () => props.history,
  (historySans) => {
    if (historySans.length === 0) {
      return
    }
    const el = historyListEl.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  },
  { flush: 'post' },
)

const onToggleQualities = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:showMoveQualities', target.checked)
}

const iconGlyph = (kind: string) => {
  switch (kind) {
    case 'double-up':
      return '⇈'
    case 'up':
      return '↑'
    case 'down':
      return '↓'
    case 'double-down':
      return '⇊'
    default:
      return '●'
  }
}
</script>

<template>
  <div class="play__history">
    <template v-if="showGraph">
      <h2 class="play__history-title" aria-label="Win probability">{{ evalTitle }}</h2>
      <svg
        class="play__eval-chart"
        :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
        role="img"
        aria-label="Win probability over moves"
        preserveAspectRatio="none"
      >
        <line
          class="play__eval-chart-mid"
          x1="0"
          :y1="chartPaths.midlineY"
          :x2="CHART_W"
          :y2="chartPaths.midlineY"
        />
        <path
          v-if="chartPaths.green"
          class="play__eval-chart-line play__eval-chart-line--green"
          :d="chartPaths.green"
          fill="none"
        />
        <path
          v-if="chartPaths.red"
          class="play__eval-chart-line play__eval-chart-line--red"
          :d="chartPaths.red"
          fill="none"
        />
      </svg>
    </template>

    <div
      ref="historyListEl"
      class="play__history-list"
      aria-label="Move history"
    >
      <ol class="play__history-sans">
        <li
          v-for="(ply, i) in figurinePlies"
          :key="i"
          :class="ply.color === 'w' ? 'ply--w' : 'ply--b'"
          :aria-label="ply.san"
        >
          <span class="ply__san">{{ ply.figurine }}</span>
          <span
            v-if="showMoveQualities && ply.icon"
            class="ply__quality"
            :class="`ply__quality--${ply.icon.tone}`"
            :title="ply.icon.label"
            aria-hidden="true"
          >{{ iconGlyph(ply.icon.kind) }}</span>
        </li>
      </ol>
    </div>

    <label class="play__history-toggle">
      <input
        type="checkbox"
        :checked="showMoveQualities"
        @change="onToggleQualities"
      />
      <span>Show move qualities</span>
    </label>
  </div>
</template>

<style scoped>
.play__history {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.play__history-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--color-ivory);
}

.play__eval-chart {
  display: block;
  width: 100%;
  height: 4rem;
}

.play__eval-chart-mid {
  stroke: rgb(232 220 200 / 0.28);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.play__eval-chart-line {
  stroke-width: 2.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.play__eval-chart-line--green {
  stroke: #6fbf73;
}

.play__eval-chart-line--red {
  stroke: #d45d5d;
}

.play__history-list {
  height: 9.5rem;
  overflow-y: auto;
  border: 1px solid rgb(232 220 200 / 0.18);
  padding: 0.35rem 0.5rem;
}

.play__history-sans {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-variant-numeric: tabular-nums;
}

.play__history-sans li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0;
}

.ply--w {
  color: var(--color-ivory);
}

.ply--b {
  color: #8a7a66;
}

.ply__quality {
  flex: 0 0 auto;
  font-size: 0.95rem;
  line-height: 1;
}

.ply__quality--brilliant,
.ply__quality--great {
  color: #6fbf73;
}

.ply__quality--good,
.ply__quality--poor,
.ply__quality--neutral {
  color: #9a9a9a;
}

.ply__quality--mistake,
.ply__quality--blunder {
  color: #d45d5d;
}

.ply__quality--neutral {
  font-size: 0.55rem;
  vertical-align: middle;
}

.play__history-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-ivory-muted);
  cursor: pointer;
}

.play__history-toggle input {
  accent-color: var(--color-ivory-muted);
}
</style>

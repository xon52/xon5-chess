<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { buildEvalChartPaths, type EvalPoint } from '@/play/evalChart'
import {
  formatEvalDisplay,
  formatFigurineSan,
  plyColor,
} from '@/play/formatters'

const props = defineProps<{
  history: string[]
  whiteWinPct: number | null
  blackWinPct: number | null
  evalSeries: EvalPoint[]
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
    return {
      san,
      color,
      figurine: formatFigurineSan(san, color),
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
      el.scrollLeft = el.scrollWidth
    }
  },
  { flush: 'post' },
)
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
          {{ ply.figurine }}
        </li>
      </ol>
    </div>
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
  overflow-x: auto;
  border-bottom: 1px solid rgb(232 220 200 / 0.18);
  padding-bottom: 0.35rem;
}

.play__history-sans {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.55rem;
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.play__history-sans li {
  margin: 0;
  flex: 0 0 auto;
}

.ply--w {
  color: var(--color-ivory);
}

.ply--b {
  color: #8a7a66;
}
</style>

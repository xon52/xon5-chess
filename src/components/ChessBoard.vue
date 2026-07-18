<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Key } from '@lichess-org/chessground/types'

export type BoardMove = {
  from: string
  to: string
}

const props = withDefaults(
  defineProps<{
    fen: string
    turn: 'w' | 'b'
    orientation?: 'white' | 'black'
    dests: Map<string, string[]>
    lastMove?: [string, string]
    /**
     * When true, the human cannot move. Do not map this straight to chessground
     * `viewOnly`: that flag only binds pointer events at init, so starting locked
     * would permanently disable the board after New Game unlocks it.
     */
    viewOnly?: boolean
    /** Side the human may move; ignored when locked. */
    movableColor?: 'white' | 'black'
  }>(),
  {
    orientation: 'white',
    viewOnly: false,
    movableColor: 'white',
  },
)

const emit = defineEmits<{
  move: [BoardMove]
}>()

const boardEl = ref<HTMLElement | null>(null)
let cg: Api | null = null

function turnColor(): 'white' | 'black' {
  return props.turn === 'w' ? 'white' : 'black'
}

function asDests(): Map<Key, Key[]> {
  if (props.viewOnly) {
    return new Map()
  }
  const dests = new Map<Key, Key[]>()
  for (const [from, tos] of props.dests) {
    dests.set(from as Key, tos as Key[])
  }
  return dests
}

function asLastMove(): Key[] | undefined {
  if (!props.lastMove) {
    return undefined
  }
  return props.lastMove as Key[]
}

function destsWatchKey(): string {
  if (props.viewOnly) {
    return 'locked'
  }
  return [...props.dests.entries()]
    .map(([from, tos]) => `${from}:${tos.join(',')}`)
    .sort()
    .join('|')
}

function boardConfig() {
  const locked = props.viewOnly
  return {
    fen: props.fen,
    orientation: props.orientation,
    turnColor: turnColor(),
    lastMove: asLastMove(),
    // Always false so pointer listeners are bound at init and stay bound.
    viewOnly: false,
    movable: {
      free: false,
      color: locked ? undefined : props.movableColor,
      dests: asDests(),
      showDests: true,
      events: {
        after(orig: Key, dest: Key) {
          emit('move', { from: orig, to: dest })
          // Parent updates the store synchronously; re-apply so rejected moves snap back.
          void nextTick(() => {
            cg?.set(boardConfig())
          })
        },
      },
    },
    highlight: {
      lastMove: true,
      check: true,
    },
    draggable: {
      enabled: !locked,
    },
    selectable: {
      enabled: !locked,
    },
  }
}

onMounted(() => {
  if (!boardEl.value) {
    return
  }
  cg = Chessground(boardEl.value, boardConfig())
})

onBeforeUnmount(() => {
  cg?.destroy()
  cg = null
})

watch(
  () =>
    [
      props.fen,
      props.turn,
      props.orientation,
      destsWatchKey(),
      props.lastMove?.[0],
      props.lastMove?.[1],
      props.viewOnly,
      props.movableColor,
    ] as const,
  () => {
    cg?.set(boardConfig())
  },
)
</script>

<template>
  <!-- cg-wrap required by chessground before init for correct bounds/CSS. -->
  <div ref="boardEl" class="cg-wrap cg-board-wrap" />
</template>

<style scoped>
.cg-board-wrap {
  width: 100%;
  height: 100%;
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useGameStore } from '@/stores/game'

const route = useRoute()
const game = useGameStore()
const { panelOpen, panelPinned } = storeToRefs(game)

const onPlayRoute = computed(() => route.name === 'play')

const panelExpanded = computed(() => panelPinned.value || panelOpen.value)

const togglePanel = () => {
  if (panelPinned.value) {
    // Unpinning collapses to closed; pinning keeps open.
    game.setPanelPinned(false)
    game.setPanelOpen(false)
    return
  }
  game.setPanelOpen(!panelOpen.value)
}
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--play': onPlayRoute }">
    <header class="app-nav">
      <RouterLink class="app-nav__brand" to="/">xon5-chess</RouterLink>
      <div class="app-nav__end">
        <nav class="app-nav__links" aria-label="Main">
          <RouterLink class="app-nav__link" to="/">Home</RouterLink>
          <RouterLink class="app-nav__link" to="/play">Play</RouterLink>
          <RouterLink class="app-nav__link" to="/stats">Stats</RouterLink>
          <RouterLink class="app-nav__link" to="/about">About</RouterLink>
        </nav>
        <button
          v-if="onPlayRoute"
          type="button"
          class="app-nav__panel-btn"
          :aria-expanded="panelExpanded"
          :aria-label="panelExpanded ? 'Hide game panel' : 'Show game panel'"
          :title="panelExpanded ? 'Hide panel' : 'Show panel'"
          @click="togglePanel"
        >
          <svg
            class="app-nav__icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
            />
            <path
              d="M15 4v16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
            />
            <rect
              x="15.75"
              y="5.5"
              width="4.5"
              height="13"
              fill="currentColor"
              opacity="0.35"
            />
          </svg>
        </button>
      </div>
    </header>
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.app-shell--play {
  height: 100dvh;
  overflow: hidden;
}

.app-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  flex: 0 0 auto;
  padding: 0.85rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid rgb(232 220 200 / 0.14);
  background: rgb(15 36 25 / 0.72);
  backdrop-filter: blur(8px);
  z-index: 40;
}

.app-nav__brand {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-decoration: none;
  color: var(--color-ivory);
}

.app-nav__brand:hover {
  color: #fff;
}

.app-nav__end {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-nav__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1.1rem;
}

.app-nav__link {
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--color-ivory-muted);
}

.app-nav__link:hover {
  color: var(--color-ivory);
}

.app-nav__link.router-link-active {
  color: var(--color-ivory);
  text-decoration: underline;
  text-underline-offset: 0.3em;
}

.app-nav__panel-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid rgb(232 220 200 / 0.28);
  background: transparent;
  color: var(--color-ivory-muted);
  cursor: pointer;
}

.app-nav__panel-btn:hover,
.app-nav__panel-btn[aria-expanded='true'] {
  color: var(--color-ivory);
  border-color: rgb(232 220 200 / 0.55);
  background: rgb(232 220 200 / 0.08);
}

.app-nav__icon {
  display: block;
}
</style>

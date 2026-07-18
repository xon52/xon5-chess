<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-nav">
      <RouterLink class="app-nav__brand" to="/">xon5-chess</RouterLink>
      <nav class="app-nav__links" aria-label="Main">
        <RouterLink class="app-nav__link" to="/">Home</RouterLink>
        <RouterLink class="app-nav__link" to="/play">Play</RouterLink>
        <RouterLink class="app-nav__link" to="/stats">Stats</RouterLink>
        <RouterLink class="app-nav__link" to="/about">About</RouterLink>
      </nav>
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

.app-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1.5rem;
  padding: 0.85rem clamp(1rem, 3vw, 2rem);
  border-bottom: 1px solid rgb(232 220 200 / 0.14);
  background: rgb(15 36 25 / 0.55);
  backdrop-filter: blur(8px);
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
</style>

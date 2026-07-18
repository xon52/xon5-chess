<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="home">
    <h1 class="home__brand">xon5-chess</h1>
    <p class="home__pitch">
      Local chess against the computer — learn your game, spot weak spots, get stronger.
    </p>
    <RouterLink class="home__cta" to="/play">Play</RouterLink>
  </main>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  padding: clamp(1.5rem, 5vw, 3rem);
  text-align: center;
  animation: home-enter 0.7s var(--ease-out) both;
}

.home__brand {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 8vw, 4.5rem);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-ivory);
  animation: brand-settle 0.9s var(--ease-out) 0.1s both;
}

.home__pitch {
  margin: 0;
  max-width: 28rem;
  font-size: 1.15rem;
  line-height: 1.45;
  color: var(--color-ivory-muted);
}

.home__cta {
  margin-top: 0.5rem;
  padding: 0.7rem 1.75rem;
  border: 1px solid rgb(232 220 200 / 0.45);
  text-decoration: none;
  font-weight: 600;
  color: var(--color-ivory);
  transition:
    background 0.2s var(--ease-out),
    border-color 0.2s var(--ease-out);
}

.home__cta:hover {
  border-color: rgb(232 220 200 / 0.75);
  background: rgb(232 220 200 / 0.1);
}

@keyframes home-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes brand-settle {
  from {
    opacity: 0;
    transform: translateY(-0.4rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

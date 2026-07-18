<template>
  <main class="page">
    <h1 class="page__title">Stats</h1>
    <p class="page__body">No games recorded yet.</p>
    <p class="page__muted">
      Progress tracking will live here — wins, losses, and strength over time — all kept on this
      device.
    </p>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  padding: clamp(1.5rem, 4vw, 2.5rem);
  text-align: center;
}

.page__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 700;
  color: var(--color-ivory);
}

.page__body {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-ivory);
}

.page__muted {
  margin: 0;
  max-width: 28rem;
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--color-ivory-muted);
}
</style>

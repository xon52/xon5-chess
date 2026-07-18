<template>
  <main class="page">
    <h1 class="page__title">About</h1>
    <div class="page__prose">
      <p>
        <strong>xon5-chess</strong> is a free, 100% local chess app. There are no network calls for
        play, no human opponents online — just you and a computer opponent on your device.
      </p>
      <p>
        The focus is teaching: help you notice weak parts of your game and get stronger over time.
        No ads. No purchases.
      </p>
      <p>
        I’m a software developer who loves to build things. After paying off my house, I decided I
        don’t need to keep chasing that money — free, simple apps like this are how I give back.
      </p>
    </div>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.page__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 700;
  color: var(--color-ivory);
}

.page__prose {
  max-width: 36rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page__prose p {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--color-ivory-muted);
}

.page__prose strong {
  color: var(--color-ivory);
  font-weight: 600;
}
</style>

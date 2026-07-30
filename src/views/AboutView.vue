<script setup lang="ts">
import { ENGINE_CATALOG } from '@/engines/registry'
import { STOCKFISH_CONFIGS } from '@/engines/stockfish/configs'
</script>

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

      <h2 class="page__subtitle">Engines</h2>
      <p>
        Pick an <strong>engine</strong> and a <strong>config</strong> for that engine. Win%
        evaluation always uses full-strength Stockfish so the graph is not poisoned by weaker play
        settings.
      </p>
      <ul>
        <li v-for="eng in ENGINE_CATALOG" :key="eng.id">
          <strong>{{ eng.label }}</strong> — {{ eng.configs.length }} config(s)
        </li>
      </ul>

      <h2 class="page__subtitle">Stockfish levels</h2>
      <div class="page__table-wrap" role="region" aria-label="Stockfish configs">
        <table class="page__table">
          <thead>
            <tr>
              <th scope="col">Config</th>
              <th scope="col">Skill</th>
              <th scope="col">Depth</th>
              <th scope="col">Profile</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="band in STOCKFISH_CONFIGS" :key="band.id">
              <td>{{ band.label }}</td>
              <td>{{ band.playSkill }}</td>
              <td>{{ band.playDepth }}</td>
              <td>{{ band.profile }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Maia needs ONNX weights fetched once with <code>pnpm fetch:maia</code> before that engine
        can play.
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

.page__subtitle {
  margin: 0.75rem 0 0;
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-ivory);
}

.page__prose {
  max-width: 42rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.page__prose p,
.page__prose li {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--color-ivory-muted);
}

.page__prose ul {
  margin: 0;
  padding-left: 1.25rem;
}

.page__prose strong {
  color: var(--color-ivory);
  font-weight: 600;
}

.page__prose code {
  font-size: 0.9em;
  color: var(--color-ivory);
}

.page__table-wrap {
  overflow-x: auto;
  margin-top: 0.25rem;
}

.page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--color-ivory-muted);
}

.page__table th,
.page__table td {
  padding: 0.55rem 0.65rem;
  text-align: left;
  border-bottom: 1px solid rgb(232 220 200 / 0.18);
  vertical-align: top;
}

.page__table th {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-ivory);
  white-space: nowrap;
}

.page__table td:nth-child(1),
.page__table td:nth-child(2),
.page__table td:nth-child(3) {
  white-space: nowrap;
  color: var(--color-ivory);
}
</style>

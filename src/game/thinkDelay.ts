/** Pad elapsed search time so interactive engine replies feel human. */
export const ENGINE_THINK_MIN_MS = 500
export const ENGINE_THINK_MAX_MS = 1500

export const randomThinkTargetMs = (
  minMs = ENGINE_THINK_MIN_MS,
  maxMs = ENGINE_THINK_MAX_MS,
  random: () => number = Math.random,
): number => {
  const lo = Math.min(minMs, maxMs)
  const hi = Math.max(minMs, maxMs)
  return Math.floor(lo + random() * (hi - lo + 1))
}

/** Milliseconds still needed so (elapsed + pad) reaches target. */
export const remainingThinkPadMs = (
  elapsedMs: number,
  targetMs: number,
): number => Math.max(0, Math.ceil(targetMs - elapsedMs))

export const sleepMs = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms))

export const ELO_MIN = 500
export const ELO_MAX = 2000
export const ELO_STEP = 50
export const ELO_DEFAULT = 1200

/** Clamp and snap to the product Elo grid (500–2000, step 50). */
export const snapElo = (value: number): number => {
  const clamped = Math.min(ELO_MAX, Math.max(ELO_MIN, value))
  return Math.round(clamped / ELO_STEP) * ELO_STEP
}

const pick = <T>(items: readonly T[], random: () => number = Math.random): T =>
  items[Math.floor(random() * items.length)]!

export const WIN_BUTTONS = [
  'Yay!',
  'Sweet',
  "I'm that good.",
  'Nailed it',
  'Easy',
  'Boom',
] as const

export const LOSS_BUTTONS = [
  "I won't quit my day job",
  "'Tis but a flesh wound",
  'Ouch',
  'Rematch… maybe',
  'That stung',
  'Back to the drawing board',
] as const

export const DRAW_BUTTONS = [
  'Rematch?',
  'We both tried',
  'Even stevens',
  'Fair enough',
  'Split the points',
] as const

export const randomWinButton = (random?: () => number) => pick(WIN_BUTTONS, random)
export const randomLossButton = (random?: () => number) => pick(LOSS_BUTTONS, random)
export const randomDrawButton = (random?: () => number) => pick(DRAW_BUTTONS, random)

const pick = <T>(items: readonly T[], random: () => number = Math.random): T =>
  items[Math.floor(random() * items.length)]!

export const WIN_LINES = [
  'Clean as a whistle.',
  'Theory optional. Vibes mandatory.',
  'The pieces believed in you.',
  'That was rude (in a good way).',
  'Stockfish is taking notes.',
  'Checkmate tastes like victory.',
] as const

export const LOSS_LINES = [
  'A learning opportunity, allegedly.',
  'The king had somewhere to be.',
  'Bold strategy. Mixed results.',
  'Even Magnus blinks.',
  'The board will forget. Eventually.',
  'Rematch fuel acquired.',
] as const

export const DRAW_LINES = [
  'Peace was always an option.',
  'Honours even. Ego bruised equally.',
  'Neither of you blinked first.',
  'A diplomatic masterpiece.',
  'The pawns called a truce.',
] as const

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

export const randomWinLine = (random?: () => number) => pick(WIN_LINES, random)
export const randomLossLine = (random?: () => number) => pick(LOSS_LINES, random)
export const randomDrawLine = (random?: () => number) => pick(DRAW_LINES, random)
export const randomWinButton = (random?: () => number) => pick(WIN_BUTTONS, random)
export const randomLossButton = (random?: () => number) => pick(LOSS_BUTTONS, random)
export const randomDrawButton = (random?: () => number) => pick(DRAW_BUTTONS, random)

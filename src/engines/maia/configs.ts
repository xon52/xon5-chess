/**
 * Maia rating-net configs. ONNX files live under maia/onnx/ (gitignored; fetch via pnpm fetch:maia).
 */

export type MaiaConfig = {
  id: string
  label: string
  /** Rating tag matching maia-{rating}-opset15.onnx */
  rating: number
}

export const MAIA_CONFIGS: readonly MaiaConfig[] = [
  { id: 'maia-1100', label: 'Maia 1100', rating: 1100 },
  { id: 'maia-1200', label: 'Maia 1200', rating: 1200 },
  { id: 'maia-1300', label: 'Maia 1300', rating: 1300 },
  { id: 'maia-1400', label: 'Maia 1400', rating: 1400 },
  { id: 'maia-1500', label: 'Maia 1500', rating: 1500 },
  { id: 'maia-1600', label: 'Maia 1600', rating: 1600 },
  { id: 'maia-1700', label: 'Maia 1700', rating: 1700 },
  { id: 'maia-1800', label: 'Maia 1800', rating: 1800 },
  { id: 'maia-1900', label: 'Maia 1900', rating: 1900 },
] as const

export const DEFAULT_MAIA_CONFIG_ID = 'maia-1100'

const byId = new Map(MAIA_CONFIGS.map((c) => [c.id, c]))

export const getMaiaConfig = (id: string): MaiaConfig =>
  byId.get(id) ?? MAIA_CONFIGS[0]!

export const maiaOnnxUrl = (rating: number): string =>
  new URL(`./onnx/maia-${rating}-opset15.onnx`, import.meta.url).href

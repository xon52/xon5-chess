export type EvalPoint = { ply: number; white: number }

export type EvalChartPaths = {
  green: string
  red: string
  midlineY: number
}

type XY = { x: number; y: number }

const sideOf = (white: number): 'green' | 'red' | 'neutral' => {
  if (white > 50) {
    return 'green'
  }
  if (white < 50) {
    return 'red'
  }
  return 'neutral'
}

/** Map White % to SVG y (0% at bottom, 100% at top). */
const pctToY = (white: number, height: number, padY: number): number => {
  const inner = height - padY * 2
  return padY + inner * (1 - white / 100)
}

const toPoints = (
  series: EvalPoint[],
  width: number,
  height: number,
  padX: number,
  padY: number,
): XY[] => {
  if (series.length === 0) {
    return []
  }
  const minPly = series[0]!.ply
  const maxPly = series[series.length - 1]!.ply
  const span = Math.max(1, maxPly - minPly)
  const innerW = width - padX * 2
  return series.map((p) => ({
    x: padX + ((p.ply - minPly) / span) * innerW,
    y: pctToY(p.white, height, padY),
  }))
}

const appendLine = (
  parts: string[],
  last: { point: XY | null },
  from: XY,
  to: XY,
) => {
  const continuous =
    last.point !== null && last.point.x === from.x && last.point.y === from.y
  if (!continuous) {
    parts.push(`M ${from.x} ${from.y}`)
  }
  parts.push(`L ${to.x} ${to.y}`)
  last.point = to
}

/**
 * Build SVG path `d` strings for White win% series.
 * Green when White > 50; red when White < 50; crosses 50 via interpolated points.
 */
export const buildEvalChartPaths = (
  series: EvalPoint[],
  opts: { width: number; height: number; padX?: number; padY?: number },
): EvalChartPaths => {
  const padX = opts.padX ?? 4
  const padY = opts.padY ?? 4
  const midlineY = pctToY(50, opts.height, padY)
  const coords = toPoints(series, opts.width, opts.height, padX, padY)

  if (coords.length === 0) {
    return { green: '', red: '', midlineY }
  }

  if (coords.length === 1) {
    const p = coords[0]!
    const side = sideOf(series[0]!.white)
    const d = `M ${p.x} ${p.y} L ${p.x} ${p.y}`
    return {
      green: side === 'green' ? d : '',
      red: side === 'red' ? d : '',
      midlineY,
    }
  }

  const green: string[] = []
  const red: string[] = []
  const greenLast = { point: null as XY | null }
  const redLast = { point: null as XY | null }

  for (let i = 0; i < coords.length - 1; i++) {
    const a = series[i]!
    const b = series[i + 1]!
    const pa = coords[i]!
    const pb = coords[i + 1]!
    const sa = sideOf(a.white)
    const sb = sideOf(b.white)

    if (sa === sb || sa === 'neutral' || sb === 'neutral') {
      const side = sa !== 'neutral' ? sa : sb
      if (side === 'green') {
        appendLine(green, greenLast, pa, pb)
      } else if (side === 'red') {
        appendLine(red, redLast, pa, pb)
      }
      continue
    }

    // Cross the 50% midline between a and b.
    const t = (50 - a.white) / (b.white - a.white)
    const cross: XY = {
      x: pa.x + (pb.x - pa.x) * t,
      y: midlineY,
    }
    if (sa === 'green') {
      appendLine(green, greenLast, pa, cross)
      appendLine(red, redLast, cross, pb)
    } else {
      appendLine(red, redLast, pa, cross)
      appendLine(green, greenLast, cross, pb)
    }
  }

  return {
    green: green.join(' '),
    red: red.join(' '),
    midlineY,
  }
}

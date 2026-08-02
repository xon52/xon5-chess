import { describe, expect, it } from 'vitest'

import { moveQualityIcon } from '@/play/moveQualityIcon'

describe('moveQualityIcon', () => {
  it('maps sampled qualities', () => {
    expect(moveQualityIcon('brilliant').kind).toBe('double-up')
    expect(moveQualityIcon('great').tone).toBe('great')
    expect(moveQualityIcon('good').tone).toBe('good')
    expect(moveQualityIcon('poor').kind).toBe('down')
    expect(moveQualityIcon('mistake').tone).toBe('mistake')
    expect(moveQualityIcon('blunder').kind).toBe('double-down')
  })

  it('maps unclassified labels to a grey circle', () => {
    expect(moveQualityIcon('unclassified')).toEqual({
      kind: 'circle',
      tone: 'neutral',
      label: 'Forced / unclassified',
    })
    expect(moveQualityIcon('only-legal').kind).toBe('circle')
    expect(moveQualityIcon('outside-multipv').kind).toBe('circle')
  })
})

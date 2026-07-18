import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PlayMoveHistory from '@/components/PlayMoveHistory.vue'

describe('PlayMoveHistory', () => {
  it('renders figurine plies horizontally with SAN aria-labels', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4', 'e5', 'Nf3'],
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
    })

    const items = wrapper.findAll('.play__history-sans li')
    expect(items.map((li) => li.text())).toEqual(['♙e4', '♟e5', '♘f3'])
    expect(items.map((li) => li.attributes('aria-label'))).toEqual(['e4', 'e5', 'Nf3'])
    expect(items[0]!.classes()).toContain('ply--w')
    expect(items[1]!.classes()).toContain('ply--b')
  })

  it('shows win-chance title and chart when history has ≥2 plies', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4', 'e5'],
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
    })

    expect(wrapper.find('.play__history-title').text()).toBe('50 / 50')
    expect(wrapper.find('.play__eval-chart').exists()).toBe(true)
  })

  it('omits graph before both sides have moved', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4'],
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
    })

    expect(wrapper.find('.play__history-title').exists()).toBe(false)
    expect(wrapper.find('.play__eval-chart').exists()).toBe(false)
  })

  it('renders green and red chart paths from eval series', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4', 'e5', 'Nf3', 'Nc6'],
        whiteWinPct: 62,
        blackWinPct: 38,
        evalSeries: [
          { ply: 2, white: 60 },
          { ply: 4, white: 40 },
        ],
      },
    })

    expect(wrapper.find('.play__history-title').text()).toBe('62 / 38')
    expect(wrapper.find('.play__eval-chart-line--green').exists()).toBe(true)
    expect(wrapper.find('.play__eval-chart-line--red').exists()).toBe(true)
  })

  it('scrolls to the end when history grows', async () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4'],
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
      attachTo: document.body,
    })

    const list = wrapper.find('.play__history-list').element as HTMLElement
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 240 })
    list.scrollLeft = 0

    await wrapper.setProps({
      history: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    })
    await nextTick()

    expect(list.scrollLeft).toBe(240)
    wrapper.unmount()
  })
})

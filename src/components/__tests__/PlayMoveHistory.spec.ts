import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import PlayMoveHistory from '@/components/PlayMoveHistory.vue'

describe('PlayMoveHistory', () => {
  it('renders figurine plies vertically with SAN aria-labels', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4', 'e5', 'Nf3'],
        moveQualities: ['good', 'good', 'great'],
        showMoveQualities: true,
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
    })

    const items = wrapper.findAll('.play__history-sans li')
    expect(items.map((li) => li.find('.ply__san').text())).toEqual([
      '♙e4',
      '♟e5',
      '♘f3',
    ])
    expect(items.map((li) => li.attributes('aria-label'))).toEqual(['e4', 'e5', 'Nf3'])
    expect(items[0]!.classes()).toContain('ply--w')
    expect(items[1]!.classes()).toContain('ply--b')
    expect(items[2]!.find('.ply__quality').text()).toBe('↑')
  })

  it('hides quality icons when toggled off', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4'],
        moveQualities: ['blunder'],
        showMoveQualities: false,
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
    })

    expect(wrapper.find('.ply__quality').exists()).toBe(false)
  })

  it('shows win-chance title and chart when history has ≥2 plies', () => {
    const wrapper = mount(PlayMoveHistory, {
      props: {
        history: ['e4', 'e5'],
        moveQualities: [],
        showMoveQualities: true,
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
        moveQualities: [],
        showMoveQualities: true,
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
        moveQualities: [],
        showMoveQualities: true,
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
        moveQualities: [],
        showMoveQualities: true,
        whiteWinPct: null,
        blackWinPct: null,
        evalSeries: [],
      },
      attachTo: document.body,
    })

    const list = wrapper.find('.play__history-list').element as HTMLElement
    Object.defineProperty(list, 'scrollHeight', { value: 400, configurable: true })
    Object.defineProperty(list, 'clientHeight', { value: 100, configurable: true })

    await wrapper.setProps({ history: ['e4', 'e5', 'Nf3'] })
    await nextTick()
    expect(list.scrollTop).toBe(list.scrollHeight)

    wrapper.unmount()
  })
})

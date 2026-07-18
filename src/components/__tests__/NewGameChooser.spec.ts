import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import NewGameChooser from '@/components/NewGameChooser.vue'

describe('NewGameChooser', () => {
  it('snaps Elo on slider input', async () => {
    const wrapper = mount(NewGameChooser, {
      props: {
        color: 'w' as const,
        elo: 1200,
        'onUpdate:elo': (value: number) => wrapper.setProps({ elo: value }),
      },
    })

    const slider = wrapper.find('.play__elo-slider')
    await slider.setValue(1510)
    await slider.trigger('input')

    expect(wrapper.props('elo')).toBe(1500)
  })

  it('emits start and cancel', async () => {
    const wrapper = mount(NewGameChooser, {
      props: { color: 'w', elo: 1200 },
    })

    await wrapper.findAll('button').find((b) => b.text() === 'Start')!.trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')

    expect(wrapper.emitted('start')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})

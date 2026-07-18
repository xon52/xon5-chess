import { describe, it, expect, vi } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import App from '../App.vue'
import HomeView from '../views/HomeView.vue'
import PlayView from '../views/PlayView.vue'
import StatsView from '../views/StatsView.vue'
import AboutView from '../views/AboutView.vue'

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
}))

describe('App', () => {
  it('mounts the shell with nav and play route', async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', name: 'home', component: HomeView },
        { path: '/play', name: 'play', component: PlayView },
        { path: '/stats', name: 'stats', component: StatsView },
        { path: '/about', name: 'about', component: AboutView },
      ],
    })
    router.push('/play')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      },
    })

    expect(wrapper.text()).toContain('xon5-chess')
    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Play')
    expect(wrapper.text()).toContain('Stats')
    expect(wrapper.text()).toContain('About')
    expect(wrapper.text()).toContain('Ready to play')
    expect(wrapper.text()).toContain('New Game')
    expect(wrapper.text()).not.toContain('50 / 50')
    expect(wrapper.text()).not.toContain('Undo')
    expect(wrapper.text()).not.toContain('Resign')
  })
})

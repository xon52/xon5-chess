import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import { resetEngine, setEngine } from '@/engine'
import type { ChessEngine } from '@/engine/types'
import App from '../App.vue'
import HomeView from '../views/HomeView.vue'
import PlayView from '../views/PlayView.vue'
import StatsView from '../views/StatsView.vue'
import AboutView from '../views/AboutView.vue'

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => false,
}))

const installEngineMock = () => {
  const stop = vi.fn()
  const engine: ChessEngine = {
    playSearch: vi.fn(async () => null),
    evalSearch: vi.fn(async () => null),
    analyzeMove: vi.fn(async () => ({ quality: 'unclassified', move: '' })),
    notifyNewGame: vi.fn(),
    stop,
    stopAndDrain: vi.fn(async () => {
      stop()
    }),
  }
  setEngine(engine)
  return engine
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    installEngineMock()
  })

  afterEach(() => {
    resetEngine()
  })

  it('mounts the shell with nav and auto-starts first Play visit', async () => {
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
    expect(wrapper.text()).toContain('White to move')
    expect(wrapper.text()).toContain('Resign')
    expect(wrapper.text()).toContain('Flip')
    expect(wrapper.text()).not.toContain('Ready to play')
    expect(localStorage.getItem('xon5.configId')).toBe('beginner')
    expect(localStorage.getItem('xon5.activeColor')).toBe('w')
  })
})

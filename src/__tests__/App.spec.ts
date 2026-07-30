import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

import { resetEngineRegistry, setEvalEngine, setPlayEngine } from '@/engines/registry'
import type { EvalEngine, PlayEngine } from '@/engines/types'
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
  const play: PlayEngine = {
    id: 'stockfish',
    playSearch: vi.fn(async () => null),
    notifyNewGame: vi.fn(),
    stop,
    stopAndDrain: vi.fn(async () => { stop() }),
  }
  const evalEng: EvalEngine = {
    evalSearch: vi.fn(async () => null),
    stop,
    stopAndDrain: play.stopAndDrain,
  }
  setPlayEngine('stockfish', play)
  setEvalEngine(evalEng)
  return play
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    installEngineMock()
  })

  afterEach(() => {
    resetEngineRegistry()
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
    expect(localStorage.getItem('xon5.configId')).toBe('level-1')
    expect(localStorage.getItem('xon5.activeColor')).toBe('w')
  })
})

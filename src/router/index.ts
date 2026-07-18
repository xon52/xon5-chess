import { createRouter, createWebHistory } from 'vue-router'
import { isTauri } from '@tauri-apps/api/core'

import HomeView from '@/views/HomeView.vue'
import PlayView from '@/views/PlayView.vue'
import StatsView from '@/views/StatsView.vue'
import AboutView from '@/views/AboutView.vue'

const router = createRouter({
  // Asset base is './' for Tauri packaging; history stays absolute so routes resolve cleanly.
  history: createWebHistory('/'),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/play',
      name: 'play',
      component: PlayView,
    },
    {
      path: '/stats',
      name: 'stats',
      component: StatsView,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutView,
    },
  ],
})

/** One-shot: desktop opens on the board; later Home nav must still work. */
let didEntryRedirect = false

router.beforeEach((to) => {
  if (!didEntryRedirect) {
    didEntryRedirect = true
    if (to.path === '/' && isTauri()) {
      return { name: 'play' }
    }
  }
  return true
})

export default router

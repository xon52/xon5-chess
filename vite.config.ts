import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const host = process.env.TAURI_DEV_HOST

const modeFlagIndex = process.argv.indexOf('--mode')
const enablePwa = modeFlagIndex !== -1 && process.argv[modeFlagIndex + 1] === 'web'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // Chessground piece icons reuse the native <piece> element.
          isCustomElement: (tag) => tag === 'piece',
        },
      },
    }),
    ...(enablePwa
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico'],
            manifest: {
              name: 'xon5-chess',
              short_name: 'xon5-chess',
              description:
                '100% local chess vs computer — learn and strengthen weak parts of your game.',
              theme_color: '#1a3d2e',
              background_color: '#0f2419',
              display: 'standalone',
              start_url: './',
              icons: [
                {
                  src: 'pwa-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: 'pwa-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                },
              ],
            },
            workbox: {
              // Stockfish lite WASM is ~7MB; include engine assets for offline play.
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            },
          }),
        ]
      : []),
  ],

  base: './',

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
})

# xon5-chess

Free, 100% local chess vs a computer opponent. Learn your game, spot weak spots, get stronger. No ads, no purchases, no network play.

Built with Vue 3 + Vite, and optionally packaged with Tauri 2 for desktop.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Vite web/dev server (port 1420) |
| `pnpm build` | Desktop/Tauri frontend build (**no** service worker) |
| `pnpm build:web` | Cloudflare / PWA build (service worker + manifest) |
| `pnpm preview` | Preview the last Vite build |
| `pnpm test:unit` | Vitest unit tests |
| `pnpm tauri dev` | Run the Tauri desktop app |
| `pnpm tauri build` | Package the desktop app |

## Routes

| Path | Notes |
| --- | --- |
| `/` | Home (web/PWA entry). On Tauri, first open redirects to Play. |
| `/play` | Chess game (Tauri entry) |
| `/stats` | Local progress (empty for now) |
| `/about` | Product story |

Shared top nav on every page.

## Deploy to Cloudflare

Git-connected Workers (current Cloudflare default) runs `wrangler deploy` after your build.

1. Build command: `pnpm build:web` (output: `dist`).
2. Config is in `wrangler.toml` (`[assets]` → `./dist`, SPA `not_found_handling`).
3. Push to the connected branch; Cloudflare builds and deploys automatically.

`public/_redirects` remains for classic Pages; Workers SPA routing uses `not_found_handling` instead.

## Offline / install weight

The PWA caches local fonts plus Stockfish lite (~7MB WASM). Expect a larger first install than a typical marketing site; after that, play works offline.

## Product contract

See [SPEC.md](./SPEC.md) for the play-surface rules (engine, Elo, undo, win%).

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-analyzer.rust-analyzer)

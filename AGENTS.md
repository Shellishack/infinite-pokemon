# AGENTS.md — agent notes for Infinite Pokémon

## What this repo is

A self-hosted, Pokémon-style adventure. Two runtimes share one engine:

- **Local game** — Node server (`game/server/`) + SQLite (`node:sqlite`), WebSocket
  protocol on `/play`, REST under `/api/`, Electron shell in `desktop/` (loads the
  exported site's `/game/` route inside its iframe).
- **Website + browser demo** — Next.js App Router static export (`output: 'export'`,
  `trailingSlash: true`, webpack build via `next build --webpack` because shared code
  uses NodeNext `.js` import specifiers; `next.config.mjs` maps them via
  `resolve.extensionAlias`). The demo runs the engine in a Web Worker
  (`game/browser/worker.ts`) over an in-memory store snapshotted to IndexedDB.

## Key directories

- `app/` — website: `(en)`, `(zh)`, `(game)` route groups each with their own root
  layout (multiple-root-layout i18n). Copy lives in `app/content.ts` (EN + zh-CN).
  `public/` is GENERATED: `npm run sync:assets` copies `game/assets/` into it; never
  edit files in `public/` directly.
- `game/engine/` — gameplay rules. Must stay free of Node builtins (no `node:*`,
  no `node:sqlite`). Persistence goes through the `WorldStore` interface in
  `game/engine/store.ts`; platform backups via optional `backupDatabase`.
  Hashing uses `game/shared/sha256.ts` (pure TS, identical in both runtimes).
- `game/server/` — Node-only: Store (SQLite), SaveLibrary, Codex harness, preview
  pack loader, portable-save import (`import.ts`, host-only `/api/host/import`).
- `game/browser/` — MemoryStore, IndexedDB storage with cross-tab Web Lock
  (`infinite-pokemon-demo-save`), portable save builder, the demo worker.
  The worker entry is guarded against double-evaluation (`__ipDemoWorkerActive`).
- `game/client/` — React + Phaser client. `App.tsx` picks transport: WebSocket to
  the server, or `DemoSocket` (`demo-transport.ts`, WebSocket-compatible wrapper
  around the worker) when the static export marker meta tag is present and
  `/api/info` is unreachable. `?demo-debug=1` enables a teleport test hook.

## Commands

- `npm run build` — typecheck, sync assets, static-export site to `out/`, build server.
- `npm run dev` — dev server with Vite middleware (legacy client dev flow; client
  entry `game/client/index.html` + `main.tsx` kept for this).
- `npm run dev:web` — Next dev server for the site.
- `npm test` — node:test unit/integration suite. `npm run test:demo` — Playwright
  smoke of the browser demo (play → reload/resume → export). Requires `out/`.
- `npm run capture:showcase` — replays the demo headlessly and captures the four
  landing-page screenshots into `game/assets/showcase/`.

## Conventions and invariants

- Never move `game/assets/` (referenced by scripts, tests, Electron). Showcase
  screenshots go in `game/assets/showcase/`.
- Website copy is bilingual from `app/content.ts`; game dialogue stays English.
- The exported web bundle must never contain Node server code, SQLite, Codex, or
  private runtime data — verify with a grep over `out/_next` after changing deps.
- Demo saves are portable JSON (`format: 'infinite-pokemon-save'`, `formatVersion: 1`);
  import always creates a NEW isolated preview run and never overwrites local saves.
- Do not commit changes to `infinite-pokemon-website/` (abandoned directory).

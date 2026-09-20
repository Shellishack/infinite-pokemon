# AGENTS.md — agent notes for Infinite Pokémon

## What this repo is

A self-hosted, Pokémon-style adventure. Two runtimes share one engine:

- **Local game** — Node server (`game/server/`) + SQLite (`node:sqlite`), WebSocket
  protocol on `/play`, REST under `/api/`, Electron shell in `desktop/` (loads the
  standalone Vite client's `/game/` route inside its iframe).
- **Website + browser demo** — now maintained and deployed independently from
  `C:/GitHub/infinite-pokemon-website` (`Shellishack/infinite-pokemon-website`).
  That repository owns the Next.js pages and a versioned browser runtime snapshot.
  This repository remains the source of truth for the shared game code.

## Key directories

- Website pages, website copy, showcase capture and static-demo smoke tests live
  in the separate website repository. Ignore stale local `out/`, `.next/` and
  `public/` directories here; the local server only serves `dist/`.
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

- `npm run build` — typecheck, build Vite client to `dist/`, build Node server.
- `npm run dev` — dev server with Vite middleware (legacy client dev flow; client
  entry `game/client/index.html` + `main.tsx` kept for this).
- `npm test` — node:test unit/integration suite. Website build and browser-demo
  smoke tests run from the website repository.

## Conventions and invariants

- Never move `game/assets/` (referenced by scripts, tests, Electron). Showcase
  screenshots go in `game/assets/showcase/`.
- Website copy is bilingual in the website repository; game dialogue stays English.
- The exported web bundle must never contain Node server code, SQLite, Codex, or
  private runtime data — verify with a grep over `out/_next` after changing deps.
- Demo saves are portable JSON (`format: 'infinite-pokemon-save'`, `formatVersion: 1`);
  import always creates a NEW isolated preview run and never overwrites local saves.
- The sibling `C:/GitHub/infinite-pokemon-website` is now the active independent
  website repository. Commit website changes there, not into this game's repository.

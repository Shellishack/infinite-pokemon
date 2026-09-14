# Infinite Pokémon

**English** | [简体中文](README.zh-CN.md) · [GitHub repository](https://github.com/Shellishack/infinite-pokemon)

> **Educational and non-commercial use only.** This is an experimental fan project, not an official Pokémon product. It is not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK, or The Pokémon Company.
>
> **Generated with Codex.** This repository was generated using OpenAI Codex under human direction. Third-party dependencies and reference assets were incorporated into the project; they were not created by Codex and retain their respective ownership and license terms. See [DISCLAIMER.md](DISCLAIMER.md) and [asset credits](game/assets/classic/CREDITS.md).

![Infinite Pokémon](game/assets/branding/infinite-pokemon-logo.svg)

**The adventure never ends.**

![Infinite Pokémon intro: gameplay becomes context for Codex to create the next part of your adventure](docs/assets/infinite-pokemon-intro.gif)

*Watch the 35-second intro: play, build a shared history, and let Codex help create what comes next.*

Infinite Pokémon explores a simple idea: a game world can keep being written as you play. Walk toward a new horizon, and a local AI harness uses the history of your adventure to propose what comes next—places, characters, conversations, and story hooks. Return to a place you know, and it should remain part of the same world, with your progress and consequences intact.

This is a playable TypeScript prototype of that idea, presented as a Pokémon-style pixel-art creature-catching RPG powered by an AI harness. The goal is a continuing adventure shaped by play, with familiar controls and dependable game rules. Open-ended generation is the ambition; finite storage, generation time, provider limits, and the current engine's vocabulary still constrain every run.

## How the adventure continues

1. **Play in an authoritative world.** The server handles movement, collision, battles, inventory, and progression. An AI suggestion cannot award itself a victory or move your trainer.
2. **Remember what actually happened.** Each run stores maps, choices, NPC memories, and an event history. The server exports an immutable local snapshot for the generation skill to read.
3. **Prepare the next places.** Your host's Codex proposes content from that snapshot. Schemas, map validation, and dependency checks decide what can enter the game. Visited places stay stable.
4. **Generate ahead, or wait deliberately.** A configurable depth of 0–3 controls map preparation. Depth 1 is the default. Generation batch size defaults to three simultaneous blocks and can be set to 1–8 in Session; choose one for sequential work. Cached maps are reused; unfinished destinations show real queue/generation status with retry and cancel controls.
5. **Choose another future.** Create a checkpoint, keep playing, or branch from an earlier one. A branch gets its own world database and generation context. Later events in the original run do not become memories in the new branch.

In multiplayer, friends explore the same run and share its world history. Only the host connects Codex and supplies the generation allowance. Other runs and checkpoint branches remain separate worlds.

## What exists today—and what comes next

| Area | Current prototype | Direction for future development |
| --- | --- | --- |
| World generation | Persistent template maps, generated stories, biome choices, greetings, hooks, and bounded terrain features | Richer terrain geometry and more varied environments |
| Continuity | Run-scoped history, NPC memory, neighboring edge/surface context, and stale-proposal checks | Measured long-term narrative coherence and enforced gradual terrain transitions |
| Characters | Persistent creature/NPC traits, generated species profiles, hybrid eggs, and bounded NPC intentions | More expressive agents with explicit, testable behavior contracts |
| Visuals and buildings | Classic reference art, new pixel-art recipes, distinct maps, shelters with shops/nurseries, and healing | Validated image-generated assets and customizable buildings |
| Regional progression | Route trainers, personal tutorials, and a cooperative guardian | Connected multi-block regions, service centers, and persistent Dojo masters |
| Saves and pacing | Default runs, immutable checkpoint trees, isolated branches, cached maps, and depth 0–3 preparation | Broader replay, scheduling, and player-experience studies |

The [generation skill](skills/infinite-pokemon-region/SKILL.md) keeps its core instructions short and provides separate references for terrain, gradual transitions, buildings, regional Dojos, and visual assets. It gives the harness creative freedom within the capabilities of the current job. Hospitals/community centers are specified to provide healing, saving, and trading; trading and the full center/Dojo systems are not implemented yet. The current runtime can render new creature, item, and vehicle visuals from validated pixel-art recipes; external image-generation importing is still unimplemented.

The title has two choices: **Single player** and **Multiplayer**. Full single-player exploration uses your local Codex; a finite tutorial preview works without it. Multiplayer offers **Host session** and **Join session**; only the host needs Codex, and guests join by IP address or URL. There are no game accounts, invitation codes, or recovery-key screens. The world owner supplies the generation allowance and agrees to its token use.

This is an experimental implementation, not a finished release. Terrain comes from validated, seeded map templates; the harness supplies names, descriptions, biome choices, NPC profiles, greetings, and story hooks. It does not invent arbitrary executable gameplay. New catalog art is rendered from bounded recipes; external image generation is a separate future pipeline.

## Run on your computer

Install Node.js **22.13 or newer**, then run these commands from this repository:

Docker is optional. The normal local workflow is just Node.js and the commands below.

```sh
npm install
npm run build
npm start
```

The application uses Node's built-in SQLite support, which may print an experimental warning. The runtime dependency includes Codex CLI **0.153.4**; a separate global installation is not required. The bridge prefers the project CLI so an older globally installed executable does not silently change compatibility.

Open the local game at [http://127.0.0.1:8788](http://127.0.0.1:8788):

1. Select **Single player**.
2. If Codex is not already verified, choose **Connect to Codex**. This authorizes the displayed token-use notice, verifies the harness, and enters automatically. Finish provider sign-in if prompted.
3. The game enters automatically. Verification sends a short nonce confirmation without loading a skill or reading files. Once it succeeds, the starting map is playable and nearby maps prepare in the background according to your generation depth (1 by default). Unfinished destinations show a waiting screen.

A still-valid Codex connection is reused. After restarting an approved run, the game automatically checks the local sign-in and sends a tiny confirmation prompt; you do not need to click Connect again. A failed check returns to the Connect action. There is no separate account-creation or manual map-preparation step. The confirmation asks only for a nonce and “ok”, with no skill loading or file reads. Provider startup and response time still apply. Trainer nickname, generation batch size, map generation depth, and saves appear under the collapsed **Optional settings** section.

There is no game-level job cap in the normal connection flow. Verification and background generation consume Codex allowance; failed attempts can consume allowance too. Provider limits and billing still apply.

For development, `npm run dev` runs the TypeScript server and Vite middleware together on the same ports. For the Electron host window, build first and then run:

```sh
npm run desktop
```

Electron opens a handheld-style console frame with an inset screen, custom window controls, and a themed startup screen. It starts its own Node server on available ports by default; explicit `PORT` / `ADMIN_PORT` values are still supported. This is a source-run desktop shell, not a packaged installer. It requires Node on `PATH`, or an absolute `NODE_BINARY` setting.

## Tutorial preview

Choose **Single player → Play tutorial preview** on the Codex connection screen to start without connecting Codex or spending tokens. It contains five distinct outdoor areas and their prepared indoor rooms. Rooms belong to their outdoor area and do not add new world maps. No new maps, model-generated NPC plans, or model calls run in preview. You can finish all beginner lessons by revisiting the prepared routes and their shelters.

The boundary explains when you have reached the preview's edge. Choose **Connect to Codex** there or from the preview banner, complete consent and verification, and continue the **same save** into full exploration. Your trainer, tutorial progress, and already revealed maps are preserved.

Preview saves are separate from the original world and can be resumed after restarting. **Return to original world** goes back to the parent game. Preview itself is private; multiplayer becomes available only after connecting and verifying Codex. A promoted preview uses its own displayed game address and port. For internet hosting, point the proxy/tunnel at that game port rather than the parent's default 8787; keep administration private.

## Multiplayer and controls

Visit the merchant and nursery keeper inside a shelter to buy supplies, purchase a Bicycle, or pair two level-5 companions for a hybrid egg. **CODEX**, **NURSERY**, **RIDES**, and **RECORDS** are available from START. The catalog now includes twelve additional authored species and supports new harness-proposed profiles, local goods, and vehicles. [Collection, economy, and breeding details](docs/VARIETY.md).

To share a world, choose **Multiplayer → Host session**. The local Codex connection is reused or set up as above, then the game enters and the session address is available from **START → SESSION**. You can also choose **Enable multiplayer** there while playing alone; this opens the same saved world to guests.

Guests choose **Multiplayer → Join session**, enter an address such as `http://HOST_LAN_ADDRESS:8787` or the host's HTTPS URL, and join. A trainer nickname is optional character text, not an account. Guests never connect Codex. **Return to single player** closes current guest connections and prevents further public joining while preserving their server saves.

Move with WASD or arrow keys. To interact, stand directly beside an NPC, sign, item, or room PC, face it, and press **E** or **Space**. Diagonal proximity does not count. People, signs, fences, walls, and furniture block movement; face them rather than trying to walk through them.

Approach a building's visible door and walk into it, or face the door from the next tile and press E. Use the room's exit to return outside. Speak to the caretaker inside to heal your team. Guides offer beginner practice, trainers offer challenges, and tall grass contains wild encounters. Item pickups are saved for your trainer.

**Escape** or **START** opens the party, bag, trainer profile, journal, map, and save menu; Escape closes it. Only the opening lesson is fixed to Willowbrook. Later battle, capture, care, and trainer lessons follow your progress between areas. Entering a room keeps you in the same area's tutorial; in preview, revisiting the five outdoor areas lets you finish the sequence.

Saves are kept on the world server. The browser silently retains an opaque session token to recognize its trainer and authorize commands. Returning from the same browser/origin resumes that trainer; the local owner is restored through the private local game. Separate browsers represent separate guests. Clearing guest browser storage or changing hostname, scheme, or port can lose that browser's association with its save; no manual recovery-key interface is provided.

The world currently permits eight simultaneous connections and up to 64 saved trainers. These are implementation limits, not a claim of validated internet-scale capacity.

## The five opening areas

| Direction | Area | What is different |
| --- | --- | --- |
| Center | **Willowbrook** | Town square, gardens, Professor Fern's enterable lab, and a separate home |
| North | **Whisperwood Trail** | Dense trees, winding trails, hidden clearings, and a ranger cabin |
| South | **Cloverbank River** | Flower meadows, a winding river, a timber bridge, and a rest house |
| East | **Sunbreak Coast** | Open water, shore paths, wooden boardwalks, and a coastal station |
| West | **Waystone Terraces** | Zigzag routes between stone terraces, fallen pillars, and an archive shelter |

Guide and trainer positions vary. Each area provides practice grass, a Waystone, signs, supplies, and indoor care. Willowbrook has two rooms; each other area has one. Existing saves retain their established map names and story text when their older layouts are upgraded.

## Host ports and remote access

| Listener | Default address | Purpose |
| --- | --- | --- |
| Guest game | `0.0.0.0:8787` | Client files and public game connection; admission opens only in multiplayer |
| Host console | `127.0.0.1:8788` | Local connection, generation settings, and backup controls |
| Codex | Child-process stdio | Private harness protocol; no game-facing listener |

Allow the game port through the host firewall for your intended LAN when hosting multiplayer. Single player blocks public game admission; it does not remove the HTTP listener or hide the title page. Keep the local console on loopback. **Never reverse-proxy port 8788 or expose the Codex process, credential directory, or host APIs to guests.**

For internet access, [deploy/Caddyfile.example](deploy/Caddyfile.example) provides an optional HTTPS reverse proxy to **8787 only**, with WebSocket support. Replace its domain with one you control, configure DNS and access to 80/443, and restrict direct public access to 8787. Caddy must preserve the original Host header for the game's same-origin checks. Its [reverse-proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) describes WebSocket support.

A home router may need forwarding of 80/443. Carrier-grade NAT may require a separate private tunnel or relay. No automatic NAT traversal or hosted relay is included. A tunnel must forward only the guest game service.

On a remote host, authenticate its CLI from the operator's private shell before connecting the host console:

```sh
node node_modules/@openai/codex/bin/codex.js login --device-auth
```

Device-code login may need enabling in the account/workspace. Complete the displayed flow yourself; do not share the code with guests. See the [official authentication instructions](https://learn.chatgpt.com/docs/auth).

From the operator's own computer, privately forward administration:

```sh
ssh -N -L 127.0.0.1:8788:127.0.0.1:8788 operator@your-server
```

Then open [http://127.0.0.1:8788](http://127.0.0.1:8788) locally and choose **Multiplayer → Host session**. Connect and verify Codex if needed; the session opens automatically. Use a different local forwarding port if 8788 is occupied. This is an owner-only tunnel, not a public proxy.

## Docker on a Linux home server

[Dockerfile](Dockerfile) builds the browser and compiled Node server, retains production dependencies, and runs as the non-root `node` user. [compose.yaml](compose.yaml) uses **Linux host networking** so the loopback administration listener stays accessible locally without exposing it on a bridge interface. It intentionally contains no `ports` mappings. On Windows/macOS, use the native commands above; this Compose setup targets Docker Engine on Linux. See [Docker's host-network documentation](https://docs.docker.com/engine/network/drivers/host/).

```sh
docker compose build
docker compose up -d
docker compose exec game node node_modules/@openai/codex/bin/codex.js login --device-auth
```

Authenticate interactively as the server owner. The image contains no account credentials. `world-data` holds the world at `/app/data`; `codex-private` holds private host authentication/configuration at `/home/node/.codex`. Preserve both volumes across recreation, protect the latter as account credentials, and publish neither through the web server. Container authentication/sandbox compatibility needs validation on the target Linux host.

Use the same local or SSH-forwarded game after startup. `docker compose logs game` shows errors. After a restart, choose Single player or Host session and reconnect/verify Codex if needed; the saved world resumes automatically. Guests can return once multiplayer is enabled and ready. `docker compose stop` preserves volumes. Do not use `down --volumes` for a world you want to retain.

## Saves, backups, and configuration

Native `npm start` stores data in `./data`. Electron defaults to `world` under its application user-data directory. Set `INFINITE_DATA_DIR` to an absolute path to keep one world across launch methods.

The app preserves existing Electron profiles, browser session identifiers, audio settings, and Docker volume names. It uses an existing `infinite-pokemon` profile first, falls back to an existing `infinite-tamer-adventure` profile, and uses `infinite-pokemon` for new installations. An explicit `--user-data-dir` still takes precedence.

| Setting | Purpose |
| --- | --- |
| `INFINITE_DATA_DIR` | World database, snapshots, generation logs, and backups |
| `PORT` | Guest port, default `8787` |
| `ADMIN_PORT` | Loopback host-console port, default `8788` |
| `CODEX_EXECUTABLE` | Optional executable or `codex.js` override; shell wrappers are rejected |
| `CODEX_HOME` | Optional host-owned Codex authentication/config directory |
| `NODE_BINARY` | Node executable used by Electron |
| `INFINITE_MAP_TIMEOUT_MS` | Per-map generation deadline; default `180000`, maximum `600000` |

SQLite `world.sqlite` stores maps, players, events, NPC memory, generation jobs, command receipts, and metadata. `context/snapshots/` contains immutable JSON inputs with manifests; `generated-content/` contains new model-output/usage logs; older `generation/` logs remain in place. Gameplay facts come from the server, not client-authored save files.

Use **START → SESSION → World settings → Back up world** for an online SQLite backup in `backups/`. This contains database state, not every context/log file or private Codex credential. For a full archive, stop the server cleanly and copy the entire data directory. Restore while stopped into a separate directory, retain the original, then select the restored directory with `INFINITE_DATA_DIR` and reconnect. Never replace a live database or separate it from active WAL files.

Preview saves live under `previews/` inside the main data directory, including saves later continued with Codex. Include those directories in full backups. An online database backup applies to the currently open world and does not automatically include other preview/world databases. Saved preview ports are reused on restart; if one is occupied or a referenced save directory is missing, the game reports the problem instead of replacing the save.

Older version-one layouts are upgraded on startup. Before changing them, the server creates a local `backups/pre-layout-v2-*.sqlite` copy. Trainer progress, companions, items, story choices, and NPC memories are retained; a trainer standing inside a newly placed wall is moved to a reachable free tile. This upgrade does not start a new save.

## Validation and implementation notes

**START → SESSION → Map generation depth** sets how far the host prepares maps: 0 (on arrival), 1 (default, 4 surrounding maps), 2 (12), or 3 (24). Cached maps are reused and queued work runs nearest to players first. Unfinished destinations show real generation status with retry/cancel controls. See [map streaming](docs/STREAMING.md).

Runs and immutable checkpoints are available under **START → SAVES**. **SAVE** creates a checkpoint; continuing an older checkpoint creates a separate branch, preserving the original run's later progress. New players get a default run automatically. Each branch owns its world history, NPC memories, generation context, and autosave database. See [the save architecture](docs/SAVES.md) for storage, multiplayer behavior, and recovery details.

```sh
npm test
npm run build
npm run test:movement
npm run test:gameplay
npm run test:preview
npm run test:saves
npm run test:streaming
npm run test:variety
npm run test:e2e
npm run test:desktop
```

Deterministic fixtures exercise game mechanics without provider calls. Live verification is a separate, host-consented operation. [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) describes the source behavior and limitations. Architectural plans include future scope and are not a feature-completion checklist. These are development checks, not research results.

The movement browser check measures continuous keyboard and touch holds, intermediate rendered positions, and single-tap steps. The gameplay browser check covers facing and collision, battle menus and HP playback, and entering and leaving interiors. Both use the prepared preview and assert zero Codex calls.

The presentation combines credited reference-game artwork with project-authored and harness-proposed pixel-art recipes for new catalog content. See [classic asset credits](game/assets/classic/CREDITS.md) and [terrain source/decoder notes](game/assets/classic/terrain-SOURCES.md). The terrain atlas can be rebuilt offline with `tsx scripts/build-terrain.ts`; no permissive license for the original game artwork is asserted.

To clear the entire local game, open **Settings** on the home screen and choose **Full game reset**. This is separate from saves: it erases all runs and checkpoints, generated content, progress, and game settings after you type `RESET`. It also forgets this game's Codex approval while leaving the Codex CLI signed in.

In the Electron app, click the fullscreen icon in the title bar or press **F11**. Fullscreen hides the console frame and fits the game to the display. Press **F11** or **Exit fullscreen** to return to the previous window size. You can also launch directly with `npm run desktop:fullscreen`.


NPC behavior and interiors now use separate skills: [NPC behavior](skills/infinite-pokemon-npc/SKILL.md) and [interior design](skills/infinite-pokemon-interior/SKILL.md). The harness proposes intentions and optional stationary/wander/patrol policies; shared server code enforces movement, collisions, interaction access and progression. New map proposals can also arrange furniture and rugs inside protected room shells. Generated rooms keep working entrances, exits, healing and shop/nursery stations; published rooms remain stable. See [generative scene rules](docs/GENERATIVE-SCENES.md).


Press **Escape** to open/close the in-game menu. Escape still closes open dialogs. Use **F11** to toggle desktop fullscreen; the objective panel has its own Close button.

The game includes an original synthesized chiptune soundtrack for the title screen, exploration, interiors, battles, and victories. Music starts after your first click or keypress, fades between scene themes, and pauses when the game is hidden. Use **Music on/off** and **Volume** below the game; preferences follow local saved-run navigation. Playback is entirely local and makes no Codex calls. Rebuild the recordings with `npm run audio:compose`; original score and synthesis source live in `scripts/compose-soundtrack.ts`, with audio credits in `game/assets/audio/soundtrack.json`.

For composing additional scenario tracks and generating their audio files, see the [audio development guide](docs/AUDIO-DEVELOPMENT.md). The bundled soundtrack now covers12 cues, including town, forest, coast, ruins, shops, trainer battles and shared guardian encounters.

The audio system also includes22 synthesized sound effects for menus, movement, doors, encounters, combat, healing, rewards, capture and saving. Effects have independent mute/volume controls. See [sound-effect generation](docs/AUDIO-DEVELOPMENT.md#sound-effect-generation) for the source format and game-event integration rules. Generate them with `npm run audio:sfx` or rebuild all audio with `npm run audio:all`.

## Source organization

- `desktop/`: Electron window, preload bridge, and desktop shell.
- `game/client/`: React menus, Phaser rendering, input, and audio playback.
- `game/engine/`: authoritative gameplay rules, battles, map compilation, interiors, NPC movement, and item systems. These modules run on the host, including in single-player.
- `game/shared/`: game models, validation schemas, collision helpers, and client/server contracts. Safe for browser imports.
- `game/server/`: HTTP/WebSocket hosting, Codex jobs, generation scheduling, SQLite storage, checkpoints, and session lifecycle.

The engine currently accepts the server's SQLite Store through type-only imports; persistence and startup migrations retain their existing behavior. Browser code imports shared definitions, never the host engine or database. Frontend assets stay in `game/assets/`, authored tutorial data in `game/content/`, and generation instructions in `skills/`.

Run `npm run dev` for development, or `npm run build` followed by `npm run desktop` for the desktop game.

Generated content is private to each saved run: `<save-data-directory>/generated-content/` contains map proposals, compiled maps and generation diagnostics. The save database remains authoritative for maps and NPC state; checkpoints preserve it when branching. These artifact folders are Git-ignored and are never served as frontend assets. Older `generation/` diagnostics remain readable on disk and are also cleared by a full game reset.

## Install the generation skills

The three [generation skill bundles](skills/README.md) are available separately under MIT-0. They produce structured proposals for a compatible host; installing them does not install the game. The game and asset disclaimer remains separate.

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon-region --skill infinite-pokemon-npc --skill infinite-pokemon-interior
```

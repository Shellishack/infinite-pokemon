# Implementation guide

This guide describes the current game implementation and its limitations. The interface uses a 240×160 pixel game viewport, a following camera, and classic title/Start menus. Reference-game artwork is credited separately from project-authored code and generated stories.

## Processes and source layout

The production entry point is `dist-server/game/server/index.js`, compiled from `game/server/index.ts`. One Node process owns an HTTP guest listener, a separate loopback administration listener, WebSocket connections, a synchronous SQLite connection, game rules, and an asynchronous Codex generation queue. React supplies setup and game controls; Phaser draws the overworld.

| Source | Responsibility |
| --- | --- |
| `game/server/index.ts` | HTTP routing, local host token, joining, WebSocket authentication and delivery |
| `game/engine/world.ts` | Authoritative movement, battles, capture, rewards, tutorials, shared encounters |
| `game/server/store.ts` | SQLite persistence, event history, snapshots, online backups |
| `game/server/preview.ts`, `game/content/tutorial-world.json` | Fixed tutorial pack, finite map whitelist, isolated preview saves |
| `game/engine/maps.ts` | Distinct terrain layouts, scene objects/interiors, validation, hashes, and backed-up layout upgrades |
| `game/server/harness.ts` | Codex transport, verification, generation queue, proposal validation |
| `game/shared/model.ts` | Types, Zod schemas, species, combat helpers, tutorial definitions |
| `game/shared/scene.ts` | Scene projections, exact-facing interaction lookup, object collision, safe positions |
| `game/client/App.tsx` | React guest/host interface |
| `game/client/GameCanvas.tsx`, `game/client/pixels.ts` | Game rendering and pixel presentation |
| `game/client/classic-assets.ts`, `game/assets/classic/` | Loading and provenance for classic reference assets |
| `scripts/build-terrain.ts` | Offline palette/metatile decoding into the terrain atlas |
| `skills/infinite-pokemon-region/SKILL.md` | Verification, map-story, and NPC instructions |
| `desktop/main.cjs` | Electron host window and child Node server lifecycle |

The implementation uses `ws` directly. It does not use the Colyseus rooms discussed in earlier plans, Redis, central matchmaking, or distributed replication. One data directory belongs to one running world server.

## Play modes and internal session ownership

The guest server defaults to `0.0.0.0:8787`. Administration binds `127.0.0.1:8788`, including when its port is changed. The local bootstrap endpoint returns a per-process host token only on the administration listener and with a localhost Host header. Host mutation routes require that token. This is an operating-system-local owner boundary, not an internet administrator account system. Other local processes under the operator's control remain trusted.

The title contains exactly **Single player** and **Multiplayer**. Multiplayer contains **Host session** and **Join session**. Full local play and hosting connect an authenticated Codex CLI only when a valid verified connection is unavailable. The Connect button authorizes the adjacent token-use disclosure and performs connection plus verification in one flow. Consent metadata records the time, disclosure version, mode and effective limit; the UI sets no job cap. Verification sends a fresh nonce directly in a short structured-output prompt, without loading a skill or reading local files. The default confirmation timeout is30 seconds. After a restart, a remembered run approval allows a local host-only session check to read CLI authentication and repeat the small confirmation automatically; existing live verification is reused. Approval metadata stays unchanged during these checks, previews never auto-connect, and failures leave generation unverified. Once verified, the client starts/resumes the world and enters automatically; there is no separate game account or preparation form. The explicit tutorial preview below is the only no-harness entry path.

`POST /api/host/start` accepts `sessionMode: "singleplayer" | "multiplayer"`. It allocates the selected generation radius, publishes the spawn, marks the world ready, and returns HTTP 202 while nearby maps generate. Depth0 creates only the spawn; the default depth1 allocates five blocks. An already-ready world is reused. `POST /api/host/session` changes admission without starting another generation job; opening multiplayer requires a verified harness. The selected mode is stored in world metadata. New databases default to single player.

Single player rejects public joins, public map access, and public WebSocket upgrades. Switching back closes existing guest sockets and retains their saves; the local owner remains. The HTTP title/info service still listens. The host trainer is tied to the private local channel and cannot be impersonated through the public game endpoint, even by replaying its session token.

Guests join an enabled session by IP/URL. Nicknames are optional character metadata. The API automatically creates or resumes a trainer and returns an opaque bearer token; SQLite stores its hash and the browser retains it silently. Tokens establish save association and command ownership, not a user-facing account. There are no invitation codes, account forms, or recovery-key controls. WebSocket authentication sends the token in its first message, not the URL. One active socket per trainer is retained, with limits of eight simultaneous trainers and 64 saved profiles.

The local owner can regain the saved host trainer through the private console, which can rotate its token. Guest storage is origin-specific: clearing it or using another origin/browser does not automatically recover the previous guest save. Changing a nickname is not an identity-recovery mechanism. Guests never authenticate a model provider or spend their own generation allowance.

## Finite tutorial preview

The Single player connection screen offers **Play tutorial preview**. `POST /api/host/preview` creates or reopens an isolated child game-server instance and Store under the parent data directory's `previews/<UUID>/`, then returns its `previewUrl` and `parentUrl`. `POST /api/host/resume` resolves the latest save with `url`, `redirect`, `preview`, `parentUrl`, and `hasOriginalWorld` fields. These are private local-owner operations, not guest endpoints.

The child loads five committed authored outdoor maps from version two of `game/content/tutorial-world.json`. The pack also embeds six scripted rooms inside those regions: two in Willowbrook and one in each adjacent area. Rooms retain the base region ID and do not count as new outdoor maps. A whitelist rejects additional regions before lookup/allocation. Frontier generation and NPC planning callbacks are disabled, and preview admission requires no CLI connection, authentication, probe, or model job. This production preview mode is distinct from the deterministic test-fixture flag.

Crossing beyond the pack returns `PREVIEW_BOUNDARY`. The interface explains the limit and offers connection to Codex. All five beginner lessons can finish through revisits inside the pack. After successful real verification, starting full play promotes that same Store: the finite whitelist is removed, generation callbacks become available, and published maps, trainer state, and tutorial progress remain intact. The original parent world's canonical data is unchanged.

Parent metadata stores `latestPreviewId` and the stable game/admin ports under `previewPorts:<UUID>`. The saved origin lets the browser return to its trainer. A missing referenced directory or occupied saved port fails clearly instead of silently creating another save. The parent closes child servers during shutdown. Full filesystem backups must include preview directories and parent metadata; an online SQLite backup covers only its active Store.

The child uses the same admission-enforced privacy as single player: a guest-facing HTTP listener can exist, but public joins and WebSockets are rejected. After promotion it can host multiplayer on its existing game port. Its advertised address deliberately uses its own IP/port rather than a parent proxy URL. An internet proxy/tunnel for this world must target that child game port, while administration remains on loopback. Remote owners using SSH forwarding also need a private forward for the child's administration port; forwarding the parent's port alone does not expose the child console.

## Commands and durable state

Clients submit UUID-tagged commands with constrained actions. The server parses them with Zod, checks rule preconditions, and updates SQLite transactionally. Receipts prevent replaying an accepted command ID from granting rewards again. Movement is throttled server-side; inaccessible interactions are rejected. Clients render server state rather than authoritatively setting HP, rewards, or coordinates.

Movement is cardinal and tile-authoritative, with client animation between accepted positions. Collision combines the tile's walkability and each solid object's footprint. NPCs occupy one solid tile; signs, items, Waystones, fences, and furniture also block their declared cells. A building's visual rectangle is non-solid because its wall tiles carry collision, leaving only the explicit door cell walkable.

E/Space sends an interaction for the object one tile directly in front of the trainer. Being nearby or diagonal is insufficient. The same lookup handles NPCs, signs, supplies, furniture, and informational PCs. Pickups use stable region/scene/object keys in the trainer's collected-item state, so repeat interaction cannot grant another copy and the item disappears for that trainer.

Doors can be walked onto or interacted with from the facing adjacent tile. Their `targetScene`, `arrival`, and `facing` metadata select an embedded room or the outdoor scene. An indoor exit uses the saved outdoor return position when available and checks that the arrival is safe. Entering a room preserves the base `regionId`, tutorial lesson assignment, and world-map count. Healer-role NPCs restore the party; room PCs currently provide text rather than a separate storage-management application.

State updates are scheduled approximately every 100 ms. A hash comparison lets the server omit unchanged region content while sending current player state, nearby players, world events, and generation status. This is a small snapshot protocol, not rollback networking or a guaranteed simulation-rate measurement.

Delivered state contains the recipient's full trainer state and public nearby avatars. NPC memory arrays are omitted, visits are scoped to the recipient, and other trainers' conversation events are filtered. Internal generation snapshots can still contain relevant authoritative multiplayer context.

SQLite uses WAL mode. Tables hold metadata, players, regions, events, NPC state, receipts, and generation jobs. Commands persist as accepted; Save confirms the server-save model rather than uploading a client save. Interrupted jobs are marked on restart. Online backup uses Node's SQLite backup API. Use it for a live database; make full filesystem archives after orderly shutdown.

## Maps and gameplay files

The opening world immediately includes `(0,0)` and four prepared neighbors after owner verification. Their version-two layouts are structurally different: central Willowbrook uses a town square and lab/home, north Whisperwood winds through dense forest, south Cloverbank crosses a river by timber bridge, east Sunbreak uses coastal boardwalks, and west Waystone Terraces follows stone ledges. Guides, trainers, doors, signs, supplies, and Waystones have region-specific positions. All four outdoor gateways still meet adjacent maps at x=16 or y=12.

The spawn is published before entry while unpublished neighbors can be enriched in the background. Entering another region creates missing layouts and queues eligible destinations. Generation is sequential with a fixed neighbor buffer; predictive multi-ring scheduling remains future work.

Outdoor regions and embedded rooms use 32×24 grids at a 16-pixel logical tile size. `Region.objects` describes placed entities; `Region.scenes` embeds interiors with their own grids, objects, spawns, and interior theme. Tile 7 marks a bridge/boardwalk. Indoor tiles 9–13 represent floor, wall, carpet, counter, and bookcase. Stable object IDs distinguish the guide, trainer, healing door, Waystone, sign, supply, healer, PC, and room exit; the town additionally contains a home door and room.

Codex supplies story fields and up to eight bounded feature rectangles from trees, ponds, flowers, tall grass, and stones. Feature application preserves paths, buildings, spawn routes, practice grass, and interaction access. The compiler does not execute model-authored scripts or accept arbitrary tile arrays. Validation checks reciprocal exits, required roles and practice grass, object bounds, doorway destinations, safe arrivals, and reachable indoor healers/exits.

The renderer draws those engine tile categories with a decoded FireRed terrain atlas and credited creature/trainer sprites. The atlas contains 729 original metatiles with source IDs preserved. Its decoder reconstructs palette indices, flip flags, and lower/upper subtile composition; it does not synthesize new artwork. [Terrain provenance](../game/assets/classic/terrain-SOURCES.md) records original source paths, revision, hashes, and the static-layer limitation. The reference Pallet Town diagnostic is an asset-decoding check, not a game screenshot or AI-generated map.

A map becomes published on first reveal. Compiled geography and story content then remain stable; NPC memory and shared world state live in separate mutable records. Unfinished destinations now keep the player at the boundary while the agent finishes. Failures, pauses, disconnection, and budget limits are shown with cancel/retry controls; existing visited or prepared destinations remain cached.

Version-one saves receive an explicit layout migration at startup, which is an exception to ordinary published-map immutability. `upgradeLegacyLayouts(store, ids?)` first validates replacements, creates a consistent local SQLite copy with `VACUUM INTO`, then updates the layouts in a transaction. It preserves region names/story/source, player progression, creatures, inventory, choices, receipts, and NPC memory. Invalid or disconnected player positions are relocated to reachable free cells; obsolete scene positions are repaired. The backup path is recorded in metadata, and an already-upgraded save produces no new migration backup. `loadPreviewPack` applies this upgrade to an existing v1 preview without adding outdoor regions or resetting its trainer.

For every region job, the server writes a staged directory and renames it into `context/snapshots/<id>/` after the files and manifest are complete:

- `world.json`: world identity, seed, shared choice, selected recent canonical events.
- `players.json`: relevant nearby trainers, parties, tutorial state, and visits, excluding bearer credentials.
- `maps.json`: nearby map summaries, NPC memories, recent events, and observed/planned status.
- `request.json`: destination, source hash, event sequence, and permitted generation scope.
- `context.json`: compact world/request data, nearby map summaries and biomes, selected player fields, recent scoped events, runtime capabilities, and adjacent terrain edge profiles read by the worker.
- `manifest.json`: snapshot identity, the active compact-context hash, archived-file hashes, and relevant map dependencies.

`context/current.json` is a convenience pointer; each job receives immutable manifest/context paths. The skill reads those two files together, distinguishing plans from actions that happened, while the detailed files remain archived. Selection uses bounded recent history and nearby regions, not a semantic memory database or the full historical chronology in every prompt.

The skill can also read its explicitly linked references selectively. Its catalogs cover terrain families and object roles, gradual block transitions, creative buildings with mandatory center services, multi-block region/Dojo design, and optional image-generation assets. See the [skill entrypoint](../skills/infinite-pokemon-region/SKILL.md). These richer design contracts do not extend the strict live output schema: custom asset import, trading, a multi-block region registry, and Dojo masters remain unimplemented.

`game/server/terrain-context.ts` adds actual surface counts and run-length-encoded facing edges for adjacent maps, including collision-aware passability and observed/planned status. Occupied observed neighbors are reported as possible approach blocks. This gives the model continuity evidence without guessing the player's predecessor. Geometry is still compiled from protected templates; these observations are not an assertion that seamless blending is enforced by the engine.

## Harness and bounded NPC behavior

The bridge launches Codex app-server over stdio, loads the skill explicitly, and requests structured JSON. It uses read-only ephemeral threads, disables web search, and rejects interactive approvals. The host's CLI still needs private authentication and provider connectivity. Its protocol is never a public game endpoint.

The runtime pins project CLI version 0.153.4 to avoid an incompatible global default. An explicit executable override is available. Overrides name a native executable or JavaScript entry point; `.cmd`, `.bat`, and `.ps1` wrappers are rejected.

Responses must pass their schema and match the requested snapshot. Before committing a map, the server checks that it remains unpublished, its source hash and shared story choice are unchanged, and referenced map dependencies still match. Connection epochs and tracked jobs prevent stale work from surviving relevant reconnect/shutdown transitions. These checks do not prove every sentence consistent with every intervening event. Logs retain output, duration, job metadata, and available provider usage, including failed-turn accounting when supplied by the revised transport.

The generation budget counts attempted map/NPC jobs. It is not a guaranteed monetary ceiling, and nonce-verification calls are outside that counter. The host, rather than guests, supplies the allowance and consent. Provider limits can still stop generation.

NPC records contain visits and up to twelve recent memory strings. Eligible interactions queue a proposal tagged with an NPC revision. Allowed actions are `greet`, `guard`, and `rest`; current-revision responses can update mood, intention, dialogue, and memory. Stored dialogue can be used in subsequent interactions. NPC proposals cannot grant items, mutate geography, or rewrite canonical facts. This is a bounded observation-memory-intention loop, not an unconstrained social simulation, and it has no live NPC-quality evaluation.

## Tutorial and shared consequences

Tutorial state belongs to each player. The spawn lesson needs a starter, movement, and a conversation. The following battle, capture, care, and trainer/choice lessons follow the player across eligible routes. Lesson flags persist, so different-progress players can share geography without sharing completion rewards.

Combat implements a small species set, elemental attacks, HP, capture, healing, party switching, trainers, and a shared guardian encounter. It is not a complete reproduction of every Pokémon mechanic. The first committed valley-path choice establishes shared canon; another player's differing preference is retained personally without replacing that choice.

## Deployment and limitations

Use HTTPS for public guest connections. Preserve the incoming Host header through the proxy for same-origin checks. Caddy forwards the guest listener and `/play` WebSocket; remote administration uses an owner-only SSH loopback forward. A proxy does not automatically resolve carrier-grade NAT or distribute world authority. The request limiter sees its direct peer, so clients behind one proxy share that coarse limiter.

The Docker image contains production output and the project CLI. Separate volumes retain world data and private authentication. Compose targets Linux host networking because bridge publication cannot reach a container's loopback-only admin listener. Container build, sign-in, sandbox compatibility, and public proxy operation need validation on the target host; supplied configuration is not evidence of deployment.

The earlier invitation and recovery-key interfaces are superseded by the current address-based session flow.

Present scope is one server process, template terrain, a small visual/species vocabulary, bounded context, distance-prioritized preparation, and limited NPC actions. Distributed workers, PvP, trading, automatic asset generation, and a comprehensive account system are not implemented. Prepared sessions can continue through cached maps when generation is unavailable; new unfinished maps require waiting. Unique content forever and zero stalls under arbitrary load are not established.

`npm test` exercises deterministic mechanics and networking; `npm run build` checks types and compiles production output. Browser and desktop fixtures check the interface without model calls. These are development checks and do not establish scientific findings or general story quality.

The Electron client uses `desktop/shell.html` as a persistent console frame around the game. Its sandboxed, context-isolated preload exposes only window controls and launch status to the trusted top-level shell; the game iframe has no native bridge. A local startup screen appears before the child server is ready and reports launch failures with a retry action. The launcher reads its own child process readiness message before loading the game, chooses free ports by default, and retains explicit port overrides. See [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc) and [process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox). `npm run test:desktop` verifies launch, window controls, preview navigation, shutdown, port conflicts, retry, and compact layout without model calls.

Electron fits the complete game surface to both dimensions of the available screen area. The title menu, objective panel, and gameplay controls scale together on resize; the page itself never needs scrollbars. Tall dialogs retain their own scrolling. The desktop fit is limited to the embedded client and leaves normal browser layout unchanged; Phaser's canvas fills the fitted viewport without applying a second scale.


The connection modal keeps a centered primary Connect to Codex action and a tutorial-preview alternative. Batch size, map depth, nickname and saves live in collapsed Optional settings. The normal verify request omits a job budget, which means no application-level cap; explicit legacy API caps remain supported. The agent panel shows the number of generation jobs used, without a budget control.


The connect button uses a standard primary-action size with the subtitle “Start your adventure”. Remembered checks use the documented [Codex account/read and turn/start APIs](https://learn.chatgpt.com/docs/app-server); OAuth credentials remain with the local CLI. Confirmation establishes model connectivity, not skill or filesystem access. Map jobs load and validate the skill/context during actual generation.

Home → **Settings** → **Full game reset** is separate from the save browser. The host must type `RESET` before confirming. It removes every run, checkpoint, generated map/story, trainer, inventory, game setting, remembered game consent, and app-owned context/log/backup files from that installation's configured data directory. Connected guests are disconnected and active generation is cancelled first. The Codex CLI account and unrelated files are not deleted. A fresh installation state is served on the same host port. From a child run, Home settings returns to the original host before offering the reset.

START → SESSION → **AI harness** lets the host disconnect generation or switch a Codex account/local Codex CLI connection. Disconnect cancels active turns, removes remembered game approval, and retains the current run and prepared maps. It does not sign the CLI out globally. Interrupted map requests become eligible for generation after an explicit reconnection. Switching an account opens the provider sign-in flow; switching a CLI uses an optional absolute executable/codex.js path, stored per run. The current adapter supports Codex-compatible app-server CLIs, not other providers. All these operations require the local host token; guests cannot control the harness.

Successful connection/check flows enter the game automatically; there is no “Starting your adventure” modal or extra Continue button. First-time Codex setup is displayed inline on the title page. A connection/start failure opens an actionable error dialog with explicit retry/back controls, and a failed attempt is not automatically retried in a loop.

## Original soundtrack

`game/assets/audio` contains twelve original mono22.05kHz16-bit PCM cues rendered from the score in `scripts/compose-soundtrack.ts`. Pulse lead, triangle bass/arpeggios, bell tones and synthesized percussion use no third-party samples. MusicPlayer lazily loads/decodes tracks after a user gesture, caches buffers, loops ambient cues, crossfades scene changes, and returns to location ambience after the one-shot victory fanfare. It uses a separate Web Audio graph from Phaser, which still owns no audio.

Mute and volume preferences are local to the player. Browser storage/cookies carry preferences between local ports; the Electron shell relays only validated non-sensitive audio settings between its embedded game pages. The full-game reset restores music defaults. Playback and muted fixture browser tests require no Codex provider calls.

The soundtrack now has12 scenario cues, including town, forest, coast, ruins, shop, trainer and guardian variants. See [Audio development](AUDIO-DEVELOPMENT.md) for the generation workflow and extension contract. Victory returns to the current location cue rather than a fixed exploration track.

Sound effects are part of the shared gameplay contract: successful server action receipts carry semantic cue IDs, and the client schedules combat cues on animation frames. `game/shared/sfx.ts` defines the supported IDs; `scripts/compose-sfx.ts` generates their original WAVs. Result cues are consumed once per issued command, separate from local UI selection feedback. Effects use their own gain/mute channel within MusicPlayer and retain preferences through the existing Electron audio relay. See [Audio development — SFX](AUDIO-DEVELOPMENT.md#sound-effect-generation).

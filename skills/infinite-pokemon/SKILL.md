---
name: infinite-pokemon
description: Set up and start Infinite Pokémon when a user asks to install, play, or launch the game with their AI assistant. Clone missing game files, install dependencies, build, and launch the local desktop or browser game; not for background map or NPC generation jobs.
license: MIT-0
metadata:
  author: Shellishack
  version: "0.3.0"
  homepage: https://github.com/Shellishack/infinite-pokemon
  repository: https://github.com/Shellishack/infinite-pokemon
---

# Set up and play Infinite Pokémon

When the user asks to play, carry out setup and launch using the available terminal tools. Installing this skill only installs instructions; it does not install or start the game by itself.

## 1. Locate or obtain the game

Use the user's selected checkout if available. A complete checkout contains `package.json` with name `infinite-pokemon`, `game/client/index.html`, `game/content/tutorial-world.json`, `desktop/main.cjs`, and the generation skills under `skills/`.

If the game or required project files are missing, first clone the complete [source repository](https://github.com/Shellishack/infinite-pokemon) into a new directory in the user's workspace:

```sh
git clone https://github.com/Shellishack/infinite-pokemon.git
cd infinite-pokemon
```

Do not clone over an existing directory or overwrite saves/uncommitted edits. Reuse a complete checkout without resetting or automatically pulling over local work. If an incomplete checkout exists, choose a distinct destination and tell the user which one you used. If cloning fails, report the concrete error rather than fabricating files.

Read the cloned `README.md`, or `README.zh-CN.md` for Chinese instructions, and any applicable repository instructions before proceeding. Use its current setup requirements if they differ from the baseline below.

## 2. Check requirements and build

Check `git --version`, `node --version`, and `npm --version`. The baseline requires Node.js 22.13 or newer. A missing prerequisite is a specific setup blocker: use the user's established installation method or explain what needs installing; do not silently replace an existing system runtime. Docker is optional and is not needed for local play.

From the checkout, install the locked dependencies and build:

```sh
npm ci
npm run build
```

Reuse a valid installed environment when restarting an unchanged checkout. If a command fails, inspect its error and fix the relevant setup issue before proceeding. Do not bypass failing checks or claim a successful launch merely because a process spawned.

Codex CLI is included in the project dependencies; a global installation is unnecessary. Do not copy provider credentials into the repository.

## 3. Launch the requested experience

For a local graphical desktop, launch:

```sh
npm run desktop
```

Use `npm run desktop:fullscreen` when the user requests fullscreen. Keep the launcher/server alive using the environment's supported background-process or persistent-terminal facility. On Windows, keep helper terminal windows hidden while allowing the requested Electron game window to appear.

If a desktop GUI is unavailable or the user prefers a browser, use `npm start` and open `http://127.0.0.1:8788`. Check the server's startup output and `/api/info` before reporting that it is ready. Electron chooses available ports by default; use its displayed address rather than assuming 8788. If another instance is already running, reuse it only after confirming it belongs to this game and the intended save directory. Do not kill unrelated processes to free ports.

No-install option: open the hosted browser demo at https://infinite-pokemon-clay-pulse.vercel.app/game/ (site: https://infinite-pokemon-clay-pulse.vercel.app). It runs the five prepared tutorial maps entirely in the browser, autosaves locally, and can export progress as a portable save for import into the full game via the host-only import action in SAVES. The demo needs no Codex connection, account, or setup.

Keep default save locations unless the user specifies one. Do not reset the game, delete databases, or start extra servers against the same data directory. Explain the actual checkout and launch mode in the completion message.

## 4. Enter the game

The title offers Single player and Multiplayer. For generated exploration, the host connects Codex and accepts the game's token-use notice. Let the user complete provider sign-in if necessary; never bypass consent, change allowance settings, or enable a test harness to simulate a live connection. Remembered approvals are checked by the game itself.

Offer **Single player → Play tutorial preview** when the user wants to try it without Codex. Preview has five prepared maps and makes no model calls. Multiplayer guests join by the host's address and do not need their own Codex connection. Start a private single-player game by default; enable guest access only when requested.

Controls: hold WASD/arrows to move, face adjacent objects and press E/Space to interact, Escape opens/closes menus, and F11 toggles desktop fullscreen. The game includes its region, NPC and interior generation skills; users do not need to separately install those to play.

## Installation and provenance

Install this entry skill with:

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon
```

Then ask the AI: **“Use $infinite-pokemon to set up and start the game for me.”** The Skills CLI requires a repository source; the bare `npx skills add infinite-pokemon` is not a supported global alias.

- [Repository and getting started](https://github.com/Shellishack/infinite-pokemon#readme)
- [Website and browser demo](https://infinite-pokemon-clay-pulse.vercel.app)
- [Chinese README](https://github.com/Shellishack/infinite-pokemon/blob/main/README.zh-CN.md)
- [Generation skills](https://github.com/Shellishack/infinite-pokemon/tree/main/skills)
- [Issues](https://github.com/Shellishack/infinite-pokemon/issues)
- [Project disclaimer](https://github.com/Shellishack/infinite-pokemon/blob/main/DISCLAIMER.md)

This instruction bundle uses [MIT-0](LICENSE). It excludes game code, artwork, saves and provider credentials. The game is an educational, non-commercial fan project created with Codex; third-party material retains its own ownership and terms.

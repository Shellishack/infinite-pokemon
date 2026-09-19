---
name: infinite-pokemon-region
description: Generate Infinite Pokémon map stories, terrain features, content profiles, NPC policies, and interiors from a host-supplied saved-run snapshot and output schema.
license: MIT-0
metadata:
  author: Shellishack
  version: "0.3.0"
  homepage: https://github.com/Shellishack/infinite-pokemon
  repository: https://github.com/Shellishack/infinite-pokemon
---

## Before playing: get the complete game

For user-requested setup and launch, the [infinite-pokemon entry skill](https://github.com/Shellishack/infinite-pokemon/tree/main/skills/infinite-pokemon) provides the complete workflow. The setup instructions below also work when only this bundle is installed.

Installing this skill alone does not install Infinite Pokémon. If the game checkout or any required project file is missing, first try to clone the complete [GitHub repository](https://github.com/Shellishack/infinite-pokemon) into a new local directory before starting play:

```sh
git clone https://github.com/Shellishack/infinite-pokemon.git
cd infinite-pokemon
```

Read the cloned repository's `README.md` (or `README.zh-CN.md`) and follow its getting-started instructions to install dependencies, build, launch, and connect Codex. The checkout contains all three skills, game code, schemas, and bundled content. Reuse an existing complete checkout; do not overwrite directories, saves, or local changes. If cloning fails, report the failure rather than inventing missing files or claiming the game is ready.

Players who only want to try the game can also open the hosted browser demo at https://infinite-pokemon-blond.vercel.app/game/ — five prepared maps, no install or sign-in, with progress exportable into the full game for continued play.

This setup step applies when helping a user install or start the game. During an already-running host generation job, use the supplied local files; do not clone, install dependencies, or launch another game. Missing job-specific context must be reported to the host: cloning source cannot recover private saved context.

## Generation task

Use the supplied saved-run context to continue the player's world. You have creative liberty to select, combine, adapt, or invent terrain, decoration, buildings, and visual motifs using the references below. The catalogs are examples, not a closed list. Let neighboring terrain, established places, and the story guide the choice.

Read the supplied manifest and compact context together. Use only this run's inherited history; never consult sibling saves or later parent continuations. Observed facts are fixed; planned places are provisional. Return the exact requested schema and snapshot identity. The engine publishes proposals and owns gameplay state.

For map or world-design work, read [runtime contract](references/runtime-contract.md) first, then the relevant references:

- [Terrain catalog](references/terrain.md): landforms, surfaces, blockers, decoration, paths, and interactions.
- [Terrain continuity](references/continuity.md): continue neighboring edges and make gradual, story-led changes. Read for every new block.
- [Buildings and services](references/buildings.md): creative architecture and mandatory hospital/community-center facilities.
- [Regions and Dojos](references/regions-and-dojos.md): connected groups of blocks, stable regional identity, and each region's master.
- [Visual assets](references/visual-assets.md): use available image generation and asset references while preserving the classic pixel-art style and engine-defined hitboxes.
- [Creatures, items, breeding, and vehicles](references/creatures-and-economy.md): propose new species profiles, traits, local shop goods, and rides through the supported structured catalog.

Read only references relevant to the job, not duplicate context archives or unrelated directories. Creative choices must fit the capabilities supplied with the request; the runtime contract explains how to handle unsupported ideas. Use concise, warm handheld-adventure writing grounded in actual player consequences.

Connection confirmation is handled separately and does not load this skill.

For NPC behavior proposals, use the [bundled NPC behavior contract](references/npc-behavior.md). For interior layouts, use the [bundled interior design contract](references/interiors.md). These contracts describe creative choices; shared movement, collision, access, service and progression rules remain engine-owned. Read them when proposing `npcBehaviors` or `interiors`, using `designContext` to identify allowed targets.

## Project and source references

Part of [Infinite Pokémon](https://github.com/Shellishack/infinite-pokemon), an educational, non-commercial experiment in agent-driven generative gameplay created with Codex. This skill requires a host-supplied context and output schema; installing it alone does not run the game.

- [Skill source](https://github.com/Shellishack/infinite-pokemon/tree/main/skills/infinite-pokemon-region) and [project setup](https://github.com/Shellishack/infinite-pokemon#readme).
- [Implementation guide](https://github.com/Shellishack/infinite-pokemon/blob/main/docs/IMPLEMENTATION.md), [game schemas](https://github.com/Shellishack/infinite-pokemon/tree/main/game/shared), and [project disclaimer](https://github.com/Shellishack/infinite-pokemon/blob/main/DISCLAIMER.md).
- [Issues and feedback](https://github.com/Shellishack/infinite-pokemon/issues).

These links provide provenance and integration documentation. During a live background job, use supplied local context and bundled references; do not browse the repository or fetch unrelated content.

The instruction files in this skill bundle are licensed under [MIT-0](LICENSE). This permission excludes the game code, artwork, branding and other assets outside this bundle.

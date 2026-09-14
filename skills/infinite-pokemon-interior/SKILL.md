---
name: infinite-pokemon-interior
description: Design interior furniture layouts, rugs, room names and inspectable details for new Infinite Pokémon maps within the supplied protected room and service constraints.
license: MIT-0
metadata:
  author: Shellishack
  version: "0.2.0"
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

This setup step applies when helping a user install or start the game. During an already-running host generation job, use the supplied local files; do not clone, install dependencies, or launch another game. Missing job-specific context must be reported to the host: cloning source cannot recover private saved context.

## Generation task

Make the room feel inhabited and consistent with its building, surrounding terrain, and this save's story. You have creative freedom over furniture arrangement, grouping, names, descriptions, and floor coverings within the supplied room. Choose from the supported visual assets; the code defines their hitboxes and interactions.

Read `designContext.interiorSpaces` and [interior contract](references/interiors.md). Preserve the fixed room shell, entry/spawn, exit destination, terminal, and service NPCs. Return proposed rooms in the map's `interiors` array, using only scene IDs present in the context. Omit a room to retain its prepared layout. Do not change already-published rooms or mutate game files.

The engine validates placement and reachability before accepting the entire map. Do not claim unsupported facilities exist just by naming them. Current services include healing, shops, nursery, terminal information and the game's save menu; trading and Dojos still require separate runtime support.

## Project and source references

Part of [Infinite Pokémon](https://github.com/Shellishack/infinite-pokemon), an educational, non-commercial experiment in agent-driven generative gameplay created with Codex. This skill requires a host-supplied context and output schema; installing it alone does not run the game.

- [Skill source](https://github.com/Shellishack/infinite-pokemon/tree/main/skills/infinite-pokemon-interior) and [project setup](https://github.com/Shellishack/infinite-pokemon#readme).
- [Implementation guide](https://github.com/Shellishack/infinite-pokemon/blob/main/docs/IMPLEMENTATION.md), [game schemas](https://github.com/Shellishack/infinite-pokemon/tree/main/game/shared), and [project disclaimer](https://github.com/Shellishack/infinite-pokemon/blob/main/DISCLAIMER.md).
- [Issues and feedback](https://github.com/Shellishack/infinite-pokemon/issues).

These links provide provenance and integration documentation. During a live background job, use supplied local context and bundled references; do not browse the repository or fetch unrelated content.

The instruction files in this skill bundle are licensed under [MIT-0](LICENSE). This permission excludes the game code, artwork, branding and other assets outside this bundle.

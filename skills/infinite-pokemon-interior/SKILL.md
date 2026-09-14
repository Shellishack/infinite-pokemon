---
name: infinite-pokemon-interior
description: Design interior furniture layouts, rugs, room names and inspectable details for new Infinite Pokémon maps within the supplied protected room and service constraints.
license: MIT-0
metadata:
  author: Shellishack
  version: "0.1.0"
  homepage: https://github.com/Shellishack/infinite-pokemon
  repository: https://github.com/Shellishack/infinite-pokemon
---

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

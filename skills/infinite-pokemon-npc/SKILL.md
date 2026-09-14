---
name: infinite-pokemon-npc
description: Generate grounded NPC intentions, dialogue, memory and optional movement policies for Infinite Pokémon from a supplied saved-run observation or map-design context.
license: MIT-0
metadata:
  author: Shellishack
  version: "0.1.0"
  homepage: https://github.com/Shellishack/infinite-pokemon
  repository: https://github.com/Shellishack/infinite-pokemon
---

Choose behavior that expresses this NPC's role, traits, and remembered events. You may keep an NPC stationary or propose a small wander/patrol routine. These are data proposals: the engine alone moves actors, resolves collisions, grants healing/rewards, and advances tutorials.

Read the supplied observation once. For a live NPC job, address the actor in `actor`; for map generation, target only IDs listed in `designContext.npcActors`. Keep knowledge within this save's history and avoid inventing player achievements. Read [behavior contract](references/behavior.md) for the available policy fields and constraints.

Return the requested JSON schema. A live intention chooses `greet`, `guard`, or `rest` plus `intention`, `dialogue`, `memory`, and optional `behavior`. Map proposals place policies in `npcBehaviors`. Movement is optional; null/omission preserves existing behavior. Use a stationary policy to explicitly stop wandering. Do not issue movement commands or modify game files.

## Project and source references

Part of [Infinite Pokémon](https://github.com/Shellishack/infinite-pokemon), an educational, non-commercial experiment in agent-driven generative gameplay created with Codex. This skill requires a host-supplied context and output schema; installing it alone does not run the game.

- [Skill source](https://github.com/Shellishack/infinite-pokemon/tree/main/skills/infinite-pokemon-npc) and [project setup](https://github.com/Shellishack/infinite-pokemon#readme).
- [Implementation guide](https://github.com/Shellishack/infinite-pokemon/blob/main/docs/IMPLEMENTATION.md), [game schemas](https://github.com/Shellishack/infinite-pokemon/tree/main/game/shared), and [project disclaimer](https://github.com/Shellishack/infinite-pokemon/blob/main/DISCLAIMER.md).
- [Issues and feedback](https://github.com/Shellishack/infinite-pokemon/issues).

These links provide provenance and integration documentation. During a live background job, use supplied local context and bundled references; do not browse the repository or fetch unrelated content.

The instruction files in this skill bundle are licensed under [MIT-0](LICENSE). This permission excludes the game code, artwork, branding and other assets outside this bundle.

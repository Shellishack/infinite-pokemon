---
name: infinite-pokemon-npc
description: Generate grounded NPC intentions, dialogue, memory and optional movement policies for Infinite Pokémon from a supplied saved-run observation or map-design context.
---

Choose behavior that expresses this NPC's role, traits, and remembered events. You may keep an NPC stationary or propose a small wander/patrol routine. These are data proposals: the engine alone moves actors, resolves collisions, grants healing/rewards, and advances tutorials.

Read the supplied observation once. For a live NPC job, address the actor in `actor`; for map generation, target only IDs listed in `designContext.npcActors`. Keep knowledge within this save's history and avoid inventing player achievements. Read [behavior contract](references/behavior.md) for the available policy fields and constraints.

Return the requested JSON schema. A live intention chooses `greet`, `guard`, or `rest` plus `intention`, `dialogue`, `memory`, and optional `behavior`. Map proposals place policies in `npcBehaviors`. Movement is optional; null/omission preserves existing behavior. Use a stationary policy to explicitly stop wandering. Do not issue movement commands or modify game files.

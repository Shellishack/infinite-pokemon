---
name: infinite-pokemon-region
description: Generate context-led terrain and stories, plan buildings and regional Dojos, or choose bounded NPC intentions for Infinite Pokémon from the active saved run's snapshot.
---

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

For NPC behavior proposals, use the [NPC behavior skill](../infinite-pokemon-npc/SKILL.md). For interior layouts, use the [interior design skill](../infinite-pokemon-interior/SKILL.md). These skills describe creative choices; shared movement, collision, access, service and progression rules remain engine-owned. Read them when proposing `npcBehaviors` or `interiors`, using `designContext` to identify allowed targets.

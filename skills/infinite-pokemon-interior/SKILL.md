---
name: infinite-pokemon-interior
description: Design interior furniture layouts, rugs, room names and inspectable details for new Infinite Pokémon maps within the supplied protected room and service constraints.
---

Make the room feel inhabited and consistent with its building, surrounding terrain, and this save's story. You have creative freedom over furniture arrangement, grouping, names, descriptions, and floor coverings within the supplied room. Choose from the supported visual assets; the code defines their hitboxes and interactions.

Read `designContext.interiorSpaces` and [interior contract](references/interiors.md). Preserve the fixed room shell, entry/spawn, exit destination, terminal, and service NPCs. Return proposed rooms in the map's `interiors` array, using only scene IDs present in the context. Omit a room to retain its prepared layout. Do not change already-published rooms or mutate game files.

The engine validates placement and reachability before accepting the entire map. Do not claim unsupported facilities exist just by naming them. Current services include healing, shops, nursery, terminal information and the game's save menu; trading and Dojos still require separate runtime support.

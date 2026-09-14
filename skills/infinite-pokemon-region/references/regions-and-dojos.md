# Regions spanning multiple blocks

World-design **regions** are named, connected groups of outdoor blocks with a recognizable geographic and social identity. Existing code calls each individual block `Region`; use `worldRegionId` in a future rich-plan contract to avoid treating every 32×24 map as a whole region. That field is not currently accepted by the map-story schema.

Plan flexible clusters, often roughly 12–36 connected blocks rather than fixed squares or a mandatory exact count. Rivers, ridges, travel routes, settlements, and story development can shape their boundaries. Propose membership as the frontier grows. Keep accepted membership and stable IDs in the run's canonical region registry; a region must not reroll its name or master each time a block is requested.

## Region commitments

Reserve at least one full service center and **one primary Dojo with a persistent master** when establishing a region plan. Place these on a connected travel network and signpost the Dojo before players reach the region's main exit routes. The generator may choose their location and visual design, but must not postpone them indefinitely while inventing more filler blocks. A service center should be reachable before the master challenge.

Blocks may include multiple towns, landmarks, side routes, and transition zones. They share some terrain, architectural, ecological, and narrative motifs without looking identical. Adjacent regions may have different identities, but their border blocks still follow the continuity reference.

When planning from a frontier:

1. Continue an existing region if its geography, storyline, and reserved facilities still fit.
2. Propose a border transition when a genuine new regional identity is warranted.
3. Check the registry before proposing facilities or characters, including already reserved but unvisited locations.
4. Publish membership and reservations atomically with the block plan, so simultaneous multiplayer approaches cannot create competing masters.

The registry belongs to the saved run. Forks inherit accepted regional history at their checkpoint; later regional choices in sibling runs are not evidence for this one.

## Dojo and master contract

Each primary Dojo has a stable Dojo ID and master ID, a regional theme, readable entrance, reachable reception/training space, an arena, and an exit. Optional pupils and practice challenges can teach the theme. Styles might include a garden court, tide platform, mountain hall, urban training club, or ruined monastery.

The master is a persistent opponent for the player to defeat—not a random NPC generated anew on every visit. Specify personality, battle style, team proposal, and the narrative reason the challenge matters. Teams must use supported species, moves, levels, and battle rules. Story or art never authorizes impossible combat mechanics.

The engine owns challenge eligibility, deterministic combat resolution, completion flags, rewards, rematches, and any region progression. Persist each trainer's challenge result unless the session explicitly defines shared completion. Record regional consequences separately from personal victory. Rewards must be idempotent; a repeated request or reload cannot award a second badge/reward accidentally. Defeat should leave a reachable healing and retry path.

A previous master victory remains true after revisiting. Forking from before the battle leaves that fork unbeaten; forking after it retains the result. Do not claim a victory from another save or convert existing co-op guardian encounters into Dojo completion without an explicit engine rule.

## Current compatibility

The live engine currently has independent map blocks, route trainers, and a cooperative guardian. It has no persistent multi-block region registry, Dojo placement schema, master roster, or Dojo-specific victory flags. Apply this document in rich planning jobs or when those capabilities are supplied; ordinary map-story output must not pretend these systems are already operational.

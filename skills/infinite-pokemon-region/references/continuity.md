# Continue the land across blocks

A **block** is one loaded outdoor map, currently 32×24 tiles. A **region** in world design is a connected group of blocks; it is not the existing TypeScript `Region` map record. See the regional reference for that distinction.

## Read the boundary before choosing the destination

Use the current saved run's source blocks, observed adjacent blocks, movement context, and planned neighbors. The live context's `terrainContext` identifies occupied observed neighbors as possible approaches; several players can approach the same target. Do not invent a single predecessor if none is known. `neighborEdges` describes the actual edge of each adjacent block facing the target. Those profiles are observations of current geometry, not permission to edit it.

Honor every observed neighboring edge, not just the route the first player took. Continue path position and width, banks, tree belts, fences, building density, palette, and major landforms where possible. Edge indices run west-to-east on north/south edges and north-to-south on east/west edges; do not reverse them when matching opposing edges. Nonadjacent descriptions provide broader context but are not direct edge constraints.

In a geometry-capable job, carry compatible materials inward from the boundary before blending toward the interior. Keep a readable entrance apron and enough room to turn. Around corners, reconcile the two adjoining seams together. Match real walkability and door/bridge anchors as well as colors. Never rewrite a visited neighbor to make a proposal fit. An unobserved planned neighbor can be revised only if the scheduler explicitly allows it and revalidates its dependents.

## Gradual change

Change one or two major properties at a time: surface material, building density, vegetation, moisture, or elevation. A single block may be a mixed transition zone. Use several blocks when the destination is substantially different; roughly a quarter to a third change in dominant coverage per step can be a useful composition heuristic, not a rigid law.

| From → destination | Plausible sequence |
| --- | --- |
| City → fields | Streets → residential edge → gardens and farm plots → farm lane → open fields |
| Meadow → forest | Open grass → bushes and scattered trees → groves → dense woods |
| Forest → coast | Woods → thinning sandy woodland → salt grass/dunes → beach or harbor |
| River → sea | River bend → wider channel → reeds and estuary → tidal shore |
| Green hills → desert | Meadow → dry pasture → scrub → gravel and exposed sand → dunes |
| Lowlands → snow | Foothills → rocky upland → frost patches → snowy woodland → deep snow |
| Settlement → ruins | Maintained houses → unused buildings → broken walls → overgrown foundations |
| Town → industry | Shopfronts → workshops → service yards → quarry, docks, or waterworks |

Preserve a visual thread through the sequence: the same canal, road paving, distant ridge, crop, fence style, or roof color. Story changes should explain the transition through observable details—a city gate, irrigation works, abandoned railway, or increasing salt exposure—rather than an abrupt unrelated biome roll.

A discrete entrance can justify a stronger change: entering a cave, stepping indoors, or taking a supported tunnel. Establish the connector in the scene and use its actual engine transition. Do not invent a teleport, season change, or catastrophe merely to excuse an incompatible seam.

## Planning and validation

When the supplied schema supports rich plans, record the source/neighbor identities and hashes, dominant and secondary materials, proposed transition direction, matched connectors, and unresolved constraints. These are planning concepts, not additional keys in today's strict map-story response.

Before publication, geometry validation should check reciprocal traversable exits, connected mandatory routes, coherent water crossings, collision footprints, and the service/Dojo anchors. If constraints conflict, retain the safe existing block and ask the scheduler to revise the unobserved plan; do not turn a blocked route into a fictional promise.

With today's template compiler, select a compatible supported biome and sensible feature patches, and make the story acknowledge the existing physical setting. Matching edges in a prompt does not enforce terrain seams: arbitrary geometry blending remains an engine extension.

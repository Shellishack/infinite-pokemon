# Runtime contract and capability negotiation

The request's supplied output schema and capabilities determine what can be executed. Reference catalogs grant creative latitude within that contract; they do not add engine mechanics. Treat unsupported creative ideas as design material only when a planning output is requested. Never append undeclared fields to a live response or announce a service that does not exist.

## Current map-story jobs

The current schema is region-story-v3. It retains the earlier fields and also accepts optional creature, NPC-trait, shop-good, and vehicle blueprints described in [creatures and economy](creatures-and-economy.md). These use bounded pixel-art recipes, prices, and effects controlled by the engine.

The response is exactly `{ "snapshotId": "the supplied identity", "story": { ... } }`. The story schema in `game/shared/model.ts` accepts:

| Field | Current constraint |
| --- | --- |
| `name` | 3–42 characters |
| `description` | 10–400 characters |
| `biome` | `meadow`, `forest`, `coast`, or `ruins` |
| `npcName` | 2–28 characters |
| `greeting` | 5–400 characters |
| `hook` | 5–240 characters |
| `features` | Up to 8 patches; use a few purposeful patches rather than filling the map |

Each feature has only `kind`, `x`, `y`, `width`, `height`. Allowed kinds are `trees`, `pond`, `flowers`, `tallGrass`, and `stones`; x is 3–27, y is 3–20, width is 2–6, and height is 2–4 (integers). These are 32×24 blocks. Geometry, reciprocal exits, tutorial anchors, shelter shells, exits and service anchors remain compiler-owned; interior furniture/rugs can be proposed through `interiors`. Existing protected geometry takes precedence over patches. The five opening layouts are fixed. Later `meadow` proposals currently use the river/meadow layout; the other supported biomes select their corresponding layout.

Choose supported biomes and patches in the context of actual neighboring surfaces, not only map names. A forest fringe can use a meadow/forest proposal with a few tree patches; a ruin being reclaimed by nature can combine stones and vegetation. Rich city, snow, desert, wetland, or custom-building geometry is not currently importable. Do not describe an unsupported city as if its buildings had appeared merely because the output biome was set to `meadow`.

## What the context means

`lineage` identifies the current run and checkpoint ancestry. `maps` distinguishes observed and planned blocks and includes their biome labels. `terrainContext.neighborEdges` describes actual bordering tiles and open positions of adjacent blocks; `approachBlockIds` are occupied observed adjacent blocks, not a guaranteed single predecessor. A `fixedOpeningLayout` name, if supplied, overrides assumptions drawn from the biome label for the target's geometry.

Current `terrainContext` is descriptive. It enables informed proposals; it does not claim that the template compiler enforces arbitrary seam matching or gradual terrain coverage. If a transition cannot be represented, preserve truthful supported output and leave the richer geometry to a separate engine-capable planning job.

## Rich world-design jobs

When the host supplies a richer schema and explicit capabilities, use the terrain, continuity, building, region/Dojo, and asset references selectively. Relevant capabilities include editable block geometry, region registry/reservations, building placement, service actions, Dojo/master battles, image generation, and validated asset import. Record unresolved capabilities in the designated planning field; do not invent a new response format.

Trade actions, region membership, rewards, accepted asset manifests, and published block geometry become facts only after engine validation and persistence in this run. Verification jobs remain nonce-only; NPC jobs remain bounded intention proposals. Preview mode must not generate maps, stories, or images.


`npcBehaviors` (up to12 bindings) and `interiors` (up to2 room proposals) are optional. See the NPC/interior skills linked from the root skill. The supplied `designContext` lists exact actor IDs and protected room objects. Do not invent target IDs. NPC movement uses shared runtime policies, and interior proposals must pass the same collision/access validation as authored layouts.

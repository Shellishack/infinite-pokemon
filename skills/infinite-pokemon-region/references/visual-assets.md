# Visual assets and image generation

Keep the classic top-down handheld pixel-art presentation: current logical tiles are 16×16 pixels and the viewport is 240×160. Use crisp pixel clusters, controlled palettes, a consistent overhead perspective, readable silhouettes, and coherent light direction. Buildings can have original architecture and large roof silhouettes; do not force every building to reuse the same template.

## Choose an asset source by context

Reuse an accepted asset when continuity calls for the same material, landmark, or character. When a novel asset is useful and the supplied harness exposes image generation **and** a game asset-import pipeline, use the available image-generation tool with the relevant accepted references. Do not assume a tool exists because another Codex interface has it. Respect the host's generation allowance and queue budget.

Useful asset families include:

- Transition terrain strips: paving fading into dirt, grass thinning into sand, scattered snow, forest fringe, marsh banks.
- Ground tiles and border variants: inner/outer corners, edges, small variations, riverbank and shoreline connections.
- Vegetation and rocks: multiple silhouettes with compatible palettes; explicit trunks/base footprints and optional canopy layers.
- Building kits: facade, roof, entrance, signage, interior floor/walls, furniture, and service markers.
- Character sheets: consistent master/caretaker identity, required facings and supported animation frames.
- Interaction sprites: terminals, trade desks, signs, supply items, and their supported state variants.

## Asset brief and import contract

When the job's schema supports asset requests, identify the asset's role, region/block/run lineage, accepted visual references, palette, pixel dimensions, tile dimensions, required edges or frames, transparent areas, and intended placement. Describe what should remain consistent and what may change. Do not include credentials or unrelated user data in image prompts.

For buildings, specify entrance sockets, exterior collision footprint, foreground occlusion, interior transition, and service anchors separately from pixels. A hospital/community center's brief must preserve healing, saving, trading, and exit access. A Dojo brief must preserve master/arena access and its stable identity.

Example design brief: “An outskirts clinic beside the established brick road. Keep the neighboring warm red roof palette; use timber extensions and a garden toward the fields. A visible south entrance, care sign, and space for separate healer, save, and trade stations. Match the supplied building scale and top-down perspective.” This is an artistic brief, not a live map-story JSON response.

Import into a run-scoped staging area. Validate dimensions, format, transparency, palette/readability, tile seams, collision/door alignment, and required services. Store the final accepted asset by content hash with its generation/reference metadata. A visually plausible image is not a valid map until collision, interactions, and connectivity pass validation.

Generated pixels must never define physics implicitly. Solid silhouettes need declared hitboxes; paths need real traversability; signs and doors need working interaction metadata. Keep distant roof/canopy pixels separate from ground collision and use foreground layers when they overlap the player.

## Streaming and checkpoints

Generate assets for buffered adjacent blocks ahead of entry. Publish the validated block data and its asset manifest together. Until then use a safe accepted placeholder, or keep the unpublished proposal staged. Do not swap a building's door, footprint, or required services underneath a player.

Checkpoint manifests should pin immutable accepted asset hashes. A fork inherits the referenced versions, not an editable shared asset path that a sibling can replace later. Shared content-addressed storage is acceptable when immutable; keep unpublished work and mutable manifests scoped to the run.

## If tooling is unavailable

The current game invokes read-only structured map/NPC jobs. It renders classic static artwork and now also validated pixel-art SVG recipes for creature profiles, goods, and vehicles; see [creatures and economy](creatures-and-economy.md). It does not expose a working image-generation/import job. Do not call extra tools, emit image paths, claim images were generated, or expand the strict story schema in that job. Use supported terrain features for live output. In an explicitly requested design/planning job, provide an asset brief and capability requirements using the supplied planning format instead.

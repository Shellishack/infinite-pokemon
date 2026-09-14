# Terrain and object vocabulary

Choose a coherent environment, then vary its composition. These examples are a starting vocabulary; new motifs are welcome when their gameplay category and continuity are clear. A new visual appearance does not grant a new movement or interaction mechanic. Consult the runtime contract before emitting fields.

## Environment families

| Family | Useful variations | Natural neighboring transitions |
| --- | --- | --- |
| City | Dense streets, brick alleys, canal quarter, plazas, railway district, rooftop silhouettes | Residential streets, parks, warehouses, gardens |
| Town and village | Market square, terraced homes, fishing hamlet, mountain village, garden town | Orchards, allotments, farm lanes, woodland edge |
| Outskirts | Scattered cottages, small workshops, drainage channels, abandoned lots | Suburbs → garden plots → farmland |
| Farmland | Crop rows, orchards, pasture, windmill lanes, irrigation ditches, rice terraces | Hedgerows, meadow, riverbank, scrub |
| Grassland | Short lawn, flower meadow, prairie, grazing land, breezy hills | Farms, sparse trees, heath, savanna |
| Woodland | Sparse grove, mixed forest, pine forest, bamboo thicket, old-growth canopy | Meadow → shrubs → scattered trees → dense forest |
| Wetland | Reed beds, marsh pools, mangroves, mossy bog, flooded woodland | River shallows, damp meadow, estuary |
| Fresh water | Spring, creek, river bend, waterfall basin, lake margin | Springs → stream → river → delta; shallow banks before open water |
| Coast | Pebble beach, sand dunes, tide pools, sea cliffs, harbor, boardwalk | Estuary, salt meadow, fishing town, rocky upland |
| Highlands | Rocky pasture, foothills, ravine, mountain pass, alpine meadow | Low hills → rocky slopes → upland terrain |
| Cold terrain | Frosted grass, snowy pine woods, drifts, frozen shore, glacier approach | Cold foothills and sparse snow patches before deep snow |
| Dry terrain | Dry grass, thorn scrub, ochre canyon, gravel flats, dunes, oasis | Grassland → dry grass → scrub → exposed sand or stone |
| Volcanic terrain | Dark scree, cooled lava, warm springs, ash meadow, basalt ridge | Ordinary rock → dark rock → sparse plants → ash or basalt |
| Ruins | Mossy walls, broken terraces, buried courtyards, old aqueduct, shrine paths | Existing settlement or forest gradually reclaiming masonry |
| Industrial terrain | Workshop yards, quarries, loading docks, waterworks, disused rail | Town edge, service road, spoil heaps, recovering scrub |
| Underground | Cave mouth, limestone chamber, mineral grotto, mine passages, flooded cavern | An explicit entrance, stair, or tunnel connects surface and interior |
| Unusual places | Giant-root glade, luminous fungi, meteor grove, wind-carved stone garden | Introduce the motif through small details before its main landmark |

Vary route shape, sightlines, open space, vegetation density, landmarks, and settlement density—not merely the place name or palette. Reuse the region's architectural language while giving each block a distinct navigational identity. Keep busy decoration away from doorways and readable path edges.

## Gameplay categories

Classify every proposed element independently of its art. A scene can layer multiple categories on one tile only if the collision and interaction result are unambiguous.

| Category | Examples | Required meaning |
| --- | --- | --- |
| Ground/surface | Grass, sand, paving, dirt, snow, floorboards | Base material; normally traversable unless another layer blocks it |
| Path | Worn trail, brick lane, stepping-stone motif, bridge deck, boardwalk, stairs | Visible route. Path art alone cannot override water, walls, height differences, or a locked connector |
| Blockage | Tree trunk, dense hedge, cliff, boulder, deep water, fence, wall | Explicit footprint and collision; keep mandatory routes reachable |
| Decoration | Flowers, fallen leaves, moss, puddle sheen, grass tufts, lamps, roof trim | Cosmetic unless a separate solid/interactable object is declared; no invisible walls |
| Interactable | Sign, supply bundle, berry shrub, well, terminal, noticeboard, memorial | Facing target, prompt, action identifier, persisted state where relevant; no invented reward execution |
| Building | Cottage, center, Dojo, greenhouse, tower, shop, mill | Exterior footprint, actual door, reachable interior/exit, and any declared services |
| Encounter area | Tall grass, cave floor, reeds, shallow-water habitat | Encounter policy is a separate engine capability; a texture must not silently introduce combat |

Examples of deliberate variants:

- A shallow-looking decorative puddle is traversable; a river is blocked unless a supported crossing exists.
- A flowering hedge can be a solid boundary, while scattered flowers remain traversable.
- A tree canopy may overlap a player visually; its collision belongs to the trunk or specified dense grove footprint, not every transparent pixel.
- A supply object disappears for the correct player/run after collection; painted scenery never pretends to dispense inventory.
- A bridge requires both a continuous deck and matching connections on each bank. A bridge-shaped image is insufficient.

## Selection sketch

For a city-to-field story, prefer an outskirts block with fewer buildings, softened paving, gardens, and one surviving urban landmark. The next block can introduce farm tracks and larger open plots, followed by predominantly meadow. Add a new visual motif because the place needs it, not to fill every tile.

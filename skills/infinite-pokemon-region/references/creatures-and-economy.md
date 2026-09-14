# Creatures, traits, goods, and rides

The region-story-v2 response may include up to three `creatures`, three `shopGoods`, one `vehicles` entry, and a guide `npcTraits` profile. Use empty arrays and a null NPC-trait profile when existing content fits the place, following the supplied output schema. Favor a few coherent discoveries over unrelated novelty. Reuse the exact established profile when bringing a species or item into another block; its name, type, and appearance are identity-bearing data. These definitions belong only to the active run and checkpoint history.

## New creature profiles

Each creature blueprint supplies `name`, `description`, `base`, `types`, `move`, `traits`, and `art`. `base` is an engine family (bulbasaur, charmander, squirtle, pikachu, oddish, or pidgey); the generated creature has a separate stable species identity and display name. Choose one or two types from the supplied schema and one or two traits. Do not invent stats, rewards, abilities, evolutions, or executable commands outside that schema.

Traits include hearty/sturdy (modest extra HP), bold (small attack bonus), gentle (small damage reduction), elusive (slightly harder capture), and curious/swift/radiant (personality or visual flavor). Individuals can differ within a species. Type affinities and the named special move use the prototype's existing combat rules, not arbitrary effects inferred from prose.

The `art` recipe chooses a quadruped, bird, fish, serpent, golem, or sprite body; hex primary/accent colors; plain/spots/stripes/crest pattern; and boolean horns/wings. Use a silhouette and palette suited to the biome and neighboring species. These are engine-rendered pixel-art SVG recipes, not image-generator output. External image importing remains unavailable. Example concepts: a reed grazer near wetlands, a mineral-backed creature beside ruins, or a lantern-colored sprite near a story landmark.

## Hybrid nursery

The engine can pair two distinct owned, healthy level-5 companions at a nursery. Parents remain owned; care costs 120 coins, eggs hatch after 32 accepted movement steps, and parents rest for 64 steps before another egg. Their baby inherits types, visual features, and traits, with a bounded trait variation. Same species-parent combinations share a canonical hybrid species identity; individual parent IDs and the child's lineage remain recorded.

Do not generate an egg as an inventory reward or declare a hatch, parent pairing, or ownership transfer in prose. Only the nursery action creates an egg. Hatching adds a level-1 companion to the party or storage. Bred companions are not counted as wild captures on the leaderboard.

## Shops and currency

Shops retain preset Poké Balls, Great Balls, Potions, Super/Hyper Potions, Revives, Ethers, Repels, and a Bicycle. Prices are this prototype's economy, not a claim of exact original-game pricing. All purchases are server-priced, charge existing coins, and validate stock and ownership. A generous merchant can offer the defined modest discount.

Generated `shopGoods` have a name/description, `effect` (heal, pp, repel, capture), `tier` (1–3), `icon` (bottle, herb, orb, charm), and hex color. The engine derives effect strength and price; the harness cannot grant free items or set prices. Use local lore: a spring herb that heals, an orchard scent that repels encounters, or a crafted orb for capture. The icon is rendered from the validated recipe. Do not promise unsupported status ailments, teleportation, free money, or permanent stat increases.

## Vehicles

Generated `vehicles` have name/description, form (bicycle, scooter, cart, mount), hex color, and speedTier (1–2). The engine derives price and step duration. Rides are owned once per trainer, work outdoors, and retain the ordinary collision footprint and blocked terrain. Buildings temporarily park the selected ride. A floating-looking cart does not gain flight; a water-themed ride does not cross deep water. New traversal mechanics need explicit engine support before they can be advertised.

## NPC traits and records

For `npcTraits`, select a supported temperament and interest, plus a short concrete quirk grounded in this place. Keep identity stable on revisits. Guide traits inform dialogue; merchants, caretakers, breeders, and trainers also have stable seeded profiles. Traits do not authorize arbitrary actions.

Leaderboards are authoritative and local to a run: wild capture count, unique caught species IDs, visited map blocks, recorded individual tiles, and distinct trainers defeated. Starters and eggs do not inflate catches; rematches do not inflate distinct trainer counts. Do not invent scores or merge counters from sibling saves. Global cross-server competitive ranking is not implemented.

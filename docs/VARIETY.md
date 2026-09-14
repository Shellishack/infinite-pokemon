# Creatures, shops, hybrids, rides, and records

Shelter interiors now contain a travel merchant and nursery keeper. Face them and press E. Existing saves keep their progress; the service-object upgrade creates a `pre-variety-*.sqlite` backup before changing room content. New previews use an authored pack containing the services and still make no harness calls.

## Collection and traits

The original six creatures remain available. Twelve project-authored species add woodland, coastal, rocky, unusual, and flying silhouettes: Mosskit, Emberwing, Brookfin, Voltling, Pebblit, Frostowl, Duskcoil, Sunmoth, Reedram, Glimmerfox, Ironclod, and Skydrake. Wild habitats choose from these and accepted local generated profiles. Beginner practice keeps the familiar species set.

The catalog has no fixed authored-roster limit. A generated profile has a stable content-derived identity, display name, description, one or two recorded types, a special-move label, preferred traits, and a pixel-art recipe. `Creature.species` remains the legacy engine family for compatibility; `creatureKey` and `creatureInfo` resolve the actual identity and presentation. Definitions are stored in the run database, and captured creatures retain their accepted profile. Reusing an established authored profile retains its identity.

Hearty/sturdy add modest HP, bold improves attack slightly, gentle reduces incoming damage slightly, and elusive lowers capture chance slightly. Curious/swift/radiant supply personality or visual flavor. The prototype uses primary-type combat affinities and a small move system; it does not implement the full original game's type, ability, evolution, or status mechanics. NPC temperaments, interests, and quirks persist deterministically or come from the accepted guide profile. A generous merchant offers the defined small discount.

START → CODEX lists owned species and their traits; POKÉMON also offers storage-to-party swapping. Individual creatures can differ within one species.

## Coins and shops

Coins already earned from gameplay now buy supplies. Presets include Poké Balls, Great Balls, Potions, Super/Hyper Potions, Revives, Ethers, Repels, and a Bicycle. These use this prototype's prices and effects. Shops may also stock bounded goods and vehicle designs from their accepted map story. Their descriptions, colors, and silhouettes can reflect the local lore; prices and effects are computed by the server.

Purchases require facing the merchant, enough coins, valid quantities, and available stock. Receipts prevent replayed commands from charging or granting twice. Vehicle ownership is unique per trainer. BAG → All items & supplies lets players target a companion; capture items are used from the battle bag. Repel prevents random encounters for its remaining movement steps. Existing potion stacks are preserved when battle rewards add supplies.

## Hybrid eggs

At a nursery, choose two distinct owned, healthy companions of at least level 5. Care costs 120 coins. Parents stay in the team/storage and rest for 64 movement steps between eggs. One egg can be carried at a time; it hatches after 32 accepted walking or riding steps into a level 1 companion. Invalid movement and time spent waiting do not advance an egg.

A hybrid inherits primary types, colors, and visual features from its parents, plus an inherited trait and bounded variation. The species identity is derived from the parent-species pair, while individual parent IDs and generation remain recorded. Equivalent parent-species pairs therefore do not mint different species identities merely through retries or parent-instance changes. The child joins the party or storage; parents are not consumed. Eggs, cooldowns, money, definitions, and offspring persist across saves and forks.

## Rides

The Bicycle costs 400 coins and uses a 110 ms step rather than the normal 160 ms step. The original bicycle uses credited classic rider sprites. Generated scooters, carts, mounts, or bicycles use the defined recipe/appearance path and bounded 110/90 ms tiers. Client prediction uses the server's current movement duration; collision, map readiness, doors, and indoor restrictions still apply. The selected ride is parked indoors. No flying, swimming, terrain skipping, or arbitrary generated vehicle code is enabled.

## Leaderboards

START → RECORDS ranks trainers within the current run by wild capture count, unique caught species identities, explored map blocks, recorded individual tiles, or distinct trainers defeated. Starters and eggs do not inflate capture scores; trainer rematches do not inflate distinct-opponent scores. Previously recorded capture/trainer events are migrated where identifiable. Individual tile history begins with this update because old saves did not retain every visited tile.

The host's database is authoritative for its run; there is no global cross-server competitive service. Forks copy their checkpoint's records and then diverge, so scores from sibling histories are not pooled.

## Generation and visuals

`region-story-v2` accepts optional creature, shop-good, vehicle, and NPC-trait blueprints. The generation skill's [catalog reference](../skills/infinite-pokemon-region/references/creatures-and-economy.md) lists the contract. The engine validates types, colors, shapes, effects, and tiers, and derives identities and prices. These are structured data proposals, not executable plugins.

New visual assets are deterministic pixel-art SVGs or engine renderings from accepted recipes. This is a working path for new catalog visuals, not an image-generator integration; external image generation/import remains future work. The standard game artwork remains separately credited.

`npm test` covers economy, ownership, item effects, inheritance, catalog validation, records, and speed. `npm run test:variety` checks the UI with explicitly seeded fixture resources and no provider calls.

# Terrain source and decoding

The terrain atlas contains original Pokémon FireRed artwork obtained from the public [pret/pokefirered decompilation repository](https://github.com/pret/pokefirered). These are reference-game assets, not original artwork created for Infinite Tamer Adventure. No permissive artwork license is claimed; copyright remains with the respective game rights holders. Repository availability is not a redistribution-license grant.

Source revision recorded on 2026-09-10: `c75f352304d529f6ba92d4f74b9cf8b5c3810788`. Individual source-file SHA-256 hashes are in `terrain.json`.

- [General primary tileset](https://github.com/pret/pokefirered/tree/c75f352304d529f6ba92d4f74b9cf8b5c3810788/data/tilesets/primary/general): `tiles.png`, `metatiles.bin`, palettes `00.pal`–`06.pal`.
- [Pallet Town secondary tileset](https://github.com/pret/pokefirered/tree/c75f352304d529f6ba92d4f74b9cf8b5c3810788/data/tilesets/secondary/pallet_town): `tiles.png`, `metatiles.bin`, palettes `07.pal`–`12.pal`.
- [Format constants](https://github.com/pret/pokefirered/blob/c75f352304d529f6ba92d4f74b9cf8b5c3810788/include/fieldmap.h): 640 primary tiles, 640 primary metatiles, seven primary palettes, thirteen total palettes, eight subtiles per metatile.
- [Pallet Town layout](https://github.com/pret/pokefirered/tree/c75f352304d529f6ba92d4f74b9cf8b5c3810788/data/layouts/PalletTown): `map.bin`, with 24×20 dimensions recorded in the source layouts JSON. Used to verify faithful house/lab assembly, not as the game's generated map.

Run `node scripts/build-terrain.mjs` from the repository root after `npm install`. It rebuilds the atlas and contact sheets offline from `source-terrain/` using `pngjs`.

The source PNGs encode 4-bit palette indices in an indexed grayscale palette. The decoder restores indices, reads each little-endian GBA map entry, applies its 10-bit tile index, horizontal/vertical flip flags, and 4-bit palette number, and composites the lower and upper 8×8 quadrants into 16×16 metatiles. Index zero is transparent. This is a static flattened terrain atlas; original animated background timings and player occlusion layers are not reproduced by the atlas.

`terrain.png` is 512×368: 32 columns, 729 frames of 16×16. Atlas frame numbers equal original metatile IDs. Primary IDs occupy 0–639 and Pallet Town IDs 640–728. `terrain.json` includes named IDs, suggested row-major blocks, exact source hashes, and format metadata. No unavailable tile/palette references were encountered during decoding.

Contact sheets label IDs in decimal: `terrain-contact.png` (0–255), `terrain-contact-256.png` (256–511), and `terrain-contact-512.png` (512–728). `terrain-blocks.png` shows the suggested tree, house, lab, mailbox, and pond. `terrain-reference-pallet-town.png` is a decoded source-layout diagnostic, not a screenshot of Infinite Tamer Adventure or evidence of AI-generated content.

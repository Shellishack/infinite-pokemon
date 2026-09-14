# Classic presentation assets

Pokémon front/back sprites use the FireRed/LeafGreen generation-III set mirrored by [PokeAPI/sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-iii/firered-leafgreen).

Overworld Red and Green (walking and bicycle sheets), Professor Oak, Youngster, Nurse, Hiker, Lass, Fisher, and Scientist sheets come from [pret/pokefirered](https://github.com/pret/pokefirered/tree/master/graphics/object_events/pics/people). Terrain data is sourced and assembled separately by the project's terrain importer; see its source manifest. Indoor tiles use that repository's primary building and secondary Pokémon Center sets, decoded by `scripts/build-interior.mjs` with metadata in `interior/sources.json`.

Original Pokémon game artwork and characters belong to Nintendo, Creatures, and GAME FREAK. These assets are reference-game artwork, not original artwork created by this project. Game implementation, local UI composition, and generated story content are separate from the reference art. Source files and transformation metadata are retained for provenance.

The original extra creature designs, hybrid/creature SVG recipes, item icons, and custom vehicle recipes are project-authored code/data, separate from the credited reference-game artwork. Generated profile recipes can extend these visuals; they are not output from an image-generation service.

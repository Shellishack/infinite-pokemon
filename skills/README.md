# Infinite Pokémon generation skills

[Project repository](https://github.com/Shellishack/infinite-pokemon) · [Getting started](https://github.com/Shellishack/infinite-pokemon#readme) · [Issues](https://github.com/Shellishack/infinite-pokemon/issues)

Version 0.1.0. These skills produce structured content proposals for the Infinite Pokémon host. The engine supplies saved context, schemas and capabilities, validates results, and owns gameplay state. They do not start a game or provide a standalone map server. No artwork, saves, credentials, or unpublished research is included.

| Skill | Purpose |
| --- | --- |
| [infinite-pokemon-region](infinite-pokemon-region/SKILL.md) | Map stories, bounded features and content profiles |
| [infinite-pokemon-npc](infinite-pokemon-npc/SKILL.md) | Dialogue, memory, intentions and optional movement policies |
| [infinite-pokemon-interior](infinite-pokemon-interior/SKILL.md) | Furniture/rugs within protected rooms |

Install through the Skills CLI:

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon-region --skill infinite-pokemon-npc --skill infinite-pokemon-interior
```

The game loads its bundled skills directly, so playing does not require this separate installation. Region includes local copies of the NPC/interior contracts so individual registry installations remain self-contained. Keep those copies synchronized when changing the canonical contracts.

The three instruction bundles are released under MIT-0 (see each bundle’s LICENSE), including commercial reuse of the instructions. This exception does not include game code, artwork or branding. See the [project disclaimer](../DISCLAIMER.md).

See [registry publication status](../docs/SKILL-DISTRIBUTION.md) and [versioned downloads](https://github.com/Shellishack/infinite-pokemon/releases/tag/skills-v0.1.0).

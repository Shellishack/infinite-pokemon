# Infinite Pokémon setup and generation skills

[Project repository](https://github.com/Shellishack/infinite-pokemon) · [Getting started](https://github.com/Shellishack/infinite-pokemon#readme) · [Issues](https://github.com/Shellishack/infinite-pokemon/issues)

Source version 0.2.0. The entry skill guides an AI assistant through user-requested setup and launch. The three generation skills produce structured content proposals for the game host. No artwork, saves, credentials, or unpublished research is included in these bundles.

## Quick start

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon
```

Then ask: **“Use $infinite-pokemon to set up and start the game for me.”** The AI follows the entry skill to clone missing game files, install dependencies, build and launch. The Skills CLI requires a repository source; `npx skills add infinite-pokemon` alone is not supported. Installing instructions does not launch the game automatically.

If an installed skill is missing the game or required project files, first clone [the complete repository](https://github.com/Shellishack/infinite-pokemon) into a new local directory and follow its [English](../README.md#run-on-your-computer) or [Chinese](../README.zh-CN.md#本地启动) getting-started instructions before playing. Reuse a complete checkout without overwriting saves or local changes. Missing private context in a running generation job must be reported to the host rather than replaced by a fresh clone.

| Skill | Purpose |
| --- | --- |
| [infinite-pokemon](infinite-pokemon/SKILL.md) | Set up and launch the game when the user asks to play |
| [infinite-pokemon-region](infinite-pokemon-region/SKILL.md) | Map stories, bounded features and content profiles |
| [infinite-pokemon-npc](infinite-pokemon-npc/SKILL.md) | Dialogue, memory, intentions and optional movement policies |
| [infinite-pokemon-interior](infinite-pokemon-interior/SKILL.md) | Furniture/rugs within protected rooms |

Install through the Skills CLI:

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon-region --skill infinite-pokemon-npc --skill infinite-pokemon-interior
```

The game loads its bundled skills directly, so playing does not require this separate installation. Region includes local copies of the NPC/interior contracts so individual registry installations remain self-contained. Keep those copies synchronized when changing the canonical contracts.

The four instruction bundles are released under MIT-0 (see each bundle’s LICENSE), including commercial reuse of the instructions. This exception does not include game code, artwork or branding. See the [project disclaimer](../DISCLAIMER.md).

See [registry publication status](../docs/SKILL-DISTRIBUTION.md) and [versioned downloads](https://github.com/Shellishack/infinite-pokemon/releases/tag/skills-v0.2.0).

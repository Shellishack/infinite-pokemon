# Skill distribution

Publication links rechecked 19 September 2026. The entry skill and three generation skills are version 0.3.0, which adds the hosted website and browser demo to the skill instructions.

[Repository](https://github.com/Shellishack/infinite-pokemon) · [Versioned ZIP bundles](https://github.com/Shellishack/infinite-pokemon/releases/tag/skills-v0.3.0) · [Website and browser demo](https://infinite-pokemon-blond.vercel.app/) · [Skill instructions and installation](../skills/README.md)

| Destination | Verified status |
| --- | --- |
| GitHub release | Published: four instruction-only ZIP archives at v0.3.0 |
| skills.sh / Skills CLI | [Entry](https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon), [region](https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon-region), [NPC](https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon-npc), and [interior](https://skills.sh/shellishack/infinite-pokemon/infinite-pokemon-interior) pages are public |
| skills.re | [Entry](https://skills.re/skills/Shellishack/infinite-pokemon/infinite-pokemon), [region](https://skills.re/skills/Shellishack/infinite-pokemon/infinite-pokemon-region), [NPC](https://skills.re/skills/Shellishack/infinite-pokemon/infinite-pokemon-npc), and [interior](https://skills.re/skills/Shellishack/infinite-pokemon/infinite-pokemon-interior) are public at v0.3.0 |
| ClawHub | [Entry](https://clawhub.ai/shellishack/skills/infinite-pokemon), [region](https://clawhub.ai/shellishack/skills/infinite-pokemon-region), [NPC](https://clawhub.ai/shellishack/skills/infinite-pokemon-npc), and [interior](https://clawhub.ai/shellishack/skills/infinite-pokemon-interior) pages are public at v0.3.0 |
| SkillsMP | [Search](https://skillsmp.com/search?q=infinite-pokemon): submitted through documented GitHub-topic indexing, but no listing was visible on 17 September 2026 |
| Skills Directory / SkillPass | Require additional publisher sign-in; not submitted |

Skills.re currently displays the repository-level MIT License in its catalog metadata. Each bundle's actual LICENSE and SKILL.md explicitly specify MIT-0; registry display metadata does not replace those files.

Only the four instruction bundles are MIT-0. Their archives do not contain game artwork, code outside the bundles, saves, private research, or generated runtime data. The project's educational/non-commercial disclaimer retains a specific exception for the skill instruction files.

## Install

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon
```

Then ask the AI to use the infinite-pokemon skill to set up and launch the game. The entry skill guides interactive setup; the game already loads its three generation skills. The bare command `npx skills add infinite-pokemon` was tested and fails because the upstream CLI expects a repository source.

Validated v0.2.0: four skill schemas, 19 local bundle references, isolated entry-skill installation, fresh clone, npm ci, build, and Electron smoke test with zero provider calls. Installing instructions alone does not launch the game.

## Publication references

- [Skills leaderboard discovery](https://www.skills.sh/docs/faq)
- [SkillsMP indexing requirements](https://skillsmp.com/docs/faq)
- [skills.re submission](https://skills.re/docs/submitting-skills)
- [ClawHub publishing and MIT-0 terms](https://github.com/openclaw/clawhub/blob/main/docs/cli.md)

Pending listings are not claimed as live. Future changes require a new skill version and regenerated release archives. Keep the region bundle's local NPC/interior contract copies synchronized with their canonical standalone skills.

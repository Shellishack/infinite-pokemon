# Skill distribution

Publication checked 14 September 2026. The entry skill and three generation skills are version 0.2.0, source commit 59e3b351f3e6c7879770d135563965709b633dde.

[Repository](https://github.com/Shellishack/infinite-pokemon) · [Versioned ZIP bundles](https://github.com/Shellishack/infinite-pokemon/releases/tag/skills-v0.2.0) · [Skill instructions and installation](../skills/README.md)

| Destination | Verified status |
| --- | --- |
| GitHub release | Published: four instruction-only ZIP archives at v0.2.0 |
| skills.sh / Skills CLI | Entry skill v0.2.0 installed successfully in an isolated validation directory; the three older bundles also passed installation checks. Leaderboard discovery is automatic and asynchronous |
| skills.re | All four confirmed via its read API at version 0.2.0 |
| ClawHub | All four v0.2.0 submissions accepted; public visibility awaits registry security/publication processing |
| SkillsMP | Repository topics claude-skills and claude-code-skill added for its documented daily index; listing not yet confirmed |
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

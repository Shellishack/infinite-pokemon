# Skill distribution

Publication checked 14 September 2026. The three generation skills are version 0.1.0, source commit 23bc27403a643c94dfa3b7d00b6903b4ee722638.

[Repository](https://github.com/Shellishack/infinite-pokemon) · [Versioned ZIP bundles](https://github.com/Shellishack/infinite-pokemon/releases/tag/skills-v0.1.0) · [Skill instructions and installation](../skills/README.md)

| Destination | Verified status |
| --- | --- |
| GitHub release | Published: three instruction-only ZIP archives |
| skills.sh / Skills CLI | All three successfully installed from the public repository in an isolated validation directory; leaderboard discovery is automatic and asynchronous |
| skills.re | All three submitted through the public import service and confirmed via its read API at version 0.1.0 |
| ClawHub | All three version 0.1.0 uploads accepted; awaiting publication/security processing |
| SkillsMP | Repository topics claude-skills and claude-code-skill added for its documented daily index; listing not yet confirmed |
| Skills Directory / SkillPass | Require additional publisher sign-in; not submitted |

Skills.re currently displays the repository-level MIT License in its catalog metadata. Each bundle's actual LICENSE and SKILL.md explicitly specify MIT-0; registry display metadata does not replace those files.

Only the three instruction bundles are MIT-0. Their archives do not contain game artwork, code outside the bundles, saves, private research, or generated runtime data. The project's educational/non-commercial disclaimer retains a specific exception for the skill instruction files.

## Install

```sh
npx skills add Shellishack/infinite-pokemon --skill infinite-pokemon-region --skill infinite-pokemon-npc --skill infinite-pokemon-interior
```

The game already loads its bundled copies. Separate installation is for use with a compatible host that supplies the context and schema.

## Publication references

- [Skills leaderboard discovery](https://www.skills.sh/docs/faq)
- [SkillsMP indexing requirements](https://skillsmp.com/docs/faq)
- [skills.re submission](https://skills.re/docs/submitting-skills)
- [ClawHub publishing and MIT-0 terms](https://github.com/openclaw/clawhub/blob/main/docs/cli.md)

Pending listings are not claimed as live. Future changes require a new skill version and regenerated release archives. Keep the region bundle's local NPC/interior contract copies synchronized with their canonical standalone skills.

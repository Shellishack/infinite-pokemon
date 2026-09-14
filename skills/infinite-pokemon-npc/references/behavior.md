# Behavior contract

A movement policy contains all four fields:

```json
{"movement":"wander","radius":2,"intervalSeconds":4,"waypoints":[]}
```

- `movement`: `stationary`, `wander`, or `patrol`.
- `radius`: Manhattan distance from the NPC's fixed home, integer1–3.
- `intervalSeconds`: integer2–8. The server decides when a legal step can occur; this is not a real-time command.
- `waypoints`: up to6 `{x,y}` offsets from home, each integer−3…3 and within radius. A patrol requires at least one. Use empty points for stationary/wander. Choose passable endpoints, never furniture, services or walls.

Map binding: `{"sceneId":"outdoor","npcId":"guide","behavior":{...}}`. `sceneId` may also be `sanctuary` or `home` if present in the supplied catalog. A live NPC job currently targets the outdoor guide; other NPCs receive generated policies through map proposals.

The engine enforces one cardinal tile per step, a320ms interpolation, solid NPC hitboxes, player and NPC occupancy, a home radius, no door crossing, protected arrivals, and reachable service/interaction paths. Movement pauses within two tiles of players and during battles in the scene. A blocked wander tries another legal direction; a blocked patrol waits or finds a route. Healers, merchants and nursery keepers remain stationary so their services can always be found. These rules cannot be changed by the proposal.

Examples of intent: an archive guide patrols between two reading spots; a trail guide wanders a clearing; a caretaker stays beside supplies. A `rest` intention offers existing engine healing when the player talks to the guide; prose cannot invent buffs, items or progression. Derive memories from observed events rather than claiming knowledge of another save. Keep dialogue brief and consistent with temperament. Describe intentions without promising that a blocked movement already happened.

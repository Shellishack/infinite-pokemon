# Buildings: creative exteriors, dependable services

Invent architecture that belongs to the location: canal houses, stilt huts, courtyard homes, workshops, bathhouses, greenhouses, windmills, railway halls, mountain lodges, observatories, cliff archives, hollow-tree shelters, or unfamiliar variations. These examples do not restrict style. Generated exteriors and interiors may vary when the asset and building-placement capabilities are present.

Every enterable building needs an explicit footprint, reachable entrance, matching door coordinates, valid arrival point, and a return exit. Roof art can overhang the footprint; doors must still align with the collision map. Do not draw additional apparent entrances that cannot be used without clearly marking their purpose. Decorative background buildings may be nonenterable, but should not imitate a functional service entrance.

## Hospital / community center contract

A place advertised as a hospital, healing center, or full community center must provide all of these, regardless of its architecture:

| Facility | Required behavior |
| --- | --- |
| Reception and caretaker | Clearly marked, reachable interaction; explain available services |
| Healing | Restore party HP and move PP; recover fainted companions; safe to use repeatedly without a consumable or victory prerequisite |
| Saving | Accessible checkpoint/save terminal, successful-save feedback, and access to run/checkpoint management according to host permissions |
| Trading | Clearly marked trading desk with the supported trade interface; when no partner is available, explain that honestly |
| Exit and circulation | A clear route from entry to every service and back outside; no furniture, NPC, or story lock may obstruct essential care |

The artistic treatment is free: a rural clinic, modern hospital, garden hall, or floating community pavilion can satisfy the same contract. Maintain recognizable care/save/trade signage even when adapting colors and motifs. Extra services such as a noticeboard, storage desk, or rest area are optional.

Saving follows the active run. The host can create or branch shared checkpoints; a guest must receive accurate autosave/host-managed messaging instead of a false private rewind. Healing and saving must remain available before and after the regional master is defeated.

Trading requires engine support, two eligible participants in the same run/session, explicit agreement to the offered companions, revalidation at acceptance, and an atomic exchange with retry protection. A cancelled or disconnected offer must not lose or duplicate a companion. Cross-save or cross-branch exchange needs a separate implemented policy. Dialogue and image generation cannot perform trades or declare one complete.

Do not publish a full service center as operational when a required action is unsupported. In a design job, preserve the building brief and list missing service capabilities. In today's live map-story job, leave the existing shelter mechanics intact and do not advertise trading. Existing template shelters provide healing; they are not yet implementations of this full center contract.

## Other building families

- **Homes and social places:** resident routines, gardens, communal kitchens, libraries, cafes, meeting halls. Optional conversations, no mandatory invented rewards.
- **Work and travel:** shops, mills, ferries, train stations, workshops, farms, ranger posts. Only offer purchasing or travel if the engine supplies those actions.
- **Exploration landmarks:** towers, shrines, ruins, laboratories, conservatories. Connect their identity to established region history.
- **Dojo:** use the regional reference for its master, challenge, and completion rules. A trainer sprite in an arbitrary house is not automatically a Dojo.

For asset-capable requests, use the visual-assets reference for door sockets, hitboxes, occlusion, service anchors, and staged publication.

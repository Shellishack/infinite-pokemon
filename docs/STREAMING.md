# Configurable map generation depth

The host selects **Map generation depth** under **Optional settings** in the connection screen or START → SESSION. The accepted values are integers0–3, default1. This controls speculative map generation, not camera zoom. It is stored in run metadata and inherited by checkpoint branches.

| Depth | New ring | Surrounding blocks | Including the current block |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 1 |
| 1 | 4 | 4 | 5 |
| 2 | 8 | 12 | 13 |
| 3 | 12 | 24 | 25 |

Four-direction travel produces a Manhattan-distance diamond. Overlapping paths are deduplicated: the surrounding count is `2d(d+1)`, not an exponential tree. A multiplayer run uses the union around connected trainers, so separated players can require more than24 blocks altogether. Previously completed or visited maps remain cached and need no generation job.

Queued map work is ordered by the minimum distance to a connected trainer. An explicitly requested destination wins ties. Changing depth, joining/leaving, and entering another block recomputes the queue. Lowering depth drops unstarted jobs outside the new range, but does not delete saved maps or cancel an already-running job just to change priority. NPC jobs run after map jobs. A verified host connection is required. The normal connection flow has no application job cap; provider limits still apply.

At depth0, a new full run initially creates only its starting block. A new destination is allocated and queued when a player tries to enter it. Until the map is prepared, the trainer stays on the current side of the boundary. Failed/unpublished template placeholders are not silently published as completed agent content. Existing visited maps and authored preview maps remain valid cached destinations.

The waiting UI shows actual states: queued position, generating elapsed time, failure, pause, disconnection, or exhausted budget. It does not invent an agent completion percentage. After successful validation and storage, the server performs the pending move automatically. Cancel travel removes that request; a late job may finish into the cache but cannot then move the trainer. Failure requires an explicit retry, preventing repeated frontier refreshes from silently spending more jobs on the same failure. Disconnecting clears pending travel; a reconnect resumes at the last committed position.

Preview still has exactly five authored maps and never generates. Depth changes there are saved for later full play and only reuse the finite content. At any depth, trying to cross the preview boundary shows the existing preview limit prompt.

`tests/streaming.test.ts` checks radius counts, deduplication, priorities, pruning, cache reuse, wait/cancel behavior, persistence and validation. `npm run test:streaming` drives the real UI with controlled, non-provider generation for delay/failure/retry/cancel/automatic entry. No live Codex calls are needed for these tests.

A small bottom-left gameplay indicator stays visible while background map jobs are active or queued, including the final active job after the queue is empty. It shows remaining blocks and distinguishes generating, queued, paused, disconnected, and budget-limited work. It disappears when no map work remains; NPC jobs and finite preview content do not trigger it. The overlay does not intercept gameplay input.

Click the background indicator (or START → AGENT) to inspect the host agent's activity. The panel polls an authenticated, read-only endpoint once per second while open. It reports the model and effort returned by Codex, actual tool lifecycle events, elapsed time, reported token totals, generation job count, pending map/NPC jobs, validation, and failure summaries. All active jobs plus up to eight recent completed jobs (up to24 events each) are kept in memory for the current server session, including after work finishes; reopening a server starts a fresh activity feed. It does not start new agent work. Raw commands, tool output, credentials, local paths and reasoning are not included in the player-facing feed. Guests with a valid credential for the run can see the same operational activity.

Transport events follow the official [Codex App Server documentation](https://learn.chatgpt.com/docs/app-server): `item/started`, `item/completed`, and `thread/tokenUsage/updated`. Unknown token usage is displayed as unreported, rather than zero; elapsed time is not a completion percentage.


## Generation batch size

The host selects **Generation batch size** under **Optional settings** during connection or in START → SESSION. It defaults to **3**, accepts integers **1–8**, and is stored per run (and inherited by checkpoint branches). One is sequential. Larger values run independent map turns concurrently through the same local harness. This is a concurrency limit, not a requirement to wait for a full batch: one queued map starts immediately, and each free slot takes the next nearest queued map. Each block counts as one generation job. Legacy API callers may still supply an explicit cap; that cap is checked synchronously before dispatch. The normal UI supplies no cap.

Changes apply to the running scheduler. Increasing the limit fills free slots immediately; decreasing it waits for active jobs to drain before starting more. Pausing prevents new dispatch without discarding current work. NPC jobs remain sequential and follow pending/active maps. Shutdown or harness invalidation cancels every active turn. Preview stores the setting without making model calls.

Map jobs receive immutable context from completed or observed maps in their own save, plus their target. Unfinished neighboring drafts are excluded from this context and its dependencies, so sibling completions cannot invalidate one another or masquerade as established story facts. Each result still passes schema, geometry, source-dependency, and run/context validation before it is saved. Concurrent maps may complete in any order. The generation indicator counts every active job, and Agent activity exposes the batch limit and individual concurrent runs.

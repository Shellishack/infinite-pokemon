# Runs and branching checkpoints

Every local world belongs to a named run. The first host entry creates an initial checkpoint automatically; an existing trainer receives an Imported progress checkpoint. Normal gameplay continues to autosave to that run. START → SAVE creates a durable checkpoint; START → SAVES opens the run selector and checkpoint tree. Names can be supplied when saving, branching, or starting a new run.

Continue run opens that run's latest autosaved state. Branch from checkpoint creates a different run rooted at the selected immutable snapshot. It never rewinds the original database. Further checkpoints in either run point to their own prior checkpoint, so two continuations of the same checkpoint become siblings in the tree. A fresh run gets a different trainer and seed; a fork retains the checkpoint's terrain seed and trainer progress while receiving a new world and run identity.

## Storage and consistency

The family root contains `save-library/catalog.sqlite`, immutable `save-library/checkpoints/<id>.sqlite` files, and working copies at `save-library/runs/<id>/world.sqlite`. Existing worlds and previews remain at their original paths; the catalogue registers them without moving or replacing their data. The host automatically resumes the last selected run through the main menu. Local run ports persist across restarts. A missing directory or occupied port is reported instead of silently creating a replacement.

SQLite `VACUUM INTO` takes a synchronous, consistent checkpoint of maps, players, canonical events, NPC memories, world choices, and metadata. The file is finalized before it is indexed. A SHA-256 digest is verified before branching. This prioritizes a clear checkpoint boundary; very large worlds can briefly pause server processing while copied. Checkpoint requests are idempotent per run and request ID. Fork/new-run requests also accept an idempotency ID. There is no delete or overwrite operation in the save UI.

The catalogue tracks run identity, directory, fork origin, latest checkpoint, ports, and progress summaries. Each checkpoint records its parent, source run, event sequence, creation time, and progress summary. Current run autosaves are mutable; checkpoint files are not. A partial failure can leave an unindexed file, but an incomplete copy is never offered in the tree. Restoring a catalogue and its checkpoints should use a complete, stopped-server copy of the family directory.

## Generation scope

Each working copy has its own Store, World, Generator, job ledger, context directory, and NPC observations. Forking copies only the selected database snapshot; external context folders, Codex credentials, queued runtime work, and future parent events are not copied. Copied job/command receipts are cleared, movement interpolation is reset, and browser tokens are rotated. Existing static game artwork is shared read-only.

New map manifests and compact context explicitly identify the run, fork checkpoint, and latest checkpoint. NPC observations carry the same lineage. The generation skill reads only these supplied inputs; ancestral history is already in the copied ledger, so it must not read sibling runs or later parent snapshots. Publication also checks run identity. A late parent job can update only its original run, never a checkpoint or sibling working copy.

Preview runs remain finite and generate nothing. Full-world runs require their local harness to be verified; a new full-world branch may therefore show the connection screen. Switching pauses generation in the old run and cancels active provider work. Previously consumed provider allowance cannot be restored by going back to a checkpoint.

## Multiplayer

One run is the authoritative shared world for its session. The local host owns the catalogue and checkpoint controls; public clients cannot browse or switch private runs. Guests retain automatic progress saving in the host's current run. A host must close multiplayer or wait for guests to leave before switching histories. Shared co-op battles must finish before a checkpoint is created. Forks initially open as single player and can subsequently be hosted as a separate session.

Snapshots preserve all trainer records and their world consequences. Browser credentials are regenerated for a fork; the host resumes their copied trainer automatically, while guests joining the new session begin new browser identities. Returning to an existing run's original session address retains that run's existing guest saves. Cross-branch guest-profile transfer is not implemented.

## Verification

`npm test` includes tree ancestry, progress/context isolation, late generation, checkpoint integrity, request deduplication, restart recovery, and host-only routes. `npm run test:saves` exercises the real browser flow for named saves, branching, returning to a later autosave, creating a fresh run, and mobile layout. These tests do not call Codex.

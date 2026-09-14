# Visual direction (superseded by the classic revision)

The user rejected the initial expedition-console treatment below. The implemented revision uses a native 240×160 following camera, classic FireRed terrain and trainer sheets, generation-III front/back battle sprites, compact bordered dialogue, an in-game Start menu, and dedicated party/bag/map screens. See `game/client/styles.css`, `game/client/GameCanvas.tsx`, and `game/assets/classic/CREDITS.md`. The original notes are retained as design history rather than the current UI specification.

An illustrated expedition console surrounds a classic pixel-world viewport. The world is the largest, most memorable element; the UI feels like a trainer's field guide.

Palette: deep ink #183945, lake #327e92, field #80b86b, path #e7c990, paper #f3f5d9, signal yellow #f4d66b. Pixel type: locally bundled Press Start 2P for short titles, VT323 for dialogue and controls, system sans for setup details. Headings stay short; ordinary copy uses sentence case.

Desktop: narrow expedition rail, large game viewport, compact field journal. The setup uses a rendered pixel landscape beside a simple host/join panel. Small screens stack the journal beneath the viewport and expose touch controls. Pixel borders describe game windows, not generic cards. Focus indicators and reduced motion are required. All artwork is authored in the repository as pixel sprite definitions; no network asset dependencies.

Implementation review: retain the natural greens and tiled scenery of the brief, use dark blue only for framing, avoid a generic neon dashboard. Terrain and character details carry the identity.

## Audio development

Follow [Audio generation and game integration](AUDIO-DEVELOPMENT.md) when composing or adding scenario music. It contains the cue catalog, score format, rendering commands, playback rules and required checks. The soundtrack is original chiptune audio rendered locally from code; runtime scene selection follows game state.

Sound effects should reinforce confirmed actions and visible animation stages. Keep movement quiet, reward cues distinct, and dense battle/UI effects short. Follow the [SFX generation and integration rules](AUDIO-DEVELOPMENT.md#sound-effect-generation) when extending the effect bank.

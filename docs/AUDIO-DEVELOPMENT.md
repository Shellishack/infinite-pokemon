# Audio generation and game integration

Infinite Pokémon uses an original, locally synthesized chiptune soundtrack. Audio generation is a development/build step: an agent can compose structured score data and run the renderer. The running game plays bundled WAV files; map and NPC generation jobs do not call an audio service or create music while a player waits.

## Current scenario cues

| Scenario | Track ID | Composition | BPM |
| --- | --- | --- | --- |
| Title, introduction, starter selection | `title` | A Map Without an Edge | 112 |
| Willowbrook outdoors | `town` | Willowbrook Morning | 108 |
| Meadow and river routes | `exploration` | Footsteps Beyond the Valley | 120 |
| Forest routes | `forest` | Where the Ferns Whisper | 96 |
| Coastal routes | `coast` | Saltwind Boardwalk | 116 |
| Ruins | `ruins` | Echoes in the Waystone | 76 |
| Indoor rooms and nursery | `interior` | Lanterns and Linen | 84 |
| Open shop panel | `shop` | Coins and Curiosities | 126 |
| Wild encounters and practice | `battle` | Sparks at the Crossroads | 144 |
| Trainer battle | `trainer-battle` | A Rival on the Road | 152 |
| Shared guardian battle | `guardian-battle` | The Valley Stands Together | 138 |
| Won battle | `victory` | A New Page | 132 |

All cues loop except the victory fanfare. Battle music overrides location/shop music. A victory plays once, then returns to the current location's ambience. Opening and closing a shop changes its cue without restarting the surrounding region. Moving between maps with the same music type keeps the current track playing.

## Generate audio

From the repository root:

```powershell
npm run audio:compose
npx tsx --test tests/music.test.ts
npm run build
npm run test:music
```

The score and renderer are in `scripts/compose-soundtrack.ts`; additional scenario compositions are in `scripts/scenario-scores.ts`. Rendering writes `game/assets/audio/<id>.wav` and a `soundtrack.json` manifest with title, tempo, duration, loop flag and measured levels. It overwrites these generated recordings reproducibly. The workflow uses Node.js only, with no API key, Codex token use, downloaded samples or external audio dependency.

## Compose a new cue

Add a score object to `scenarioScores`:

```js
{
  id: 'new-location',
  title: 'An Original Composition',
  bpm: 100,
  chords: ['C3 E3 G3', 'F2 A2 C3'],
  melody: ['E5 - G5 E5 D5 C5 D5 -', 'F5 A5 G5 F5 E5 C5 F5 -'],
  beat: 'soft',
  lead: 'bell'
}
```

Each bar is four beats. A melody bar has eight eighth-note positions; `-` extends the preceding note, or is silent if nothing precedes it. Chords contain three pitches. Supported notation is A–G with optional `#`/`b` and octave1–6. Scores contain1–64 bars at50–200 BPM; melody and chord bar counts must match. IDs must be unique lowercase letters/digits/hyphens, beginning with a letter.

`lead` can be `pulse`, `triangle`, or `bell`; the normal default is pulse. `beat` selects `soft` (no drums), `light`, `walk`, or `drive` (extra percussion). Set `once: true` only for a finite cue and implement its return behavior in the player. For example, victory is already handled explicitly. Give different scenarios distinct melody, harmony, tempo and density, rather than merely transposing the same phrase. Compose original material rather than copying recognizable game themes.

## Wire the scenario

1. Add the ID to `MusicTrack` in `game/client/music.ts`.
2. Add its trigger to `musicTheme` or `ambientMusicTheme` in `game/client/MusicControls.tsx`. Use actual game state, not guesses based on map names.
3. Keep the priority order: introduction → active battle → victory → shop → interior → town/biome → exploration fallback.
4. Add routing coverage and update the soundtrack count/catalog assertions in `tests/music.test.ts`; exercise a representative transition in `tests/music-e2e.ts`.
5. Run the generation and verification commands above. Restart the game to load the new build.

## Audio and playback requirements

The renderer produces mono22.05kHz16-bit PCM WAVs. Band-limited pulse harmonics, triangle accompaniment, bell tones and deterministic noise percussion are mixed with short attack/release envelopes. Files are normalized to a0.78 peak; short loop-boundary fades reduce clicks. Inspect duration, silence, clipping and boundary samples, then listen to the complete loop and its transition. Automated level checks do not judge musical quality.

Playback uses gesture-unlocked Web Audio, lazy loading, cached decoded buffers and gain fades. Keep one active musical cue, apart from a brief crossfade; never stack a fresh loop on every game-state update. Preserve mute/volume settings, pause hidden pages and keep generation/gameplay usable if an audio file fails. Electron relays validated audio preferences between local saved-run ports. Keep the existing preference keys for compatibility even if branding changes.

No live audio-generation provider is currently integrated. To add one later, treat it as a separate bounded asset job: record source/model provenance, validate file type/size/duration/levels, publish only validated local assets, and fall back to the bundled score while it runs. Do not claim a runtime audio capability in generation skills until the code implements it.

## Sound-effect generation

Run `npm run audio:sfx` to render the common SFX bank, or `npm run audio:all` to regenerate music and effects together. `scripts/compose-sfx.ts` writes22 original short mono22.05kHz16-bit WAV files plus `game/assets/audio/sfx/manifest.json`. It synthesizes tones, pitch sweeps and deterministic noise locally, with no external audio service, samples, or provider calls.

| Effects | Trigger |
| --- | --- |
| `select`, `menu-open`, `menu-close` | Enabled UI buttons and menu transitions |
| `footstep`, `bump` | Accepted on-foot movement or an authoritative blocked move |
| `door`, `travel` | Confirmed scene or map changes, excluding the initial snapshot |
| `interact`, `encounter` | Successful interactions and newly started encounters |
| `attack`, `hit`, `send-out` | Matching battle playback stages; starter/party changes also use send-out |
| `heal`, `pickup`, `purchase`, `save` | Successful healing, collection, buying and saving |
| `capture-throw`, `capture-success` | Capture animation and confirmed successful capture frame |
| `level-up`, `hatch` | Confirmed level-up frame or egg hatching |
| `escape`, `error` | Successful battle escape or rejected action feedback |

An effect is a set of `tone(at, duration, fromHz, toHz, waveform)` parts. Supported waveforms are sine (default), square and noise. `notes([...], stepSeconds)` creates short melodic sequences. Keep effects brief and distinguish their roles: soft noise for footsteps, a short low bump for collision, pitched confirmations for rewards, and brief sweeps/noise for battle actions. Use attack/release envelopes and leave a quiet tail; keep peaks below0.66. Footsteps deliberately peak much lower than reward cues.

To add an effect, add its ID to `game/shared/sfx.ts`, define its synthesis in `scripts/compose-sfx.ts`, then wire a meaningful engine result or presentation stage. Regenerate audio and run:

```powershell
npx tsx --test tests/sfx.test.ts
npm run build
npm run test:sfx
```

`World.apply` attaches semantic `sounds` only after actions succeed (plus a specific blocked-move cue). Its stored receipts retain those cues. The client plays result cues only for commands still awaiting a response, preventing duplicate receipt delivery from replaying a reward sound. Battle effects are attached to the existing animation frames rather than speculative attack input. Do not infer a purchase/heal/catch from a button press or play effects on every state snapshot. Local UI selection feedback is intentionally separate from successful-action feedback.

Effects share the music AudioContext but have a separate gain/mute channel. Playback is gesture-gated, lazy-loaded and cached. It allows at most four simultaneous effects, throttles bumps/errors to250ms and footsteps to110ms, drops cues whose load is more than600ms late, and suppresses playback while hidden or muted. A shared compressor limits mixed peaks. Missing SFX never block gameplay. The SFX controls persist with audio preferences across local run navigation; muting music does not mute effects.

The asset test verifies every registered ID, WAV headers, duration, peak level and silent boundaries. The browser test checks short-buffer playback with music muted, semantic gameplay cues, duplicate receipt suppression, animation timing hooks and independent SFX mute persistence. Playback tests mute the machine's speaker output and do not call Codex.

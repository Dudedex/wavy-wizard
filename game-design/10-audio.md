# 10 — Audio

Source: `js/audio.js`. All audio is **synthesized at runtime** with WebAudio — no audio
files. A master chain feeds a `DynamicsCompressor` acting as a limiter to prevent
clipping/clicking.

## Soundtracks (selectable in Settings)

Three loops are available via `game.opt.soundtrack` (cycled in Settings → Soundtrack):

| ID | Label | Feel |
|----|-------|------|
| `smooth` | Moonlit Groove | chill tonal pads + rounded bass + sparse bells (default) |
| `breakbeat` | Bass Breakbeat | drum-and-bass groove, tonal kick/snare/hat shapes |
| `edm` | Jump Arcade (EDM) | jumpstyle: 4-on-the-floor kick, offbeat "jump" bass, supersaw stabs, pluck riff |

All three are fully **synthesized at runtime**, constant-tempo, and built only from
tonal oscillators with soft (ramped) envelopes so they stay **click-free**; the
master chain's compressor limiter catches combined peaks.

### Jump Arcade (EDM) details
- `EDM_STEP = 0.125s` per sixteenth (~125 BPM). The loop is **two base rhythms then a
  drop**: `EDM_CYCLE = 131` steps = **Rhythm A (64)** → **Rhythm B (64)** → **3-step
  drop** → loop.
- **Rhythm A** (`edmRhythm(..,'A')`): the core jumpstyle groove — **4-on-the-floor
  kick** (pitch-bent low sine), the **offbeat "jump" bass** between the kicks, claps on
  beats 2 & 4, offbeat hats, supersaw chord stabs, and the `EDM_LEAD` pluck riff.
- **Rhythm B** (`edmRhythm(..,'B')`): the busier "second base rhythm" — a **rolling
  double-bounce bass**, octave-up stabs, continuous hats, and the brighter `EDM_LEAD_B`
  answer phrase.
- **Drop** (`edmDrop`, 3 steps): a downward impact + sub rumble, a breath/gap, then an
  upward **riser** that sweeps tension back into Rhythm A's first kick.
- Anthemic **Am–F–C–G** progression (one chord/bar). All tonal/noise-free (mirrors the
  breakbeat scheduler) so it stays click-free.

## The original loop — "Arcane Battle" / "Moonlit Groove"

Design goals were a **smooth, seamless loop** with no clicking ("GSM buzz") artifacts.

- **Constant base tempo.** `ARCANE_STEP ≈ 0.26s` per step drives a fixed-tempo
  pattern + melody (`ARCANE_PATTERN`, `ARCANE_MELODY`, `scheduleArcaneStep`).
- **Only the heartbeat accelerates** with intensity — `heartbeatInterval()` speeds up
  while the base groove stays steady. The heartbeat is a real kick-drum "lub-dub"
  (`heartKick` / `scheduleHeartbeatPhrase`), not a pitched tone.
- **Click-free envelopes.** Tones use exponential attack/release ramps with a
  `!(vol > 0)` guard; noise bursts (`scheduleCombatNoise`, `scheduleTechnoHat`) get
  short onset ramps. These ramps + the compressor limiter eliminated the analog-speaker
  buzzing that instant-onset bursts caused.

## Sound effects

`sfx(name)` / `spellSfx(id)` play short synthesized cues for casts, hits, pickups, UI
(buy/sell/deny/fuse/legendary), shields, heals, booms, level-ups, etc. Spell SFX were
overhauled to give each spell a distinct character.

## Controls

- **M** toggles mute. Per-channel volumes live in Settings.
- Audio is created/resumed on first user interaction (browser autoplay policy); calls
  are guarded so they no-op safely before the context is ready.

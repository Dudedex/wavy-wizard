# 05 — Enemies

Source: `js/data/enemies.js` (archetypes + `getWavePool`); AI in `js/enemies-ai.js`.
Base `hp`/`dmg` are scaled at runtime by wave number and the danger-level modifier.

## Archetypes

| ID | Name | Notes |
|----|------|-------|
| `blob` | Green Ghost | the basic fodder; always present |
| `bat` / `yellowbat` / `redbat` | Bats | fast, fragile; tougher tiers join later |
| `spitter` | Spitter | slow, **ranged** (lobs projectiles) |
| `brute` | Brute | big, slow, heavy melee |
| `imp` | Imp | splits into `spark` on death |
| `shaman` | Shaman | `shy` (keeps distance) |
| `spark` | Spark | tiny, very fast (imp spawn) |
| `bomber` | Bomber | rushes in, detonates a blast at close range and on death (`blastR 120`, `fuse 0.8`) |
| `caster` | Hexer | fragile back-line caster, lobs hex bolts (`shy`) |
| `lazeye` | Laze Eye | fires thin laser beams across the arena |
| `elite` | Elite | mini-boss; high HP, drops 15 gems |
| `boss` | Archlich | the wave-20 boss; massive HP, long-range caster |

## Counter-enemies

Used **sparingly** as "moments" that punish a specific habit:

| ID | Name | Punishes |
|----|------|----------|
| `goblin` | Gold Goblin | `flee`s — chase it for gold or let it escape |
| `leech` | Leech | `drainShield` — eats your Arcane Shield |
| `warden` | Warden | spawns barriers that block movement (a black-bordered ward) |
| `mirror` | Mirror Imp | reflects your projectiles back during a shell window |
| `nuller` | Null Mage | silences a spell (`disabled` timer), `shy` |

**Decision:** counter-enemies appear at low fixed weights so they create occasional
tension spikes without dominating the spawn mix.

## Spawn pool (`getWavePool(wave)`)

Weighted list that opens up as waves climb. Highlights:

- `blob` always (weight 10); `bat` from wave 2; `yellowbat` 5; `redbat` 9.
- **Shooters ramp hard late:** `spitter` from wave 4 (extra weight past wave 10);
  `caster` from wave 13. The arena deliberately fills with projectiles to pressure
  positioning in the late game.
- `brute` 6, `shaman`/`bomber` 7, `imp` 8.
- Counter-enemies at low flat weights: `goblin` 4, `leech` 6, `warden` 9, `mirror` 11,
  `nuller` 12; `lazeye` from 10 (scales up).

**Decision (scaling rework):** early waves are gentler and late waves harder & faster
than a flat curve — fodder thins out while shooters, bombers, and counter-enemies
thicken, so the threat shifts from "swarm" to "navigate a bullet-filled arena."

## Elites & combos

- **Elites** spawn within the first ~10s of a wave (telegraphed), not only at the end.
- Certain waves run **enemy-combo / horde** compositions (`isHordeWave`) for variety.

## Bosses

- The **Archlich** (`boss`) appears on boss waves (notably wave 20).
- Boss HP is heavily inflated (and was further boosted +300% in balancing), with
  multiple mechanics/phases and new boss spells.
- On high danger (≥10) the boss carries a **shield** (`eshield`/`eshieldMax`) that
  must be chewed through before HP; shown as a cyan strip on the top boss bar.
- The **boss health bar** is drawn at the top of the screen (combined HP in purple +
  shield strip in cyan, labeled, e.g. "☠ THE ARCHLICH").

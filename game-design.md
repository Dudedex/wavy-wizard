# Wavy-Wizards — Complete Game Design Document

A browser-based arena survival roguelite in the spirit of **Brotato**: you play a wizard,
the shop sells **spells** instead of weapons, and the goal is to survive **20 waves** of
escalating monster pressure — then optionally keep going forever in endless mode.

Built in vanilla JavaScript + Canvas 2D. No frameworks, no build step, no dependencies.

**How to run:** open `index.html` directly in a browser, or `node serve.js` and open
http://localhost:8123.

---

## Table of contents

1. [Core loop](#1-core-loop)
2. [Run setup: characters, danger, starter spell](#2-run-setup)
3. [Player stats & combat math](#3-player-stats--combat-math)
4. [Spells (full tier tables)](#4-spells)
5. [Spell acquisition, fusion & hotkeys](#5-spell-acquisition-fusion--hotkeys)
6. [Legendary enchants](#6-legendary-enchants)
7. [Items (full list)](#7-items)
8. [The shop](#8-the-shop)
9. [Enemies & AI](#9-enemies--ai)
10. [Waves, spawning & milestones](#10-waves-spawning--milestones)
11. [Hazards, fountains & pickups](#11-hazards-fountains--pickups)
12. [Progression & economy](#12-progression--economy)
13. [Endless mode](#13-endless-mode)
14. [Telegraph & readability language](#14-telegraph--readability-language)
15. [Controls (keyboard, mouse, controller)](#15-controls)
16. [HUD & damage meter](#16-hud--damage-meter)
17. [Persistence & save format](#17-persistence--save-format)
18. [Audio](#18-audio)
19. [Technical architecture](#19-technical-architecture)

---

## 1. Core loop

1. **Title screen** → Start Run (or Resume Run if a checkpoint exists).
2. **Pick a wizard** — five characters with unique perks and sprite colors.
3. **Pick a danger level** (1–10) and a **free starting spell** (any of the 10, at Tier I).
4. **Survive the wave.** Move with WASD / arrows / gamepad. Spells auto-cast at the
   nearest valid target; every slot can also be cast manually on a hotkey.
5. **Collect materials** — every enemy drops green gems worth **1 gold + 1 XP** each.
   Gems inside your pickup radius fly to you in a straight line (520 px/s; 950 px/s
   during the end-of-wave vacuum). Occasionally a ♥ pickup drops (heal 10).
6. **Wave ends** (timer expires, or all bosses die on boss waves): all remaining
   enemies despawn, every gem is vacuumed to you, you receive a gold bonus, and you
   are **fully healed**.
7. **Spend queued level-ups** — each offers 3 random stat boosts, pick one.
8. **Shop** — buy spells and items, fuse duplicates, lock offers, reroll. Then start
   the next wave.
9. Beat wave 20's twin bosses → **Victory screen**, with the choice to continue into
   **endless mode** or start a new run.
10. Death at any point → game-over screen with run stats; the run save is deleted.

Design intent: waves are short bursts of pressure (16–60 s) where positioning matters
(dodgeable telegraphs everywhere); the between-wave economy is where builds are made.
Because you fully heal between waves, all difficulty is concentrated *inside* the wave.

---

## 2. Run setup

### 2.1 Characters

| Wizard | Look | Perks (exact numbers) |
|---|---|---|
| **Aldric the Apprentice** | blue robe, blue hat, cyan orb | +15% materials from enemies; shop prices ×0.9 |
| **Pyra the Pyromancer** | red robe, dark-red hat, orange orb | +30% spell damage; −15 max HP (45 base) |
| **Benedict the Cleric** | beige robe, tan hat, yellow orb | +25 max HP (85 base); +1.0 HP/s regen; all healing received ×1.5; −15% spell damage |
| **Vex the Warlock** | purple robe, dark-purple hat, green orb | +15% crit chance (18% base); crit multiplier 2.5× instead of 2×; −15 max HP (45 base) |
| **Lyra the Twincaster** | teal robe, deep-teal hat, ice-blue orb | **every spell casts twice** (second cast fires ~50 ms later); spell range ×0.55; range bonuses (Reach enchant) are 50% weaker |
| **Mira the Chronomancer** | steel robe, ice orb | −20% spell cooldowns; −10% move speed |
| **Odo the Geomancer** | earthen robe, amber orb | +5 armor; −40 pickup range |
| **Selene the Moon Witch** | indigo robe, pale orb | crits heal 1 HP; +8% crit; −10% spell damage |
| **Brakk the Battle Mage** | rust robe, ember orb | searing aura damages nearby enemies; +2 armor; **only 4 spell slots** |
| **Nix the Wild Mage** | magenta robe, pink orb | every 5th cast fires an extra time; +10% damage; +5% crit |
| **Stilo the Concentratos** | indigo robe, hood, staff | **casts only while standing still** (+50% damage then); +25% move speed while moving; −25% range & area on everything |

Each wizard has a **distinct look** — hat or hood or bare head, with or without a staff
(staffless wizards conjure a glowing hand-wisp), plus hair/bald/horn variations. The
**character select** shows just the avatars; hovering or clicking one reveals its
perks in a detail panel, and a **Start →** button begins the run.

Characters you have beaten wave 20 with show a 👑 and an "Archlich slain" badge on the
select screen (stored permanently in `localStorage`, key `wavywizards-wins`).

The character-select cards render live portraits using the same `drawWizardSprite()`
that draws the in-game player (robe / hat / staff-orb colors come from `look`).

### 2.2 Danger levels

Selected on the spell-select screen; persisted between sessions (`wavywizards-danger`).
The modifier multiplies **enemy HP and enemy damage** (mobs, elites, bosses, their
zone attacks, and arcane-storm damage).

| Level | Enemy HP & dmg | Materials | Level | Enemy HP & dmg | Materials |
|---|---|---|---|---|---|
| Danger 1 | +0% | +0% | Danger 6 | +150% | +75% |
| Danger 2 | +10% | +5% | Danger 7 | +300% | +150% |
| Danger 3 | +25% | +13% | Danger 8 | +500% | +250% |
| Danger 4 | +50% | +25% | Danger 9 | +750% | +375% |
| Danger 5 | +100% | +50% | Danger 10 | +1000% | +500% |

Higher danger pays out: **+50% gold per gem per +100% danger**. During play the HUD
shows e.g. `☠ +300%` next to the wave label.

**Tuning guarantee (simulated):** with just the starter Magic Missile, wave 1 yields
enough gold for **at least one extra spell on every danger level** (~23–35 g) and
**two spells on the lower danger levels** (~30–35 g on Danger 1–3).

### 2.3 Starter spell

Any of the ten spells, free, at Tier I. Tier I spells are intentionally strong
(see §4) because your starter carries the first several waves.

---

## 3. Player stats & combat math

### 3.1 Stats

Base values, before character perks:

| Stat | Base | Notes |
|---|---|---|
| Max HP | 60 | |
| HP regen | 0 /s | accumulates fractionally, applies whole points |
| Damage | +0% (`dmgMult` 1.0) | multiplies all spell damage |
| Cooldowns | −0% (`cdMult` 1.0) | multiplies all spell cooldowns (lower = faster) |
| Crit chance | 3% | crits deal `critMult` (2.0× default, 2.5× on Vex) |
| Move speed | 210 px/s (`speedMult` 1.0) | |
| Armor | 0 | flat damage reduction per hit, minimum 1 taken |
| Pickup range | 80 px | gems inside fly straight to you |
| Materials | +0% (`matMult` 1.0) | multiplies gold per gem |
| *Hidden:* price mult | 1.0 | shop price multiplier (Aldric 0.9, Cracked Hourglass +0.1) |
| *Hidden:* heal mult | 1.0 | multiplies all healing received (Benedict 1.5) |
| *Hidden:* range mult | 1.0 | multiplies spell range (Lyra 0.55) |
| *Hidden:* range-perk mult | 1.0 | scales range *bonuses* (Lyra 0.5) |
| *Hidden:* double cast | false | Lyra: every successful cast queues a second |
| *Temporary:* `tempDmg`, `tempSpd` | 1.0 | set by chaos-item procs each frame |

### 3.2 Damage you deal

```
damage = round( spellBase × dmgMult × tempDmg × (crit ? critMult : 1) ), minimum 1
crit roll: random < critChance
```

Damage numbers float above enemies — white for normal hits, large orange for crits.
Every point of damage is attributed to its source spell for the damage meter.

### 3.3 Damage you take

```
incoming   = round(enemyDamage) − armor, minimum 1
shield     absorbs first (blue number), remainder hits HP (red number)
afterwards: 0.35 s of invulnerability (sprite blinks)
```

Enemy contact attacks have a 0.9 s per-enemy cooldown and knock the enemy back
slightly. Armor's exact effect is shown as a tooltip (ⓘ) on the shop stats panel,
with a worked example.

### 3.4 Casting

- Auto-cast: each spell has an independent cooldown timer; when ready and a valid
  target exists, it casts. With no target it retries every 0.12 s.
- **Sequential firing:** if several spells become ready in the same frame, only the
  first fires immediately; each additional one is staggered by 50 ms.
- **Double casts** (Lyra always; Echo enchant 25%) are queued on a cast queue and
  fire 50–100 ms after the original.
- Manual casts (hotkey / gamepad button) fire instantly if the spell is off cooldown.
  A slot toggled to manual (Shift+key) never auto-casts; the slot shows an orange
  border and an "M".

---

## 4. Spells

Ten spells, four tiers each (I–IV). Buying a duplicate and **fusing** two same-tier
copies is the main upgrade path (§5). All prices are base shop prices in gold
(modified by your price multiplier).

### ✦ Magic Missile — fast single-target homing bolt
| Tier | Damage | Cooldown | Range | Price |
|---|---|---|---|---|
| I | 14 | 0.60 s | 420 | 14 |
| II | 16 | 0.52 s | 450 | 34 |
| III | 27 | 0.45 s | 480 | 68 |
| IV | 44 | 0.38 s | 520 | 120 |

Projectile speed 520 px/s, steers toward its target (homing turn rate 8 rad/s).

### 🔥 Fireball — projectile that explodes in an area
| Tier | Damage (AoE) | Radius | Cooldown | Price |
|---|---|---|---|---|
| I | 19 | 70 | 1.50 s | 18 |
| II | 25 | 82 | 1.40 s | 42 |
| III | 42 | 96 | 1.28 s | 85 |
| IV | 68 | 112 | 1.12 s | 150 |

Explodes on first contact or at max range. Projectile speed 380 px/s.

### ❄️ Frost Shard — piercing shard that slows
| Tier | Damage | Pierces | Slow | Cooldown | Price |
|---|---|---|---|---|---|
| I | 10 | 3 | 35% | 0.90 s | 16 |
| II | 13 | 4 | 40% | 0.80 s | 38 |
| III | 21 | 6 | 45% | 0.70 s | 75 |
| IV | 34 | 9 | 50% | 0.60 s | 130 |

Slow lasts 2 s; slowed enemies are tinted ice-blue. Projectile speed 440 px/s.

### ⚡ Chain Lightning — instant zap that arcs between enemies
| Tier | Damage/hit | Chains | Cooldown | Price |
|---|---|---|---|---|
| I | 13 | 3 | 1.30 s | 20 |
| II | 17 | 4 | 1.18 s | 46 |
| III | 28 | 5 | 1.05 s | 90 |
| IV | 46 | 7 | 0.90 s | 160 |

First target within range (380–460 by tier); each arc jumps up to 180 px.

### 🛡️ Arcane Shield — periodic damage absorption
| Tier | Shield | Max stack | Cooldown | Price |
|---|---|---|---|---|
| I | 16 | 32 | 6.0 s | 16 |
| II | 20 | 40 | 5.5 s | 40 |
| III | 32 | 64 | 5.0 s | 80 |
| IV | 50 | 100 | 4.4 s | 140 |

Skips the cast while at cap (no wasted cooldown). Shield is shown as a bubble around
the wizard, a blue strip over both health bars. Cannot receive a legendary enchant.

### ☠️ Poison Cloud — damage-over-time area
| Tier | DPS | Radius | Duration | Cooldown | Price |
|---|---|---|---|---|---|
| I | 8 | 70 | 3.5 s | 3.5 s | 15 |
| II | 11 | 82 | 4.0 s | 3.2 s | 36 |
| III | 18 | 96 | 4.5 s | 3.0 s | 72 |
| IV | 29 | 112 | 5.0 s | 2.7 s | 125 |

Cast on the nearest enemy's position; ticks every 0.25 s. Harmless to you.

### ☄️ Meteor — delayed huge AoE on a random enemy
| Tier | Damage (AoE) | Radius | Cooldown | Price |
|---|---|---|---|---|
| I | 45 | 90 | 4.5 s | 22 |
| II | 62 | 102 | 4.1 s | 50 |
| III | 100 | 116 | 3.7 s | 95 |
| IV | 160 | 132 | 3.3 s | 170 |

0.9 s telegraph (cyan ring + falling rock), then explodes. Safe for you.

### 🩸 Life Drain — damage that heals you
| Tier | Damage | Heal | Range | Cooldown | Price |
|---|---|---|---|---|---|
| I | 12 | 30% of damage | 250 | 1.10 s | 18 |
| II | 16 | 35% | 270 | 1.00 s | 42 |
| III | 26 | 40% | 290 | 0.88 s | 82 |
| IV | 42 | 50% | 320 | 0.75 s | 145 |

Short range, instant beam visual. Healing benefits from heal multiplier.

### 🔮 Arcane Orbs — passive orbiting projectiles
| Tier | Orbs | Damage/touch | Price |
|---|---|---|---|
| I | 1 | 13 | 20 |
| II | 2 | 15 | 48 |
| III | 3 | 21 | 92 |
| IV | 4 | 32 | 165 |

No cooldown — orbs circle at radius 72 px (rotation 2.6 rad/s) and damage+knock back
enemies they touch (per-enemy 0.5 s immunity). **Each owned copy is its own ring**:
ring k orbits at 72 + 26k px and alternate rings counter-rotate. No manual cast.

### ✨ Holy Nova — burst around you with knockback
| Tier | Damage (AoE) | Radius | Cooldown | Price |
|---|---|---|---|---|
| I | 24 | 130 | 4.0 s | 18 |
| II | 31 | 146 | 3.7 s | 44 |
| III | 52 | 165 | 3.3 s | 88 |
| IV | 84 | 190 | 2.9 s | 155 |

Casts on cooldown even with nothing in range (the ring doubles as a heartbeat).
Knockback 380.

---

## 5. Spell acquisition, fusion & hotkeys

- **6 spell slots.** Duplicates allowed — owning two Fireballs is legal and good.
- **Shop tiers by wave:** new offers are Tier I until wave 4; Tier II can appear from
  wave 4, Tier III from wave 8, Tier IV from wave 13 (weights ramp with wave).
- **Fusion:** two copies of the same spell at the same tier merge into **one copy one
  tier higher** (max Tier IV). Two ways:
  - the **⚗ Fuse** button in the shop's spellbook panel, or
  - **Buy & Fuse** directly on a shop card when you already own a same-tier copy —
    upgrades your copy immediately and **does not need a free slot**.
- **Selling:** any spell can be sold for half its current-tier price (you must keep
  at least one spell).
- **Reordering:** ▲▼ buttons in the spellbook move spells between slots — this is how
  you map a spell onto the hotkey you want.
- **Hotkeys:** slots 1–6 default to keys 1–6; fully rebindable in the pause menu
  (click the key, press a new one; persisted in `wavywizards-keys`). Shift+hotkey
  toggles that slot between auto and manual casting.
- **Fountain gifts** (§11) can add a free random Tier I spell.

---

## 6. Legendary enchants

From **wave 8**, each shop has a **30% chance** to contain one golden **Legendary**
offer targeting a random enchant-less owned spell (Arcane Shield excluded).

Rules:

- Buying it **equips the enchant** on that specific spell. The spell's tier is
  **unchanged**.
- **Up to 3 spells may be enchanted at once** (one enchant each). When all 3 are
  taken, a new legendary can only **replace** an existing spell's enchant.
- It **cannot be locked** and **disappears on reroll** or when the shop closes:
  buy it now or never.
- Price: `100 + 5 × wave`, modified by your price multiplier.
- Enchanted spells show a gold ⭐ in the spellbook and on their HUD slot.

| Enchant | Improved effect (v2) | Excluded for |
|---|---|---|
| 💥 **Splash** | hit explodes for 50% damage — **and the explosion chains** to a smaller blast on each enemy it kills (up to 3 deep) | Fireball, Meteor, Nova, Poison (already AoE) |
| 🔭 **Reach** | +40% range, +30% area, **+30% zone duration** (scaled by range-perk mult; halved on Lyra) | — |
| 🩸 **Vampiric** | heal 10% of damage; **any overheal becomes a temporary shield** (capped at 50% max HP) | — |
| 🔁 **Echo** | **40%** chance to cast again at **60% damage** — the recast rolls its own crit | Arcane Orbs |
| ❄️ **Frostbite** | slow 30% for 2 s; **slowed enemies shatter on death**, dealing AoE to neighbours | — |

---

## 7. Items

Passive items stack freely; prices scale **+10% per wave**
(`price × (1 + (wave−1) × 0.10)`, then × your price multiplier).

### Flat boosters

| Item | Effect | Base price |
|---|---|---|
| 📕 Tome of Power | +12% spell damage | 25 |
| 👢 Swift Boots | +10% move speed | 18 |
| 🪬 Iron Talisman | +2 armor | 20 |
| ❤️ Heart Crystal | +15 max HP | 18 |
| 💍 Regen Ring | +0.7 HP/s | 20 |
| ⏳ Hourglass | −7% cooldowns | 26 |
| 🍀 Lucky Clover | +8% crit chance | 22 |
| 🧲 Magnet Stone | +30 pickup range | 14 |
| 🗿 Greedy Idol | +20% materials | 28 |
| 🪄 Crystal Wand | +6% damage, −3% cooldowns | 32 |
| 🥋 Warding Robe | +10 max HP, +1 armor | 26 |

### Tradeoffs (downside, but the bonus is better than fair)

| Item | Effect | Base price |
|---|---|---|
| 💀 Cursed Skull | +20% damage, −10 max HP | 30 |
| 🔮 Glass Cannon Orb | +25% damage, −2 armor | 30 |
| ⚓ Leaden Anchor | +4 armor, −8% move speed | 28 |
| 🫀 Blood Pact | +1.5 HP/s regen, −15 max HP | 26 |
| ⌛ Cracked Hourglass | −15% cooldowns, shop prices +10% | 34 |

### Chaos items (timed random procs)

Procs trigger on their own clock during combat, announce themselves with a colored
shout + particle burst, and temporarily modify damage (`tempDmg`) and/or speed
(`tempSpd`). Multiple actives stack additively. Proc items are saved with the run.

| Item | Proc | Base price |
|---|---|---|
| 🍺 Berserker Brew | every 20 s → **ENRAGE!** for 5 s: **+200% damage, −50% move speed** | 38 |
| 🧪 Quicksilver Vial | every 12 s → **SWIFT!** for 4 s: +35% move speed | 24 |
| 🎲 Trickster Die | every 10 s → one of, for 4 s: **HASTE!** +30% speed / **MIGHT!** +40% damage / **SLUGGISH…** −25% speed | 30 |

---

## 8. The shop

Appears after every wave (after queued level-ups are spent).

- **4 offer slots**, each ~55% spell / ~45% item, plus the possible legendary (§6).
- **Locking:** the 🔓 button keeps an offer through rerolls **and into the next
  wave's shop** (card turns gold). Sold/stale locks clean themselves up. Legendaries
  cannot be locked.
- **Reroll** cost: `floor(wave × 0.8) + 1 + 2 × rerollsThisShop`.
- **Buy & Fuse** button appears on spell offers matching an owned same-tier copy.
- Spell offers show "⚗ You own a copy — buy to fuse!" when fusable.
- **Spellbook panel** (right): hotkey, tier, enchant ⭐, Fuse, reorder ▲▼, Sell.
- **Stats panel** (left): all visible stats; armor row has the damage-reduction
  tooltip.
- **Damage report** (bottom left): the finished wave's full per-spell damage, DPS,
  share %, and totals (§16).
- Every transaction checkpoints the run save (§17).

---

## 9. Enemies & AI

Each enemy type is drawn as a distinct little-alien **"shade"** — a translucent,
glowing vector sprite with its own silhouette and glowing eyes (`drawShade()` in
`main.js`, mapped via `SHADE_OF`): ooze blob, winged flyer, three-eyed maw, bulky
hulk, horned imp, haloed mystic, darting mote, grinning sneak, segmented worm,
armoured sentinel, faceted crystal, hooded voidling, crested elite, and a
tentacled multi-eyed overlord boss. They flash white when hit and tint blue when
slowed.

All hit points / damage below are **base values**; per-wave scaling and danger are
applied on spawn (§10). `gems` = material drops on death. Every special ability is
telegraphed by a pulsing yellow ring + "!" wind-up (0.45–0.9 s) during which the
enemy is rooted.

| Enemy | r | HP | Speed | Contact dmg | Gems | From wave | Special |
|---|---|---|---|---|---|---|---|
| **Blob** | 14 | 14 | 70 | 6 | 1 | 1 | none — the honest worker |
| **Bat** | 10 | 8 | 135 | 4 | 1 | 2 | **Lunge**: 0.45 s wind-up, then darts at you (impulse 460) |
| **Spitter** | 13 | 18 | 55 | 5 | 2 | 4 | keeps ~170 px distance; fires a bolt (dmg 7, 190 px/s, every 2.4 s); **3-shot spread** from wave 10 |
| **Brute** | 24 | 65 | 44 | 15 | 3 | 6 | **Charge**: 0.7 s wind-up, then dashes 5× speed for 0.55 s in a straight line |
| **Shaman** | 14 | 24 | 60 | 4 | 3 | 7 | hides at ~250 px; every ~3.2 s **heals all allies within 150 px for 8% max HP** (green ring); with nobody to heal, hurls a **curse zone** at your feet (r 85, 0.9 s, 2.5× its damage) |
| **Imp** | 12 | 22 | 88 | 6 | 2 | 8 | **Blinks** to a random point 120–200 px from you every 3.5–5.5 s; splits into 2 Sparks on death |
| **Spark** | 7 | 5 | 155 | 3 | 1 | — | fast, fragile fragment |
| **Elite** | 32 | 320 | 60 | 20 | 15 | 8, 17 (+endless) | full spellbook, see below; summons 2 blobs every 11 s |
| **Archlich** (boss) | 46 | 850 | 52 | 26 | 60 | 10, 15, 20 (+endless) | see below; summons 3 imps every 8 s |

### Elite spellbook (one cast every 4–5.5 s, 0.8 s wind-up)

- **Ground Slam** (always chosen within 200 px): zone r 150 at its feet, 1.2× damage.
- **Arcane Barrage**: 3 zones (r 80) in a line from elite to you, detonating in
  sequence (delays 0.95 / 1.2 / 1.45 s).
- **Rune Circle**: 5 zones (r 70) in a ring 110 px around *you*, all detonating at
  1.0 s — escape through a gap.
- **Bolt Burst**: radial spray of 8 slow projectiles (130 px/s, 0.8× damage).

### Archlich (boss)

- **Radial burst**: 14 bullets every 3.2 s (dmg 12 base, 170 px/s).
- **Alternates**: charge dash (0.9 s wind-up, 5× speed) ↔ ground slam **at your
  position** (zone r 170, 1.3× damage).
- Boss waves are untimed; they end when every boss is dead. The HUD shows a combined
  boss HP bar.

### Shared behaviors

- Chase the player; spitters/shamans retreat at close range.
- Knockback decays exponentially; slows cap at the strongest applied.
- HP bars appear on damaged tough enemies (elite/boss/HP > 50).
- Elites/bosses wear a 👑; shamans are marked with a white cross.

---

## 10. Waves, spawning & milestones

### Scaling per wave `w` (applied on spawn)

```
HP     = base × 0.6 × 1.13^(w−1) × (1 + danger)              // gentle early, steep late
Damage = base × (0.7 + 0.09(w−1) + 0.0025(w−1)²) × (1 + danger)
Speed  = base × (1 + 0.012(w−1) + 0.0012(w−1)²)              // mobs get notably faster late
```

Tuned so the **early waves are easier and the late waves harder** than the original
linear curve: a wave-1 enemy is at 0.6× HP / 0.7× damage, a wave-20 enemy at ~6.1× HP /
3.3× damage / 1.66× speed. The quadratic terms make damage and movement spike in the
endgame instead of plateauing.

### Wave duration

`min(60, 16 + 2w)` seconds. Boss waves (10, 15, 20, endless multiples of 5) are
**untimed** — they end when all bosses die.

### Spawn pacing

```
interval = max(0.35, 1.25 − 0.05w)        // seconds between spawn batches
maxAlive = 12 + 2w                        // alive + queued cap
batch    = 1 + floor(w / 6)
```

**Ramp:** with wave progress `p` (time/duration; time/45 s on untimed waves):
interval ×(1 − 0.45p), maxAlive ×(1 + 0.7p), +1 batch beyond p = 0.5. The end of a
wave is always busier than the start.

**Horde waves** (5, 15, endless w%5==3): interval ×0.4, cap ×2.2, +2 batch.
**Boss-only waves**: trickle instead — interval 3.2 s, cap 14 (the boss is the show).

Spawns are telegraphed: a red crosshair marks the spot 0.8 s before the enemy
appears, placed ≥260 px from you when possible.

### Milestones

| Wave | Event |
|---|---|
| 5 | Horde |
| 8 | Elite |
| 10 | Boss ×1 |
| 15 | **Horde + Boss** simultaneously |
| 17 | Elite |
| 20 | **Final: Boss ×2** |

### Spawn pool by wave

Blob always; Bat from 2; Spitter from 4; Brute from 6; Shaman from 7; Imp from 8.
Weights shift toward the newer enemies as waves rise.

---

## 11. Hazards, fountains & pickups

### Arcane storms (from wave 3)

Hostile zones telegraphed around your position on a timer:

```
period   = max(3.5, rand(5.5–8.5) − 0.12w) seconds (5 s grace at wave start)
count    = 1 + floor(w / 8) zones; the first lands within 60 px of you
radius   = 75–100 px, warning 1.2 s
damage   = (8 + 1.4w) × (1 + danger)
```

### Gold Magnet & Item Mine (world spawns)

Each wave also drops two interactive world objects at random spots:

- **🧲 Gold Magnet** — stand on its small circle and **all gold gems are dragged
  toward it** (~8 s to cross the whole map). Since you're standing on it, the gold
  funnels straight to you — great for sweeping a messy arena.
- **⛏ Item Mine** — **channel on it for 5 s** (progress ring) to receive a **random
  item** (items only, never a spell); the mine is then spent. Stepping off slowly
  loses progress.

### Fountains

One per wave (two from wave 10), bubbling up at a random spot a few seconds in
(announced + sparkling). **Stand in it and drain for 2 s** (progress ring; refills if
you step away) to consume it:

- **Heal 25% of max HP** (benefits from heal multiplier).
- **40% chance** of a bonus: a **free random Tier I spell** into an open slot, or
  **+15 gold** if your spellbook is full.

Unused fountains vanish at wave end.

### Pickups

- **Gems**: 1 gold (× materials) + 1 XP. Straight-line flight when in pickup range.
- **♥ Health**: 2.5% drop chance per kill, heals 10 (× heal multiplier).

---

## 12. Progression & economy

### XP & level-ups

- Every gem = 1 XP. Requirement: `round(10 × 1.2^(level−1))` — +20% compounding
  (10, 12, 14, 17, 21 … 52 at level 10, ~266 at level 18).
- Level-ups queue during combat and are spent at wave end: choose **1 of 3** random
  options (duplicates possible across levels):

| Option | Effect |
|---|---|
| 🔥 Power | +6% spell damage |
| ❤️ Vitality | +6 max HP (and heal 6) |
| ⏳ Haste | −4% cooldowns |
| 👢 Swiftness | +5% move speed |
| 🛡️ Toughness | +1 armor |
| 🎯 Precision | +4% crit chance |
| 💚 Mending | +0.45 HP/s |
| 🧲 Greed | +15 pickup range, +8% materials |

(Deliberately modest: builds come from spells, fusion and items, not stat stacking.)

### Gold flow

- Gems × materials multiplier × danger compensation, with **fractional gold
  accounting** (sub-1g remainders accumulate, so +15% materials genuinely pays
  +15% over time). Wave-clear bonus `8 + wave`, fountain consolation +15,
  spell sales (half price back).
- Sinks: spells (14–170 base), items (+10%/wave inflation), rerolls, legendaries
  (100 + 5w).

---

## 13. Endless mode

Beating wave 20 banks the win (character record + win screen) and offers
**Continue — Endless Mode**. Past 20, milestones repeat on a 5-wave cycle:

- `w % 5 == 0` → boss wave; boss count = `min(4, 2 + floor((w−25)/10))`
  (2 at 25/30, 3 at 35, 4 from 45).
- `w % 5 == 3` → horde. `w % 5 == 1` → elite.
- Scaling never stops; every endless run eventually ends in a heroic death (which
  still shows the wave reached).

Clearing endless waves returns to the normal level-up/shop loop. Resuming a save at
wave ≥ 20 resumes in endless.

---

## 14. Telegraph & readability language

One consistent visual grammar, explained on the title screen:

| Visual | Meaning |
|---|---|
| **Dashed red ring, pulsing, with ⚠** | hostile zone — get out before it fills |
| **Solid cyan ring** (meteor), **green cloud** (poison), white/gold nova rings | *your* magic — safe to stand in |
| **Pulsing yellow ring + "!"** on an enemy | ability wind-up (lunge/charge/spell incoming) |
| **Red crosshair circle** | enemy spawning here in 0.8 s |
| Teal ring pulse | shaman heal (kill the healer) |
| Ice-blue tint on an enemy | slowed |
| Filling circle inside any zone | time until detonation |
| Green bar above the wizard | your HP (blue strip = shield) |

---

## 15. Controls

### Keyboard & mouse

| Input | Action |
|---|---|
| WASD / Arrow keys | move |
| 1–6 | manually cast that spell slot (if off cooldown) |
| Shift + 1–6 | toggle auto-cast for that slot |
| Tab | toggle damage meter |
| P / Esc | pause — the pause menu hosts the **keybind editor** |
| M | mute |
| Mouse | menus/shop only; the cursor is hidden over the arena |

Hotkeys are rebindable (click key in pause menu, press new key; reserved keys and
duplicates are rejected; persisted across sessions). The window auto-pauses on
focus loss.

### Controller (Gamepad API)

| Input | Action |
|---|---|
| Left stick / D-pad | move (analog magnitude respected, 0.22 deadzone) |
| A / B / X / Y / LB / RB (buttons 0–5) | cast spell slots 1–6 |
| Start (button 9) | pause / unpause |
| Select (button 8) | toggle damage meter |

Hot-pluggable; first connected pad wins; menus still need mouse/keyboard.

---

## 16. HUD & damage meter

- **Top left:** HP bar (with numbers), shield strip, XP bar + level.
- **Top center:** wave label (`WAVE 7`, `WAVE 10 — BOSS`, `FINAL WAVE`), countdown
  timer (gold when <5 s) or boss HP bar on untimed waves, danger badge.
- **Top right:** gold; below it the **damage meter** (Tab):
  - one row per spell: icon, **total damage · DPS**, bar, share %
  - **TOTAL row**: overall damage · overall DPS for the wave.
- **Bottom left:** 6 spell slots — hotkey label, icon, cooldown sweep, tier pips,
  ⭐ enchant marker, orange border + "M" when manual.
- **Around the wizard:** the equipped spells orbit as small icon badges (with a
  cooldown sweep), so you can read your loadout at a glance.
- **Above the wizard:** green health bar + shield strip.
- **In the shop:** full damage report of the finished wave (per-spell damage, DPS,
  share, wave duration, totals) bottom-left.

---

## 17. Persistence & save format

All persistence is `localStorage`:

| Key | Contents |
|---|---|
| `wavywizards-save` | run checkpoint: wave, gold, xp, level, pending level-ups, kills, endless flag, danger, character id, hp, full stats object, spells `[ {id, tier, auto, enchant} ]`, proc item ids |
| `wavywizards-wins` | array of character ids that have beaten wave 20 |
| `wavywizards-keys` | hotkey bindings (6 key codes) |
| `wavywizards-danger` | last chosen danger level index |

Checkpoints are written when the shop opens and after every buy / sell / fuse /
reroll / level-up pick. Resume drops you into the shop after your last completed
wave (mid-wave progress is not saved). Death deletes the checkpoint; starting a new
run replaces it; winning keeps it so you can still continue into endless after
closing the browser.

---

## 18. Audio

Tiny WebAudio synth — every sound is a single oscillator with a frequency ramp and
exponential decay (square/sine/triangle/sawtooth). Distinct blips for: shoot, hit,
explosion, zap, frost, pickup, buy, sell, hurt, heal, level-up, nova, shield, death,
win. Per-sound 50 ms throttle prevents spam. **M** mutes. No assets, no loading.

---

## 18b. Identity systems (build variety layer)

A later pass added systems that make runs diverge — clearer archetypes, more
surprising waves, and stickier decisions.

### Last Resort

Every run starts with one **Last Resort**. The first time you'd take lethal damage,
you instead cling to **1 HP**, gain ~1.8 s of invulnerability, and blast nearby
enemies away with a golden nova. Status shows in the HUD (✦ Last Resort) and the shop
stats panel. Once spent, a **🔥🕊️ Phoenix Charm** legendary can appear in the shop
(~40% chance) to restore it — and it *only* appears while Last Resort is spent. It
takes priority over the replay-failed-waves option. Persisted in the save.

### Element realms (map themes)

For **waves 1–20**, each round picks a random **element realm** — 🔥 Fire, ❄️ Frozen,
⛰️ Earthen, or 🌀 Windswept — announced at the round start. The realm recolours the
whole arena (background, grid, walls, dust, runes) and grants **+2 to that element's
meta stack** for the wave (on top of the spell cap of 3, to a max of 5). From wave 21
(endless) realms stop and the background reverts to your chosen **colour scheme** from
Settings.

Each realm also scatters **5 themed landmarks** across the arena that mark the area and
grant a small bonus while you stand near one (shown with a glowing aura + label):

| Realm | Landmark | Bonus while near |
|---|---|---|
| ⛰️ Earthen | 🌳 trees | +0.5 HP/s regeneration |
| 🔥 Fire | 🔥 campfires | +10% spell damage |
| 🌀 Windswept | ☁️ wind clouds | +25% move speed (lingers 3 s after leaving) |
| ❄️ Frozen | ❄️ ice patches | your ice-element spells slow +5% extra |

### Breath spells (elemental cones)

Four short-range cone spells — one per element — that hit every enemy in a **~90°
arc** toward the nearest target, each with a signature aftermath:

| Spell | Element | Aftermath |
|---|---|---|
| 🐲 Fire Breath | fire | leaves a **burning ground** patch (DoT) where the cone lands |
| 🧊 Ice Breath | ice | **roots** every enemy hit for **3 s** |
| 🪨 Earth Breath | earth | **knocks** enemies hard backward |
| 🌪️ Wind Breath | wind | each enemy hit spawns a **roaming tornado** (5 s) that pulses **33%** of the cone's damage |

Cones benefit from the usual modifiers (damage %, mastery, crit, Reach extends the
cone length, Splash detonates on each hit) and feed their element's meta-class. Wind
Breath is the standout AoE-snowball: catch a pack and the arena fills with tornadoes.

### Spell meta-classes (elements)

Every spell belongs to one or more **elements**. The number of owned spells carrying
an element stacks a passive bonus, **capped at 3 spells**. This rewards leaning into a
theme without locking you into it.

| Element | Stacking bonus (per spell, max 3) | Spells |
|---|---|---|
| 🔥 **Fire** | +12% AoE size | Fireball, Meteor, Holy Nova |
| ❄️ **Ice** | your hits chill enemies (+8% slow) | Frost Shard, Life Drain |
| ⛰️ **Earth** | +2 armor & +0.3 HP/s | Arcane Shield, Poison Cloud, Meteor |
| 🌀 **Wind** | +5% move speed | Magic Missile, Chain Lightning, Arcane Orbs, Holy Nova |

Stacks recompute live as you buy, sell, or fuse spells, and the active stacks show in
the shop's Build Identity panel and on each spell card. (Meteor and Holy Nova are
dual-element, so they feed two trees at once.)

### Spell tags & synergy items

Every spell carries one or more **tags**: `fire` (Fireball, Meteor), `frost`
(Frost Shard), `arcane` (Magic Missile, Arcane Orbs, Arcane Shield), `storm`
(Chain Lightning), `holy` (Holy Nova, Life Drain), `venom` (Poison Cloud). Tags
drive synergy items and the build-summary "theme".

| Synergy item | Effect |
|---|---|
| 👑 Ember Crown | fire-tagged explosions leave **burning ground** (orange cloud) for 1.5 s |
| 🧊 Frozen Core | slowed enemies take **+15% damage** |
| 📍 Storm Needle | Chain Lightning gains **+1 chain per crit** during a cast (capped) |
| 🛰️ Orbital Lens | Arcane Orbs rotate **+30% faster** |
| 🔔 Martyr's Bell | taking damage **cuts Holy Nova cooldown by 1.5 s** |

| Positioning item | Effect |
|---|---|
| 🎯 Point-Blank Sigil | +25% damage to enemies within 150 px |
| 🔭 Coward's Telescope | +25% spell range, −10% move speed |
| 🤺 Duelist Robe | +3 armor while fewer than 5 enemies are within 300 px |
| 🛎️ Panic Bell | when hit, release a weak Holy Nova |

### Wave modifiers

One rolls on every 3rd non-boss, non-horde wave (3, 6, 9, 12, …), shown as a HUD
banner:

| Modifier | Effect |
|---|---|
| 🌑 Blood Moon | +40% spawns, +40% gems |
| 🌵 Mana Drought | +20% cooldowns this wave, −25% shop prices in the next shop |
| 🔷 Glass Arena | enemies deal +30% damage, fountains heal double |
| 🐝 Swarm Nest | spawn pool floods with bats & sparks |
| 💎 Treasure Wave | half the enemies, but 2.5× gems (elites drop +8) |
| 🌩️ Storm Surge | arcane storms ~40% more frequent, +50% XP |

### Boss phases & twin variants

The Archlich now fights in three phases by HP: **>70%** charge + slam; **35–70%**
adds creeping curse zones and summons faster; **<35%** ("ENRAGED") attacks faster
and casts arena-wide storm scatters. On wave 20 the twins are distinct: one
**bullets** variant (radial bursts + faster summons), one **charger** variant
(no ranged — pure charge + ground zones).

### Fountain types

Each fountain rolls a flavour (Danger 9+ skews toward Chaos):

| Fountain | Effect |
|---|---|
| 💧 Healing | heal 25% max HP (×2 in Glass Arena) |
| 🔶 Power | +30% damage for 10 s |
| 🟣 Spell | a free **borrowed** spell for the rest of the wave (removed at wave end) |
| 🟡 Greed | gold now — but a 5-enemy ambush erupts around it |
| 🔴 Chaos | a strong blessing, a curse, or a gold windfall |

### Danger-level rules (beyond raw stats)

- **Danger 3+**: arcane storms ~20% more frequent.
- **Danger 5+**: a rogue elite can stalk you outside milestone waves.
- **Danger 9+**: fountains are more likely to be the risky Chaos type.
- **Danger 10**: the Archlich rises **pre-shielded** (40% of max HP as a soak ring).

### Shop events

~40% of shops (from wave 2) add a 5th, golden **event** card:

| Event | Choice |
|---|---|
| 🎰 The Gambler | pay 15 g for a random item |
| ⚗️ The Alchemist | transmute 5 max HP → 30 gold |
| 🕯️ Black Market | a cursed relic (Skull / Glass / Blood Pact) at 60% price |

### Spell mastery (spell XP)

Each spell **levels up by scoring kills** — XP is shared across every copy of that
spell id (three Chain Lightnings all feed one Chain Lightning level). Cumulative
kills of **12 / 30 / 55 / 88 / 130** reach Mastery **Lv 1–5** (max 5). Each level
reached grants a mastery pick (shown after the wave, before level-ups): **Empower**
(+18% damage), **Hasten** (−12% cooldown / +12% rate), or **Overload** (+30% damage,
+10% cooldown). Mastery is per spell-id and persists in the save; the spellbook shows
★-pips for the current level and the tooltip shows kills-to-next.

### Settings screen (title & pause menus)

Grouped options, all persisted in `localStorage` (`wavywizards-opts`):

- **Audio** — master Volume (Off / 25% / 50% / 100%) and a Mute toggle (the **M**
  key stays in sync).
- **Colour scheme** — five arena palettes (Midnight, Dusk, Forest, Ember, High
  Contrast) recolouring the canvas background, grid, walls, dust and runes live.
- **Gameplay** — **Replay failed waves**: when on, dying restarts the current wave
  at full HP (a death counter ticks) instead of ending the run — a practice/casual
  mode. Also toggleable directly on the start screen before a run.
- **Readability** — reduce particle density · bigger enemy telegraphs · high-contrast
  enemy shots · always show boss attack names · screen shake on/off · damage numbers
  on/off.

Reachable from both the title screen and the pause menu.

### Counter-enemies

Five enemies that punish specific habits, kept **rare** (low spawn weights) so they
create moments rather than overwhelming readability:

| Enemy | From wave | Behavior |
|---|---|---|
| 💰 **Gold Goblin** | 4 | Flees instead of attacking; deals no contact damage. Catch it for a big gold payout (+6 plus more by wave) — let it run ~13 s and it escapes with nothing. |
| ∿ **Leech** | 6 | On contact, **drains your shield first** (healing itself), punishing shield-stacking; only hits HP once the shield is gone. |
| ⛬ **Warden** | 9 | Raises a temporary **ward** near you that physically blocks movement (~4.5 s) — reposition around it. |
| **Mirror Imp** | 11 | Periodically raises a reflective shell (telegraphed); shots that hit it during the window are **reflected back at you**. |
| Ø **Null Mage** | 12 | Hangs back and **silences one of your auto-cast spells** for ~4 s (shown dimmed with a Ø on the slot). |

### Rare spell variants

~14% of shop spell offers (wave 5+) are a **variant** — an alternate stat profile of
the base spell (pink "✦ Variant" badge, modified stats shown on the card). A variant
is a spell instance; it fuses only with the **same variant** at the same tier and
persists in saves.

| Variant | Base | Effect |
|---|---|---|
| Rapid Magic Missile | Missile | ×0.6 damage, ×0.45 cooldown (rapid-fire) |
| Heavy Fireball | Fireball | ×1.6 damage, slow projectile (×0.55 speed), +15% cd |
| Giant Nova | Holy Nova | ×1.5 radius, ×1.5 cooldown |
| Venom Cloud | Poison Cloud | its toxin also **slows** enemies 25% |
| Forked Lightning | Chain Lightning | strikes **2 initial targets**, −2 chains each |

### World events

From **wave 5**, each round has a **33% chance** to erupt into a **world event**
around its midpoint (~45% of the wave timer; ~22 s into untimed boss waves),
announced with a themed banner that pulses at the top of the screen. The event
spawns persistent, **shape-varied danger zones that pulse damage (every 0.4 s) to
both the player AND enemies**, and they last until the wave ends. Every zone
**telegraphs** in the event colour for ~1 s before going live. Damage scales with
wave and lightly with danger.

| Event | Banner | Hazard shape & behaviour |
|---|---|---|
| 🪨 Earthquake | "The earth is rumbling" | 5+ wide **fissure lines** crack across the arena (more on later waves), static for the round |
| ⛈️ Thunderstorm | "A thunderstorm is approaching" | up to 6+ big **circular strikes** that zap, then **relocate** — a roaming threat |
| 🌋 Volcano | "A volcano erupted" | **lava pools** erupt fast (up to 12+) and **linger**, steadily shrinking the safe space |
| 🌊 Tide | "A tide is rising" | a wide **band** sweeps up and down the arena (a **second** band joins from wave 12) |

Zone counts and sizes scale up with the wave, so late-game events can blanket much of
the arena — keep moving.

Because zones hurt enemies too, a well-placed event can thin the horde — kiting mobs
through a lava pool or under the tide is a legitimate tactic. World events are
transient (not saved) and reset each wave.

### Wave overview (roadmap)

The top of the shop and the pause menu show a **wave roadmap**: a strip of chips for
waves 1–20 (and a few beyond in endless), each colour-coded and labelled by type
(Normal • / Elite ⭐ / Horde 🐝 / Boss 👑, with boss counts), the current/upcoming wave
highlighted. A header line shows the current wave, the active element realm, danger
level, and any wave modifier.

### Build summary (shop)

A bottom-right panel reads out your run's identity: dominant **theme** (from spell
tags), **top damage** spell last wave, spellbook size, a **weakness** heuristic,
and a one-line **suggestion**. The shop's spell cards also show a fusion **stat
comparison** (current → next tier, with a ~DPS estimate) when a fuse is available.

---

## 19. Technical architecture

| File | Contents |
|---|---|
| `index.html` | canvas + every overlay screen (title, char select, spell/danger select, level-up, shop, pause/keybinds, game over, win) |
| `style.css` | dark fantasy theme; cards, panels, shop layout, buttons, keybind rows, danger buttons |
| `js/audio.js` | tiny WebAudio synth: `blip`, `noise`, `chord`, generic `sfx`, per-spell `spellSfx` (loaded before the engine) |
| `js/data/spells.js` | `SPELLS` (tier tables, icons, description-line functions), `TIER_*`, `MAX_SPELL_SLOTS`, `SPELL_TAGS` + `TAG_COLORS`, `ELEMENTS` + `SPELL_ELEMENTS`, `ENCHANTS`, `VARIANTS` |
| `js/data/characters.js` | `CHARACTERS` (perks, `apply`, `look` flags) |
| `js/data/items.js` | `ITEMS` (with `apply` / `proc`), `LEVELUP_OPTIONS` |
| `js/data/enemies.js` | `ENEMY_TYPES`, `getWavePool` |
| `js/data/world.js` | `DANGER_LEVELS`, `THEMES`, `ELEMENT_THEMES`, `WAVE_MODIFIERS`, `WORLD_EVENTS`, `FOUNTAIN_TYPES` |
| `js/enemies-ai.js` | wave milestone helpers, per-wave scaling, `spawnEnemy`/`queueSpawn`, the spawn director, and the enemy AI/ability state machine |
| `js/shop.js` | shop offer generation, pricing, fusion, shop events, and the shop / wave-overview / build-summary UI |
| `js/render/shades.js` | `SHADE_OF` + `drawShade` — the per-type little-alien enemy sprites |
| `js/render/wizard.js` | `drawWizardSprite` — the player/character sprite (hat/hood/staff/hair variations) |
| `js/render/environment.js` | arena background (gradient/dust/runes), element structures, gold-magnet & item-mine world spawns |
| `js/main.js` | the core engine: game state machine, input (keyboard + gamepad), cast system + cast queue, projectiles/clouds/meteors/zones/beams/novas, gems/fountains/hazards/world-events, wave lifecycle, level-up/mastery, character & settings UI, save system, main render loop, HUD + damage meter + tooltips, boot |
| `serve.js` | dependency-free static file server (`node serve.js`, port 8123) |
| `game-design.md` | this document |

### Engine notes

- Fixed logical canvas 1280×720, CSS-scaled to the window (16:9 letterboxed),
  26 px walls inset the arena.
- Single `requestAnimationFrame` loop, dt clamped to 50 ms; state machine:
  `title / charselect / spellselect / playing / waveend / levelup / shop / paused /
  gameover / win`.
- Entities are plain objects in arrays (`enemies`, `projectiles`,
  `enemyProjectiles`, `clouds`, `meteors`, `zones`, `beams`, `novas`, `gems`,
  `particles`, `texts`, `spawns`, `fountains`); filtered in place each frame.
- Collisions are circle-vs-circle distance checks (no spatial partitioning —
  entity counts stay low enough).
- Rendering is layered: grid/walls → friendly areas → hostile zones → telegraphs →
  fountains → gems → enemies (+wind-up rings) → player (+orbs, health bar) →
  projectiles → beams → novas → particles → floating text → HUD.
- Menus (shop, level-up, keybinds, character select) are DOM overlays, not canvas —
  free hit-testing, tooltips and CSS.
- The wizard sprite is a single parameterized vector drawing (`drawWizardSprite`)
  reused for gameplay and character-select portraits.

# 04 — Items, Level-Ups & Gadgets

Source: `js/data/items.js`. Items are bought in the shop and **stack freely**. An item
either has an `apply(stats)` (a permanent stat change), a `proc` (timed combat buff), a
`roundEffect` (a gadget deployed periodically during a wave), or a marker flag like
`sentry`/`tag` that other systems read.

## Passive stat items (excerpt)

| ID | Name | Effect | Price |
|----|------|--------|-------|
| `tome` | Tome of Power | +12% spell damage | 25 |
| `boots` | Swift Boots | +10% move speed | 18 |
| `talisman` | Iron Talisman | +2 armor | 20 |
| `heart` | Heart Crystal | +15 max HP | 18 |
| `ring` | Regen Ring | +0.7 HP/s | 20 |
| `hourglass` | Hourglass | −7% cooldowns | 26 |
| `clover` | Lucky Clover | +8% crit | 22 |
| `magnet` | Magnet Stone | +30 pickup range | 14 |
| `toolkit` | **Engineer's Toolkit** | **+20% Item Strength** | 26 |
| `idol` | Greedy Idol | +20% materials | 28 |
| `wand` | Crystal Wand | +6% damage, −3% cooldowns | 32 |
| `robe` | Warding Robe | +10 max HP, +1 armor | 26 |
| `skull` | Cursed Skull | +20% damage, −10 max HP | 30 |

### Tradeoffs (high risk / reward)
`glass` (Glass Cannon Orb +25% dmg/−2 armor), `anchor` (Leaden Anchor +4 armor/−8% spd),
`bloodpact` (+1.5 HP/s/−15 max HP), `overclock` (−15% cd / shop +10%).

### Chaos procs (timed)
`berserk` (every 20s ENRAGE: +200% dmg/−50% spd 5s), `quicksilver` (+35% spd 4s/12s),
`trickster` (every 10s: haste / might / sluggish — a gamble).

### Type-synergy & positioning
`duelistglyph` (+20% single-target), `breathfocus` (+25% breath), `blastprism` (+18% AoE),
`stormcoil` (+22% chaining/projectile); `sigil` (point-blank +25%), `scope` (+25% range/−10% spd),
`duel`, `panic`. Tag items: `ember`/`fcore`/`needle`/`lens`/`bell` reward committing to a damage type.

### Spell-modifying relics
`splitwand` (bolts split on hit), `burnink` (DoTs can crit), `gravity` (AoE pulls inward),
`brittle` (slowed foes +35% crit), `stormbat` (Chain Lightning kills charge next cast).

### Economy
`reclaimer` (Gold Reclaimer: −33% gold voided at wave end, stacks to 3), `widecone`
(+15° breath cone up to 180°).

## Round-effect gadgets (`roundEffect`)

Deployed automatically on a timer during a wave. More copies fire proportionally faster.
**Their potency scales with Item Strength** (see [08](08-turrets-and-item-strength.md)).

| ID | Name | Behavior |
|----|------|----------|
| `decoy` | Decoy Clown 🤡 | taunts enemies, soaks ~10 hits (Item-Strength scaled) |
| `flash` | Flashbang 🧨 | drops, detonates after 1s, stuns 3s |
| `turret` | Arcane Turret 🗼 | 12s **beam** turret that zaps nearby foes |
| `sentry` | **Sentry Turret** 🛰️ | **permanent projectile turret deployed at wave start** ([08](08-turrets-and-item-strength.md)) |
| `totem` | Healing Totem 🪅 | heals you while you stand near it (Item-Strength scaled) |
| `blackhole` | Black Hole Orb 🕳️ | pulls enemies in, then bursts |
| `mirror` | Mirror Image 👥 | clone recasts your last spell at half power |
| `banner` | Banner of Fury 🚩 | +30% damage while you fight near it (Item-Strength scaled) |
| `bubble` | Time Bubble ⏳ | briefly slows every enemy inside |

## Level-up choices

On level-up, pick **1 of 3** from `LEVELUP_OPTIONS` (modest: Power +6% dmg, Vitality,
Haste, Swiftness, Toughness, Precision, Mending, Greed, **Machinist +8% Item Strength**).
A "Mighty" pool (`MIGHTY_LEVELUP_OPTIONS`) offers much larger versions (e.g. Mighty
Power +30%, **Mighty Machinist +30% Item Strength**), granted by certain pending boosts.

**Decision:** level-ups are intentionally *small* — spells and items carry the run, so
the level-up cadence is a steady trickle rather than the main power source.

## Item chests

Some world finds grant an **item chest** instead of applying immediately. At wave end
the player chooses per chest: **Take** the item, or **Smash** it for gold
(`max(8, round(price·0.6))`). Handled by `showChestChoice` / `resolveChest` in `main.js`.

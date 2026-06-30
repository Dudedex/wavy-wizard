# 03 — Spells

Source: `js/data/spells.js`; casting in `main.js` (`tryCast`, `castSpell`, `updateSpells`).

Spells **auto-cast** from the player's spellbook on their own cooldowns. The player
never aims; targeting is automatic (usually nearest enemy). The spellbook holds up to
`MAX_SPELL_SLOTS = 6` spells (fewer for Battle Mage/Hermit).

## Tiers & fusion

- Every spell has **4 tiers** (`I–IV`, index `0–3`) with rising damage and effects.
- Buying a duplicate either takes a **new slot** or, with **fusion**, upgrades an
  owned same-tier copy by one tier (`owned.tier++`). Variants are preserved/merged.
- **Tier III** reads as a visually upgraded cast (`tierFx`).
- **Tier IV ("perfected")** unlocks a unique behavior per spell (see table).
- **Collector** wizard: each fusion adds `+15%` permanent damage to that spell (`fuseBonus`).

## Spell catalogue

| ID | Name | Icon | Role | T4 "Perfected" |
|----|------|------|------|----------------|
| `missile` | Magic Missile | 💫 | homing single-target bolt | kills split into 2 homing shards |
| `fireball` | Fireball | 🔥 | AoE explosion | leaves a lingering burning patch |
| `frost` | Frost Shard | ❄️ | piercing, slows | freezes the last pierced enemy solid |
| `lightning` | Chain Lightning | ⚡ | chains between foes | final target blasted for bonus AoE |
| `shield` | Arcane Shield | 🛡️ | periodic absorb shield | overcharged — +50% shield cap |
| `poison` | Poison Cloud | ☣️ | DoT ground cloud | cloud grows when a foe dies inside |
| `meteor` | Meteor | ☄️ | big delayed AoE | impact leaves a burning crater |
| `drain` | Life Drain | 🩸 | damage + self-heal | siphons a second nearby enemy |
| `orbs` | Arcane Orbs | 🪐 | orbiting bodies (passive) | bigger orbs that chill on touch |
| `nova` | Holy Nova | ✨ | self-centered burst + knockback | grants a burst of armor each cast |
| `firebreath` | Fire Breath | ♨️ | cone, leaves burning ground | bigger, longer-lasting flames |
| `icebreath` | Ice Breath | 🌨️ | cone, roots 3s | frozen foes shatter on death |
| `earthbreath` | Earth Breath | 🪨 | cone, knockback | huge knockback + brief armor |
| `windbreath` | Wind Breath | 🌪️ | cone, spawns tornadoes | larger, longer-lived tornadoes |
| `builder` | Turret Builder | 🛠️ | **builds auto-turrets** | (see [08](08-turrets-and-item-strength.md)) |

> **Turret Builder** is a non-attacking spell: it constructs a turret beside you at
> wave start (one per copy owned) and another every ~15s. Detailed in
> [08-turrets-and-item-strength.md](08-turrets-and-item-strength.md).

**Breath spells** fire a cone toward the nearest enemy (base 45°, widened by the Wide
Lens item up to 180°) with an elemental aftermath (burning ground, root, knockback,
tornadoes).

## Legendary Enchants (`ENCHANTS`)

Build-defining; equip **one per spell, up to 3 spells**. Sold as "legendary" shop offers.

| Enchant | Icon | Effect |
|---------|------|--------|
| `splash` | 💥 | hits explode for 50% damage; explosions chain on kills |
| `reach` | 🔭 | +40% range, +30% area, +30% zone duration |
| `vampiric` | 🩸 | heal 10% of damage dealt |
| `echo` | 🔁 | 40% chance to cast again (60% damage, rolls its own crit) |
| `frostbite` | ❄️ | slow 30%; slowed enemies shatter on death |

## Rare Variants (`VARIANTS`)

Occasionally a shop spell offer (wave 5+, ~14%) is an alternate stat profile:

| Variant | Base | Twist |
|---------|------|-------|
| `rapid` | missile | much faster cadence, weaker bolts |
| `heavy` | fireball | hits much harder, slow projectile |
| `giant` | nova | far bigger blast, longer cooldown |
| `venom` | poison | toxin also slows |
| `forked` | lightning | strikes two targets, fewer chains |

Fusing a variant with a non-variant **keeps the variant**.

## Spell XP & Mastery

Spells gain XP from kills (max level 5). Hitting a mastery threshold offers a
**mastery pick** (`MASTERY_OPTIONS` in `main.js`):

| Option | Effect |
|--------|--------|
| Empower | +18% damage with this spell |
| Hasten | −12% cooldown (+4% damage) |
| Overload | +30% damage, +10% cooldown |

Mastery modifiers are stored per spell id (`masteryMods`) and multiply into casts.

## Meta-classes / Elements (`ELEMENTS`)

Each spell belongs to 0–2 elements. Owning multiple spells of an element stacks a
bonus (capped at 3 from the spellbook; the wave's **element realm** adds +2, cap 5):

| Element | Stack bonus |
|---------|-------------|
| 🔥 Fire | +12% AoE size per stack |
| ❄️ Ice | your hits slow enemies (8%/stack) |
| ⛰️ Earth | +2 armor & +0.3 HP/s per stack |
| 🌀 Wind | +5% move speed per stack |

`recomputeElements()` rebuilds the stacks whenever the spellbook changes.

## Tags & synergy (`SPELL_TAGS`)

Tags (`fire/frost/arcane/holy/storm/venom`) gate synergy items (Ember Crown, Frozen
Core, Storm Needle, Orbital Lens, Martyr's Bell — see [04-items.md](04-items.md)).

## Damage pipeline (where numbers come from)

`castSpell` builds a per-cast tier object scaled by: range/area mults, mastery,
Concentratos still-bonus, Storm Battery, fuse bonus, banner bonus, fire-meta AoE.
The actual hit runs through `hitEnemy(e, rawDmg, opts)` which applies the player's
spell-damage multiplier, type multipliers, crit, Frozen Core/Point-Blank/Brittle, the
boss shield soak, and logs to the damage meter (`game.dmgMeter[source]`).

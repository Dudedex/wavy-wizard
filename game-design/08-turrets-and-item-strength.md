# 08 — Turrets, Item Strength & the Wizgeneer

This file documents the turret family, the **Item Strength** attribute, and the
**Wizgeneer** wizard, which together form one interlocking system. Logic lives in
`main.js` (turret update loop, `spawnBuilderTurret`, `deployBuilderTurrets`,
`deploySentryTurrets`, `spellPower`/`itemPower`, `hitEnemy`).

## Item Strength (the attribute)

- New stat `itemStrength` (base `1.0`) that scales the power of **round-affecting
  items** — turrets, gadgets, the bomb pad, gold-magnet pull, totem heal, decoy soak,
  banner bonus. It does **not** affect spell damage (that's `dmgMult`).
- Sources: **Engineer's Toolkit** item (+20%), **Machinist** level-ups (+8% / +30%),
  and the Wizgeneer's conversion (below).
- Shown in the shop stats panel as "Item strength".

### "Item" vs "spell" damage
`hitEnemy(e, raw, opts)` branches on `opts.item`:
- `opts.item` true → scales by `itemPower(stats)` (Item Strength).
- otherwise → scales by `spellPower(stats)` (spell damage).

So turrets, the bomb, and gadget damage are all flagged `item: true` and ride Item
Strength, while spells ride spell damage.

## The three turret sources

All turrets live in `game.turrets`. A turret has `mode` (`beam` or `proj`), a `range`,
`fireCd`, `dmg` (base), `source` (damage-meter key), and `permanent` (lives the whole
wave) vs. a `dur` (ages out). Damage is `round(dmg · itemPower(stats))` at fire time.

| Source | Item/Spell | Behavior |
|--------|-----------|----------|
| **Arcane Turret** (`turret` item) | round-effect item | every 16s deploys a **beam** turret that zaps for 12s |
| **Sentry Turret** (`sentry` item) | item, deployed at **wave start** | **permanent projectile** turret(s) in a ring around the player; **one per copy owned**; medium range (360) |
| **Turret Builder** (`builder` spell) | spell | builds a **permanent projectile** turret beside you at wave start (one per copy owned), then another every ~15s (cooldown-reduced) |

### Projectile turrets
`mode: 'proj'` turrets fire homing bolts (`kind: 'turret'`, `item: true`) at the nearest
enemy in range. Damage logs to the meter under `source` (`builder` shows under the
Turret Builder spell; `turret`/`sentry` damage groups under the generic turret source).

### Turret Builder (spell) specifics
- Tiers raise the **base damage** of the turret it builds (`14 → 22 → 34 → 52`).
- Build interval is 15s, reduced by cooldown reduction.
- **Multiple copies → multiple turrets at wave start** (`deployBuilderTurrets` spawns one
  per copy, then sets each copy's build timer to a full cooldown so they don't instantly
  rebuild). Turrets scatter 28–64px around the player so they don't stack.

### Sentry Turret (item) specifics
- Deployed at the **start of every wave** by `deploySentryTurrets`, one per copy, ringed
  72px around the player; lasts the whole wave; medium range (360).
- Base damage scales with the wave (`10 + 2.2·wave`) and Item Strength at fire time.

## The Wizgeneer (conversion wizard)

Perk: **spell damage powers items, and item strength powers spells — both reduced by
40%.** A build-around identity: a turret/gadget engineer who can pour "spell damage"
items into their machines, or "item strength" into their spells.

Implemented as a point-of-use swap (constant `ITEM_CONV = 0.6`):

```js
spellPower(st) = st.wizgeneer ? 1 + 0.6·(st.itemStrength − 1) : st.dmgMult
itemPower(st)  = st.wizgeneer ? 1 + 0.6·(st.dmgMult     − 1) : st.itemStrength
```

So for the Wizgeneer, buying Tomes (spell damage) empowers his **turrets/items**, and
buying Toolkits (item strength) empowers his **spells** — each at 60% effectiveness.
Verified example: `dmgMult 2.0`, `itemStrength 1.5` → spell ×1.3, item ×1.6.

He also **looks like a robot disguised as a wizard** (`look.robot`): metal face plate,
glowing LED eyes, grille mouth, rivets, a chest power-core, and an antenna poking up
through the wizard hat.

## Bomb rebalance (related)

The Bomb pad was retuned to a **tighter, harder-hitting** blast: radius `230` (down from
380) and base damage `95 + 8·wave` (up from a small flat value), and it now scales with
**Item Strength** (`item: true`) instead of double-dipping spell damage.

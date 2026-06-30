# 02 — Characters (Wizards)

Source: `js/data/characters.js`. Each wizard has a `look` (drives the sprite in
`js/render/wizard.js`), a list of human-readable `perks`, and an `apply(stats)` that
mutates the starting stat block (`freshStats()` in `main.js`).

**Design intent:** every wizard is a *constraint or twist*, not just a stat nudge.
Picking one re-frames the whole run. Winning wave 20 as each wizard is an achievement.

## Roster

| ID | Name | Title | Perks (summary) |
|----|------|-------|------------------|
| `apprentice` | Aldric | the Apprentice | +15% materials, shop prices −10% (the "vanilla"/easy start) |
| `pyromancer` | Pyra | the Pyromancer | +30% spell damage, −15 max HP |
| `cleric` | Benedict | the Cleric | +25 max HP, +1 HP/s, all healing +50%, −15% damage |
| `warlock` | Vex | the Warlock | +15% crit, crits ×2.5, −15 max HP |
| `twincaster` | Lyra | the Twincaster | every spell casts twice; range −45%; range bonuses 50% weaker |
| `chronomancer` | Mira | the Chronomancer | −20% cooldowns, −10% move speed |
| `geomancer` | Odo | the Geomancer | +5 armor, −40 pickup range |
| `moonwitch` | Selene | the Moon Witch | crits heal 1 HP, +8% crit, −10% damage |
| `battlemage` | Brakk | the Battle Mage | searing aura damages nearby foes, +2 armor, only 4 spell slots |
| `wildmage` | Nix | the Wild Mage | every 5th cast fires an extra time, +10% damage, +5% crit |
| `concentratos` | Stilo | the Concentratos | casts only while still (+50% dmg), +25% move speed while moving, −25% range & area |
| `gambler` | Fortuna | the Gambler | shop prices swing wildly ±, items 40% to apply twice, −10 max HP |
| `summoner` | Morwen | the Summoner | kills summon a temporary familiar, −25% spell damage |
| `hermit` | Cyrus | the Hermit | only 3 spell slots, +60% spell damage |
| `collector` | Quill | the Collector | each fusion makes that spell +15% stronger, manual fusion costs gold, +10% materials |
| `rando` | Rando | the Unpredictable | can't buy spells (items only); spellbook re-rolled every wave; each spell's tier = its persistent mastery level |
| `cursedking` | Mordred | the Cursed King | +40% damage; lose 8 max HP each wave unless a relic was bought last shop |
| `wizgeneer` | Gizmo | the Wizgeneer | spell damage powers items & vice-versa, both reduced by 40% (see [08](08-turrets-and-item-strength.md)); looks like a robot in disguise |

## Notable mechanics behind perks

- **Twincaster / Wild Mage / Echo** all push extra casts onto a small `castQueue`
  so the duplicate fires a few frames later (a deliberate stagger, not simultaneous).
- **Concentratos** only casts when `!p.moving`; standing still grants `×1.5` damage.
- **Battle Mage / Hermit** reduce `maxSlots`, trading flexibility for power.
- **Rando** can't buy spells; `randomizeRandoSpells()` rerolls the book each wave, and
  each spell returns at its persisted mastery-level tier.
- **Cursed King** bleeds max HP each wave unless `boughtRelic` was set in the last shop.
- **Wizgeneer** sets `wizgeneer = true`; the conversion is computed at point-of-use via
  `spellPower()` / `itemPower()` helpers. His `look.robot` flag renders a metal face,
  LED eyes, a chest power-core, and an antenna poking through the wizard hat.

## Sprite system (`js/render/wizard.js`)

`look` flags compose the sprite: `robe`, `hat`, `orb`, `trim` colors plus booleans
`hasHat`, `hasStaff`, `hood`, `horn`, `bald`, `hair`, and `robot`. The renderer draws
an aura, robe (with walk-animated hem/boots), arms, head/face, and headwear. The
`robot` branch swaps the human head for a metal face plate (LED eyes, grille, rivets),
adds a glowing chest core, and an antenna — "a robot disguised as a wizard."

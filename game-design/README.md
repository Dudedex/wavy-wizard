# Wavy-Wizards — Game Design Docs

This folder breaks the design of **Wavy-Wizards** into focused documents. Each file
describes a current system *as implemented in the code* (not aspirational), plus the
reasoning behind the notable decisions.

> Wavy-Wizards is a browser-based, Brotato-style **arena-survival roguelite**. You
> play an auto-casting wizard surviving 20 escalating waves (then optional Endless),
> shopping between waves to build a spell-and-item engine.

## Index

| File | Covers |
|------|--------|
| [01-overview.md](01-overview.md) | Vision, core loop, tech stack, file/architecture map |
| [02-characters.md](02-characters.md) | The playable wizards and their perks |
| [03-spells.md](03-spells.md) | Spells, tiers, fusion, enchants, variants, mastery, elements |
| [04-items.md](04-items.md) | Shop items, level-ups, Item Strength, round-effect gadgets |
| [05-enemies.md](05-enemies.md) | Enemy archetypes, counter-enemies, elites, bosses, spawn pool |
| [06-progression-economy.md](06-progression-economy.md) | Waves, XP/levels, gold/budget, danger levels, shop |
| [07-world-and-events.md](07-world-and-events.md) | World events, wave modifiers, fountains, structures, pads, realms |
| [08-turrets-and-item-strength.md](08-turrets-and-item-strength.md) | Turret systems + Item Strength attribute + Wizgeneer |
| [09-ui-ux.md](09-ui-ux.md) | Camera, HUD, menus, tooltips, achievement toasts, co-op, controls |
| [10-audio.md](10-audio.md) | Soundtrack and sound effects |
| [11-achievements.md](11-achievements.md) | The full achievement list and how they unlock |
| [12-design-decisions.md](12-design-decisions.md) | Cross-cutting rationale / decision log |

## Conventions used in these docs

- **Tiers** are written `I–IV` (internally `tier` index `0–3`).
- Numbers (damage, cooldown, price) are the base values from `js/data/*`; most are
  scaled at runtime by stats, danger level, and wave number.
- "the code" references live in `js/` — see [01-overview.md](01-overview.md) for the map.

> ⚠️ A legacy monolithic `game-design.md` exists at the repo root from an earlier
> milestone. These folder docs supersede it and reflect the current build.

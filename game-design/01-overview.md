# 01 — Overview & Architecture

## Vision

A fast, readable **arena-survival roguelite** in the browser. You control a wizard
that **auto-casts** its spellbook; your job is to **move, dodge, and position** while
the build does the damage. Between waves you spend gold in a shop to assemble a
spell-and-item engine. Runs are short (20 waves + optional Endless), and replay value
comes from the wizard you pick, the spells you fuse, and the danger level you dare.

## Core loop

1. **Pick** a wizard → a danger level → a starting spell.
2. **Survive a wave** (timed). Kill enemies, collect gems (gold) and XP, dodge zones.
3. **Level up** mid-wave → pick 1 of 3 small boosts. Spells gain XP → **mastery** picks.
4. **Wave ends** → unspent "budget" rules, then the **shop**: buy/fuse spells, buy items,
   reroll, equip legendary enchants, resolve item-chest finds.
5. Repeat. **Clear wave 20 to win**; continue into **Endless** if desired.

A run ends on death (Game Over) or victory (Win). Both show a build summary, a
post-run scoreboard, and any achievements unlocked.

## Pillars / design intent

- **Build expression over twitch execution.** Casting is automatic; the player's skill
  expression is positioning + build choices. (See spells/items docs.)
- **Legible threats.** Hostile zones are red-dashed; friendly/own zones are
  blue-dotted solid. Off-screen enemies get edge arrows. (See [09-ui-ux.md](09-ui-ux.md).)
- **Meaningful between-wave decisions.** Fusion, enchants, mastery, item synergies,
  and "build-debt" bargains all create branching choices.
- **Characters as constraints.** Each wizard is a rule that re-shapes the run (e.g.
  "casts only while standing still", "spell damage powers items"). (See [02-characters.md](02-characters.md).)

## Tech stack

- **Vanilla JS + HTML5 Canvas 2D.** No framework, no build step — open `index.html`.
- **Classic `<script>` globals.** Load order matters: data → systems/renderers → `main.js`.
- **WebAudio** synth for music + SFX (oscillators, filtered noise, a compressor limiter).
- **localStorage** for persistence (save, wins, scores, achievements, settings).
- A tiny `serve.js` provides a static dev server; `simulate.js` runs headless balance sims.

## World vs. viewport

- **World** is `W × H = 1920 × 1080` (1.5× the viewport).
- **Viewport** is `VIEW_W × VIEW_H = 1280 × 720`.
- A **follow-camera** (`game.cam`) tracks the player; the world layer is drawn with
  `ctx.translate(-cam.x, -cam.y)`, and the HUD is drawn screen-space afterward.

## File / architecture map

```
index.html              # DOM overlays (menus, shop, HUD containers) + script load order
style.css               # all styling, overlays, HUD, toasts, responsive rules
serve.js                # static dev server
simulate.js             # headless balance simulation

js/
  audio.js              # WebAudio music ("Arcane Battle") + spell/UI SFX
  main.js               # engine: state machine, game loop, casting, combat,
                        #   enemies driving, shop logic, persistence, achievements
  enemies-ai.js         # enemy spawning, AI, ranged attacks, boss/elite behavior
  shop.js               # shop offer rolls, rendering, buy/fuse/sell, damage meter
  data/
    spells.js           # SPELLS, tiers, ENCHANTS, VARIANTS, tags, ELEMENTS
    characters.js       # CHARACTERS (wizards) + perks + look
    items.js            # ITEMS, LEVELUP_OPTIONS, MIGHTY_LEVELUP_OPTIONS
    enemies.js          # ENEMY_TYPES + getWavePool(wave)
    world.js            # DANGER_LEVELS, THEMES, ELEMENT_THEMES, WAVE_MODIFIERS,
                        #   WORLD_EVENTS, FOUNTAIN_TYPES
  render/
    wizard.js           # the wizard sprite (hats/hoods/robot/etc.)
    shades.js           # color helpers
    environment.js      # arena background, structures, world visuals
```

## Game state machine

`game.state` ∈ `title | charselect | dangerselect | spellselect | playing | levelup |
mastery | shop | chestchoice | pause | gameover | win` (+ `achievements`, `settings`).
Overlays are full-viewport `position:fixed` flex panels toggled by `setState()`.

## Key runtime constants

- `MAX_SPELL_SLOTS = 6` (some wizards cap lower).
- Player base move speed `250`; enemies move at `~1.16×` their base; projectiles
  carry a global `PROJ_SPEED_MULT = 1.05`.
- Wave duration: `min(60, 16 + wave·2) + 10` seconds.
- All **incoming healing is globally halved** (then the Cleric's `healMult` etc. apply).

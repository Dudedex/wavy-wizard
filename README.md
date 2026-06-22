# Wavy-Wizards

A browser-based, Brotato-style arena-survival roguelite. Pick a wizard, survive 20 escalating
waves of enemies, and shape a build out of auto-casting spells, fusions, items and legendaries.
Written in plain HTML5 Canvas + vanilla JavaScript — **no build step, no dependencies**.

> Clearing **wave 20** wins the game. After that you can keep going in endless mode.

## Play

You need any local static server (the game loads its scripts via `<script>` tags, so opening
`index.html` directly from `file://` may be blocked by the browser).

A tiny zero-dependency server is included:

```bash
node serve.js
```

Then open **http://localhost:8123**.

Any other static server works too, e.g.:

```bash
npx serve .
# or
python -m http.server 8123
```

## Controls

| Action | Keys |
| --- | --- |
| Move | `WASD` or Arrow keys |
| Damage meter | `Tab` |
| Pause | `P` / `Esc` |
| Mute | `M` |
| Controller | Left stick / d-pad to move, Start to pause |

Spells **cast automatically** at the nearest target. On a phone, rotate to landscape and use the
on-screen joystick.

**Co-op:** toggle 2 players on the title screen — Player 1 uses `WASD`, Player 2 uses the Arrow
keys (or plug in two gamepads). The spellbook and gold are shared.

## How it plays

- **Waves & shop** — Survive each wave, then spend gold in the shop on spells, items, fusions and
  events before the next wave.
- **Spells** — Buy duplicates to **fuse** them up tiers (Tier IV is a "perfected" version with a
  unique behavior). Spells level via kills into a **mastery** bonus.
- **Elements** — Fire / Ice / Earth / Wind spells stack a meta-class bonus; the arena theme
  reflects the wave's element.
- **Characters** — Many wizards, each with perks (and some with drawbacks). Per-wizard wins are
  tracked.
- **Difficulty** — Preset Danger Levels 0–10, plus a **Custom** difficulty with independent
  health / damage / materials sliders (−99% to +5000%).
- **Achievements** — Run milestones, per-character and per-difficulty wins, plus a pile of silly
  ones. Custom rounds only earn their three dedicated achievements.
- **Last Resort** — Cheat death once per run, then visit the altar to restore or upgrade it.

Everything (run progress, wins, high scores, settings, achievements) is saved in `localStorage`.

## Tools

Standalone pages served from the project root:

- **`/spell-editor.html`** — sandbox to tune a spell's base width, damage, speed and cooldown,
  drop target dummies, watch it interact live, and read off the resulting config.
- **`/asset-previews.html`**, `/wizard-assets-preview.html`, `/enemy-assets-preview.html`,
  `/spell-assets-preview.html`, `/environment-assets-preview.html` — visual galleries of the
  rendered sprites/effects.
- **`simulate.js`** — headless balance check: `node simulate.js [danger]` runs a base character
  (no perks) through every spell and reports DPS.

## Project layout

```
index.html              Game shell (overlays: title, shop, char/danger select, …)
style.css               All UI styling
serve.js                Minimal static server (node serve.js)
spell-editor.html       Standalone spell sandbox
game-design.md          Design notes
js/
  audio.js              WebAudio sound synthesis
  main.js               Core engine: loop, player, combat, waves, UI wiring, achievements
  enemies-ai.js         Enemy spawning, wave director, enemy AI & abilities
  shop.js               Shop generation, offers, fusion, build identity
  data/                 Pure data: spells, characters, items, enemies, world/danger
  render/               Canvas renderers: wizard, environment, shading helpers
```

There is no compilation: edit a file, reload the page. Classic `<script>` tags share one global
scope, so **load order matters** — data files first, then systems/renderers, then `js/main.js`
(see the bottom of `index.html`).

## Tech

Vanilla JS · HTML5 Canvas 2D · WebAudio · `localStorage`. No frameworks, no bundler, no install.

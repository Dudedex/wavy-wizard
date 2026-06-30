# 07 — World, Events & Map Features

Source: `js/data/world.js` + world logic in `main.js` (`updateWorld`, `startWave`,
gadget/pad/spawn systems) and `js/render/environment.js`.

## Color themes (`THEMES`)

Chosen in Settings; sets canvas background/grid/wall colors: Midnight, Dusk, Forest,
Ember, High Contrast (accessibility).

## Element realms (`ELEMENT_THEMES`)

Waves 1–20 each get a random **element realm** (decided up front in a `realmSchedule`
so the roadmap can preview it). The realm sets the backdrop **and grants +2 to that
element's meta-stack** (cap 5). Realms: Fire 🔥, Frozen ❄️, Earthen ⛰️, Windswept 🌀.
Endless waves drop back to the chosen color theme.

## Element structures

Up to 5 landmarks of the realm element scatter across the map (clear of spawn, spaced
apart). Standing near one grants a small proximity bonus (e.g. ice structures feed a
slow aura via `structIce`).

## Wave modifiers (`WAVE_MODIFIERS`)

One rolls on every 3rd non-boss, non-horde wave (from wave 3) to vary the rhythm:

| Modifier | Effect |
|----------|--------|
| 🌑 Blood Moon | more enemies, more gems |
| 🌵 Mana Drought | +20% cooldowns now, −25% shop prices next |
| 🔷 Glass Arena | enemies +30% damage, fountains heal double |
| 🐝 Swarm Nest | endless bats & sparks |
| 💎 Treasure Wave | fewer enemies, but they drip gold |
| 🌩️ Storm Surge | more arcane storms, +50% XP |

## World events (`WORLD_EVENTS`)

From wave 5, a **33% chance** per wave to erupt mid-wave. Each spawns persistent,
shape-varied **danger zones** that pulse damage to **both** player and enemies until the
wave ends. Events are mighty and cover a large part of the map:

- 🪨 **The earth is rumbling** (quake)
- ⛈️ **A thunderstorm is approaching** (storm)
- 🌋 **A volcano erupted** (volcano)
- 🌊 **A tide is rising** (tide) — rising water with **safe gaps** to pass through.

## Fountains (`FOUNTAIN_TYPES`)

Risk/reward shrines that may spawn each wave (a second is rarer, wave 10+). Channel to
drain:

| Fountain | Effect |
|----------|--------|
| Healing | heal 25% max HP |
| Power | +30% damage for 10s |
| Spell | a free spell for the rest of the wave |
| Greed | gold now — but an ambush erupts |
| Chaos | a strong blessing… or a curse |

## World spawns

- **Gold Magnet** 🧲 — stand on it to drag all gold gems toward it (pull speed scales
  with Item Strength).
- **Item Mine** — channel to mine an **item chest** (resolved as Take/Smash at wave end).

## Activatable pads

Stand on a pad for ~1s (`ACT_CHANNEL`) to trigger it; up to 2 on the map at once:

| Pad | Effect |
|-----|--------|
| 💣 Bomb | 1.5s fuse, then a tight-but-hard blast (radius 230, base `95 + 8·wave`, **scales with Item Strength**) |
| 🛡️ Aegis | 5s invincibility; enemies take contact damage; golden aura + countdown |
| 🎯 Barrage | 8s — every cast fires two extra ±45° copies |

The Warden's movement-blocking ward is drawn with a thick black border to match the
map edge (clear "can't pass here" signal).

## Arcane storms & anti-camp

A periodic arcane storm hazard (`hazardT`) and a small periodic targeted spell
(`antiCampT`) discourage standing still indefinitely.

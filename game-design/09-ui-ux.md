# 09 — UI / UX, Controls & Feedback

## Camera

A **follow-camera** (`game.cam`) tracks the player across the 1920×1080 world inside
the 1280×720 viewport. World entities are drawn under `ctx.translate(-cam.x, -cam.y)`;
the HUD is drawn screen-space afterward. **Off-screen enemies** get edge arrows so
threats are never invisible.

## Zone legibility

A core readability rule: **hostile vs friendly zones look different**.
- **Hostile** ground attacks / world hazards: red, **dashed** rings (`⚠`).
- **Friendly / your own** effects (totems, banners, bubbles, aegis): light-purple fill
  with a thick **blue dotted** border (`drawFriendlyZone`).
- Buff zones show a centered **countdown timer** (`drawZoneTimer`).

## HUD

- Player HP bar, shield, armor, level/XP.
- **Damage meter** (toggle with **Tab**): per-spell damage bars in the **bottom-left**
  while playing. Non-spell sources (bomb, turrets, auras) are filtered out of the meter.
- **Boss bar** at the top on boss waves (combined HP in purple + shield strip in cyan,
  labeled).
- Owned spells are drawn **arranged around the wizard** (no bottom spell bar).
- Gold "flies" to the counter on pickup; the cursor is hidden during play.

## Shop UI

- Stable layout (no jumping); owned items and equipped legendaries shown below the
  spellbook; armor total damage-reduction % displayed.
- **Hover tooltips** with full damage details for spells and items (with `+`/`−`
  numbers colored green/red).
- A **wave-overview / roadmap** panel at the shop top (and in Pause) previews upcoming
  waves and their element realms.
- The shop's **damage meter** (with per-spell bar chart) sits in the same bottom-left
  spot it occupies during a wave.
- **Fusion compare** preview shows what a fuse upgrades to.
- Tooltips are dismissed defensively (on re-render, state change, pointerdown/blur/scroll)
  so they never get "stuck."

## Achievement toasts

Earning an achievement **slides a pop-up into the bottom-right corner** (`#ach-toasts`,
`showAchToast`). Multiple stack upward and auto-dismiss after ~4.2s (slide-out). Fired
from both the live `unlockAch` path and the run-end batch (`unlockAchievements`,
staggered). A small in-world "🏅 name" flourish also appears over the wizard on live
unlocks. See [11-achievements.md](11-achievements.md).

## Menus & responsiveness

- Full-viewport overlays for title, character select (avatar grid + detail panel),
  danger select, starting-spell select, level-up, mastery, shop, pause, game-over, win,
  achievements, settings, and the item-chest choice.
- **Responsive** for mobile / tablet / FHD; the title menu is compacted to fit; the
  leaderboard scrolls within a capped height.
- **Mobile:** transparent on-screen stick + pause button, and a rotate-to-landscape
  prompt in portrait.

## Fullscreen

- A **Fullscreen** button on the title and pause screens (`toggleFullscreen`,
  `syncFullscreenBtn`); hidden where unsupported (e.g. iOS). **Esc** behaves sensibly
  (exit fullscreen / resume). Pause offers Resume + Fullscreen + Settings + Quit.

## Controls

- **Move:** WASD / Arrows. **Tab:** damage meter. **P / Esc:** pause. **M:** mute.
- **Controller** supported. Spells cast automatically (no manual aim).
- **Couch co-op:** a second local player (P1 = WASD/pad1, P2 = arrows/pad2) sharing the
  spellbook, gold and shop; enemies chase the nearest body. See [12](12-design-decisions.md).

## Settings & accessibility

Audio volumes, color schemes (incl. High Contrast), damage-number toggle, low-FX
toggle, and a replay-failed-waves toggle.

# 12 — Design Decisions (Rationale Log)

Cross-cutting "why", so future changes don't undo intentional choices.

## Combat & control

- **Auto-cast, manual movement.** Skill expression is positioning, not aiming. Spells
  fire on their own cooldowns at auto-selected targets.
- **Sequential cast stagger.** When many spells (or double/echo/wild casts) want to fire
  the same frame, they're staggered a few ms via the `castQueue` so visuals read clearly
  and don't all stack on frame 1.
- **Global healing nerf (×0.5).** All incoming healing is halved at the source, then
  per-character multipliers apply. Keeps sustain builds from trivializing damage.
- **Faster late game, gentler early.** The spawn pool and scaling were reworked so early
  waves ease players in while late waves get harder *and faster*, shifting from "swarm"
  to "navigate a projectile-filled arena" (more shooters/bombers/counter-enemies late).

## Build depth

- **Tiers I–IV with a payoff at the top.** T3 = visual upgrade, **T4 = a unique
  "perfected" behavior** — fusing to max is a real reward, not just bigger numbers.
- **Fusion keeps variants.** Fusing a rare variant with a normal copy preserves the
  variant, so finding a variant is never "wasted" by a later fuse.
- **Enchants capped at 3 spells.** Forces choosing *which* spells become build-defining.
- **Level-ups are deliberately small.** Spells + items carry the run; level-ups are a
  steady trickle, not the main power curve.
- **Counter-enemies are rare "moments."** Low flat spawn weights so they punish a habit
  occasionally without dominating the mix.

## Economy

- **Gold budget / voiding.** Unspent gold past the budget is voided at wave end
  (Brotato-style) to force spending decisions; **Gold Reclaimer** is the counter-play.
- **Build debt.** Some shop bargains grant cheap power now for a cost next wave — a
  risk lever for greedy players.

## The Item Strength / turret / Wizgeneer system

- **Two damage channels.** `dmgMult` (spells) and `itemStrength` (turrets, gadgets,
  bomb) are separate so a "gadget build" is a real, distinct path. `hitEnemy(opts.item)`
  routes to the right multiplier.
- **Wizgeneer as a conversion character.** Rather than a flat bonus, he *swaps* the two
  channels at 60% each (−40%), making "spell damage" items power his machines and
  "item strength" power his spells — a build-around identity. Computed at point-of-use
  (`spellPower`/`itemPower`) so it stays correct regardless of buy order.
- **Turrets deploy at wave start, one per copy, scattered.** Multiple Turret Builders or
  Sentries = multiple turrets in a small ring around you, so stacking copies reads
  visibly and immediately.
- **Bomb retune.** Tighter radius (230) but much higher base damage, scaling with Item
  Strength — a precise nuke rather than a screen-wide clear, and on the gadget channel.

## Readability & feedback

- **Hostile = red dashed; friendly = blue dotted.** A consistent visual grammar for
  "this hurts" vs "this helps."
- **Off-screen arrows + top boss bar.** No threat is ever invisible.
- **Corner achievement toasts.** Earned achievements slide in bottom-right so progress
  is acknowledged without interrupting play.
- **Sticky-tooltip guard.** Tooltips are force-dismissed on re-render / state change /
  input so they can't linger.

## Audio

- **One cohesive track, fixed tempo, only the heartbeat accelerates.** Intensity is
  conveyed by the kick "heartbeat" speeding up over a steady groove. Click-free via
  ramped envelopes + a compressor limiter.

## Tech

- **No build step.** Vanilla JS + Canvas, classic script globals, strict load order
  (data → systems/renderers → `main.js`). Easy to open, hack, and ship as static files.
- **Headless simulation.** `simulate.js` / the in-app difficulty simulator predict
  per-difficulty outcomes for balancing.

---

### Known doc caveat
The repo-root `game-design.md` is an older monolithic snapshot. This `game-design/`
folder is the current, segmented source of truth; prune or archive the old file when
convenient.

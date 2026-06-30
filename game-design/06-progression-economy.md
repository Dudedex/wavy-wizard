# 06 — Progression & Economy

## Waves

- A run is **20 waves**; clearing wave 20 wins. **Endless mode** continues past 20
  (enemies keep scaling; element realms stop and the chosen color theme returns).
- **Wave duration:** `min(60, 16 + wave·2) + 10` seconds. Survive the timer to clear.
- The arena seeds element realms, structures, fountains, world spawns, possible world
  events, and a possible wave modifier at the start of each wave (`startWave`).
- **Retry option:** a start-screen toggle lets failed waves be replayed instead of
  ending the run outright.

## XP & levels

- Enemies drop XP; filling the bar triggers a **Level Up** (pick 1 of 3, see
  [04-items.md](04-items.md)). Multiple level-ups can queue (`pendingLevelUps`).
- Spells separately gain XP from kills (max level 5) → **mastery** picks
  (see [03-spells.md](03-spells.md)).

## Gold, gems & the budget mechanic

- Enemies drop **gems** = gold, modified by `matMult` and the danger materials bonus.
- **Gold budget:** at wave end, unspent gold beyond the carry-over "budget" is
  **voided** (a Brotato-style economy that discourages hoarding). The **Gold Reclaimer**
  item claws back a fraction (stacks to 3 for near-full recovery).
- Higher danger pays more materials to compensate for tougher enemies.

## Danger levels (`DANGER_LEVELS`)

Chosen before each run. `mod` scales enemy HP (and, past mid, damage). Materials scale
up to compensate (~+50% gold per gem per +100% danger).

| Level | HP × | Damage × |
|-------|------|----------|
| 0 | 1 | 1 |
| 1–3 | 1 | 1 |
| 4 | 2 | 1 |
| 5 | 3 | 1.5 |
| 6 | 4 | 2 |
| 7 | 5 | 2.5 |
| 8 | 6.5 | 3.25 |
| 9 | 8 | 4 |
| 10 | 10 | 5 |

Winning at a danger level unlocks the "Danger N Cleared" achievement (and all below it).
A **Custom** danger mode lets affixes be set freely but locks out normal achievements
(only custom-only achievements count).

## Shop

Opened between waves (`js/shop.js`). Four offer slots rolled from `rollOffer`:

- ~55% **spell** offers (a random spell at a wave-weighted tier; wave 5+ has a ~14%
  chance to be a rare **variant**). Rando can't get spell offers.
- Otherwise an **item** offer. Some items leave the pool when maxed (Gold Reclaimer at
  3, Wide Lens at 180° cone).
- Slots can be replaced by special offers: **legendary** enchants, a **Last Resort**
  upgrade, or a **shop event**.
- Offers can be **locked** (kept through a reroll) and **rerolled** for gold.

### Buying / fusing / selling
- Buy a spell into a free slot, or **buy & fuse** to upgrade an owned same-tier copy.
- Equip a **legendary enchant** onto an owned spell (max 3 enchanted spells).
- Items apply immediately (stat/proc) or register as sentry/round-effect gadgets.

### Pricing & "build debt"
- Shop prices **scale up in later rounds**; the Apprentice and some items discount them.
- **Build-debt bargains** (shop events) offer cheap power now for a cost later
  (e.g. Cursed Discount, Arcane Loan, next-wave enemy buffs).

## Persistence (localStorage)

- `wavywizards-save` — mid-run checkpoint (between waves).
- `wavywizards-wins` — per-wizard win records.
- `wavywizards-scores` — top-10 scoreboard (DPS + kills + waves + win bonus).
- `wavywizards-achievements` — unlocked achievements.
- `wavywizards-flawless` — lifetime flawless-wave tally (for Untouchable).
- Settings/options persisted separately. Legacy `browizard-*` keys are wiped on boot.

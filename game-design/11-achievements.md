# 11 — Achievements

Source: `ACHIEVEMENTS` in `main.js`. Stored in localStorage (`wavywizards-achievements`).
Browsable from the title screen; earning one pops a **bottom-right toast** (see
[09-ui-ux.md](09-ui-ux.md)).

## Two unlock paths

- **`inline` (live):** event-driven, unlocked the instant the condition happens during
  play, via `unlockAch(id)`. (Funny/situational ones.)
- **`check(ctx)` (run-end):** evaluated against the finished-run context
  (`achievementContext`) in `unlockAchievements(won)`. "Winning" always means clearing
  wave 20.

**Custom rounds** earn *only* custom-only achievements; everything else is locked out
(and custom-only ones require a custom round). This keeps the leaderboard honest.

## Core / win-condition

| Achievement | How |
|-------------|-----|
| 🎓 Graduation | win the game (first wave-20 clear) |
| 🛡️ Halfway There | reach wave 10 in a run |
| ♾️ Beyond the Veil | press into Endless (past wave 20) |
| 💀 Exterminator | 500 kills in one run |
| 💰 Tycoon | earn 1000 gold in one run |
| 💥 It's Over 9000! | >9000 overall DPS in a run |
| 🐌 Slow Ass Wizz / ⚡ Fast Ass Wizz | win with move speed <0% / >+50% |
| 🎯 The Picky One | win using only your starting spell (copies allowed) |
| 🔥/❄️/🌀/⛰️ The Hotty/Cool/Birdy/Humble One | win with only one element's spells |
| ⚰️ Can't Take It With You | die holding 3000+ unspent gold |
| 🪦 Not Today! | cheat death with Last Resort, then win |
| ✨ Untouchable II | win without taking a single hit |

## Live / funny

🕶️ Enter the Matrix (10 hits in 3s) · 🪙 Broke as Wizz (wave 5+ shop, can't afford
anything) · 🪨 Wiztank (40 armor) · 😈 Pain Enjoyer (−40 armor) · 🐲 Dragon's Hoard
(50,000 gold at once) · 🎒 Pack Rat (15 items) · 🧼 Untouchable (10 lifetime flawless
waves) · 🗿 Rooted to the Spot (clear a wave without moving) · 🤹 Sleight of Hands
(grab a chest item with <2s left) · 🥤 Always Thirsty (drain a fountain with <2s left)
· 🥩 Tenderized (max the spell-vulnerability debuff at 20).

## Custom-only

⚙️ Can't Be Satisfied (win with custom affixes) · 🐘 Elephant in the Glass Room (win
with HP −99%, dmg +5000%, materials 0%) · 🤨 For Real? (win with affixes set to exactly
the Danger 5 values).

## Generated sets

- **Danger N Cleared** (☠) — one per danger level `0–10`; winning higher also credits
  the lower ones.
- **Master: \<Name\>** (🧙) — one per wizard; win the game as that wizard.

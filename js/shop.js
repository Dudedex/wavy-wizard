'use strict';

// ===========================================================================
// Shop: offer generation, pricing, fusion, events, and shop/overview UI
// ===========================================================================

// Shop
// ---------------------------------------------------------------------------
// Rough ceiling of gold a player can earn in a given wave. Anchored to the
// user's spec: ~40g on wave 1, ~1000g on wave 8 (≈ ×1.585 per wave).
function maxEarnableGold(w) {
  return 40 * Math.pow(1.585, Math.max(0, w - 1));
}

// Item prices climb with the economy: base price + 10% of the wave's gold ceiling.
// (e.g. a 15g item costs 19g on wave 1 and ~115g on wave 8.)
function itemPrice(item) {
  return Math.round(item.price + 0.10 * maxEarnableGold(game.wave));
}

function spellTierWeightForWave(wave) {
  // returns tier index 0..3 for a NEW spell offer
  const w = [10, 0, 0, 0];
  if (wave >= 4)  w[1] = 4 + wave * 0.5;
  if (wave >= 8)  w[2] = wave * 0.45;
  if (wave >= 13) w[3] = (wave - 10) * 0.5;
  return weightedPick([[0, w[0]], [1, w[1]], [2, w[2]], [3, w[3]]]);
}

function rollOffer() {
  // Rando can't buy spells — only items appear for him
  if (!game.player.stats.rando && Math.random() < 0.55) {
    const id = pick(Object.keys(SPELLS));
    const offer = { kind: 'spell', id, tier: spellTierWeightForWave(game.wave) };
    // ~14% of spell offers (wave 5+) are a rare variant of that spell
    if (game.wave >= 5 && Math.random() < 0.14) {
      const vk = Object.keys(VARIANTS).find(k => VARIANTS[k].spell === id);
      if (vk) offer.variant = vk;
    }
    return offer;
  }
  // Gold Reclaimer caps at 3 copies — drop it from the pool once maxed
  const pool = (game.player.stats.reclaim || 0) >= 3 ? ITEMS.filter(it => it.id !== 'reclaimer') : ITEMS;
  return { kind: 'item', item: pick(pool) };
}

// Display name + (variant-modified) tier stats for spells/offers.

function spellShopIcon(id) {
  const def = SPELLS[id];
  const c = def ? def.color : '#8be0ff';
  const soft = `${c}55`;
  const svg = (body) => `<div class="icon spell-shop-icon" style="--spell:${c};--spell-soft:${soft}"><svg viewBox="0 0 64 64" aria-hidden="true">${body}</svg></div>`;
  switch (id) {
    case 'missile': return svg(`<polygon points="48,32 24,18 30,32 24,46" fill="${c}"/><polygon points="34,32 16,22 21,32 16,42" fill="${soft}"/><polygon points="22,32 8,24 12,32 8,40" fill="${soft}"/><circle cx="12" cy="20" r="2" fill="#eaffff"/><circle cx="18" cy="47" r="1.8" fill="#eaffff"/>`);
    case 'fireball': return svg(`<path d="M45 45c8-13-5-18-2-32-12 8-24 17-22 32 2 11 20 12 24 0z" fill="#ff6b2a"/><path d="M35 48c7-8-1-13 1-22-7 5-15 11-14 22 1 8 10 8 13 0z" fill="#ffe96b"/>`);
    case 'frost': return svg(`<polygon points="34,6 52,31 34,58 12,34" fill="${c}" stroke="#f5ffff" stroke-width="3"/><path d="M34 8v48M14 34h36M24 22l20 20" stroke="#ffffff" stroke-opacity=".75" stroke-width="2"/>`);
    case 'lightning': return svg(`<polygon points="36,4 14,36 31,34 25,60 51,25 34,27" fill="${c}" stroke="#fff6a8" stroke-width="2"/>`);
    case 'shield': return svg(`<path d="M32 6C48 11 53 15 52 28c-1 15-10 24-20 30-10-6-19-15-20-30C11 15 16 11 32 6z" fill="${soft}" stroke="${c}" stroke-width="4"/><path d="M32 13v36M20 29h24" stroke="#ffffff" stroke-opacity=".55" stroke-width="2"/>`);
    case 'poison': return svg(`<circle cx="25" cy="34" r="15" fill="${soft}"/><circle cx="39" cy="32" r="13" fill="${soft}"/><circle cx="33" cy="23" r="12" fill="${soft}"/><path d="M18 42c9 7 25 7 34-1" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`);
    case 'meteor': return svg(`<path d="M47 13C33 15 14 27 11 47c13-12 25-9 40-28z" fill="#ff6b2a"/><circle cx="36" cy="33" r="13" fill="#3a2118" stroke="#ffb347" stroke-width="3"/><circle cx="32" cy="29" r="4" fill="#ffe96b"/>`);
    case 'drain': return svg(`<path d="M19 15c9 8 9 16 0 25-9-9-9-17 0-25zM34 8c11 11 11 22 0 33-11-11-11-22 0-33zM49 20c8 8 8 15 0 23-8-8-8-15 0-23z" fill="${c}"/>`);
    case 'orbs': return svg(`<circle cx="32" cy="32" r="7" fill="${c}"/><circle cx="32" cy="10" r="6" fill="${c}"/><circle cx="54" cy="32" r="6" fill="${c}"/><circle cx="32" cy="54" r="6" fill="${c}"/><circle cx="10" cy="32" r="6" fill="${c}"/><circle cx="32" cy="32" r="25" fill="none" stroke="${soft}" stroke-width="3"/>`);
    case 'nova': return svg(`<circle cx="32" cy="32" r="10" fill="${c}"/><circle cx="32" cy="32" r="22" fill="none" stroke="${c}" stroke-width="4"/><circle cx="32" cy="32" r="30" fill="none" stroke="${soft}" stroke-width="3"/>`);
    case 'firebreath':
    case 'icebreath':
    case 'earthbreath':
    case 'windbreath': return svg(`<path d="M10 42 Q31 8 58 16 Q46 34 58 52 Q31 56 10 42z" fill="${soft}" stroke="${c}" stroke-width="4"/><path d="M18 41 Q34 29 48 31" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>`);
    default: return svg(`<circle cx="32" cy="32" r="22" fill="${soft}" stroke="${c}" stroke-width="4"/>`);
  }
}

function spellName(s) { return s.variant && VARIANTS[s.variant] ? VARIANTS[s.variant].name : SPELLS[s.id].name; }
function displayTier(id, tier, variantKey) {
  let t = SPELLS[id].tiers[tier];
  if (variantKey && VARIANTS[variantKey] && VARIANTS[variantKey].mod) { t = { ...t }; VARIANTS[variantKey].mod(t); }
  return t;
}
function sameSpell(a, b) { return a.id === b.id && a.tier === b.tier && (a.variant || null) === (b.variant || null); }

// Duplicates are always purchasable now (fusion), so locks never go stale.
function offerStillValid() { return true; }

// Pick an enchant that makes sense for the spell.
function rollEnchant(spellId) {
  const pool = ['vampiric', 'frostbite', 'reach'];
  if (!['fireball', 'meteor', 'nova', 'poison'].includes(spellId)) pool.push('splash');
  if (spellId !== 'orbs') pool.push('echo');
  return pick(pool);
}

function generateShop() {
  const kept = game.shopOffers.filter(o => o.locked && !o.sold && offerStillValid(o));
  game.shopOffers = [];
  for (let i = 0; i < 4; i++) game.shopOffers.push(kept[i] || rollOffer());

  // a legendary perk may appear (wave 8+): equips an enchant on one owned spell.
  // up to 3 spells may be enchanted; a 4th offer can only replace an existing
  // enchant. It cannot be locked and is gone on reroll — buy it now or lose it.
  // (skipped for Rando, whose spellbook re-rolls every wave anyway)
  if (!game.player.stats.rando && game.wave >= 8 && Math.random() < 0.3) {
    const spells = game.player.spells.filter(s => s.id !== 'shield');
    const enchanted = spells.filter(s => s.enchant);
    const fresh = spells.filter(s => !s.enchant);
    const targets = enchanted.length < 3 ? (fresh.length ? fresh : enchanted) : enchanted;
    if (targets.length) {
      const spellRef = pick(targets);
      const slots = game.shopOffers.map((o, i) => (o.locked ? -1 : i)).filter(i => i >= 0);
      if (slots.length) {
        game.shopOffers[pick(slots)] = { kind: 'legendary', spellRef, ench: rollEnchant(spellRef.id) };
      }
    }
  }

  // Last Resort Altar: appears after Last Resort is spent (and not sacrificed).
  // Lets you restore it, upgrade it to a rolled variant, or sacrifice it for power.
  if (!game.player.lastResort && !game.player.lastResortSacrificed && Math.random() < 0.5) {
    const slots = game.shopOffers.map((o, i) => (o.locked ? -1 : i)).filter(i => i >= 0);
    if (slots.length) game.shopOffers[pick(slots)] = { kind: 'lastresort', up: pick(['phoenix', 'vengeful', 'greedy']) };
  }

  // a merchant event sometimes joins the shop as a 5th, highlighted card
  if (game.wave >= 2 && Math.random() < 0.4) {
    const evPool = ['gambler', 'alchemist', 'black'];
    if (game.wave >= 3) evPool.push('demon', 'cursed');     // build-debt bargains
    if (game.wave >= 4 && !game.arcaneLoan) evPool.push('loan'); // one-time
    game.shopOffers.push({ kind: 'event', ev: pick(evPool) });
  }
}

// Merchant events that occasionally appear as a 5th, highlighted shop card.
const SHOP_EVENTS = {
  gambler: {
    icon: '🎰', name: 'The Gambler',
    desc: () => 'Pay for a random item — could be a steal, could be junk.',
    cost: () => 15, can: g => g.gold >= 15,
    label: () => 'Gamble — 15g',
    act: g => { g.gold -= 15; const it = pick(ITEMS); if (it.apply) it.apply(g.player.stats); if (it.proc) addProcItem(it.id); recordItem(it.id); g.player.hp = Math.min(g.player.hp, g.player.stats.maxHp); addText(g.player.x, g.player.y - 40, `Won: ${it.name}!`, '#ffd454', 18); },
  },
  alchemist: {
    icon: '⚗️', name: 'The Alchemist',
    desc: () => 'Transmute 5 max HP into 30 gold.',
    cost: () => 0, can: g => g.player.stats.maxHp > 20,
    label: () => 'Transmute — 5 HP → 30g',
    act: g => { g.player.stats.maxHp -= 5; g.player.hp = Math.min(g.player.hp, g.player.stats.maxHp); g.gold += 30; },
  },
  black: {
    icon: '🕯️', name: 'Black Market',
    desc: () => 'A cursed relic at a steep discount — power with a price.',
    cost: g => Math.round(itemPrice(ITEMS.find(i => i.id === 'skull')) * 0.6),
    can: g => g.gold >= Math.round(itemPrice(ITEMS.find(i => i.id === 'skull')) * 0.6),
    label: g => `Buy — ${Math.round(itemPrice(ITEMS.find(i => i.id === 'skull')) * 0.6)}g`,
    act: g => { const it = pick(ITEMS.filter(i => ['skull', 'glass', 'bloodpact'].includes(i.id))); const c = Math.round(itemPrice(ITEMS.find(i => i.id === 'skull')) * 0.6); g.gold -= c; it.apply(g.player.stats); recordItem(it.id); g.player.hp = Math.min(g.player.hp, g.player.stats.maxHp); addText(g.player.x, g.player.y - 40, `Cursed: ${it.name}`, '#ff5577', 17); },
  },
  // --- "Build debt": power now, a delayed cost next wave ---
  demon: {
    icon: '😈', name: 'Demon Contract', debt: true,
    desc: () => 'Gain 80 gold now. The price: every enemy has +10% HP next wave.',
    cost: () => 0, can: () => true,
    label: () => 'Sign in blood — +80g',
    act: g => { g.gold += 80; g.goldEarned += 80; g.debtHpMult = 1.1; addText(g.player.x, g.player.y - 40, 'The contract is sealed…', '#ff5577', 17); },
  },
  cursed: {
    icon: '🩸', name: 'Cursed Discount', debt: true,
    desc: () => 'Your next 3 purchases are 50% off. The price: enemies move +10% faster next wave.',
    cost: () => 0, can: () => true,
    label: () => 'Accept the curse',
    act: g => { g.discountBuys = 3; g.debtSpdMult = 1.1; addText(g.player.x, g.player.y - 40, 'Bargain struck — 3 cheap buys', '#ffd454', 17); },
  },
  loan: {
    icon: '📜', name: 'Arcane Loan', debt: true,
    desc: () => 'Forever: each reroll has a 50% to gain +3% spell damage and a 10% to lose 5 max HP. You cannot reroll below 6 max HP.',
    cost: () => 0, can: g => !g.arcaneLoan,
    label: () => 'Take the loan',
    act: g => { g.arcaneLoan = true; addText(g.player.x, g.player.y - 40, 'The loan is yours…', '#c47bff', 17); },
  },
};

function rerollCost() {
  return Math.floor(game.wave * 0.8) + 1 + game.rerolls * 2;
}

function openShop() {
  game.player.boughtRelic = false; // Cursed King: did we buy a relic this shop?
  generateShop();
  setState('shop');
  renderShop();
  saveRun(); // between-wave checkpoint
}

function offerPrice(offer) {
  if (offer.kind === 'event' || offer.kind === 'lastresort') return 0; // these price themselves
  // spell prices climb with the wave too (items already scale via itemPrice);
  // the rise steepens in the late/endless game
  const spellWaveMult = 1 + (game.wave - 1) * 0.06 + Math.max(0, game.wave - 12) * 0.02;
  const base = offer.kind === 'item' ? itemPrice(offer.item)
    : offer.kind === 'legendary' ? 100 + game.wave * 5
    : offer.kind === 'phoenix' ? 120 + game.wave * 4
    : SPELLS[offer.id].tiers[offer.tier].price * spellWaveMult;
  const discount = 1 - (game.pendingShopDiscount || 0);
  // Gambler: each offer carries a stable, wildly-varying price multiplier
  if (game.player.stats.gambler && offer.priceRng === undefined) offer.priceRng = rand(0.5, 1.7);
  const gamble = offer.priceRng || 1;
  // Cursed Discount: the next few purchases are 50% off
  const debtDiscount = game.discountBuys > 0 ? 0.5 : 1;
  return Math.max(1, Math.round(base * game.player.stats.priceMult * discount * gamble * debtDiscount));
}

function renderShop() {
  const p = game.player;
  document.getElementById('shop-title').textContent = `SHOP — before wave ${game.wave + 1}`;
  document.getElementById('shop-gold').textContent = `💰 ${game.gold} gold`;

  // stats panel
  const s = p.stats;
  const armor = s.armor + 2 * (game.elem ? game.elem.earth : 0); // includes Earth meta-class
  const statsEl = document.getElementById('shop-stats');
  statsEl.innerHTML = '<h3>Your Wizard</h3>' + [
    ['Max HP', Math.round(s.maxHp)],
    ['HP Regen', s.regen.toFixed(1) + '/s'],
    ['Damage', '+' + Math.round((s.dmgMult - 1) * 100) + '%'],
    ['Cooldowns', '-' + Math.round((1 - s.cdMult) * 100) + '%'],
    ['Crit', Math.round(s.crit * 100) + '%'],
    ['Speed', '+' + Math.round((s.speedMult - 1) * 100) + '%'],
    ['Armor', `${armor} (−${armor}/hit)`, `Every hit you take is reduced by ${armor} damage (always at least 1 taken). The Duelist Robe adds more while few enemies are near. Example: a ${Math.max(armor + 5, 10)} damage hit deals ${Math.max(1, Math.max(armor + 5, 10) - armor)} to you.`],
    ['Pickup', Math.round(s.pickup)],
    ['Materials', '+' + Math.round((s.matMult - 1) * 100) + '%'],
    ['Gold Budget', (game.budget || 0) + ' ×2', `Each point doubles the next gold coin you collect. Built from uncollected gold at wave end.`],
    ['Level', game.level],
    ['Last Resort',
      p.lastResortSacrificed ? '✖ Sacrificed'
        : p.lastResort ? `${LAST_RESORT_TYPES[p.lastResortType || 'basic'].icon} Ready`
        : '✖ Spent',
      p.lastResortSacrificed ? 'Traded away forever for +25% damage.'
        : LAST_RESORT_TYPES[p.lastResortType || 'basic'].desc + (p.lastResort ? '' : ' (spent — visit the altar to restore it)')],
  ].map(([k, v, tip]) => `<div class="stat-line"${tip ? ` title="${tip}"` : ''}><span>${k}${tip ? ' ⓘ' : ''}</span><span>${v}</span></div>`).join('');
  // active "build debt" effects
  const debts = [];
  if (game.discountBuys > 0) debts.push(['Cheap buys', `${game.discountBuys} left (−50%)`, 'Cursed Discount: your next purchases are half price.']);
  if (game.arcaneLoan) debts.push(['Arcane Loan', '📜 active', 'Each reroll: 50% +3% damage, 10% −5 max HP. No rerolls below 6 max HP.']);
  if (game.debtHpMult > 1 || game.debtSpdMult > 1) {
    const bits = [];
    if (game.debtHpMult > 1) bits.push(`+${Math.round((game.debtHpMult - 1) * 100)}% HP`);
    if (game.debtSpdMult > 1) bits.push(`+${Math.round((game.debtSpdMult - 1) * 100)}% speed`);
    debts.push(['Next wave', '⚠ enemies ' + bits.join(' & '), 'A contract you signed strengthens the next wave of enemies.']);
  }
  if (debts.length) {
    statsEl.innerHTML += '<h3 style="margin-top:10px;color:#ff9aae">Debts</h3>' +
      debts.map(([k, v, tip]) => `<div class="stat-line" title="${tip}"><span>${k} ⓘ</span><span style="color:#ff9aae">${v}</span></div>`).join('');
  }

  // owned items
  if (p.items && p.items.length) {
    const chips = p.items.map(it => {
      const def = ITEMS.find(i => i.id === it.id);
      const icon = def ? def.icon : '❔';
      const name = def ? def.name : it.id;
      return `<span class="item-chip" title="${name}${def ? ' — ' + def.desc : ''}">${icon}${it.n > 1 ? '<b>×' + it.n + '</b>' : ''}</span>`;
    }).join('');
    statsEl.innerHTML += `<h3 style="margin-top:10px">Items</h3><div class="item-chips">${chips}</div>`;
  }

  // offers
  const row = document.getElementById('shop-offers');
  row.innerHTML = '';
  game.shopOffers.forEach((offer, idx) => {
    const card = document.createElement('div');
    card.className = 'card' + (offer.locked ? ' locked' : '') + (offer.kind === 'legendary' ? ' legendary' : '');
    const price = offerPrice(offer);
    if (offer.sold) {
      card.innerHTML = `<div class="icon">✔️</div><div class="desc">Sold</div>`;
      row.appendChild(card);
      return;
    }
    if (offer.kind === 'event') {
      card.className = 'card event';
      const ev = SHOP_EVENTS[offer.ev];
      const cost = ev.cost(game);
      card.innerHTML = `
        <div class="icon">${ev.icon}</div>
        <div class="name">${ev.name}</div>
        <div class="tier-badge" style="color:#ffd454">✦ Event</div>
        <div class="desc">${signColor(ev.desc(game))}</div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn legendary-btn';
      btn.textContent = ev.label(game);
      btn.disabled = !ev.can(game);
      btn.onclick = () => { ev.act(game); offer.sold = true; sfx(ev.debt ? 'shopLegendary' : 'shopBuy'); renderShop(); saveRun(); };
      card.appendChild(btn);
      row.appendChild(card);
      return;
    }
    if (offer.kind === 'lastresort') {
      card.className = 'card legendary';
      const up = LAST_RESORT_TYPES[offer.up];
      const restoreCost = Math.round((90 + game.wave * 4) * p.stats.priceMult);
      const upCost = Math.round((150 + game.wave * 6) * p.stats.priceMult);
      card.innerHTML = `
        <div class="icon">⚰️</div>
        <div class="name">Last Resort Altar</div>
        <div class="tier-badge" style="color:#ffd454">⭐ Legendary</div>
        <div class="desc">Your Last Resort is spent. Bargain with the altar:</div>
        <div class="stat-lines">
          <b style="color:${up.color}">${up.icon} ${up.name}</b><br>${signColor(up.desc)}
          <br><i>…or sacrifice it forever for +25% damage.</i>
        </div>`;
      const mkBtn = (label, disabled, fn) => {
        const b = document.createElement('button');
        b.className = 'buy-btn legendary-btn'; b.textContent = label; b.disabled = disabled;
        b.onclick = fn; card.appendChild(b);
      };
      mkBtn(`Restore — ${restoreCost}g`, game.gold < restoreCost, () => {
        game.gold -= restoreCost; p.lastResort = true; p.lastResortType = 'basic';
        offer.sold = true; sfx('shopLegendary'); addText(p.x, p.y - 40, 'Last Resort restored!', '#ffd454', 20); renderShop(); saveRun();
      });
      mkBtn(`${up.icon} Upgrade — ${upCost}g`, game.gold < upCost, () => {
        game.gold -= upCost; p.lastResort = true; p.lastResortType = offer.up;
        offer.sold = true; sfx('shopLegendary'); addText(p.x, p.y - 40, `${up.name}!`, up.color, 20); renderShop(); saveRun();
      });
      mkBtn('Sacrifice → +25% dmg', false, () => {
        p.stats.dmgMult += 0.25; p.lastResortSacrificed = true; p.lastResort = false;
        offer.sold = true; sfx('shopSell'); addText(p.x, p.y - 40, 'Last Resort sacrificed — +25% damage', '#ff5577', 18); renderShop(); saveRun();
      });
      row.appendChild(card);
      return;
    }
    if (offer.kind === 'legendary') {
      const sp = offer.spellRef;
      const stillOwned = p.spells.includes(sp) && !sp.enchant;
      const def = SPELLS[sp.id];
      const en = ENCHANTS[offer.ench];
      const hasOther = p.spells.some(s => s !== sp && s.enchant);
      card.innerHTML = `
        <div class="icon">${en.icon}</div>
        <div class="name">Legendary: ${en.name}</div>
        <div class="tier-badge" style="color:#ffd454">⭐ Legendary</div>
        <div class="desc">${stillOwned ? `Equips on your <b>${def.icon} ${def.name}</b>` : 'The spell is gone…'}</div>
        <div class="stat-lines">${signColor(en.desc)}<br><i>Only one legendary can be equipped${hasOther ? ' — replaces your current one' : ''}</i><br><i>Cannot be locked — now or never!</i></div>`;
      const btn = document.createElement('button');
      btn.className = 'buy-btn legendary-btn';
      btn.textContent = `Equip — ${price}g`;
      btn.disabled = game.gold < price || !stillOwned;
      btn.onclick = () => buyOffer(idx);
      card.appendChild(btn);
      row.appendChild(card);
      return;
    }
    if (offer.kind === 'spell') {
      const def = SPELLS[offer.id];
      const t = displayTier(offer.id, offer.tier, offer.variant);
      const tc = offer.variant ? '#ff9adf' : TIER_COLORS[offer.tier];
      const tags = (def.elements || []).map(e => `<span class="tag" style="color:${ELEMENTS[e].color}">${ELEMENTS[e].icon} ${ELEMENTS[e].name}</span>`).join(' ');
      const copies = p.spells.filter(s => sameSpell(s, offer)).length;
      // fusion preview: current → next-tier stat comparison
      let fuseCompare = '';
      if (copies && offer.tier < 3) {
        const nt = displayTier(offer.id, offer.tier + 1, offer.variant);
        const rows = [];
        if (t.dmg) rows.push(['Damage', t.dmg, nt.dmg]);
        if (t.dps) rows.push(['DPS', t.dps, nt.dps]);
        if (t.cd) rows.push(['Cooldown', t.cd.toFixed(2) + 's', nt.cd.toFixed(2) + 's']);
        const dpsNow = dpsEstimate(t), dpsNext = dpsEstimate(nt);
        if (dpsNow) rows.push(['~DPS', dpsNow, dpsNext]);
        // fusion payoff: T3 upgrades the visuals, T4 unlocks a perfected behavior
        const nextTier = offer.tier + 1;
        let bonus = '';
        if (nextTier === 2) bonus = `<div class="fc-bonus" style="color:#c47bff">✨ Tier III — empowered cast visuals</div>`;
        else if (nextTier === 3 && def.perfected) bonus = `<div class="fc-bonus" style="color:#ffd454">⭐ Perfected: ${def.perfected}</div>`;
        fuseCompare = `<div class="fuse-compare">${rows.map(([k, a, b]) =>
          `<div class="fc-row"><span>${k}</span><span>${a} → <b>${b}</b></span></div>`).join('')}${bonus}</div>`;
      }
      card.innerHTML = `
        ${spellShopIcon(offer.id)}
        <div class="name">${spellName(offer)}</div>
        <div class="tier-badge" style="color:${tc}">${offer.variant ? '✦ Variant · ' : ''}Tier ${TIER_NAMES[offer.tier]}</div>
        <div class="tags">${tags}</div>
        ${offer.variant ? `<div class="upgrade-tag" style="color:#ff9adf">${VARIANTS[offer.variant].desc}</div>` : ''}
        ${copies ? '<div class="upgrade-tag">⚗ You own a copy — buy to fuse!</div>' : ''}
        <div class="desc">${def.desc}</div>
        <div class="stat-lines">${def.lines(t).join('<br>')}</div>
        ${fuseCompare}`;
    } else {
      const it = offer.item;
      card.innerHTML = `
        <div class="icon">${it.icon}</div>
        <div class="name">${it.name}</div>
        <div class="tier-badge" style="color:#9aa7b8">Item</div>
        <div class="desc">${signColor(it.desc)}</div>`;
      // hover details
      card.onmousemove = e => showTooltip(`<div class="tt-title">${it.icon} ${it.name}</div><div class="tt-sec">${signColor(it.desc)}</div>${it.proc ? '<div class="tt-sec">Triggers a timed combat effect.</div>' : ''}`, e.clientX, e.clientY);
      card.onmouseleave = hideTooltip;
    }
    const lockBtn = document.createElement('button');
    lockBtn.className = 'lock-btn' + (offer.locked ? ' on' : '');
    lockBtn.textContent = offer.locked ? '🔒' : '🔓';
    lockBtn.title = offer.locked
      ? 'Unlock — this offer will be rerolled normally'
      : 'Lock — keep this offer through rerolls and into the next shop';
    lockBtn.onclick = () => { offer.locked = !offer.locked; sfx('shopLock'); renderShop(); };
    card.appendChild(lockBtn);
    const btn = document.createElement('button');
    btn.className = 'buy-btn';
    const noSlot = offer.kind === 'spell' && p.spells.length >= slotCap();
    btn.textContent = noSlot ? 'Spellbook full' : `Buy — ${price}g`;
    btn.disabled = game.gold < price || noSlot;
    btn.onclick = () => buyOffer(idx);
    card.appendChild(btn);
    // buy & fuse: directly upgrade an owned same-tier copy, no slot needed
    if (offer.kind === 'spell' && offer.tier < 3 &&
        p.spells.some(s => sameSpell(s, offer))) {
      const fuseBuy = document.createElement('button');
      fuseBuy.className = 'buy-btn fuse-buy-btn';
      fuseBuy.textContent = `Buy & Fuse → T${TIER_NAMES[offer.tier + 1]} — ${price}g`;
      fuseBuy.disabled = game.gold < price;
      fuseBuy.onclick = () => buyOffer(idx, true);
      card.appendChild(fuseBuy);
    }
    row.appendChild(card);
  });

  // owned spells panel
  const owned = document.getElementById('shop-owned');
  let html = `<h3>Spellbook (${p.spells.length}/${slotCap()})</h3>`;
  // find fusable pairs: two copies of the same spell at the same tier (< max)
  const fusePartner = {};
  p.spells.forEach((sp, i) => {
    if (fusePartner[i] !== undefined || sp.tier >= 3) return;
    for (let j = i + 1; j < p.spells.length; j++) {
      const other = p.spells[j];
      if (sameSpell(other, sp) && fusePartner[j] === undefined) {
        fusePartner[i] = j; fusePartner[j] = i;
        break;
      }
    }
  });
  p.spells.forEach((sp, i) => {
    const def = SPELLS[sp.id];
    const tc = TIER_COLORS[sp.tier];
    const sellVal = Math.max(1, Math.floor(def.tiers[sp.tier].price / 2));
    const j = fusePartner[i];
    const fc = p.stats.collector ? manualFuseCost(sp) : 0;
    // Rando's book re-rolls each wave, so fusing/selling it is disabled
    const fuseHtml = (!p.stats.rando && j !== undefined && j > i)
      ? `<button class="fuse-btn" data-i="${i}" data-j="${j}" ${fc && game.gold < fc ? 'disabled' : ''} title="Fuse both copies into one Tier ${TIER_NAMES[sp.tier + 1]}${fc ? ` (+15% damage, costs ${fc}g)` : ''}">⚗ Fuse${fc ? ` ${fc}g` : ''}</button>`
      : '';
    html += `<div class="owned-spell" data-idx="${i}">
      <span class="hotkey">[${keyLabel(slotKeys[i])}]</span>
      ${spellShopIcon(sp.id)}
      <div class="info"><div class="nm">${spellName(sp)}</div><div class="tr" style="color:${tc}">Tier ${TIER_NAMES[sp.tier]} · ${'★'.repeat(game.masteryLvl[sp.id] || 0)}${'☆'.repeat(5 - (game.masteryLvl[sp.id] || 0))}</div>${sp.tier === 3 && def.perfected ? `<div class="ench" style="color:#ffd454" title="Perfected">⭐ ${def.perfected}</div>` : ''}${sp.enchant ? `<div class="ench">⭐ ${ENCHANTS[sp.enchant].name}</div>` : ''}</div>
      ${fuseHtml}
      <div class="move-btns">
        <button class="move-btn" data-idx="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="move-btn" data-idx="${i}" data-dir="1" ${i === p.spells.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      ${p.stats.rando ? '<span class="empty-slot" style="font-size:11px">🎲 re-rolls next wave</span>' : `<button class="sell-btn" data-idx="${i}">Sell ${sellVal}g</button>`}
    </div>`;
  });
  for (let i = p.spells.length; i < slotCap(); i++) {
    html += `<div class="empty-slot">[${keyLabel(slotKeys[i])}] — empty slot —</div>`;
  }
  // equipped legendaries shown as their own items below the spellbook
  const enchanted = p.spells.filter(s => s.enchant);
  if (enchanted.length) {
    html += `<h3 style="margin-top:12px">Legendaries (${enchanted.length}/3)</h3>`;
    for (const sp of enchanted) {
      const en = ENCHANTS[sp.enchant], def = SPELLS[sp.id];
      html += `<div class="owned-spell legend-row" title="${en.desc}">
        <div class="icon">${en.icon}</div>
        <div class="info"><div class="nm" style="color:#ffd454">${en.name}</div><div class="tr">on ${def.icon} ${spellName(sp)}</div></div>
      </div>`;
    }
  }
  owned.innerHTML = html;
  owned.querySelectorAll('.sell-btn').forEach(btn => {
    btn.onclick = () => sellSpell(+btn.dataset.idx);
  });
  owned.querySelectorAll('.fuse-btn').forEach(btn => {
    btn.onclick = () => fuseSpells(+btn.dataset.i, +btn.dataset.j);
  });
  owned.querySelectorAll('.move-btn').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.idx, j = i + (+btn.dataset.dir);
      [p.spells[i], p.spells[j]] = [p.spells[j], p.spells[i]];
      sfx('shopLock');
      renderShop();
    };
  });
  owned.querySelectorAll('.owned-spell').forEach(rowEl => {
    const sp = p.spells[+rowEl.dataset.idx];
    if (!sp) return;
    rowEl.onmousemove = e => showTooltip(spellDetailHtml(sp), e.clientX, e.clientY);
    rowEl.onmouseleave = hideTooltip;
  });

  // buttons
  const rrBtn = document.getElementById('btn-reroll');
  const loanLocked = game.arcaneLoan && p.stats.maxHp < 6;
  rrBtn.textContent = loanLocked ? 'Reroll locked (max HP < 6)' : `Reroll — ${rerollCost()}g${game.arcaneLoan ? ' 📜' : ''}`;
  rrBtn.disabled = loanLocked || game.gold < rerollCost();
  rrBtn.title = game.arcaneLoan ? 'Arcane Loan: each reroll may grant +3% damage or cost 5 max HP' : '';

  renderShopMeter();
  renderBuildSummary();
  renderWaveOverview('shop-overview', game.wave + 1);
}

// Type/details of a given wave for the roadmap.
function waveInfo(w) {
  const bc = bossCountForWave(w);
  if (bc) return { icon: '👑', label: 'Boss' + (bc > 1 ? ' ×' + bc : ''), color: '#aa66ff' };
  if (isHordeWave(w)) return { icon: '🐝', label: 'Horde', color: '#ff8a5a' };
  if (isEliteWave(w)) return { icon: '⭐', label: 'Elite', color: '#ff5577' };
  const combo = comboForWave(w);
  if (combo && COMBOS[combo]) return { icon: '🎯', label: COMBOS[combo].name, color: COMBOS[combo].color };
  return { icon: '•', label: 'Normal', color: '#7e8ca3' };
}

// Wave roadmap — a small paginated window (1 previous + current + next 3) you can
// scroll through with the ◀ ▶ arrows. Offset is kept while you page, and resets
// whenever a new shop/pause opens (i.e. when the "current wave" changes).
const WO_WINDOW = 5; // chips visible at once
let woOffset = 0, woLastCurrent = null;

function renderWaveOverview(elId, currentW) {
  const el = document.getElementById(elId);
  if (!el) return;
  const maxW = Math.max(20, game.wave + 3);
  if (currentW !== woLastCurrent) { woOffset = 0; woLastCurrent = currentW; } // fresh open → recenter
  const base = currentW - 1;                       // one wave before the current
  const lastStart = Math.max(1, maxW - WO_WINDOW + 1);
  let start = Math.min(Math.max(base + woOffset, 1), lastStart);
  woOffset = start - base;                          // normalise so arrow stepping stays smooth
  const end = Math.min(maxW, start + WO_WINDOW - 1);

  let chips = '';
  for (let w = start; w <= end; w++) {
    const info = waveInfo(w);
    let cls = 'wo-chip';
    if (w < currentW) cls += ' done';
    else if (w === currentW) cls += ' current';
    // the realm this wave will be fought in (decided at run start)
    const rid = game.realmSchedule && game.realmSchedule[w];
    const rt = rid && ELEMENT_THEMES[rid];
    const realmPip = rt ? `<span class="wo-realm" style="color:${rt.wall}" title="${rt.name}">${rt.icon}</span>` : '';
    const realmName = rt ? ` · ${rt.name}` : '';
    chips += `<div class="${cls}" style="--wc:${info.color}" title="Wave ${w} — ${info.label}${realmName}">
      <span class="wo-n">${w}</span><span class="wo-i">${info.icon}</span><span class="wo-l">${info.label}</span>${realmPip}</div>`;
  }
  const realm = game.mapElement ? `${ELEMENT_THEMES[game.mapElement].icon} ${ELEMENT_THEMES[game.mapElement].name}` : 'Endless — no realm';
  const dgr = game.danger > 0 ? ` · ☠ +${Math.round(game.danger * 100)}%` : '';
  const mod = game.modifier ? ` · ${game.modifier.icon} ${game.modifier.name}` : '';
  el.innerHTML = `<div class="wo-head">Wave ${game.wave}${game.endless ? ' (Endless)' : ' / 20'} · ${realm}${dgr}${mod}</div>
    <div class="wo-row">
      <button class="wo-arrow" data-dir="-1" ${start <= 1 ? 'disabled' : ''} title="Earlier waves">◀</button>
      <div class="wo-strip">${chips}</div>
      <button class="wo-arrow" data-dir="1" ${end >= maxW ? 'disabled' : ''} title="Later waves">▶</button>
    </div>`;
  el.querySelectorAll('.wo-arrow').forEach(b => {
    b.onclick = () => { woOffset += (+b.dataset.dir); renderWaveOverview(elId, currentW); };
  });
}

// Build archetypes: recognisable strategies, scored from owned spells/items/enchants
// so the shop can name the build forming and recommend what to look for next.
const ARCHETYPES = [
  { name: 'Fire AoE',        color: '#ff8c42', spells: ['fireball', 'meteor', 'nova', 'firebreath'], items: ['ember'], ench: null,
    rec: 'Meteor, Holy Nova, Ember Crown, the Reach legendary, or +AoE size' },
  { name: 'Orbital',         color: '#c47bff', spells: ['orbs'], items: ['lens', 'talisman', 'robe', 'anchor', 'magnet'], ench: null,
    rec: 'more Arcane Orbs, Orbital Lens, armor, or pickup range' },
  { name: 'Lightning Crit',  color: '#ffe96b', spells: ['lightning'], items: ['clover', 'needle', 'stormbat'], ench: null,
    rec: 'Chain Lightning, Lucky Clover, Storm Needle, or crit chance' },
  { name: 'Drain Tank',      color: '#ff7da0', spells: ['drain', 'shield'], items: ['ring', 'bloodpact', 'heart'], ench: 'vampiric',
    rec: 'Life Drain, Arcane Shield, HP regen, or the Vampiric legendary' },
  { name: 'Poison Control',  color: '#9be05a', spells: ['poison', 'frost', 'icebreath'], items: ['fcore', 'brittle'], ench: 'frostbite',
    rec: 'Poison Cloud, the Venom variant, Frozen Core, or slows' },
];

// Scores each archetype against the current build; returns the leading one (or null).
function detectArchetype() {
  const p = game.player;
  let best = null, bestScore = 0;
  for (const a of ARCHETYPES) {
    let score = 0;
    for (const sp of p.spells) if (a.spells.includes(sp.id)) score += 2 + sp.tier * 0.5;
    for (const it of (p.items || [])) if (a.items.includes(it.id)) score += 1.5 * it.n;
    if (a.ench && p.spells.some(sp => sp.enchant === a.ench)) score += 2;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 2 ? best : null; // need at least a core spell to commit to a label
}

// Compact "build identity" read-out so casual players understand their run.
function renderBuildSummary() {
  const el = document.getElementById('shop-summary');
  if (!el) return;
  recomputeElements();
  const p = game.player, s = p.stats;
  // active meta-class stacks
  const elemHtml = Object.entries(game.elem).filter(([, n]) => n > 0)
    .map(([k, n]) => `<span class="elem-pip" style="color:${ELEMENTS[k].color}" title="${ELEMENTS[k].name}: ${ELEMENTS[k].desc}">${ELEMENTS[k].icon}${n}</span>`).join(' ');
  // dominant damage type from owned spell tags
  const tagDmg = {};
  for (const sp of p.spells) for (const tag of (SPELLS[sp.id].tags || [])) tagDmg[tag] = (tagDmg[tag] || 0) + sp.tier + 1;
  const topTag = Object.entries(tagDmg).sort((a, b) => b[1] - a[1])[0];
  // best DPS spell from the wave that just ended
  const t = Math.max(1, game.waveTime);
  const meter = Object.entries(game.dmgMeter).sort((a, b) => b[1] - a[1])[0];
  const bestSpell = meter && SPELLS[meter[0]] ? SPELLS[meter[0]] : null;
  // weakness heuristic + a suggestion
  let weakness = 'well rounded', suggestion = 'fuse spells to scale up';
  if (s.speedMult < 0.95) { weakness = 'slow on your feet'; suggestion = 'buy Swift Boots or a speed level-up'; }
  else if (s.armor <= 0 && s.maxHp <= 60) { weakness = 'fragile'; suggestion = 'grab armor, max HP, or Arcane Shield'; }
  else if (s.dmgMult < 1) { weakness = 'low damage'; suggestion = 'buy a Tome of Power or fuse a spell'; }
  else if (p.spells.length < 3) { weakness = 'thin spellbook'; suggestion = 'add more spells for coverage'; }
  // build archetype + a "look for these next" recommendation
  const arch = detectArchetype();
  const archLine = arch
    ? `<div class="sum-line"><span>Build</span><span style="color:${arch.color};font-weight:700">${arch.name}</span></div>`
    : `<div class="sum-line"><span>Build</span><span style="color:#9aa7b8">forming…</span></div>`;
  const tip = arch
    ? `🎯 Your build is becoming <b style="color:${arch.color}">${arch.name}</b>. Look for ${arch.rec}.`
    : `💡 ${suggestion}`;
  el.innerHTML = `<h3>Build Identity</h3>
    ${archLine}
    <div class="sum-line"><span>Theme</span><span style="color:${topTag ? (TAG_COLORS[topTag[0]] || '#fff') : '#9aa7b8'}">${topTag ? topTag[0][0].toUpperCase() + topTag[0].slice(1) : 'mixed'}</span></div>
    <div class="sum-line"><span>Elements</span><span>${elemHtml || '—'}</span></div>
    <div class="sum-line"><span>Top damage</span><span>${bestSpell ? bestSpell.icon + ' ' + bestSpell.name : '—'}</span></div>
    <div class="sum-line"><span>Spellbook</span><span>${p.spells.length}/${slotCap()}</span></div>
    <div class="sum-line"><span>Weakness</span><span style="color:#ff9aae">${weakness}</span></div>
    <div class="sum-tip">${tip}</div>`;
}

// Full damage report for the wave that just ended (bottom left of the shop).
function renderShopMeter() {
  const el = document.getElementById('shop-meter');
  const entries = Object.entries(game.dmgMeter)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const t = Math.max(1, game.waveTime);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  let html = `<h3>Wave ${game.wave} Damage — ${t.toFixed(0)}s</h3>`;
  for (const [id, v] of entries) {
    const def = SPELLS[id];
    html += `<div class="meter-row" data-id="${id}">
      <span class="mname">${def.icon} ${def.name}</span>
      <span class="mnums">${formatNum(v)} <em>${formatNum(v / t)}/s</em> <b>${Math.round((v / total) * 100)}%</b></span>
    </div>`;
  }
  html += `<div class="meter-row total">
    <span class="mname">Total</span>
    <span class="mnums">${formatNum(total)} <em>${formatNum(total / t)}/s</em></span>
  </div>`;
  el.innerHTML = html;
  el.querySelectorAll('.meter-row[data-id]').forEach(rowEl => {
    const id = rowEl.dataset.id;
    const sp = game.player.spells.find(s => s.id === id) || { id, tier: 0 };
    rowEl.onmousemove = e => showTooltip(spellDetailHtml(sp), e.clientX, e.clientY);
    rowEl.onmouseleave = hideTooltip;
  });
}

function buyOffer(idx, fuse) {
  const offer = game.shopOffers[idx];
  if (!offer || offer.sold) return;
  const price = offerPrice(offer);
  if (game.gold < price) { sfx('shopDeny'); return; }
  const p = game.player;

  if (offer.kind === 'spell') {
    if (fuse) {
      // buy & fuse: upgrade an owned same-tier (+ same variant) copy directly
      const owned = p.spells.find(s => sameSpell(s, offer) && s.tier < 3);
      if (!owned) { sfx('shopDeny'); return; }
      owned.tier++;
      owned.t = 0;
      if (p.stats.collector) owned.fuseBonus = (owned.fuseBonus || 0) + 0.15; // Collector: fused spell hits harder
      sfx('shopFuse');
    } else {
      if (p.spells.length >= slotCap()) { sfx('shopDeny'); return; } // no free slot
      p.spells.push({ id: offer.id, tier: offer.tier, t: 0, auto: true, variant: offer.variant });
    }
  } else if (offer.kind === 'legendary') {
    const sp = offer.spellRef;
    if (!p.spells.includes(sp)) { sfx('shopDeny'); return; } // the target spell was sold
    // up to 3 spells may carry an enchant; replacing this spell's own is free room
    const enchantedCount = p.spells.filter(s => s.enchant).length;
    if (!sp.enchant && enchantedCount >= 3) { sfx('shopDeny'); return; } // no room for a new enchant
    sp.enchant = offer.ench; // replaces this spell's own enchant if it had one
    addText(p.x, p.y - 40, `${SPELLS[sp.id].name}: ${ENCHANTS[offer.ench].name} equipped!`, '#ffd454', 20);
    sfx('shopLegendary');
  } else if (offer.kind === 'phoenix') {
    p.lastResort = true;
    addText(p.x, p.y - 40, 'Last Resort restored!', '#ffd454', 20);
    sfx('shopLegendary');
  } else {
    if (offer.item.apply) offer.item.apply(p.stats);
    if (offer.item.proc) addProcItem(offer.item.id);
    recordItem(offer.item.id);
    // Gambler: items have a 40% chance to apply a second time
    if (p.stats.gambler && Math.random() < 0.4) {
      if (offer.item.apply) offer.item.apply(p.stats);
      if (offer.item.proc) addProcItem(offer.item.id);
      recordItem(offer.item.id);
      addText(p.x, p.y - 40, `LUCKY! Double ${offer.item.name}`, '#ffd454', 18);
    }
    p.boughtRelic = true; // Cursed King: a relic was bought this shop
    p.hp = Math.min(p.hp, p.stats.maxHp);
  }
  game.gold -= price;
  if (game.discountBuys > 0) game.discountBuys--; // Cursed Discount: spend a cheap purchase
  offer.sold = true;
  if (offer.kind === 'spell' && !fuse) sfx('shopSpell');
  else if (offer.kind === 'item') sfx('shopBuy');
  renderShop();
  saveRun();
}

function sellSpell(i) {
  const p = game.player;
  if (p.spells.length <= 1) return; // keep at least one spell
  const sp = p.spells[i];
  if (!sp) return;
  const sellVal = Math.max(1, Math.floor(SPELLS[sp.id].tiers[sp.tier].price / 2));
  p.spells.splice(i, 1);
  game.gold += sellVal;
  sfx('shopSell');
  renderShop();
  saveRun();
}

// Merge two copies of the same spell (same tier) into one copy a tier higher.
function fuseSpells(i, j) {
  const p = game.player;
  const a = p.spells[i], b = p.spells[j];
  if (!a || !b || !sameSpell(a, b) || a.tier >= 3) return;
  // Collector: manual fusion costs gold (half the spell's tier price)
  if (p.stats.collector) {
    const cost = manualFuseCost(a);
    if (game.gold < cost) { sfx('shopDeny'); return; }
    game.gold -= cost;
    a.fuseBonus = (a.fuseBonus || 0) + 0.15; // …but the fused spell hits harder
  }
  a.tier++;
  a.t = 0;
  p.spells.splice(j, 1);
  sfx('shopFuse');
  renderShop();
  saveRun();
}

// Collector's manual fusion price for a given spell copy.
function manualFuseCost(sp) {
  return Math.max(1, Math.floor(SPELLS[sp.id].tiers[sp.tier].price * 0.5));
}

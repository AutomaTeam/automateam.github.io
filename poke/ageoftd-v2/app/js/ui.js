// ============================================================
// AgeOfTD V2 — ui.js : HUD, boutique, panneaux, bannières, modales
// ============================================================
'use strict';

TD.ui = (() => {
  const U = TD.util;
  const $ = id => document.getElementById(id);
  let els = {};
  let stageScale = 1;
  let bannerTimer = null;

  // ── init ─────────────────────────────────────────────────
  function init() {
    els = {
      stage: $('stage'), hud: $('hud'), menu: $('menu'), modal: $('modal'),
      goldV: $('goldV'), livesV: $('livesV'), waveV: $('waveV'), goldPill: $('goldPill'), livesPill: $('livesPill'),
      callBtn: $('callBtn'), pauseBtn: $('pauseBtn'),
      shop: $('shop'), towerPanel: $('towerPanel'), tooltip: $('tooltip'),
      banners: $('banners'), charmsBar: $('charmsBar'),
      bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'), bossShield: $('bossShield'),
      enemiesV: $('enemiesV'), manaV: $('manaV'), spellbar: $('spellbar'), objectives: $('objectives'),
      woodV: $('woodV'), stoneV: $('stoneV'), weatherPill: $('weatherPill'), weatherV: $('weatherV'),
    };
    buildShop();
    buildSpellbar();
    buildMapPicker();
    els.callBtn.addEventListener('click', () => { TD.audio.sfx('click'); TD.net.send({ k: 'wave' }); });
    els.pauseBtn.addEventListener('click', () => { TD.audio.sfx('click'); showPause(); });
    $('heroDeploy').addEventListener('click', () => { TD.audio.sfx('click'); TD.game.armHero(); });
    $('heroTalent').addEventListener('click', () => { TD.audio.sfx('click'); showHeroTalents(); });
    document.querySelectorAll('.spd').forEach(b => {
      b.addEventListener('click', () => {
        TD.audio.sfx('click');
        TD.net.send({ k: 'speed', v: parseInt(b.dataset.s, 10) });
        document.querySelectorAll('.spd').forEach(x => x.classList.toggle('on', x === b));
      });
    });
    // menu principal
    document.querySelectorAll('.diffCard').forEach(b => {
      b.addEventListener('click', () => {
        TD.audio.sfx('click');
        document.querySelectorAll('.diffCard').forEach(x => x.classList.toggle('on', x === b));
      });
    });
    $('playBtn').addEventListener('click', () => {
      TD.audio.ensure();
      TD.audio.sfx('upgrade');
      const d = document.querySelector('.diffCard.on') || document.querySelector('.diffCard[data-d="normal"]');
      TD.game.start(d.dataset.d);
    });
    $('helpBtn').addEventListener('click', () => { TD.audio.ensure(); TD.audio.sfx('click'); showHelp(); });
    $('menuSettingsBtn').addEventListener('click', () => { TD.audio.ensure(); TD.audio.sfx('click'); showSettings(false); });
    $('coopBtn').addEventListener('click', () => { TD.audio.ensure(); TD.audio.sfx('click'); showCoop(); });
    $('metaBtn').addEventListener('click', () => { TD.audio.ensure(); TD.audio.sfx('click'); showMeta(); });
    $('dailyBtn').addEventListener('click', () => { TD.audio.ensure(); TD.audio.sfx('click'); showDaily(); });
  }

  // ── boutique ─────────────────────────────────────────────
  function buildShop() {
    els.shop.innerHTML = '';
    for (const key of TD.towers.ORDER) {
      const d = TD.towers.DEFS[key];
      const card = document.createElement('button');
      card.className = 'shopCard';
      card.id = 'shop_' + key;
      card.innerHTML = `
        <div class="scIcon" style="--c:${d.color}">${d.icon}</div>
        <div class="scName">${d.name}</div>
        <div class="scCost">🪙 ${d.cost}${d.wood ? ' 🪵' + d.wood : ''}${d.stone ? ' 🪨' + d.stone : ''}</div>
        <div class="scLock">🔒 <span></span></div>`;
      card.addEventListener('click', () => {
        TD.audio.sfx('click');
        TD.game.selectShop(key);
      });
      card.addEventListener('mouseenter', () => showShopTooltip(key, card));
      card.addEventListener('mouseleave', hideTooltip);
      els.shop.appendChild(card);
    }
    // carte âge suivant
    const age = document.createElement('button');
    age.className = 'shopCard ageCard';
    age.id = 'ageCard';
    age.addEventListener('click', () => { TD.net.send({ k: 'age' }); });
    els.shop.appendChild(age);
  }

  // ── barre de sorts ───────────────────────────────────────
  function buildSpellbar() {
    els.spellbar.innerHTML = '';
    for (const key of TD.game.SPELL_ORDER) {
      const sp = TD.game.SPELLS[key];
      const b = document.createElement('button');
      b.className = 'spellBtn'; b.id = 'spell_' + key;
      b.innerHTML = `<div class="sbKey">${sp.hotkey.toUpperCase()}</div><div class="sbIcon">${sp.icon}</div><div class="sbCost">🔮${sp.cost}</div><div class="sbCd"></div>`;
      b.addEventListener('click', () => { TD.audio.sfx('click'); TD.game.armSpell(key); });
      b.addEventListener('mouseenter', () => showSpellTip(key));
      b.addEventListener('mouseleave', hideTooltip);
      els.spellbar.appendChild(b);
    }
  }
  function showSpellTip(key) {
    const sp = TD.game.SPELLS[key];
    els.tooltip.innerHTML = `<b>${sp.icon} ${sp.name}</b><p>${sp.desc}</p>
      <div class="ttStats"><span>🔮 ${sp.cost} mana</span><span>⏱️ ${sp.cd}s</span></div>`;
    els.tooltip.classList.remove('hidden');
    els.tooltip.style.left = '12px'; els.tooltip.style.bottom = '78px';
  }

  function showShopTooltip(key, card) {
    TD.audio.sfx('hover');
    const d = TD.towers.DEFS[key];
    const s = d.levels[0];
    const dps = Math.round(TD.towers.computeDps(d, 0));
    let extra = '';
    if (d.kind === 'aoe') extra = `Zone : ${s.splash}px`;
    if (d.kind === 'frost') extra = `Ralentit ${Math.round(s.slowPct * 100)}% pendant ${s.slowDur}s`;
    if (d.kind === 'chain') extra = `${s.jumps} rebonds`;
    if (d.kind === 'poison') extra = `Nuage : ${s.cloud.dps} dégâts/s pendant ${s.cloud.dur}s`;
    if (d.kind === 'beam') extra = `Monte jusqu'à ×${1 + s.rampMax} sur une cible`;
    if (d.kind === 'barracks') extra = `Produit ${s.maxUnits} × ${TD.units.DEFS[d.unit].name}`;
    if (s.flyBonus) extra = `×${s.flyBonus} contre les volants`;
    if (s.burn) extra = `Brûlure : ${s.burn.dps} dégâts/s pendant ${s.burn.dur}s`;
    els.tooltip.innerHTML = `
      <b>${d.name} <span class="jp">${d.jp}</span></b>
      <p>${d.desc}</p>
      <div class="ttStats">
        <span>💥 ~${dps} DPS</span><span>🎯 ${ (s.range) }px</span>
        <span>${d.dmgType === 'phys' ? '🗡️ Physique' : '✨ Magique'}</span>
        ${extra ? `<span>${extra}</span>` : ''}
      </div>
      <div class="ttClass">${TD.enemies.towerClassInfo(key)}</div>`;
    positionTooltip(card);
  }
  function positionTooltip(card) {
    els.tooltip.classList.remove('hidden');
    const left = U.clamp(card.offsetLeft + els.shop.offsetLeft + card.offsetWidth / 2 - 130, 8, TD.map.W - 268);
    els.tooltip.style.left = left + 'px';
    els.tooltip.style.bottom = '118px';
  }
  function hideTooltip() { els.tooltip.classList.add('hidden'); }

  // ── HUD refresh (appelé chaque frame) ────────────────────
  let lastGold = -1, lastLives = -1, objSig = '';
  function update() {
    const g = TD.game;
    // objectifs
    const os = g.objectives.map(o => o.desc + (o.done ? 'D' : o.failed ? 'F' : '')).join('|');
    if (os !== objSig) {
      objSig = os;
      els.objectives.innerHTML = g.objectives.map(o => `<div class="objItem${o.done ? ' done' : ''}${o.failed ? ' failed' : ''}">${o.done ? '✅' : o.failed ? '❌' : '🎯'} ${o.desc}</div>`).join('');
    }
    if (g.gold !== lastGold) { lastGold = g.gold; els.goldV.textContent = U.fmtGold(g.gold); }
    if (g.lives !== lastLives) { lastLives = g.lives; els.livesV.textContent = g.lives; }
    els.waveV.textContent = g.endless || g.wave > 50 ? g.wave + ' ∞' : g.wave + ' / 50';

    // état de vague : local en solo/hôte, depuis le snapshot en invité
    const gh = TD.net.guestHud();
    const ws = gh ? gh.wst : TD.waves.state;
    const wcd = gh ? gh.cd : TD.waves.countdown;
    const wrem = gh ? gh.rem : TD.waves.remaining;
    els.enemiesV.textContent = g.enemies.length + wrem;

    // bouton de vague
    if (g.state !== 'playing') { els.callBtn.classList.add('hidden'); }
    else if (ws === 'idle') {
      els.callBtn.classList.remove('hidden');
      els.callBtn.disabled = false;
      if (g.wave === 0) els.callBtn.innerHTML = '▶️ Lancer la vague 1';
      else {
        const bonus = Math.ceil(Math.max(0, wcd) * 3 * (TD.mods.callBonusMul || 1));
        els.callBtn.innerHTML = `⏩ Vague ${g.wave + 1} dans ${Math.ceil(wcd)}s <b>+${bonus}🪙</b>`;
      }
    } else {
      els.callBtn.classList.add('hidden');
    }

    // boutique : verrous + fonds
    for (const key of TD.towers.ORDER) {
      const d = TD.towers.DEFS[key];
      const card = $('shop_' + key);
      const locked = d.age > g.age;
      card.classList.toggle('locked', locked);
      card.classList.toggle('poor', !locked && (g.gold < d.cost || g.wood < (d.wood || 0) || g.stone < (d.stone || 0)));
      card.classList.toggle('sel', g.selectedShop === key);
      if (locked) card.querySelector('.scLock span').textContent = TD.game.AGES[d.age].short;
    }
    const ac = $('ageCard');
    if (g.age >= 3) {
      ac.innerHTML = `<div class="scIcon">🔮</div><div class="scName">Âge Arcane</div><div class="scCost">MAX</div>`;
      ac.disabled = true;
    } else {
      const next = TD.game.AGES[g.age + 1];
      ac.innerHTML = `<div class="scIcon">${next.icon}</div><div class="scName">${next.name}</div><div class="scCost">⬆️ 🪙 ${next.cost}</div>`;
      ac.disabled = false;
      ac.classList.toggle('poor', g.gold < next.cost);
      ac.classList.toggle('canAge', g.gold >= next.cost);
    }

    // mana + sorts
    els.manaV.textContent = Math.floor(g.mana);
    els.woodV.textContent = Math.floor(g.wood);
    els.stoneV.textContent = Math.floor(g.stone);
    for (const key of g.SPELL_ORDER) {
      const sp = g.SPELLS[key], btn = $('spell_' + key), cd = g.spellCd[key];
      btn.classList.toggle('sel', g.selectedSpell === key);
      btn.classList.toggle('cooling', cd > 0);
      btn.classList.toggle('poor', cd <= 0 && g.mana < sp.cost);
      btn.querySelector('.sbCd').textContent = cd > 0 ? Math.ceil(cd) : '';
    }

    // boutons de vitesse : refléter la vitesse réelle (partagée via snapshot en co-op)
    const curSpd = document.querySelector('.spd.on');
    if (!curSpd || parseInt(curSpd.dataset.s, 10) !== g.speed) {
      document.querySelectorAll('.spd').forEach(x => x.classList.toggle('on', parseInt(x.dataset.s, 10) === g.speed));
    }

    // météo
    if (els.weatherPill && els.weatherPill.dataset.w !== TD.weather.id()) {
      els.weatherPill.dataset.w = TD.weather.id();
      const wx = TD.weather.info();
      els.weatherPill.firstChild.textContent = wx.icon + ' ';
      els.weatherV.textContent = wx.name;
      els.weatherPill.title = wx.desc;
    }

    // héros
    refreshHero();

    // panneau tour sélectionnée
    if (g.selectedTower) refreshTowerPanel(g.selectedTower);

    // barre de boss
    const boss = g.enemies.find(e => e.def.boss);
    if (boss && !boss.dead) {
      els.bossBar.classList.remove('hidden');
      els.bossName.textContent = boss.def.name;
      els.bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
      els.bossShield.style.width = (boss.shieldHp > 0 ? boss.shieldHp / boss.shieldMax * 100 : 0) + '%';
    } else {
      els.bossBar.classList.add('hidden');
    }
  }

  // ── panneau tour ─────────────────────────────────────────
  function showTowerPanel(tw) {
    els.towerPanel.classList.remove('hidden');
    refreshTowerPanel(tw, true);
  }
  function hideTowerPanel() { els.towerPanel.classList.add('hidden'); }

  let panelCache = '';
  // hôte : tw.builders est un Set (identités) ; invité : tw.builderCount est un simple
  // compte (cf. net.js) — un seul helper pour ne pas dupliquer la logique d'affichage.
  const builderCount = tw => tw.builders ? tw.builders.size : (tw.builderCount || 0);
  // chantier en cours : panneau dédié (progression + annulation), pas de stats/upgrade
  // puisque la tour ne fait rien tant qu'un villageois ne l'a pas terminée. Plusieurs
  // villageois peuvent y travailler ensemble pour aller plus vite (comme dans AoE).
  function renderConstructionPanel(tw, force) {
    const pct = Math.round(tw.buildProgress * 100);
    const n = builderCount(tw);
    const sig = 'site|' + tw.key + '|' + pct + '|' + n;
    if (!force && sig === panelCache) return;
    panelCache = sig;
    const builderLabel = n === 0 ? '⏳ en attente d’un villageois' : `🧑‍🌾 ${n} villageois au travail`;
    els.towerPanel.innerHTML = `
      <div class="tpHead"><span class="tpIcon" style="--c:${tw.def.color}">${tw.def.icon}</span>
        <div><b>${tw.def.name}</b><div class="tpStars">🔨 Chantier en cours</div></div>
        <button class="tpClose" id="tpClose">✕</button></div>
      <div class="tpRow"><span>Bâtisseurs</span><b>${builderLabel}</b></div>
      <div class="tpRow"><span>Progression</span><b>${pct}%</b></div>
      <p class="mSub">Astuce : diriger d'autres villageois ici accélère la construction.</p>
      <button class="btn big sell" id="tpSell">💰 Annuler le chantier — remboursé 🪙 ${tw.sellValue()}</button>`;
    $('tpClose').onclick = () => { TD.audio.sfx('click'); TD.game.deselect(); };
    $('tpSell').onclick = () => TD.net.send({ k: 'sell', id: tw.id });
  }

  function refreshTowerPanel(tw, force) {
    if (tw.underConstruction) { renderConstructionPanel(tw, force); return; }
    const s = tw.stats();
    const d = tw.def;
    const up = tw.upgradeCost();
    const buffSig = tw._buff ? `${tw._buff.dmgMul.toFixed(2)},${tw._buff.rateMul.toFixed(2)},${tw._buff.rangeMul.toFixed(2)}` : '';
    const isTownhall = tw.key === 'townhall';
    const villagerCount = isTownhall ? TD.game.countVillagersOf(tw.id) : 0;
    const recruitCost = isTownhall ? TD.game.recruitCost(tw) : 0;
    const sig = [tw.key, tw.level, up, TD.game.gold >= (up || 0), tw.mode, tw.kills, buffSig, villagerCount, recruitCost].join('|');
    if (!force && sig === panelCache) return;
    panelCache = sig;
    const stars = '★'.repeat(tw.level + 1) + '☆'.repeat(2 - tw.level);
    let lines = '';
    const row = (k, v) => `<div class="tpRow"><span>${k}</span><b>${v}</b></div>`;
    if (d.kind === 'barracks') {
      const ud = TD.units.DEFS[d.unit];
      lines += row('Unité', ud.name);
      lines += row('Unités max', s.maxUnits);
      if (isTownhall) {
        lines += row('Villageois', villagerCount + ' / ' + s.maxUnits);
      } else {
        lines += row('Dégâts/unité', U.fmt1(ud.dmg));
        lines += row('Vie/unité', ud.hp);
        lines += row('Production', s.spawn + 's');
      }
    } else {
      if (d.kind === 'beam') lines += row('Dégâts/s', `${U.fmt1(s.dps)} → ${U.fmt1(s.dps * (1 + s.rampMax))}`);
      else lines += row('Dégâts', U.fmt1(s.dmg) + (s.double ? ' ×2' : ''));
      if (s.rate) lines += row('Cadence', U.fmt1(s.rate) + '/s');
      lines += row('Portée', Math.round(s.range));
      if (s.splash) lines += row('Zone', s.splash + 'px');
      if (s.slowPct) lines += row('Ralenti', Math.round((s.slowPct + TD.mods.slowBonus) * 100) + '%');
      if (s.jumps) lines += row('Rebonds', s.jumps);
      if (s.cloud) lines += row('Nuage', `${U.fmt1(s.cloud.dps * TD.mods.dmgMul)}/s · ${s.cloud.dur}s`);
      lines += row('Éliminations', tw.kills);
    }
    if (tw._buff && tw._buffLabels && tw._buffLabels.length) {
      const b = tw._buff, pct = v => '+' + Math.round((v - 1) * 100) + '%', parts = [];
      if (b.dmgMul > 1) parts.push('⚔️ ' + pct(b.dmgMul) + ' dég');
      if (b.rateMul > 1) parts.push('⏱️ ' + pct(b.rateMul) + ' cad');
      if (b.rangeMul > 1) parts.push('🎯 ' + pct(b.rangeMul) + ' portée');
      lines += `<div class="tpSynergy">✨ Synergie · ${parts.join(' · ')}<small>${tw._buffLabels.join(' · ')}</small></div>`;
    }
    let upHtml;
    if (up === null) upHtml = `<button class="btn big" disabled>Niveau MAX ✨</button>`;
    else {
      const nxt = d.levels[tw.level + 1], cur = d.levels[tw.level];
      let gain;
      if (d.kind === 'beam') gain = `+${Math.round(nxt.dps - cur.dps)} dég/s`;
      else if (d.kind === 'barracks') gain = 'renfort';
      else gain = `+${Math.round((nxt.dmg || 0) - (cur.dmg || 0))} dég`;
      upHtml = `<button class="btn big up" id="tpUp" ${TD.game.gold < up ? 'disabled' : ''}>⬆️ Améliorer (${gain}) — 🪙 ${up}</button>`;
    }
    // recrutement manuel de villageois — remplace l'ancienne auto-production de
    // l'Hôtel de Ville (cf. game.js recruitVillager, plafonné par s.maxUnits).
    let recruitHtml = '';
    if (isTownhall) {
      const capped = villagerCount >= s.maxUnits;
      recruitHtml = `<button class="btn big" id="tpRecruit" ${(capped || TD.game.gold < recruitCost) ? 'disabled' : ''}>👤 Recruter un villageois — 🪙 ${recruitCost}</button>`;
    }
    els.towerPanel.innerHTML = `
      <div class="tpHead"><span class="tpIcon" style="--c:${d.color}">${d.icon}</span>
        <div><b>${d.name}</b><div class="tpStars">${stars}</div></div>
        <button class="tpClose" id="tpClose">✕</button></div>
      ${lines}
      <div class="tpRow"><span>Cible</span><button class="btn mini" id="tpMode">🎯 ${tw.mode}</button></div>
      ${recruitHtml}
      ${upHtml}
      <button class="btn big sell" id="tpSell">💰 Vendre — 🪙 ${tw.sellValue()}</button>`;
    $('tpClose').onclick = () => { TD.audio.sfx('click'); TD.game.deselect(); };
    if ($('tpRecruit')) $('tpRecruit').onclick = () => TD.net.send({ k: 'recruit', id: tw.id });
    $('tpMode').onclick = () => {
      TD.audio.sfx('click');
      const i = TD.towers.MODES.indexOf(tw.mode);
      const mode = TD.towers.MODES[(i + 1) % TD.towers.MODES.length];
      TD.net.send({ k: 'mode', id: tw.id, mode });
      panelCache = '';
    };
    if ($('tpUp')) $('tpUp').onclick = () => TD.net.send({ k: 'upgrade', id: tw.id });
    $('tpSell').onclick = () => TD.net.send({ k: 'sell', id: tw.id });
  }

  // ── bannières ────────────────────────────────────────────
  function banner(title, sub = '', cls = '', dur = 2400) {
    clearTimeout(bannerTimer);
    els.banners.innerHTML = `<div class="banner ${cls}"><div class="bTitle">${title}</div>${sub ? `<div class="bSub">${sub}</div>` : ''}</div>`;
    bannerTimer = setTimeout(() => { els.banners.innerHTML = ''; }, dur);
  }

  function onWaveStart(w, c) {
    if (c.boss) {
      banner(`☄️ ${c.label} ☄️`, 'BOSS — Vague ' + w, 'boss', 3400);
    } else {
      banner(`🌊 Vague ${w}`, c.label || '', '', 2000);
    }
  }
  function onWaveCleared(w, bonus) {
    banner(`✅ Vague ${w} nettoyée !`, `+${bonus} 🪙`, 'clear', 1600);
  }

  // ── or : cible du vol de pièces + pop ────────────────────
  function goldTargetPos() {
    const r = els.goldPill.getBoundingClientRect();
    const s = els.stage.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / stageScale, y: (r.top + r.height / 2 - s.top) / stageScale };
  }
  function bumpGold() {
    TD.audio.sfx('coin');
    els.goldPill.classList.remove('pop');
    void els.goldPill.offsetWidth;
    els.goldPill.classList.add('pop');
  }
  function hurtLives() {
    els.livesPill.classList.remove('hurt');
    void els.livesPill.offsetWidth;
    els.livesPill.classList.add('hurt');
  }

  // ── omamori (charmes) ────────────────────────────────────
  function showCharms(picks, cb) {
    TD.game.modalPause = true;
    openModal(`
      <h2>🏮 Choisis un Omamori 🏮</h2>
      <p class="mSub">Un porte-bonheur permanent pour la suite du voyage</p>
      <div class="charmRow">
        ${picks.map((c, i) => `
          <button class="charmCard" data-i="${i}">
            <div class="ccIcon">${c.icon}</div>
            <div class="ccName">${c.name}</div>
            <div class="ccDesc">${c.desc}</div>
          </button>`).join('')}
      </div>`);
    els.modal.querySelectorAll('.charmCard').forEach(b => {
      b.addEventListener('click', () => {
        const c = picks[parseInt(b.dataset.i, 10)];
        closeModal();
        TD.game.modalPause = false;
        cb(c);
        banner(`${c.icon} ${c.name}`, c.desc, 'clear', 2000);
      });
    });
  }
  function refreshCharmsBar(defs) {
    els.charmsBar.innerHTML = defs.map(c => `<span class="charmChip" title="${c.name} — ${c.desc}">${c.icon}</span>`).join('');
  }

  // ── modales génériques ───────────────────────────────────
  function openModal(html, dim = true) {
    els.modal.innerHTML = `<div class="mBox">${html}</div>`;
    els.modal.classList.remove('hidden');
    els.modal.classList.toggle('dim', dim);
  }
  function closeModal() { els.modal.classList.add('hidden'); els.modal.innerHTML = ''; }
  const modalOpen = () => !els.modal.classList.contains('hidden');

  // rendu seul (pas de garde) : appelé à l'ouverture ET pour se rafraîchir
  // depuis l'intérieur de la modale (ex. après un clic sur la difficulté) —
  // showPause() ne peut pas se rappeler elle-même, modalOpen() y bloquerait.
  function renderPause() {
    const n = TD.game.humanCount();
    const mult = TD.waves.coopMul();
    // seul l'hôte pilote la difficulté partagée (comme le choix de carte en lobby) —
    // un invité qui l'enverrait serait de toute façon ignoré côté hôte (cmd() filtre
    // opts.remote), donc on ne lui montre même pas de boutons cliquables.
    const canSetDiff = !TD.net.isMP() || TD.net.isHost();
    const diffRow = canSetDiff
      ? ['facile', 'normal', 'difficile'].map(d =>
          `<button class="diffMini${d === TD.game.difficulty ? ' on' : ''}" data-d="${d}">${({ facile: '🌸 Facile', normal: '⛩️ Normal', difficile: '👹 Difficile' })[d]}</button>`
        ).join('')
      : `<span class="diffMini on">${({ facile: '🌸 Facile', normal: '⛩️ Normal', difficile: '👹 Difficile' })[TD.game.difficulty]}</span>`;
    openModal(`
      <h2>⛩️ Pause</h2>
      <p class="mSub">🎚️ Difficulté (s'applique aux prochaines vagues)${canSetDiff ? '' : " — réglée par l'hôte"}</p>
      <div class="coDiffRow">${diffRow}</div>
      ${n > 1 ? `<p class="mSub">👥 ${n} joueurs → PV des yokai ×${mult.toFixed(2)}</p>` : ''}
      <div class="mBtns">
        <button class="btn big" id="mResume">▶️ Reprendre</button>
        <button class="btn big" id="mSettings">⚙️ Options</button>
        <button class="btn big sell" id="mQuit">🏳️ Abandonner</button>
      </div>`);
    if (canSetDiff) els.modal.querySelectorAll('.diffMini').forEach(b => b.onclick = () => {
      TD.audio.sfx('click');
      TD.net.send({ k: 'difficulty', d: b.dataset.d });
      renderPause();
    });
    $('mResume').onclick = () => { TD.audio.sfx('click'); closeModal(); TD.game.modalPause = false; };
    $('mSettings').onclick = () => { TD.audio.sfx('click'); showSettings(true); };
    $('mQuit').onclick = () => { TD.audio.sfx('click'); closeModal(); TD.game.modalPause = false; TD.game.toMenu(); };
  }

  function showPause() {
    if (TD.game.state !== 'playing' || modalOpen()) return;
    TD.game.modalPause = true;
    renderPause();
  }

  function showSettings(fromPause) {
    const st = TD.game.settings;
    openModal(`
      <h2>⚙️ Options</h2>
      <div class="setRow"><span>🎵 Musique</span><input type="range" id="sMus" min="0" max="100" value="${Math.round(st.music * 100)}"></div>
      <div class="setRow"><span>🔔 Effets</span><input type="range" id="sSfx" min="0" max="100" value="${Math.round(st.sfx * 100)}"></div>
      <div class="setRow"><span>📳 Secousses</span><button class="btn mini" id="sShake">${st.shake ? 'Activées' : 'Coupées'}</button></div>
      <div class="setRow"><span>✨ Particules</span><button class="btn mini" id="sParts">${({ low: 'Légères', normal: 'Normales', max: 'MAXI' })[st.particles]}</button></div>
      <div class="mBtns"><button class="btn big" id="sBack">✔️ Retour</button></div>`);
    $('sMus').oninput = e => { st.music = e.target.value / 100; TD.game.applySettings(); };
    $('sSfx').oninput = e => { st.sfx = e.target.value / 100; TD.game.applySettings(); TD.audio.sfx('coin'); };
    $('sShake').onclick = e => { st.shake = !st.shake; e.target.textContent = st.shake ? 'Activées' : 'Coupées'; TD.game.applySettings(); };
    $('sParts').onclick = e => {
      st.particles = { low: 'normal', normal: 'max', max: 'low' }[st.particles];
      e.target.textContent = ({ low: 'Légères', normal: 'Normales', max: 'MAXI' })[st.particles];
      TD.game.applySettings();
    };
    $('sBack').onclick = () => {
      TD.audio.sfx('click'); TD.game.saveSettings();
      if (fromPause) showPause(); else closeModal();
    };
  }

  function showHelp() {
    openModal(`
      <h2>📜 Comment jouer</h2>
      <div class="helpCols">
        <p>🌸 <b>Construis</b> des tours sur l'herbe pour stopper les yokai avant le sanctuaire.</p>
        <p>⛩️ <b>Passe les âges</b> (Pierre → Bronze → Fer → Arcane) pour débloquer tours et casernes.</p>
        <p>🛡️ Les <b>casernes</b> déploient des unités alliées qui bloquent et frappent les yokai au sol.</p>
        <p>🏮 Toutes les 5 vagues, choisis un <b>Omamori</b> : bonus permanent.</p>
        <p>👹 Boss aux vagues <b>10, 20, 30, 40, 50</b>. Les élites 👑 valent le double d'or.</p>
        <p>⏩ Appeler la vague en avance rapporte de l'or bonus.</p>
        <p>🔮 <b>Sorts</b> (Q/W/E) : météore, blizzard et bénédiction, lancés au clic avec le mana.</p>
        <p>📖 <b>C</b> : ouvre le Codex (yokai + efficacité des types de dégâts).</p>
        <p>🏗️ Poser une tour crée un <b>chantier</b> : elle ne tire/produit rien tant qu'un villageois ne l'a pas construite. Un villageois libre s'y met tout seul entre deux récoltes — plusieurs villageois PEUVENT construire le même chantier ensemble pour aller plus vite.</p>
        <p>🖱️ <b>Clique un villageois</b> pour le sélectionner (anneau doré), puis clique un <b>nœud</b> 🪵🪨 ou un <b>chantier</b> 🔨 pour l'y envoyer directement.</p>
        <p>🏠 <b>Hôtel de Ville</b> → panneau de la tour pour <b>recruter</b> des villageois contre de l'or (plafonné par son niveau) ; ils récoltent 🪵 bois et 🪨 pierre par défaut (certaines tours en coûtent).</p>
        <p>🛡️ <b>Casernes</b> → unités qui combattent ; 🏺 reliques réclamées par vos unités.</p>
        <p>🤝 <b>Co-op</b> : défendez à plusieurs le même sanctuaire (or partagé) + bot allié optionnel (il construit instantanément, sans villageois).</p>
        <p>⌨️ <b>1-0</b> : choisir une tour (10 premières) · <b>U</b>/<b>V</b> : améliorer/vendre la tour · <b>Échap</b> : pause/désélection · <b>Espace</b> : vague suivante · <b>clic droit</b> : annuler.</p>
      </div>
      <div class="mBtns"><button class="btn big" id="hBack">✔️ Compris !</button></div>`);
    $('hBack').onclick = () => { TD.audio.sfx('click'); closeModal(); };
  }

  // ── co-op (lobby réseau) ─────────────────────────────────
  let coDiff = 'normal', coBot = false, coMap = null;

  function showCoop() {
    const st = TD.game.settings;
    const name = st.coopName || ('Renard' + (10 + Math.floor(Math.random() * 89)));
    const url = st.coopUrl || TD.net.defaultUrl();
    openModal(`
      <h2>🤝 Co-op entre potes</h2>
      <p class="mSub">Un·e joueur·se héberge, les autres rejoignent avec le code.</p>
      <div class="setRow"><span>🦊 Pseudo</span><input class="coIn" id="coName" maxlength="12" value="${name}"></div>
      <div class="setRow"><span>📡 Relais</span><input class="coIn" id="coUrl" value="${url}"></div>
      <div class="setRow"><span>🔑 Code</span><input class="coIn up" id="coCode" maxlength="6" placeholder="pour rejoindre"></div>
      <div class="mBtns">
        <button class="btn big up" id="coHost">🏠 Héberger</button>
        <button class="btn big" id="coJoin">🚪 Rejoindre</button>
      </div>
      <div class="coErr" id="coErr"></div>
      <div class="mBtns"><button class="btn" id="coBack">← Retour</button></div>`);
    const nameI = $('coName'), urlI = $('coUrl'), codeI = $('coCode');
    const remember = () => { st.coopName = nameI.value.trim(); st.coopUrl = urlI.value.trim(); TD.game.saveSettings(); };
    const onErr = msg => { $('coErr').textContent = '⚠️ ' + msg; };
    $('coHost').onclick = () => { TD.audio.sfx('click'); remember(); TD.net.host(urlI.value.trim(), nameI.value.trim(), () => showLobby(), onErr); };
    $('coJoin').onclick = () => {
      TD.audio.sfx('click'); remember();
      const code = codeI.value.trim().toUpperCase();
      if (!code) { onErr('Entre le code de la partie à rejoindre'); return; }
      TD.net.join(urlI.value.trim(), code, nameI.value.trim(), () => showLobby(), onErr);
    };
    $('coBack').onclick = () => { TD.audio.sfx('click'); closeModal(); };
  }

  function showLobby() { TD.net.onLobby(renderLobby); renderLobby(); }

  function renderLobby() {
    const role = TD.net.role;
    if (role === 'solo') { showCoop(); $('coErr').textContent = '⚠️ Connexion perdue'; return; }
    const isHost = role === 'host';
    if (!coMap) coMap = TD.game.mapId;
    const names = [`<div>${isHost ? '👑 Toi (hôte)' : '🦊 Toi'}</div>`]
      .concat(TD.net.peers.map(p => `<div>🦊 ${p.name}</div>`));
    const n = TD.net.peers.length + 1;
    openModal(`
      <h2>🏮 Salon co-op</h2>
      <p class="mSub">Code de la partie : <b class="coCode">${TD.net.roomCode}</b></p>
      <div class="coPlayers">${names.join('')}</div>
      ${n > 1 ? `<p class="mSub">👥 ${n} joueurs → PV des yokai ×${TD.waves.coopMul().toFixed(2)} (équilibrage co-op)</p>` : ''}
      ${isHost ? `
        <div class="coDiffRow">
          ${['facile', 'normal', 'difficile'].map(d => `<button class="diffMini${d === coDiff ? ' on' : ''}" data-d="${d}">${({ facile: '🌸 Facile', normal: '⛩️ Normal', difficile: '👹 Difficile' })[d]}</button>`).join('')}
        </div>
        <div class="coMapRow">
          ${TD.map.list().map(m => `<button class="mapMini${m.id === coMap ? ' on' : ''}" data-m="${m.id}" title="${m.name}">${m.icon}<small>${m.name}</small></button>`).join('')}
        </div>
        <div class="setRow"><span>🤖 Bot allié</span><button class="btn mini" id="coBotBtn">${coBot ? 'Activé' : 'Coupé'}</button></div>
        <div class="mBtns"><button class="btn big up" id="coStart">🌸 Démarrer la défense</button></div>
      ` : `<p class="mSub waitHost">⏳ En attente que l'hôte lance la partie…</p>`}
      <div class="mBtns"><button class="btn sell" id="coLeave">🚪 Quitter le salon</button></div>`);
    if (isHost) {
      els.modal.querySelectorAll('.diffMini').forEach(b => b.onclick = () => { TD.audio.sfx('click'); coDiff = b.dataset.d; renderLobby(); });
      els.modal.querySelectorAll('.mapMini').forEach(b => b.onclick = () => { TD.audio.sfx('click'); coMap = b.dataset.m; TD.game.selectMap(coMap); renderLobby(); });
      $('coBotBtn').onclick = () => { TD.audio.sfx('click'); coBot = !coBot; renderLobby(); };
      $('coStart').onclick = () => {
        TD.audio.sfx('upgrade');
        TD.net.onLobby(null);
        closeModal();
        if (coBot && TD.ai) TD.ai.enable(); else if (TD.ai) TD.ai.disable();
        TD.game.selectMap(coMap);
        TD.game.start(coDiff);
        TD.net.broadcastStart(coDiff, coMap);
      };
    }
    $('coLeave').onclick = () => { TD.audio.sfx('click'); TD.net.onLobby(null); TD.net.reset(); closeModal(); };
  }

  // ── méta-progression (succès + améliorations permanentes) ─
  let metaTab = 'up';
  function showMeta() {
    const m = TD.meta;
    const tabBtn = (id, label) => `<button class="metaTabBtn${metaTab === id ? ' on' : ''}" data-tab="${id}">${label}</button>`;
    let body;
    if (metaTab === 'up') {
      body = m.UPGRADES.map(u => {
        const lvl = m.upLevel(u.id), maxed = lvl >= u.max, cost = m.upCost(lvl), can = !maxed && m.petals >= cost;
        const pips = '●'.repeat(lvl) + '○'.repeat(u.max - lvl);
        const nextVal = u.per * (maxed ? lvl : lvl + 1);
        return `<div class="metaUp">
          <span class="muIcon">${u.icon}</span>
          <div class="muInfo"><b>${u.name}</b><span class="muEff">${u.fmt(nextVal)} <em>· ${u.unit}</em></span><span class="muPips">${pips}</span></div>
          <button class="btn mini${can ? '' : ' poor'}" data-buy="${u.id}" ${maxed || !can ? 'disabled' : ''}>${maxed ? 'MAX ✨' : '🏵️ ' + cost}</button>
        </div>`;
      }).join('');
    } else if (metaTab === 'ach') {
      body = '<div class="achGrid">' + m.ACHIEVEMENTS.map(a => {
        const got = !!m.state.achievements[a.id];
        return `<div class="achCard${got ? ' got' : ''}"><span class="achIcon">${got ? a.icon : '🔒'}</span>
          <div class="achTxt"><b>${a.name}</b><span>${a.desc}</span></div>
          ${got ? '<span class="achChk">✓</span>' : `<span class="achRew">+${a.reward}🏵️</span>`}</div>`;
      }).join('') + '</div>';
    } else {
      body = '<div class="skinGrid">' + m.SKINS.map(sk => {
        const owns = m.ownsSkin(sk.id), active = m.state.activeSkin === sk.id;
        const swatch = `<span class="skSwatch" style="background:${sk.pal.body};box-shadow:inset 0 0 0 2px ${sk.pal.crest}"></span>`;
        const action = active ? '<span class="skActive">✓ Équipé</span>' : (owns ? '<span class="skUse">Équiper</span>' : `<span class="achRew">🏵️ ${sk.cost}</span>`);
        return `<div class="skinCard${active ? ' active' : ''}${owns ? '' : ' locked'}" data-skin="${sk.id}">${swatch}<b>${sk.name}</b>${action}</div>`;
      }).join('') + '</div>';
    }
    openModal(`<h2>🏵️ Progression</h2>
      <p class="mSub">Pétales de prestige : <b class="coCode">${m.petals}</b> · Succès ${m.achievedCount()}/${m.ACHIEVEMENTS.length}</p>
      <div class="metaTabs">${tabBtn('up', '⬆️ Améliorations')}${tabBtn('ach', '🏆 Succès')}${tabBtn('skin', '🎨 Apparence')}</div>
      <div class="metaBody">${body}</div>
      <div class="mBtns"><button class="btn big" id="metaClose">Fermer</button></div>`);
    els.modal.querySelectorAll('.metaTabBtn').forEach(b => b.onclick = () => { TD.audio.sfx('click'); metaTab = b.dataset.tab; showMeta(); });
    els.modal.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      if (TD.meta.buyUpgrade(b.dataset.buy)) TD.audio.sfx('upgrade'); else TD.audio.sfx('error');
      showMeta();
    });
    els.modal.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => {
      const id = b.dataset.skin;
      if (TD.meta.ownsSkin(id)) { TD.meta.setSkin(id); TD.audio.sfx('click'); }
      else if (TD.meta.buySkin(id)) TD.audio.sfx('upgrade');
      else TD.audio.sfx('error');
      showMeta();
    });
    $('metaClose').onclick = () => { TD.audio.sfx('click'); closeModal(); };
  }

  // ── défi du jour ─────────────────────────────────────────
  function showDaily() {
    const c = TD.meta.dailyChallenge();
    const best = TD.meta.dailyBestWave();
    openModal(`<h2>🎲 Défi du jour</h2>
      <p class="mSub">Un modificateur partagé qui change chaque jour</p>
      <div class="dailyCard"><span class="dailyIcon">${c.icon}</span>
        <div><b>${c.name}</b><span>${c.desc}</span></div></div>
      <p class="mSub">${best > 0 ? `🏆 Ton meilleur aujourd'hui : vague ${best}` : 'Pas encore tenté aujourd\'hui'}</p>
      <div class="mBtns">
        <button class="btn big up" id="dailyPlay">🌸 Jouer le défi</button>
        <button class="btn big" id="dailyClose">Retour</button>
      </div>`);
    $('dailyPlay').onclick = () => {
      TD.audio.ensure(); TD.audio.sfx('upgrade'); closeModal();
      const d = document.querySelector('.diffCard.on') || document.querySelector('.diffCard[data-d="normal"]');
      TD.game.start(d ? d.dataset.d : 'normal', 0, c);
    };
    $('dailyClose').onclick = () => { TD.audio.sfx('click'); closeModal(); };
  }

  function metaResultHtml(mr) {
    if (!mr) return '';
    let h = `<div class="metaEnd">🏵️ +${mr.earned} pétales de prestige`;
    if (mr.newly && mr.newly.length) h += `<br><b>🏆 ${mr.newly.map(a => a.icon + ' ' + a.name).join(' · ')}</b>`;
    return h + '</div>';
  }

  // ── codex / bestiaire ────────────────────────────────────
  function enemyAbility(d) {
    if (d.spawner) return 'Invoque sans cesse en vie';
    if (d.poisonImmune) return 'Immunisé au poison · rapide';
    if (d.fly && (d.armor || 0) >= 0.3) return 'Vole + blindé';
    if (d.summon) return 'Invoque des Kodama';
    if (d.serpent) return 'Dash serpentin';
    if (d.shielded) return 'Boucliers + enrage';
    if (d.phase2) return 'Phase 2 : soin + invocation';
    if (d.boss && d.regenRate) return 'Régénère + explose';
    if (d.split) return 'Se scinde en 2 à la mort';
    if (d.fly) return 'Vole (anti-aérien requis)';
    if (d.dash) return 'Dash accéléré';
    if (d.phase) return 'Intangibilité périodique';
    if (d.deathSpawn) return 'Invoque à la mort';
    if (d.healAura) return 'Soigne les yokai proches';
    if (d.teleport) return 'Se téléporte en avant';
    if (d.berserk) return 'Enrage sous 30% PV';
    if (d.regenRate) return 'Régénération élevée';
    if ((d.armor || 0) >= 0.4) return 'Très blindé';
    return '—';
  }

  function showCodex() {
    if (TD.game.state !== 'playing') return;
    if (modalOpen()) { TD.audio.sfx('click'); closeModal(); TD.game.modalPause = false; return; }
    TD.audio.sfx('click');
    TD.game.modalPause = true;
    const E = TD.enemies.DEFS;
    const clsLabel = { light: 'Léger', heavy: 'Blindé', flying: 'Volant', spirit: 'Esprit' };
    const cards = Object.keys(E).map(k => {
      const d = E[k], cls = TD.enemies.classify(d);
      return `<div class="cxCard${d.boss ? ' boss' : ''}">
        <span class="cxDot" style="background:${d.body}"></span>
        <div class="cxInfo"><b>${d.name}</b>
          <span>❤️ ${d.hp} · 🏃 ${d.speed} · 🛡️ ${clsLabel[cls]}</span>
          <em>${enemyAbility(d)}</em></div></div>`;
    }).join('');
    const matrix = `<div class="cxMatrix">
      <div>⚔️ <b>Perforant</b> (Flèche, Tsuru, Grand Arc) → fort vs Léger/Volant, faible vs Blindé</div>
      <div>🔨 <b>Contondant</b> (Taiko, Mortier) → fort vs Blindé, faible vs Volant</div>
      <div>✨ <b>Magique</b> (Yuki, Poison, Kitsune, Lanterne) → fort vs Esprit</div>
      <div>🔥 <b>Feu</b> (Kitsunebi) → fort vs Léger/Volant + brûlure</div></div>`;
    openModal(`<h2>📖 Codex des Yokai</h2>
      <div class="codexGrid">${cards}</div>
      <h3 class="cxH3">Efficacité des dégâts</h3>${matrix}
      <div class="mBtns"><button class="btn big" id="cxClose">✔️ Fermer (C)</button></div>`);
    $('cxClose').onclick = () => { TD.audio.sfx('click'); closeModal(); TD.game.modalPause = false; };
  }

  function statsGrid(st) {
    const mins = Math.floor(st.time / 60), secs = Math.floor(st.time % 60);
    return `<div class="statsGrid">
      <div><b>${st.wavesCleared}</b><span>vagues</span></div>
      <div><b>${st.kills}</b><span>yokai vaincus</span></div>
      <div><b>${U.fmtGold(st.goldEarned)}</b><span>or amassé</span></div>
      <div><b>${st.crits}</b><span>critiques</span></div>
      <div><b>${st.leaks}</b><span>fuites</span></div>
      <div><b>${mins}:${String(secs).padStart(2, '0')}</b><span>durée</span></div>
    </div>`;
  }

  function showGameOver(st) {
    openModal(`
      <h2 class="ko">💔 Le sanctuaire est tombé…</h2>
      <p class="mSub">Vague ${st.wavesCleared + 1} — les yokai dansent sur les ruines</p>
      ${statsGrid(st)}
      ${metaResultHtml(TD.meta.lastResult())}
      <div class="mBtns">
        <button class="btn big" id="goRetry">🔄 Revanche</button>
        <button class="btn big sell" id="goMenu">⛩️ Menu</button>
      </div>`);
    $('goRetry').onclick = () => { TD.audio.sfx('click'); closeModal(); TD.game.start(TD.game.difficulty); };
    $('goMenu').onclick = () => { TD.audio.sfx('click'); closeModal(); TD.game.toMenu(); };
  }

  function showVictory(st) {
    const ng = TD.game.ngPlus || 0;
    openModal(`
      <h2 class="win">🎆 VICTOIRE ! 🎆</h2>
      <p class="mSub">Les 50 vagues repoussées${ng > 0 ? ` en New Game+ ${ng}` : ''} — le hanami est sauvé 🌸</p>
      ${statsGrid(st)}
      ${metaResultHtml(TD.meta.lastResult())}
      <div class="mBtns">
        <button class="btn big up" id="vNG">🔥 New Game+ ${ng + 1}</button>
        <button class="btn big" id="vEndless">♾️ Mode Sans Fin</button>
        <button class="btn big" id="vMenu">⛩️ Menu</button>
      </div>`);
    $('vNG').onclick = () => { TD.audio.sfx('upgrade'); closeModal(); TD.game.modalPause = false; TD.game.start(TD.game.difficulty, ng + 1); };
    $('vEndless').onclick = () => { TD.audio.sfx('upgrade'); closeModal(); TD.game.goEndless(); };
    $('vMenu').onclick = () => { TD.audio.sfx('click'); closeModal(); TD.game.toMenu(); };
  }

  // ── héros : barre HUD + modale de talents ────────────────
  let heroSig = '';
  function refreshHero() {
    if (!$('herobar')) return;
    const g = TD.game, info = TD.hero.info();
    $('heroDeploy').classList.toggle('sel', g.heroPlacing);
    const avail = info.available.length > 0;
    const tBtn = $('heroTalent');
    tBtn.classList.toggle('hidden', !(info.deployed && avail));
    tBtn.classList.toggle('ready', info.deployed && avail);
    const sig = [info.deployed, info.dead, info.level, info.xp, info.xpNeed, Math.ceil(info.respawnT)].join(',');
    if (sig === heroSig) return;
    heroSig = sig;
    const label = $('heroLabel'), fill = $('heroXpFill');
    if (!info.deployed) { label.textContent = 'Déployer le héros (H)'; fill.style.width = '0%'; }
    else if (info.dead) { label.textContent = '🗡️ Réapparition ' + Math.ceil(info.respawnT) + 's'; fill.style.width = '0%'; }
    else {
      label.textContent = 'Samouraï · Niv. ' + info.level + (info.level >= info.maxLevel ? ' MAX' : '');
      fill.style.width = (info.xpNeed > 0 ? Math.min(100, info.xp / info.xpNeed * 100) : 100) + '%';
    }
  }

  function showHeroTalents() {
    if (TD.game.state !== 'playing') return;
    const info = TD.hero.info();
    if (!info.deployed) { banner('🗡️ Héros non déployé', "Déploie d'abord le Samouraï (touche H)", 'boss', 1800); return; }
    if (!info.available.length) { banner('✨ Aucun talent disponible', 'Atteins le niveau 3, 6 ou 9', 'boss', 1700); return; }
    const ti = TD.hero.talentInfo(), g = TD.game;
    const sections = info.available.map(tier => {
      const cards = ti.tierOptions(tier).map(id => {
        const d = ti.defs[id];
        return `<button class="talentCard${g.gold >= d.cost ? '' : ' poor'}" data-tier="${tier}" data-id="${id}">
          <span class="tcIcon">${d.icon}</span><b>${d.name}</b>
          <span class="tcDesc">${d.desc}</span><span class="tcCost">🪙 ${d.cost}</span></button>`;
      }).join('');
      return `<div class="talentTier"><div class="ttLabel">⭐ Palier niveau ${tier}</div><div class="talentRow">${cards}</div></div>`;
    }).join('');
    openModal(`<h2>✨ Talents du Samouraï</h2>
      <p class="mSub">Niveau ${info.level} · un talent par palier (coûte de l'or)</p>
      ${sections}
      <div class="mBtns"><button class="btn big" id="htClose">Fermer</button></div>`);
    els.modal.querySelectorAll('.talentCard').forEach(b => b.onclick = () => {
      const tier = parseInt(b.dataset.tier, 10), id = b.dataset.id;
      if (TD.game.gold < ti.defs[id].cost) { TD.audio.sfx('error'); return; }
      TD.audio.sfx('click');
      TD.net.send({ k: 'hero', sub: 'talent', tier, id });
      closeModal();
    });
    $('htClose').onclick = () => { TD.audio.sfx('click'); closeModal(); };
  }

  // ── sélecteur de carte (menu principal) ──────────────────
  function buildMapPicker() {
    const row = $('mapRow');
    if (!row) return;
    row.innerHTML = '';
    for (const m of TD.map.list()) {
      const b = document.createElement('button');
      b.className = 'mapCard' + (m.id === TD.game.mapId ? ' on' : '');
      b.dataset.m = m.id;
      b.innerHTML = `<span class="mapIcon">${m.icon}</span><span>${m.name}</span>`;
      b.addEventListener('click', () => {
        TD.audio.sfx('click');
        TD.game.selectMap(m.id);
        row.querySelectorAll('.mapCard').forEach(x => x.classList.toggle('on', x === b));
      });
      row.appendChild(b);
    }
  }
  function markMapSel() {
    const row = $('mapRow');
    if (row) row.querySelectorAll('.mapCard').forEach(x => x.classList.toggle('on', x.dataset.m === TD.game.mapId));
  }

  // ── menu principal ───────────────────────────────────────
  function showMenu(records) {
    els.menu.classList.remove('hidden');
    els.hud.classList.add('hidden');
    markMapSel();
    const r = $('records');
    const parts = [];
    if (records.victories > 0) parts.push(`🏆 ${records.victories} victoire${records.victories > 1 ? 's' : ''}`);
    if (records.bestWave > 0) parts.push(`🌊 record : vague ${records.bestWave}`);
    if (records.bestNG > 0) parts.push(`🔥 NG+ ${records.bestNG}`);
    r.textContent = parts.length ? parts.join(' · ') : 'Première partie ? Le sanctuaire compte sur toi 🌸';
  }
  function hideMenu() {
    els.menu.classList.add('hidden');
    els.hud.classList.remove('hidden');
    hideTowerPanel();
    closeModal();
    lastGold = -1; lastLives = -1; panelCache = '';
  }

  return {
    init, update, banner, onWaveStart, onWaveCleared,
    showTowerPanel, hideTowerPanel, hideTooltip,
    goldTargetPos, bumpGold, hurtLives,
    showCharms, refreshCharmsBar,
    showPause, showSettings, showHelp, showGameOver, showVictory,
    showCoop, showCodex, showHeroTalents, showMeta, showDaily,
    showMenu, hideMenu, closeModal, modalOpen,
    set stageScale(v) { stageScale = v; },
    get stageScale() { return stageScale; },
  };
})();

// ============================================================
// AgeOfTD V2 — waves.js : 30 vagues + mode sans fin + élites
// ============================================================
'use strict';

TD.waves = (() => {
  const U = TD.util;
  const CHARM_WAVES = [5, 10, 15, 20, 25, 30, 35, 40, 45];

  // événements jour/nuit (port V1) — déclenchés entre les vagues
  const EVENTS = [
    { icon: '🏮', title: 'Marchand ambulant', sub: '+70 or', good: true, apply: () => TD.game.addGold(70) },
    { icon: '🌾', title: 'Récolte chanceuse', sub: '+50 or', good: true, apply: () => TD.game.addGold(50) },
    { icon: '⛩️', title: 'Bénédiction des Kami', sub: 'Unités soignées', good: true, apply: () => { for (const u of TD.game.units) u.hp = u.maxHp; } },
    { icon: '🍃', title: 'Cadeau du Tengu', sub: '+50 mana', good: true, apply: () => { TD.game.mana = Math.min(TD.game.maxMana, TD.game.mana + 50); } },
    { icon: '🌸', title: 'Pluie de Sakura', sub: '+6 vies', good: true, apply: () => { TD.game.maxLives += 6; TD.game.lives += 6; } },
    { icon: '☄️', title: 'Pluie de météores', sub: '-2 vies !', good: false, apply: () => { TD.game.lives = Math.max(1, TD.game.lives - 2); TD.fx.shake(0.4); } },
  ];
  function maybeEvent(w) {
    if (w < 3 || !U.chance(0.3)) return;
    const ev = U.choice(EVENTS);
    ev.apply();
    TD.ui.banner(`${ev.icon} ${ev.title}`, ev.sub, ev.good ? 'clear' : 'boss', 2600);
  }

  let state = 'idle';            // idle | spawning | fighting
  let queue = [];                // [{time, type, opts}]
  let spawnT = 0;
  let countdown = -1;            // -1 = attend le bouton (vague 1)
  let elitesLeft = 0;

  const G = (type, count, gap, delay = 0, opts = null) => ({ type, count, gap, delay, opts });

  function comp(w) {
    switch (w) {
      case 1: return { groups: [G('kodama', 8, 1.15)] };
      case 2: return { groups: [G('kodama', 13, 0.9)] };
      case 3: return { groups: [G('kodama', 8, 0.9), G('kappa', 5, 0.8, 6)], label: 'Des Kappa pressés' };
      case 4: return { groups: [G('kappa', 11, 0.65)] };
      case 5: return { groups: [G('kodama', 10, 0.8), G('tanuki', 4, 1.4, 4)], label: 'Premiers Tanuki' };
      case 6: return { groups: [G('tanuki', 8, 1.0), G('kappa', 6, 0.7, 5)] };
      case 7: return { groups: [G('oni', 4, 2.4), G('kodama', 12, 0.7, 3)], label: 'Premiers Oni' };
      case 8: return { groups: [G('tengu', 10, 1.0)], label: 'Vol de Tengu !' };
      case 9: return { groups: [G('oni', 6, 2.0), G('kappa', 10, 0.6, 4)] };
      case 10: return { groups: [G('boss_oni', 1, 0, 1.5, { boss: true }), G('kodama', 8, 1.2, 8)], label: 'Oni Daimyō', boss: true };
      case 11: return { groups: [G('kodama', 16, 0.55), G('tanuki', 6, 1.1, 5), G('kappa', 8, 0.6, 10)] };
      case 12: return { groups: [G('kitsune', 8, 1.2), G('kappa', 6, 0.7, 6)], label: 'Les Kitsune rôdent' };
      case 13: return { groups: [G('kappa', 22, 0.38)], label: 'Ruée éclair !' };
      case 14: return { groups: [G('yurei', 8, 1.4), G('kodama', 10, 0.7, 5)], label: 'Brume spectrale' };
      case 15: return { groups: [G('kitsune', 10, 1.0), G('tengu', 8, 1.0, 6)] };
      case 16: return { groups: [G('tanuki', 14, 0.6)], label: 'Invasion Tanuki' };
      case 17: return { groups: [G('daruma', 5, 2.6), G('oni', 6, 1.8, 5)], label: 'Mur de Daruma' };
      case 18: return { groups: [G('yurei', 10, 1.1), G('kitsune', 8, 1.0, 7), G('gashadokuro', 4, 1.6, 4)], label: 'Ossements errants' };
      case 19: return { groups: [G('oni', 10, 1.4), G('daruma', 4, 2.6, 8)] };
      case 20: return { groups: [G('boss_ryu', 1, 0, 1.5, { boss: true }), G('tengu', 8, 1.4, 10)], label: 'Ryūjin', boss: true };
      case 21: return { groups: [G('kodama', 14, 0.5), G('kappa', 12, 0.5, 5), G('tanuki', 8, 0.9, 10)] };
      case 22: return { groups: [G('tengu', 12, 0.7), G('kitsune', 8, 1.0, 6), G('itsumade', 4, 1.8, 8)], label: 'Rapaces blindés' };
      case 23: return { groups: [G('daruma', 8, 1.8), G('yurei', 8, 1.2, 6), G('miko', 3, 2.0, 3)], label: 'Prêtresses maudites' };
      case 24: return { groups: [G('kitsune', 12, 0.7), G('kappa', 14, 0.45, 6), G('jorogumo', 6, 1.1, 4)], label: 'Toiles de Jorōgumo' };
      case 25: return { groups: [G('oni', 12, 1.2), G('daruma', 6, 2.0, 8), G('tengu', 6, 1.2, 14)] };
      case 26: return { groups: [G('daruma', 12, 1.3)], label: 'La Grande Muraille' };
      case 27: return { groups: [G('yurei', 12, 0.8), G('nurikabe', 3, 2.4, 5), G('nopperabo', 3, 2.2, 7)], label: 'Sans-visage' };
      case 28: return { groups: [G('kodama', 10, 0.4), G('kappa', 10, 0.45, 4), G('tanuki', 8, 0.8, 8), G('oni', 8, 1.4, 12), G('tengu', 8, 1.0, 16)], label: 'Chaos total' };
      case 29: return { groups: [G('daruma', 10, 1.4), G('oni', 10, 1.2, 6), G('shuten', 4, 1.8, 8), G('onryo', 6, 1.2, 14)], label: 'Avant-garde du Shōgun' };
      case 30: return { groups: [G('boss_shogun', 1, 0, 2, { boss: true }), G('oni', 6, 2.2, 12), G('daruma', 4, 2.8, 20)], label: 'Shōgun des Ombres', boss: true };
      case 31: return { groups: [G('kappa', 22, 0.4), G('onryo', 8, 1.0, 6)], label: 'Ruée nocturne' };
      case 32: return { groups: [G('oni', 12, 1.2), G('nurikabe', 5, 1.8, 6)], label: 'Forteresse mouvante' };
      case 33: return { groups: [G('tengu', 16, 0.7), G('kitsune', 10, 0.9, 6), G('miko', 4, 1.4, 10)] };
      case 34: return { groups: [G('gashadokuro', 8, 1.2), G('yurei', 12, 0.8, 5)], label: "Marée d'os" };
      case 35: return { groups: [G('shuten', 6, 1.8), G('daruma', 8, 1.6, 6), G('oni', 10, 1.2, 12)] };
      case 36: return { groups: [G('kitsune', 16, 0.6), G('onryo', 10, 0.9, 6), G('jorogumo', 8, 0.8, 4)], label: 'Spectres furtifs' };
      case 37: return { groups: [G('daruma', 12, 1.3), G('nurikabe', 6, 1.6, 8)], label: 'Le grand mur' };
      case 38: return { groups: [G('tengu', 18, 0.6), G('tanuki', 14, 0.6, 6), G('miko', 5, 1.3, 10)] };
      case 39: return { groups: [G('oni', 14, 1.0), G('shuten', 8, 1.4, 6), G('gashadokuro', 8, 1.1, 12)], label: 'Avant-garde du Kappa' };
      case 40: return { groups: [G('boss_kappa', 1, 0, 2, { boss: true }), G('kappa', 16, 0.5, 12), G('nurikabe', 4, 2.2, 20)], label: 'Kappa Géant', boss: true };
      case 41: return { groups: [G('kappa', 26, 0.32), G('kodama', 20, 0.4, 4)], label: 'Déferlante' };
      case 42: return { groups: [G('yurei', 16, 0.7), G('onryo', 12, 0.8, 6), G('gashadokuro', 8, 1.0, 12)] };
      case 43: return { groups: [G('daruma', 14, 1.2), G('shuten', 8, 1.4, 8)], label: 'Colosses enragés' };
      case 44: return { groups: [G('tengu', 18, 0.55), G('itsumade', 8, 1.1, 6), G('miko', 6, 1.2, 12)], label: 'Tempête céleste' };
      case 45: return { groups: [G('oni', 16, 1.0), G('nurikabe', 8, 1.5, 6), G('daruma', 10, 1.4, 12)] };
      case 46: return { groups: [G('onryo', 16, 0.6), G('yurei', 14, 0.7, 6), G('gashadokuro', 10, 0.9, 12)], label: 'Légion spectrale' };
      case 47: return { groups: [G('shuten', 12, 1.2), G('oni', 14, 1.0, 8)], label: 'Horde berserk' };
      case 48: return { groups: [G('kappa', 24, 0.35), G('tengu', 16, 0.6, 5), G('kitsune', 14, 0.7, 10), G('onryo', 10, 0.9, 14)], label: 'Chaos total' };
      case 49: return { groups: [G('daruma', 14, 1.1), G('nurikabe', 8, 1.5, 6), G('shuten', 10, 1.3, 12), G('gashadokuro', 10, 1.0, 18)], label: 'Dernier rempart' };
      case 50: return { groups: [G('boss_king', 1, 0, 2.5, { boss: true }), G('shuten', 8, 1.6, 14), G('daruma', 6, 2.4, 24), G('onryo', 10, 1.0, 30)], label: 'Yokai Suprême', boss: true };
    }
    // ── sans fin ──
    const k = (w - 50);
    const mult = 1 + k * 0.18;
    const n = x => Math.round(x * mult);
    if (w % 10 === 0) {
      const bossKey = ['boss_oni', 'boss_ryu', 'boss_kappa', 'boss_shogun', 'boss_king'][(w / 10) % 5];
      return { groups: [G(bossKey, 1, 0, 1.5, { boss: true }), G('daruma', n(5), 1.6, 10), G('kitsune', n(8), 0.8, 16)], label: TD.enemies.DEFS[bossKey].name + ' +', boss: true };
    }
    const templates = [
      [G('kodama', n(18), 0.4), G('kappa', n(14), 0.4, 5), G('gashadokuro', n(4), 1.4, 8)],
      [G('oni', n(10), 1.1), G('nurikabe', n(4), 1.8, 8), G('nopperabo', n(4), 1.6, 12)],
      [G('tengu', n(12), 0.7), G('itsumade', n(6), 1.0, 6), G('onryo', n(6), 1.1, 12)],
      [G('yurei', n(12), 0.8), G('jorogumo', n(8), 0.7, 5), G('tanuki', n(12), 0.6, 8)],
      [G('shuten', n(6), 1.4), G('kappa', n(18), 0.35, 8), G('jorogumo', n(8), 0.7, 14)],
    ];
    return { groups: templates[w % templates.length], label: 'Sans fin ' + k };
  }

  // équilibrage co-op : l'or/les vies restent partagés (pas de bonus), mais
  // chaque joueur en plus apporte de l'attention/APM en plus (tours posées et
  // gérées plus vite, sorts et héros micro-gérés en parallèle) → on muscle les
  // yokai en conséquence. +28% PV par joueur supplémentaire (2 joueurs ×1.28).
  function coopMul() {
    const n = TD.game.humanCount();
    return n > 1 ? 1 + 0.28 * (n - 1) : 1;
  }

  const quadWave = w => 1 + 0.16 * (w - 1) + 0.011 * (w - 1) * (w - 1);

  function hpMul(w) {
    const d = TD.game.diff;
    let m = quadWave(w) * d.hpMul;
    if (w > 50) m *= Math.pow(1.10, w - 50);
    m *= Math.pow(1.25, TD.game.ngPlus || 0);     // New Game+
    m *= coopMul();
    return m;
  }

  // PV d'un boss : les 5 PV de base (enemies.js) sont calibrés à la main pour leur
  // vague d'apparition habituelle (10/20/30/40/50, cf. comp()), donc PAS multipliés
  // par quadWave(w) comme les ennemis normaux (ça retunerait tous les boss). Au-delà
  // de la vague 50 (Sans Fin, mêmes boss recyclés tous les 10 paliers), on applique
  // en revanche la MÊME croissance relative que les ennemis normaux — sans ça les
  // boss décrochaient progressivement de la courbe (seul le ×1.10^(w-50) restait,
  // sans le terme quadratique que les vagues normales continuent d'accumuler).
  function bossHpMul(w) {
    const d = TD.game.diff;
    let m = d.hpMul * Math.pow(1.25, TD.game.ngPlus || 0) * coopMul();
    if (w > 50) m *= Math.pow(1.10, w - 50) * (quadWave(w) / quadWave(50));
    return m;
  }

  const isBossWave = w => !!comp(w).boss;

  function start() {
    const w = TD.game.wave + 1;
    TD.game.wave = w;
    const c = comp(w);
    state = 'spawning';
    spawnT = 0;
    queue = [];
    for (const g of c.groups) {
      for (let i = 0; i < g.count; i++) {
        queue.push({ time: g.delay + i * g.gap, type: g.type, opts: g.opts });
      }
    }
    queue.sort((a, b) => a.time - b.time);
    elitesLeft = w >= 6 ? 1 + Math.floor(w / 15) : 0;
    countdown = -1;
    TD.ui.onWaveStart(w, c);
    TD.audio.sfx(c.boss ? 'boss' : 'wave');
    TD.audio.setBossMode(!!c.boss);
    if (c.boss) TD.fx.shake(0.3);
  }

  function callNext() {
    if (state !== 'idle' || TD.game.state !== 'playing') return;
    if (countdown > 0) {
      const bonus = Math.ceil(countdown * 3 * (TD.mods.callBonusMul || 1));
      TD.game.addGold(bonus);
      TD.fx.floatText(640, 140, '+' + bonus + ' or (appel anticipé)', '#ffd24a', 18);
    }
    start();
  }

  function update(dt) {
    if (TD.game.state !== 'playing') return;
    if (state === 'idle') {
      if (countdown > 0) {
        countdown -= dt;
        if (countdown <= 0) start();
      }
      return;
    }
    if (state === 'spawning') {
      spawnT += dt;
      while (queue.length && queue[0].time <= spawnT) {
        const ev = queue.shift();
        const opts = { hpMul: ev.opts && ev.opts.boss ? bossHpMul(TD.game.wave) : hpMul(TD.game.wave) };
        if (!ev.opts || !ev.opts.boss) {
          const eliteChance = 0.12 + (TD.game.diff.eliteBonus || 0) + Math.max(0, TD.game.humanCount() - 1) * 0.03;
          if (elitesLeft > 0 && U.chance(eliteChance)) { opts.elite = true; elitesLeft--; }
        }
        TD.game.spawnEnemy(ev.type, opts);
      }
      if (!queue.length) state = 'fighting';
    }
    if (state === 'fighting' && TD.game.enemies.length === 0) cleared();
  }

  function cleared() {
    state = 'idle';
    const w = TD.game.wave;
    TD.audio.setBossMode(false);
    let bonus = Math.round((35 + w * 6) * (TD.mods.goldMul || 1));
    if (TD.mods.interest > 0) bonus += Math.min(60, Math.floor(TD.game.gold * TD.mods.interest));
    TD.game.addGold(bonus);
    TD.game.stats.wavesCleared = w;
    TD.ui.onWaveCleared(w, bonus);
    TD.game.objectiveEvent('wave', w);

    if (w === 50 && !TD.game.endless) { TD.game.onVictory(); return; }
    if (w % 8 === 0) TD.game.respawnNodes();   // l'économie ne tarit jamais totalement (utile en Sans Fin) — nb par défaut scale avec humanCount()
    maybeEvent(w);
    TD.weather.roll();           // météo de la prochaine vague (annoncée pendant l'accalmie)
    const needCharm = CHARM_WAVES.includes(w) || (w > 50 && w % 10 === 5);
    countdown = isBossWave(w + 1) ? 18 : 12;
    if (needCharm) TD.charms.offer();
  }

  function reset() {
    state = 'idle'; queue = []; spawnT = 0; countdown = -1; elitesLeft = 0;
  }

  return {
    update, callNext, reset, hpMul, bossHpMul, isBossWave, comp, coopMul,
    get state() { return state; },
    get countdown() { return countdown; },
    get remaining() { return queue.length; },
  };
})();

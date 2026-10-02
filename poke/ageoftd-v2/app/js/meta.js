// ============================================================
// AgeOfTD V2 — meta.js : méta-progression (port V1)
// ------------------------------------------------------------
// Progression PERSISTANTE entre les parties (localStorage aotd2_meta) :
//  • Succès : objectifs débloqués au fil des parties (toast + pétales).
//  • Pétales de prestige : monnaie gagnée à chaque fin de partie.
//  • Améliorations permanentes : dépensées en boons appliqués au départ
//    (or, vies, mana, dégâts des tours, niveau de départ du héros).
// Local (solo/hôte) — l'invité co-op ne déclenche pas la méta.
// ============================================================
'use strict';

TD.meta = (() => {
  // ── améliorations permanentes ────────────────────────────
  const UPGRADES = [
    { id: 'gold',  icon: '💰', name: 'Pécule ancestral', per: 40,   max: 5, unit: 'or de départ',     fmt: v => '+' + v + ' or' },
    { id: 'lives', icon: '💖', name: 'Sanctuaire béni',   per: 2,    max: 5, unit: 'vies de départ',   fmt: v => '+' + v + ' vies' },
    { id: 'mana',  icon: '🔮', name: 'Flux de mana',      per: 0.6,  max: 4, unit: 'mana/s',           fmt: v => '+' + v.toFixed(1) + ' mana/s' },
    { id: 'dmg',   icon: '⚔️', name: 'Arsenal aiguisé',   per: 0.03, max: 5, unit: 'dégâts des tours', fmt: v => '+' + Math.round(v * 100) + '% dégâts' },
    { id: 'hero',  icon: '🗡️', name: 'Sang de samouraï',  per: 1,    max: 3, unit: 'niveau du héros',  fmt: v => 'Héros niv. ' + (1 + v) },
  ];
  const upCost = lvl => 25 + lvl * 25;   // coût pour passer du niveau `lvl` à `lvl+1`

  // ── succès ───────────────────────────────────────────────
  const ACHIEVEMENTS = [
    { id: 'firstwin', icon: '🌸', name: 'Première fleur',   desc: 'Remporter une partie',                 reward: 25, check: c => c.win },
    { id: 'hard',     icon: '🏯', name: 'Gardien aguerri',  desc: 'Gagner en Difficile',                  reward: 50, check: c => c.win && c.minDifficulty === 'difficile' },
    { id: 'wave25',   icon: '🌊', name: 'Survivant',        desc: 'Atteindre la vague 25',                reward: 20, check: c => c.wave >= 25 },
    // reward abaissé de 60 à 45 : réalisable dès Facile, il rapportait plus que
    // hard/ngplus/endless60 (50 chacun) qui exigent en plus une difficulté/un
    // mode réellement plus dur, pas juste de la chance/prudence sur une partie.
    { id: 'flawless', icon: '👑', name: 'Invaincu',         desc: 'Gagner sans perdre une seule vie',     reward: 45, check: c => c.win && c.lives >= c.maxLives },
    { id: 'hero10',   icon: '🗡️', name: 'Maître du sabre',  desc: 'Amener le héros au niveau 10',         reward: 40, check: c => c.heroLevel >= 10 },
    { id: 'legion',   icon: '⚔️', name: 'Légion',           desc: 'Déployer 10 unités en une partie',     reward: 25, check: c => (c.stats.unitsDeployed || 0) >= 10 },
    { id: 'hunter',   icon: '💀', name: 'Grand chasseur',   desc: 'Éliminer 1500 yokai au total',         reward: 40, check: c => c.lifetime.kills >= 1500 },
    { id: 'architect',icon: '🏗️', name: 'Architecte',       desc: 'Poser 8 types de tours en une partie', reward: 30, check: c => (c.stats.towerTypes || 0) >= 8 },
    { id: 'ngplus',   icon: '🔥', name: 'Toujours plus',    desc: 'Terminer un New Game+',                reward: 50, check: c => c.win && c.ngPlus >= 1 },
    { id: 'fortune',  icon: '🪙', name: 'Fortune',          desc: 'Amasser 5000 or en une partie',        reward: 30, check: c => (c.stats.peakGold || 0) >= 5000 },
    { id: 'endless60',icon: '♾️', name: 'Sans fin',         desc: 'Atteindre la vague 60',                reward: 50, check: c => c.wave >= 60 },
    // reward abaissé de 30 à 20 : ne demande ni victoire ni performance, juste du
    // temps de jeu cumulé — il rapportait autant que legion/architect/fortune qui,
    // eux, exigent une vraie performance sur une seule partie.
    { id: 'veteran',  icon: '🎖️', name: 'Vétéran',          desc: 'Jouer 15 parties',                     reward: 20, check: c => c.lifetime.games >= 15 },
  ];

  // ── apparences du héros (skins) ──────────────────────────
  const SKINS = [
    { id: 'crimson', name: 'Cramoisi', icon: '🟥', cost: 0,   pal: { body: '#c0414f', dark: '#8f2f3e', crest: '#ffd24a', aura: '#ffd98a' } },
    { id: 'onyx',    name: 'Onyx',     icon: '⬛', cost: 90,  pal: { body: '#3a3f4a', dark: '#23272e', crest: '#9fd0ff', aura: '#9fd0ff' } },
    { id: 'jade',    name: 'Jade',     icon: '🟩', cost: 120, pal: { body: '#3fa37a', dark: '#2a7355', crest: '#ffe27a', aura: '#aef0c8' } },
    { id: 'gold',    name: 'Doré',     icon: '🟨', cost: 170, pal: { body: '#e0a83a', dark: '#b07e1e', crest: '#fff0a0', aura: '#ffe89a' } },
    { id: 'sakura',  name: 'Sakura',   icon: '🌸', cost: 140, pal: { body: '#ff8fb8', dark: '#d45a86', crest: '#fff0f5', aura: '#ffd9e8' } },
  ];

  // ── défis du jour (modificateurs tournants par date) ─────
  const CHALLENGES = [
    { id: 'fog',   icon: '🌫️', name: "Brouillard d'Obon", desc: 'Brouillard permanent · +30% or',        apply: () => { TD.weather.force('fog'); TD.mods.goldMul *= 1.3; } },
    { id: 'storm', icon: '⛈️', name: 'Colère de Raijin',   desc: 'Orage permanent — éclairs alliés',       apply: () => { TD.weather.force('storm'); } },
    { id: 'glass', icon: '⚔️', name: 'Verre & fureur',     desc: 'Tours +50% dégâts, −30% portée',         apply: () => { TD.mods.dmgMul *= 1.5; TD.mods.towerRangeMul *= 0.7; } },
    { id: 'swift', icon: '💨', name: 'Course-poursuite',   desc: 'Yokai +30% vitesse · +40% or',           apply: () => { TD.mods.enemySpeedMul *= 1.3; TD.mods.goldMul *= 1.4; } },
    { id: 'solo',  icon: '🗡️', name: 'Voie solitaire',     desc: 'Pas de héros · tours +20% dégâts',       apply: () => { TD.game.heroDisabled = true; TD.mods.dmgMul *= 1.2; } },
    { id: 'poor',  icon: '💰', name: 'Marché noir',        desc: 'Or de départ ÷2 · gains +60%',           apply: () => { TD.game.gold = Math.floor(TD.game.gold / 2); TD.mods.goldMul *= 1.6; } },
  ];

  const fresh = () => ({ petals: 0, upgrades: {}, achievements: {}, skins: {}, activeSkin: 'crimson', dailyBest: {}, lifetime: { games: 0, kills: 0, waves: 0, victories: 0 } });
  let S = fresh();
  let _last = null;   // résultat de la dernière fin de partie (pour l'écran de fin)

  function load() {
    try { const raw = JSON.parse(localStorage.getItem('aotd2_meta')); if (raw) S = Object.assign(fresh(), raw, { lifetime: Object.assign(fresh().lifetime, raw.lifetime || {}) }); } catch (e) {}
  }
  function save() { try { localStorage.setItem('aotd2_meta', JSON.stringify(S)); } catch (e) {} }

  const upLevel = id => S.upgrades[id] || 0;
  const upDef = id => UPGRADES.find(u => u.id === id);

  // ── application des améliorations au démarrage (solo/hôte) ─
  function applyToGame() {
    const g = TD.game;
    g.gold += UPGRADES[0].per * upLevel('gold');
    const lv = UPGRADES[1].per * upLevel('lives');
    g.maxLives += lv; g.lives = g.maxLives;
    g.manaRegen = 3 + UPGRADES[2].per * upLevel('mana');
    TD.mods.dmgMul *= 1 + UPGRADES[3].per * upLevel('dmg');
    if (upLevel('hero') > 0 && TD.hero.setStartLevel) TD.hero.setStartLevel(1 + UPGRADES[4].per * upLevel('hero'));
  }

  // ── fin de partie : pétales + succès ─────────────────────
  function onGameEnd(win) {
    const g = TD.game, st = g.stats || {};
    S.lifetime.games++;
    S.lifetime.kills += st.kills || 0;
    S.lifetime.waves = Math.max(S.lifetime.waves, st.wavesCleared || 0);
    if (win) S.lifetime.victories++;

    const earned = Math.round((st.wavesCleared || 0) * 2 + (win ? 40 : 0) + (g.ngPlus || 0) * 20 + Math.max(0, (g.wave || 0) - 50));
    S.petals += earned;

    // « Gagner en Difficile » se base sur le rang le PLUS BAS jamais réglé
    // pendant la partie (setDifficulty en pause) — sinon on peut basculer sur
    // Difficile juste avant la victoire pour voler le succès.
    const minRank = g.minDiffRank != null ? g.minDiffRank : TD.game.DIFF_ORDER.indexOf(g.difficulty);
    const ctx = {
      win, stats: st, difficulty: g.difficulty, minDifficulty: TD.game.DIFF_ORDER[minRank] || g.difficulty,
      heroLevel: (TD.hero.info ? TD.hero.info().level : 1),
      lifetime: S.lifetime, ngPlus: g.ngPlus || 0, lives: g.lives, maxLives: g.maxLives, wave: g.wave || 0,
    };
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (S.achievements[a.id]) continue;
      let ok = false; try { ok = a.check(ctx); } catch (e) {}
      if (ok) { S.achievements[a.id] = 1; S.petals += a.reward || 20; newly.push(a); }
    }
    // défi du jour : meilleur score + bonus de pétales
    let dailyImproved = false;
    if (g.challenge) {
      const k = dailyKey(), prev = S.dailyBest[k] || 0;
      if ((g.wave || 0) > prev) { S.dailyBest[k] = g.wave || 0; S.petals += 30; dailyImproved = true; }
    }
    save();
    _last = { earned, newly, dailyImproved };
    if (newly.length && TD.ui.banner) {
      const a = newly[0];
      TD.ui.banner(`${a.icon} Succès : ${a.name}`, newly.length > 1 ? `+${newly.length} succès · +pétales` : a.desc, 'age', 3000);
    }
    return _last;
  }

  function buyUpgrade(id) {
    const def = upDef(id); if (!def) return false;
    const lvl = upLevel(id);
    if (lvl >= def.max) return false;
    const cost = upCost(lvl);
    if (S.petals < cost) return false;
    S.petals -= cost; S.upgrades[id] = lvl + 1; save();
    return true;
  }

  // ── skins ────────────────────────────────────────────────
  const SKIN = id => SKINS.find(s => s.id === id);
  const ownsSkin = id => id === 'crimson' || !!S.skins[id];
  const heroSkin = () => (SKIN(S.activeSkin) || SKINS[0]).pal;
  function buySkin(id) {
    const d = SKIN(id); if (!d || ownsSkin(id)) return false;
    if (S.petals < d.cost) return false;
    S.petals -= d.cost; S.skins[id] = 1; S.activeSkin = id; save();
    return true;
  }
  function setSkin(id) { if (!ownsSkin(id)) return false; S.activeSkin = id; save(); return true; }

  // ── défi du jour (déterministe par date) ─────────────────
  function dailyKey() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return '2026-01-01'; } }
  function dailyChallenge() {
    const k = dailyKey(); let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return CHALLENGES[h % CHALLENGES.length];
  }
  const dailyBestWave = () => S.dailyBest[dailyKey()] || 0;

  return {
    load, save, applyToGame, onGameEnd, buyUpgrade,
    UPGRADES, ACHIEVEMENTS, SKINS, upCost, upLevel, upDef,
    ownsSkin, heroSkin, buySkin, setSkin,
    dailyChallenge, dailyBestWave, dailyKey,
    get petals() { return S.petals; },
    get state() { return S; },
    lastResult: () => _last,
    achievedCount: () => Object.keys(S.achievements).length,
  };
})();

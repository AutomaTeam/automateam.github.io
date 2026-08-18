// ============================================================
// AgeOfTD V2 — game.js : orchestrateur (état, boucle, input, rendu)
// ============================================================
'use strict';

// modificateurs globaux (omamori)
TD.mods = {};
function resetMods() {
  Object.assign(TD.mods, {
    dmgMul: 1, rateMul: 1, goldMul: 1, slowBonus: 0, critChance: 0,
    chainBonus: 0, upgCostMul: 1, interest: 0, cloudMul: 1, beamRampMul: 1, callBonusMul: 1,
    unitDmgMul: 1, unitRegen: 0, towerRangeMul: 1, enemySpeedMul: 1,
  });
}
resetMods();

TD.game = (() => {
  const U = TD.util, M = TD.map;

  const AGES = [
    { name: 'Âge de Pierre', short: 'Pierre', icon: '🪨', cost: 0 },
    { name: 'Âge de Bronze', short: 'Bronze', icon: '🥉', cost: 300 },
    { name: 'Âge de Fer',    short: 'Fer',    icon: '⚔️', cost: 650 },
    { name: 'Âge Arcane',    short: 'Arcane', icon: '🔮', cost: 1100 },
  ];
  // écart facile→normal élargi (était +17.6% PV / 0pt élite, contre +22% PV / +10pt
  // élite pour normal→difficile — un « facile » quasi identique au normal) : PV
  // encore réduits et moins d'élites pour un vrai palier débutant.
  const DIFFS = {
    facile:    { name: 'Facile',    lives: 28, gold: 260, hpMul: 0.72, eliteBonus: -0.04 },
    normal:    { name: 'Normal',    lives: 20, gold: 220, hpMul: 1.00, eliteBonus: 0 },
    difficile: { name: 'Difficile', lives: 14, gold: 200, hpMul: 1.22, eliteBonus: 0.10 },
  };
  const DIFF_ORDER = ['facile', 'normal', 'difficile'];
  // nombre de joueurs humains connectés (hôte + invités, PAS le bot allié)
  const humanCount = () => TD.net.isMP() ? TD.net.peers.length + 1 : 1;
  // sorts du joueur (port V1) — coûtent du mana, ciblés au clic
  const SPELLS = {
    meteor: { key: 'meteor', name: 'Météore', icon: '☄️', cost: 60, cd: 15, radius: 115, hotkey: 'q', desc: 'Pluie de feu : gros dégâts de zone + brûlure.' },
    freeze: { key: 'freeze', name: 'Blizzard', icon: '❄️', cost: 35, cd: 10, radius: 135, hotkey: 'w', desc: 'Gèle et ralentit tous les yokai de la zone.' },
    heal:   { key: 'heal',   name: 'Bénédiction', icon: '💮', cost: 40, cd: 8, radius: 145, hotkey: 'e', desc: 'Soigne vos unités alliées dans la zone.' },
  };
  const SPELL_ORDER = ['meteor', 'freeze', 'heal'];
  // reliques neutres (port V1) — réclamées par les unités alliées
  const RELICS = {
    or:    { type: 'or',    icon: '💰', name: 'Trésor', color: '#ffd24a', sub: '+220 or',          apply: () => addGold(220) },
    force: { type: 'force', icon: '⚔️', name: 'Relique de Force', color: '#ff6b5d', sub: '+25% dégâts des unités', apply: () => { TD.mods.unitDmgMul += 0.25; } },
    soin:  { type: 'soin',  icon: '💚', name: 'Relique de Vie', color: '#8fd17a', sub: 'Unités : +4 PV/s', apply: () => { TD.mods.unitRegen += 4; } },
  };
  const RELIC_ORDER = ['or', 'force', 'soin'];
  let relicId = 1;
  // objectifs secondaires (port V1) — 2 tirés par partie
  const OBJ_POOL = [
    () => ({ kind: 'reach', desc: 'Atteindre la vague 20', target: 20, reward: 250 }),
    () => ({ kind: 'reach', desc: 'Atteindre la vague 35', target: 35, reward: 400 }),
    () => ({ kind: 'boss', desc: 'Vaincre un boss', reward: 200 }),
    () => ({ kind: 'noleak', desc: 'Aucune fuite avant la vague 8', deadline: 8, reward: 250 }),
    () => ({ kind: 'units', desc: 'Déployer 6 unités alliées', target: 6, count: 0, reward: 200 }),
  ];

  let canvas, ctx, dpr = 1;
  let vignette = null;

  const game = {
    AGES, SPELLS, SPELL_ORDER, RELICS, RELIC_ORDER,
    relics: [], objectives: [],
    state: 'menu',          // menu | playing | over  (victoire = modalPause+victoryToken, cf. onVictory)
    modalPause: false,
    victoryToken: 0,        // incrémenté à chaque victoire — permet aux invités de la détecter via le snapshot
    speed: 1,
    time: 0,
    wave: 0, gold: 0, lives: 20, maxLives: 20,
    wood: 0, stone: 0, nodes: [], basePoint: { x: 1184, y: 360 },
    mapId: M.id,
    challenge: null, heroDisabled: false,
    age: 0, endless: false, ngPlus: 0,
    mana: 40, maxMana: 100, manaRegen: 3, spellCd: { meteor: 0, freeze: 0, heal: 0 },
    difficulty: 'normal', diff: DIFFS.normal,
    enemies: [], towers: [], units: [],
    towerCells: new Map(),
    selectedShop: null, selectedTower: null, selectedSpell: null, selectedVillager: null, heroPlacing: false,
    hover: null, mouse: { x: -100, y: -100 },
    leakFlash: 0,
    stats: null,
    settings: { music: 0.5, sfx: 0.8, shake: true, particles: 'normal' },
    records: { bestWave: 0, victories: 0, bestNG: 0 },
  };
  let menuActors = [];
  let fwTimer = 0, fwActive = false;
  let synergyT = 0;

  // ── boot ─────────────────────────────────────────────────
  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = M.W * dpr; canvas.height = M.H * dpr;
    loadSettings(); loadRecords(); TD.meta.load();
    TD.ui.init();
    applySettings();
    bindInput();
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('pointerdown', () => TD.audio.ensure(), { once: true });
    spawnMenuActors();
    TD.ui.showMenu(game.records);
    requestAnimationFrame(loop);
  }

  function resize() {
    const fw = window.innerWidth, fh = window.innerHeight;
    const scale = Math.min(fw / M.W, fh / M.H);
    const stage = document.getElementById('stage');
    stage.style.transform = `scale(${scale})`;
    TD.ui.stageScale = scale;
  }

  // ── settings / records ───────────────────────────────────
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('aotd2_settings'));
      if (s) Object.assign(game.settings, s);
    } catch (e) { /* défauts */ }
  }
  function saveSettings() { try { localStorage.setItem('aotd2_settings', JSON.stringify(game.settings)); } catch (e) {} }
  function applySettings() {
    TD.audio.setVolumes(game.settings.sfx, game.settings.music);
    TD.fx.setDensity(game.settings.particles);
    TD.fx.setShake(game.settings.shake);
  }
  function loadRecords() {
    try {
      const r = JSON.parse(localStorage.getItem('aotd2_records'));
      if (r) Object.assign(game.records, r);
    } catch (e) {}
  }
  function saveRecords() {
    game.records.bestWave = Math.max(game.records.bestWave, game.stats ? game.stats.wavesCleared : 0);
    try { localStorage.setItem('aotd2_records', JSON.stringify(game.records)); } catch (e) {}
  }

  // ── cycle de partie ──────────────────────────────────────
  function start(difficulty, ngPlus, challenge) {
    game.difficulty = difficulty;
    game.diff = DIFFS[difficulty] || DIFFS.normal;
    game.minDiffRank = DIFF_ORDER.indexOf(game.difficulty);
    game.ngPlus = ngPlus || 0;
    game.challenge = challenge || null;
    game.heroDisabled = false;
    game.state = 'playing';
    game.modalPause = false;
    game.victoryToken = 0;
    game.speed = 1;
    game.time = 0;
    game.wave = 0;
    game.gold = game.diff.gold;
    game.lives = game.maxLives = game.diff.lives;
    game.age = 0;
    game.endless = false;
    game.mana = 40; game.manaRegen = 3; game.spellCd = { meteor: 0, freeze: 0, heal: 0 }; game.selectedSpell = null;
    game.enemies = [];
    game.towers = [];
    game.units = [];
    game.towerCells.clear();
    game.selectedShop = null; game.selectedTower = null; game.selectedVillager = null; game.heroPlacing = false;
    game.leakFlash = 0;
    game.stats = { kills: 0, goldEarned: 0, crits: 0, leaks: 0, wavesCleared: 0, time: 0, dmgByTower: {}, peakGold: 0, towerTypes: 0, towerKeys: {}, unitsDeployed: 0 };
    fwActive = false;
    resetMods();
    TD.charms.reset();
    TD.towers.reset();
    TD.units.reset();
    TD.hero.reset();
    TD.synergy.reset();
    TD.weather.reset();
    TD.waves.reset();
    TD.fx.clear();
    TD.ui.refreshCharmsBar([]);
    TD.ui.hideMenu();
    game.wood = 40; game.stone = 20; buildNodes();
    spawnStartingTownhall();      // Hôtel de Ville gratuit + 1 villageois — amorce la boucle
                                   // de construction (sinon aucun villageois pour bâtir le 1er)
    TD.meta.applyToGame();        // améliorations permanentes (or/vies/mana/dégâts/héros)
    if (game.challenge) game.challenge.apply();   // défi du jour
    spawnRelics();
    pickObjectives();
    document.querySelectorAll('.spd').forEach(x => x.classList.toggle('on', x.dataset.s === '1'));
    if (game.challenge) TD.ui.banner(`${game.challenge.icon} Défi : ${game.challenge.name}`, game.challenge.desc, 'boss', 3400);
    else if (game.ngPlus > 0) TD.ui.banner(`🔥 New Game+ ${game.ngPlus}`, 'Yokai renforcés — gloire accrue', 'boss', 3200);
    else TD.ui.banner('⛩️ Protège le sanctuaire !', 'Pose des tours, ton villageois ira les construire — puis lance la vague 1', 'clear', 3600);
  }

  // démarrage côté invité : on prépare l'affichage, l'état viendra des snapshots
  function startAsGuest(difficulty) {
    game.difficulty = difficulty;
    game.diff = DIFFS[difficulty] || DIFFS.normal;
    game.minDiffRank = DIFF_ORDER.indexOf(game.difficulty);   // affiné par le snapshot (mdr)
    game.ngPlus = 0;                                          // idem (ngp)
    game.state = 'playing';
    game.modalPause = false;
    game.victoryToken = 0;
    game.speed = 1;
    game.time = 0;
    game.wave = 0;
    game.gold = 0;
    game.lives = game.maxLives = game.diff.lives;
    game.age = 0;
    game.endless = false;
    game.mana = 40; game.manaRegen = 3; game.spellCd = { meteor: 0, freeze: 0, heal: 0 }; game.selectedSpell = null;
    game.enemies = [];
    game.towers = [];
    game.units = [];
    game.relics = [];
    game.objectives = [];
    game.challenge = null; game.heroDisabled = false;
    game.wood = 0; game.stone = 0; buildNodes();
    game.towerCells.clear();
    game.selectedShop = null; game.selectedTower = null; game.selectedVillager = null; game.heroPlacing = false;
    game.leakFlash = 0;
    game.stats = { kills: 0, goldEarned: 0, crits: 0, leaks: 0, wavesCleared: 0, time: 0, dmgByTower: {}, peakGold: 0, towerTypes: 0, towerKeys: {}, unitsDeployed: 0 };
    fwActive = false;
    resetMods();
    TD.charms.reset();
    TD.towers.reset();
    TD.units.reset();
    TD.hero.reset();
    TD.synergy.reset();
    TD.weather.reset();
    TD.waves.reset();
    TD.fx.clear();
    TD.ui.refreshCharmsBar([]);
    TD.ui.hideMenu();
    TD.ui.banner('🤝 Partie co-op rejointe', "L'hôte fait autorité — défendez ensemble !", 'clear', 3200);
  }

  // réglage de difficulté EN COURS DE PARTIE (pause) : n'affecte que les
  // prochaines vagues (hpMul/élites lus en direct par waves.js), jamais l'or
  // ou les vies déjà distribués. Le rang le plus bas atteint est conservé
  // pour que le succès « Gagner en Difficile » reste sincère.
  function setDifficulty(id) {
    if (game.state !== 'playing' || !DIFFS[id] || id === game.difficulty) return;
    game.difficulty = id;
    game.diff = DIFFS[id];
    game.minDiffRank = Math.min(game.minDiffRank, DIFF_ORDER.indexOf(id));
    TD.ui.banner('🎚️ Difficulté : ' + DIFFS[id].name, 'Les prochaines vagues s\'ajustent', 'clear', 2600);
  }

  function toMenu() {
    saveRecords();
    if (TD.net.isMP()) TD.net.reset();
    if (TD.ai) TD.ai.disable();
    game.state = 'menu';
    game.modalPause = false;
    fwActive = false;
    TD.audio.setBossMode(false);
    TD.fx.clear();
    spawnMenuActors();
    TD.ui.showMenu(game.records);
  }

  function gameOver() {
    if (game.state !== 'playing') return;
    game.state = 'over';
    if (TD.net.role !== 'guest') TD.meta.onGameEnd(false);
    TD.audio.sfx('defeat');
    TD.audio.setBossMode(false);
    TD.fx.shake(0.8);
    saveRecords();
    setTimeout(() => TD.ui.showGameOver(game.stats), 900);
  }

  function onVictory() {
    game.records.victories++;
    game.records.bestNG = Math.max(game.records.bestNG || 0, game.ngPlus + 1);
    game.victoryToken++;   // sert de « pulse » que les invités détectent via le snapshot (state reste 'playing')
    if (TD.net.role !== 'guest') TD.meta.onGameEnd(true);
    saveRecords();
    game.modalPause = true;
    fwActive = true;
    TD.audio.sfx('victory');
    TD.ui.showVictory(game.stats);
  }

  function goEndless() {
    game.endless = true;
    game.modalPause = false;
    fwActive = false;
    TD.waves.callNext();
  }

  // ── économie / combat ────────────────────────────────────
  function addGold(n) {
    game.gold += n;
    if (n > 0 && game.stats) game.stats.goldEarned += n;
    if (game.stats && game.gold > game.stats.peakGold) game.stats.peakGold = game.gold;
  }
  function addResource(type, amt) {
    if (type === 'wood') game.wood += amt;
    else if (type === 'stone') game.stone += amt;
  }
  // le nombre de nœuds bois/pierre est figé par la carte (M.TREES/M.ROCKS), mais en
  // co-op chaque joueur en plus pose ses propres tours/casernes à ressources et son
  // propre Hôtel de Ville → contention sur le même pool de nœuds alors que les PV
  // ennemis scalent déjà par joueur (coopMul, cf. waves.js). On compense en rendant
  // chaque nœud plus généreux et les réapparitions plus fréquentes, plutôt qu'en
  // ajoutant des nœuds (la carte n'a pas forcément la place).
  const nodeCoopMul = () => 1 + 0.35 * (humanCount() - 1);
  const WOOD_SUPPLY = () => Math.round(120 * nodeCoopMul()), STONE_SUPPLY = () => Math.round(100 * nodeCoopMul());   // ~8-12 voyages/joueur avant épuisement d'un nœud
  const RESPAWN_EVERY = 8;    // toutes les 8 vagues, cf. waves.cleared()
  const RESPAWN_COUNT = () => Math.round(2 * nodeCoopMul());   // nouveaux nœuds à chaque réapparition

  function buildNodes() {
    game.nodes = [];
    game.extraNodes = [];
    game.depletedTreeCells = new Set();
    game.depletedRockCells = new Set();
    for (const [c, r] of M.TREES) { const p = M.cellCenter(c, r); game.nodes.push({ type: 'wood', x: p.x, y: p.y, c, r, supply: WOOD_SUPPLY() }); }
    for (const [c, r] of M.ROCKS) { const p = M.cellCenter(c, r); game.nodes.push({ type: 'stone', x: p.x, y: p.y, c, r, supply: STONE_SUPPLY() }); }
    game.basePoint = { ...M.basePoint };
  }

  // nœud épuisé (supply à 0) : retiré des cibles de récolte (units.js _gather()
  // se redirige déjà tout seul, cf. `!TD.game.nodes.includes(this.node)`) ; sa
  // cellule est mémorisée pour le rendu (souche/gravats, cf. bg.js).
  function depleteNode(node) {
    game.nodes = game.nodes.filter(n => n !== node);
    if (node.extra) { game.extraNodes = game.extraNodes.filter(n => n !== node); return; }
    (node.type === 'wood' ? game.depletedTreeCells : game.depletedRockCells).add(node.c + ',' + node.r);
  }

  // fait réapparaître `n` nœuds sur des cases libres — pour ne jamais tarir
  // l'économie en mode Sans Fin (appelé par waves.cleared() tous les RESPAWN_EVERY).
  // `n` par défaut scale avec le nombre de joueurs (RESPAWN_COUNT), l'appelant peut
  // toujours forcer un nombre explicite.
  function respawnNodes(n) {
    if (n == null) n = RESPAWN_COUNT();
    const spots = [];
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      if (!M.isBuildable(c, r) || game.towerCells.has(cellKey(c, r))) continue;
      spots.push({ c, r });
    }
    for (let i = spots.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[spots[i], spots[j]] = [spots[j], spots[i]]; }
    for (let i = 0; i < n && i < spots.length; i++) {
      const { c, r } = spots[i];
      const type = Math.random() < 0.5 ? 'wood' : 'stone';
      const p = M.cellCenter(c, r);
      const node = { type, x: p.x, y: p.y, c, r, supply: type === 'wood' ? WOOD_SUPPLY() : STONE_SUPPLY(), extra: true };
      M.blockCell(c, r);
      game.nodes.push(node);
      game.extraNodes.push(node);
      TD.fx.ring(p.x, p.y, type === 'wood' ? '#8fd17a' : '#b9c2cc', 60, 0.8, 5);
    }
  }

  // ── choix de la carte (menu / co-op) ─────────────────────
  // Recharge la carte + reconstruit le décor. Sûr uniquement HORS partie
  // (menu) ou juste avant un start — jamais en cours de simulation.
  function selectMap(id) {
    M.load(id);
    TD.bg.rebuild();
    game.mapId = M.id;
    if (game.state === 'menu') spawnMenuActors();   // repositionne les acteurs sur le nouveau chemin
  }

  function dealDamage(enemy, amount, kind, opts = {}) {
    let amt = amount, crit = false;
    if (!opts.quiet && TD.mods.critChance > 0 && U.chance(TD.mods.critChance)) {
      crit = true; amt *= 2;
    }
    const wasAlive = !enemy.dead;
    const dealt = enemy.takeDamage(amt, kind, { crit, quiet: opts.quiet, tag: opts.source });
    if (dealt > 0 && opts.source) {
      game.stats.dmgByTower[opts.source] = (game.stats.dmgByTower[opts.source] || 0) + dealt;
    }
    if (crit && dealt > 0) { game.stats.crits++; TD.audio.sfx('crit'); }
    if (wasAlive && enemy.dead && !enemy.leaked && opts.tower) opts.tower.kills++;
    return dealt;
  }

  function spawnEnemy(key, opts) {
    const e = new TD.enemies.Enemy(key, opts);
    game.enemies.push(e);
    return e;
  }
  function spawnUnit(key, x, y, homeId) {
    const u = new TD.units.Unit(key, x, y, homeId);
    game.units.push(u);
    // les villageois sont des unités économiques, pas militaires : ni l'objectif
    // « Déployer 6 unités alliées » ni le succès « Legion » (unitsDeployed) ne les comptent.
    if (key !== 'villager') {
      objectiveEvent('unit');
      if (game.stats) game.stats.unitsDeployed = (game.stats.unitsDeployed || 0) + 1;
    } else {
      tryAutoAssign(u);   // un chantier en attente prime sur la récolte par défaut
    }
    return u;
  }

  // ── reliques ─────────────────────────────────────────────
  function spawnRelics() {
    game.relics = []; relicId = 1;
    const cands = [];
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      if (!M.isBuildable(c, r)) continue;
      let near = false;
      for (let dc = -1; dc <= 1 && !near; dc++) for (let dr = -1; dr <= 1; dr++) if (M.pathCells.has((c + dc) + ',' + (r + dr))) { near = true; break; }
      if (near) cands.push({ c, r });
    }
    if (!cands.length) return;
    for (let i = 0; i < RELIC_ORDER.length; i++) {
      const idx = U.clamp(Math.floor(((i + 0.5) / RELIC_ORDER.length) * cands.length), 0, cands.length - 1);
      const ctr = M.cellCenter(cands[idx].c, cands[idx].r);
      game.relics.push({ id: relicId++, type: RELIC_ORDER[i], x: ctr.x, y: ctr.y - 6, claimed: false });
    }
  }
  function claimRelic(rl) {
    if (!rl || rl.claimed) return;
    rl.claimed = true;
    const def = RELICS[rl.type];
    def.apply();
    game.relics = game.relics.filter(r => r !== rl);
    TD.fx.ring(rl.x, rl.y, def.color, 60, 0.6, 5);
    TD.fx.petalBurst(rl.x, rl.y, def.color, 14);
    TD.audio.sfx('charm');
    TD.ui.banner(`${def.icon} ${def.name} réclamée !`, def.sub, 'clear', 2400);
  }
  function drawRelics(ctx, t) {
    for (const rl of game.relics) {
      const def = RELICS[rl.type];
      const fy = rl.y + Math.sin(t * 2 + rl.id) * 4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + 0.3 * U.pulse(t * 1.5);
      ctx.drawImage(TD.fx.glowSprite(def.color), rl.x - 24, fy - 24, 48, 48);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(40,30,60,0.3)';
      ctx.beginPath(); ctx.ellipse(rl.x, rl.y + 10, 14, 5, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(rl.x, fy, 9, 0, U.TAU); ctx.fill();
      ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, rl.x, fy);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }

  // ── objectifs secondaires ────────────────────────────────
  function pickObjectives() {
    const pool = OBJ_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    game.objectives = pool.slice(0, 2).map(f => { const o = f(); o.done = false; o.failed = false; return o; });
  }
  function completeObj(o) {
    o.done = true; addGold(o.reward);
    TD.ui.banner('🎯 Objectif accompli !', o.desc + ' (+' + o.reward + ' or)', 'clear', 2800);
    TD.audio.sfx('victory');
  }
  function objectiveEvent(type, val) {
    for (const o of game.objectives) {
      if (o.done || o.failed) continue;
      if (type === 'wave') {
        if (o.kind === 'reach' && val >= o.target) completeObj(o);
        // « Aucune fuite avant la vague N » : validé en atteignant la vague N,
        // c.-à-d. en nettoyant la vague N-1 (objectiveEvent('wave', w) reçoit la
        // vague NETTOYÉE). Sans le -1, on exigeait à tort de nettoyer la vague N.
        else if (o.kind === 'noleak' && val >= o.deadline - 1) completeObj(o);
      } else if (type === 'boss' && o.kind === 'boss') completeObj(o);
      else if (type === 'leak' && o.kind === 'noleak' && game.wave < o.deadline) o.failed = true;
      else if (type === 'unit' && o.kind === 'units') { o.count++; if (o.count >= o.target) completeObj(o); }
    }
  }
  const waveHpMul = () => TD.waves.hpMul(Math.max(1, game.wave));

  function onEnemyKilled(e) {
    const g = Math.round(e.gold * TD.mods.goldMul * Math.pow(1.18, game.ngPlus));
    addGold(g);
    game.stats.kills++;
    if (e.def.boss) {
      TD.ui.banner('👑 Boss vaincu !', `+${g} 🪙`, 'clear', 2600);
      TD.audio.sfx('victory');
      objectiveEvent('boss');
    }
  }

  function onEnemyLeaked(e) {
    objectiveEvent('leak');
    game.lives = Math.max(0, game.lives - e.livesCost);
    game.leakFlash = 1;
    game.stats.leaks++;
    TD.fx.shake(0.25);
    TD.fx.ring(e.x, e.y, '#ff6b5d', 40, 0.4);
    TD.audio.sfx('leak');
    TD.ui.hurtLives();
    if (game.lives <= 0) gameOver();
  }

  // ── tours ────────────────────────────────────────────────
  const cellKey = (c, r) => c + ',' + r;

  function selectShop(key) {
    const d = TD.towers.DEFS[key];
    if (d.age > game.age) {
      TD.ui.banner('🔒 ' + d.name, `Débloquée à l'${AGES[d.age].name}`, 'boss', 1500);
      return;
    }
    game.selectedShop = game.selectedShop === key ? null : key;
    game.selectedTower = null; game.selectedSpell = null; game.selectedVillager = null;
    TD.ui.hideTowerPanel();
  }

  function deselect() {
    game.selectedShop = null;
    game.selectedTower = null;
    game.selectedSpell = null;
    game.selectedVillager = null;
    game.heroPlacing = false;
    TD.ui.hideTowerPanel();
  }

  // arme le mode « déployer / déplacer le héros » (clic suivant = point de ralliement)
  function armHero() {
    if (game.heroDisabled) { TD.ui.banner('🗡️ Héros indisponible', 'Défi du jour : Voie solitaire', 'boss', 1600); return; }
    game.heroPlacing = !game.heroPlacing;
    game.selectedShop = null; game.selectedTower = null; game.selectedSpell = null; game.selectedVillager = null;
    TD.ui.hideTowerPanel();
  }

  // ── sorts du joueur ──────────────────────────────────────
  function armSpell(key) {
    if (!SPELLS[key]) return;
    game.selectedSpell = game.selectedSpell === key ? null : key;
    game.selectedShop = null; game.selectedTower = null; game.selectedVillager = null;
    TD.ui.hideTowerPanel();
  }

  // VFX d'un sort, séparés de l'effet de jeu. Joués localement à l'incantation
  // ET rejoués chez les invités via le snapshot (sinon ils ne voyaient aucun
  // retour visuel de leur propre sort — l'hôte fait autorité sur l'effet).
  function spellFx(key, x, y) {
    const sp = SPELLS[key]; if (!sp) return;
    if (key === 'meteor') { TD.fx.explosion(x, y, '#ff7a3c', sp.radius, true); TD.fx.shake(0.4); TD.audio.sfx('boss'); }
    else if (key === 'freeze') { TD.fx.ring(x, y, '#9fdcff', sp.radius, 0.6, 6); TD.audio.sfx('freeze'); }
    else if (key === 'heal') { TD.fx.ring(x, y, '#8fd17a', sp.radius, 0.6, 5); TD.audio.sfx('charm'); }
  }

  function castSpell(key, x, y, opts = {}) {
    const sp = SPELLS[key];
    if (!sp || game.mana < sp.cost || game.spellCd[key] > 0) { if (!opts.remote) TD.audio.sfx('error'); return; }
    game.mana -= sp.cost;
    game.spellCd[key] = sp.cd;
    spellFx(key, x, y);
    if (TD.net.role === 'host') TD.net.recordSpellFx(key, x, y);   // rejoué chez les invités
    const r2 = sp.radius * sp.radius;
    if (key === 'meteor') {
      for (const e of game.enemies) if (!e.dead && U.dist2(x, y, e.x, e.y) <= r2) { dealDamage(e, 150, 'magic', {}); e.applyBurn(14, 3); }
    } else if (key === 'freeze') {
      for (const e of game.enemies) if (!e.dead && U.dist2(x, y, e.x, e.y) <= r2) { e.applyFreeze(1.4); e.applySlow(0.5, 3); }
    } else if (key === 'heal') {
      for (const u of game.units) if (!u.dead && U.dist2(x, y, u.x, u.y) <= r2) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.5); u.flash = 0.5; }
    }
  }

  // Hôtel de Ville de départ, gratuit et déjà fini (pas un chantier) + 1 villageois —
  // sans ça, aucun villageois n'existerait pour construire le tout premier bâtiment.
  function spawnStartingTownhall() {
    let best = null, bd = Infinity;
    for (let r = 0; r < M.ROWS; r++) for (let c = 0; c < M.COLS; c++) {
      if (!M.isBuildable(c, r)) continue;
      const p = M.cellCenter(c, r);
      const d = U.dist2(p.x, p.y, game.basePoint.x, game.basePoint.y);
      if (d < bd) { bd = d; best = { c, r }; }
    }
    if (!best) return;
    const tw = new TD.towers.Tower('townhall', best.c, best.r);
    game.towers.push(tw);
    game.towerCells.set(cellKey(best.c, best.r), tw);
    spawnUnit('villager', tw.x + U.rand(-10, 10), tw.y + 10, tw.id);
  }

  // durée de construction estimée d'un chantier — fonction simple du coût or ; première
  // passe, à retoucher après playtest (Archer 80or→3.2s, Ozutsu 300or→12s).
  const computeBuildTime = cost => Math.max(3, cost / 25);

  function placeTower(key, c, r, opts = {}) {
    const d = TD.towers.DEFS[key];
    if (d.age > game.age) return null;
    if (game.gold < d.cost || game.wood < (d.wood || 0) || game.stone < (d.stone || 0) || !M.isBuildable(c, r) || game.towerCells.has(cellKey(c, r))) return null;
    addGold(-d.cost);
    if (d.wood) game.wood -= d.wood;
    if (d.stone) game.stone -= d.stone;
    const tw = new TD.towers.Tower(key, c, r);
    // toutes les tours passent par un chantier — aucune n'est fonctionnelle tant qu'un
    // villageois n'a pas fini de la construire (cf. completeConstruction, appelé depuis
    // units.js quand un villageois assigné termine buildTime secondes de travail).
    tw.underConstruction = true;
    tw.placedT = 0;
    tw.buildTime = computeBuildTime(d.cost);
    game.towers.push(tw);
    game.towers.sort((a, b) => a.y - b.y);
    game.towerCells.set(cellKey(c, r), tw);
    TD.audio.sfx('build');
    TD.fx.ring(tw.x, tw.y, d.color, 30, 0.35);
    if (!opts.remote && game.gold < d.cost) game.selectedShop = null;   // plus assez pour enchaîner
    return tw;
  }

  // appelé par units.js quand un villageois termine la construction d'un chantier —
  // c'est SEULEMENT à ce moment que la tour devient fonctionnelle (tir/production) et
  // que les stats de succès (« Architecte ») comptent la pose, pas à la mise en chantier.
  function completeConstruction(tw) {
    if (!tw || !tw.underConstruction) return;
    tw.underConstruction = false;
    // avec plusieurs bâtisseurs sur le même chantier, celui dont l'appel _build() ne
    // franchit PAS le seuil de 100% ce tick-ci (ex. le 1er des 2 appelés cette frame,
    // cf. units.js _gather) ne se serait normalement auto-libéré qu'au tick SUIVANT
    // (quand il constate underConstruction=false) — on libère donc ICI tout le monde
    // d'un coup, et on leur fait chercher un autre chantier tout de suite plutôt que
    // de partir récolter par défaut.
    for (const u of game.units) if (u.buildTask === tw) { u.buildTask = null; tryAutoAssign(u); }
    tw.builders.clear();
    tw.placedT = 1;   // relance le pop-in existant comme révélation de fin de chantier
    if (game.stats) { game.stats.towerKeys[tw.key] = 1; game.stats.towerTypes = Object.keys(game.stats.towerKeys).length; }
    TD.audio.sfx('build');
    TD.fx.ring(tw.x, tw.y, tw.def.color, 44, 0.45);
    TD.fx.petalBurst(tw.x, tw.y - 10, tw.def.color, 7);
  }

  // ── villageois : job (récolte/construction), sélection, recrutement ─────
  // comme dans Age of Empires : plusieurs villageois PEUVENT construire le même
  // chantier ensemble pour aller plus vite (chacun ajoute dt/buildTime en parallèle,
  // cf. units.js _build), plafonné pour éviter qu'une tour bon marché ne pope en un
  // instant si tout le village s'y presse.
  const MAX_BUILDERS = 3;

  // Libère le chantier qu'un villageois avait réservé (s'il en avait un) avant de lui
  // donner un nouvel ordre.
  function releaseBuildTask(unit) {
    if (unit.buildTask) unit.buildTask.builders.delete(unit.id);
    unit.buildTask = null;
  }
  // Assigne un villageois à un chantier (rejoint les autres bâtisseurs déjà dessus,
  // dans la limite de MAX_BUILDERS), qu'il vienne de l'auto-assignation ou d'une
  // commande manuelle du joueur.
  function assignBuild(unit, tw) {
    if (!unit || unit.dead || unit.key !== 'villager' || !tw || !tw.underConstruction) return false;
    if (!tw.builders.has(unit.id) && tw.builders.size >= MAX_BUILDERS) return false;   // chantier déjà plein
    releaseBuildTask(unit);
    tw.builders.add(unit.id);
    unit.buildTask = tw;
    unit.commandedNode = null;   // une commande de construction annule un ordre de récolte
    return true;
  }
  // Dirige un villageois vers UN nœud précis (au lieu du plus proche, comportement par
  // défaut) — bascule immédiatement, sans attendre le prochain cycle de récolte.
  function commandGather(unit, node) {
    if (!unit || unit.dead || unit.key !== 'villager' || !node) return false;
    releaseBuildTask(unit);
    unit.commandedNode = node;
    unit.node = node;
    unit.gstate = 'toNode';
    return true;
  }
  // Auto-assignation : un villageois libre (ni commande de récolte, ni chantier en
  // cours) qui vient de terminer un cycle de dépôt (ou qui vient d'apparaître) prend un
  // chantier — priorité à un chantier ENCORE SANS PERSONNE (étale la construction sur
  // plusieurs tours plutôt que d'empiler tout le monde sur une seule), puis au plus
  // ancien qui a encore de la place (renforce plutôt que d'attendre) — sinon la
  // construction ne progresse jamais sans micro-gestion constante du joueur.
  function tryAutoAssign(unit) {
    if (!unit || unit.dead || unit.buildTask || unit.commandedNode) return;
    let best = null;
    for (const tw of game.towers) {
      if (!tw.underConstruction || tw.builders.size >= MAX_BUILDERS) continue;
      if (!best || tw.builders.size < best.builders.size || (tw.builders.size === best.builders.size && tw.id < best.id)) best = tw;
    }
    if (best) assignBuild(unit, best);
  }
  const countVillagersOf = homeId => game.units.reduce((n, u) => n + (u.homeId === homeId && u.key === 'villager' && !u.dead ? 1 : 0), 0);
  // coût de recrutement : monte avec le nombre de villageois déjà rattachés à CE
  // townhall — première passe, à retoucher après playtest.
  const recruitCost = tw => 30 + 15 * countVillagersOf(tw.id);
  function recruitVillager(tw, opts = {}) {
    if (!tw || tw.key !== 'townhall' || tw.underConstruction) return null;
    const cap = tw.stats().maxUnits;
    if (countVillagersOf(tw.id) >= cap) return null;
    const cost = recruitCost(tw);
    if (game.gold < cost) return null;
    addGold(-cost);
    const u = spawnUnit('villager', tw.x + U.rand(-8, 8), tw.y + 8, tw.id);
    TD.audio.sfx('build');
    TD.fx.ring(tw.x, tw.y, tw.def.color, 30, 0.35, 2);
    return u;
  }

  function upgradeTower(tw, opts = {}) {
    const cost = tw.upgradeCost();
    if (cost === null || game.gold < cost) return;
    addGold(-cost);
    tw.level++;
    tw.invested += cost;
    tw.placedT = 1;
    TD.audio.sfx('upgrade');
    TD.fx.ring(tw.x, tw.y - 20, '#ffd24a', 52, 0.5);
    TD.fx.sparks(tw.x, tw.y - 24, '#ffd24a', 12, 180, 4);
    if (!opts.remote && game.selectedTower === tw) TD.ui.showTowerPanel(tw);
  }

  function sellTower(tw, opts = {}) {
    addGold(tw.sellValue());
    game.towers.splice(game.towers.indexOf(tw), 1);
    game.towerCells.delete(cellKey(tw.c, tw.r));
    // vendre un chantier en cours doit libérer ses bâtisseurs tout de suite (sinon ils
    // gardent buildTask sur une tour qui n'existe plus jusqu'à leur prochain tick) —
    // même correctif que completeConstruction, et pour la même raison.
    if (tw.underConstruction) for (const u of game.units) if (u.buildTask === tw) { u.buildTask = null; tryAutoAssign(u); }
    TD.audio.sfx('sell');
    TD.fx.coinFly(tw.x, tw.y - 10, 3);
    TD.fx.spawn({ x: tw.x, y: tw.y - 16, life: 0.5, size: 18, endSize: 34, color: '#cbb9a2', alpha: 0.5, type: 'smoke' });
    if (!opts.remote && game.selectedTower === tw) deselect();
  }

  function ageUp(opts = {}) {
    if (game.age >= 3) return;
    const next = AGES[game.age + 1];
    if (game.gold < next.cost) {
      if (!opts.remote) TD.ui.banner('🪙 Or insuffisant', `${next.name} : ${next.cost} or`, 'boss', 1400);
      return;
    }
    addGold(-next.cost);
    game.age++;
    TD.audio.sfx('ageup');
    TD.ui.banner(`${next.icon} ${next.name} !`, 'Nouvelles tours débloquées', 'age', 3000);
    TD.fx.shake(0.3);
    TD.fx.ring(M.shrineCenter.x, M.shrineCenter.y, '#ffd24a', 160, 0.8, 6);
    for (let i = 0; i < 26; i++) {
      TD.fx.spawn({
        x: U.rand(0, M.W), y: U.rand(-40, -10), vx: U.rand(-20, 20), vy: U.rand(40, 110),
        life: U.rand(1.5, 3), size: U.rand(6, 10), color: U.choice(['#ffd24a', '#ff9ec7', '#7adcff']),
        type: 'petal', layer: 2, vr: U.rand(-4, 4),
      });
    }
  }

  const towerById = id => game.towers.find(t => t.id === id) || null;
  const unitById = id => game.units.find(u => u.id === id) || null;

  // ── dispatcher de commandes ──────────────────────────────
  // Point d'entrée unique pour TOUTE mutation de partie. Appelé :
  //  - en solo/hôte directement (origine locale ou commande d'invité)
  //  - jamais en invité (l'invité envoie au réseau, l'hôte fait autorité)
  function cmd(c, opts = {}) {
    switch (c.k) {
      case 'build':   placeTower(c.key, c.c, c.r, opts); break;
      case 'upgrade': { const t = towerById(c.id); if (t) upgradeTower(t, opts); break; }
      case 'sell':    { const t = towerById(c.id); if (t) sellTower(t, opts); break; }
      case 'mode':    { const t = towerById(c.id); if (t) { t.mode = c.mode; t.target = null; } break; }
      case 'age':     ageUp(opts); break;
      case 'wave':    TD.waves.callNext(); break;
      case 'charm':   TD.charms.pick(c.key); break;
      case 'spell':   castSpell(c.s, c.x, c.y, opts); break;
      case 'speed':   game.speed = U.clamp(c.v | 0, 1, 3); break;
      // seul l'hôte peut régler la difficulté partagée (un invité passe forcément
      // par opts.remote=true, cf. net.js case 'input') — même garde que le choix
      // de carte en lobby, qui est déjà réservé à l'hôte côté UI.
      case 'difficulty': if (!opts.remote) setDifficulty(c.d); break;
      case 'hero':
        if (c.sub === 'deploy') TD.hero.deploy(c.x, c.y);
        else if (c.sub === 'talent') TD.hero.chooseTalent(c.tier, c.id);
        break;
      case 'villager': {
        const u = unitById(c.id); if (!u || u.key !== 'villager') break;
        if (c.sub === 'gather') { const node = game.nodes.find(n => n.c === c.c && n.r === c.r); if (node) commandGather(u, node); }
        else if (c.sub === 'build') { const t = game.towerCells.get(cellKey(c.c, c.r)); if (t) assignBuild(u, t); }
        break;
      }
      case 'recruit': { const t = towerById(c.id); if (t) recruitVillager(t, opts); break; }
    }
  }

  // ── input ────────────────────────────────────────────────
  function canvasPos(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / TD.ui.stageScale, y: (ev.clientY - r.top) / TD.ui.stageScale };
  }

  function bindInput() {
    canvas.addEventListener('mousemove', ev => {
      const p = canvasPos(ev);
      game.mouse = p;
      const cell = M.cellAt(p.x, p.y);
      game.hover = M.inGrid(cell.c, cell.r) ? cell : null;
      if (game.state === 'playing' && TD.net.isMP()) TD.net.sendCursor(p.x, p.y);
    });
    canvas.addEventListener('mouseleave', () => { game.hover = null; game.mouse = { x: -100, y: -100 }; });
    canvas.addEventListener('click', ev => {
      if (game.state !== 'playing' || game.modalPause) return;
      const p = canvasPos(ev);
      if (game.heroPlacing) {
        TD.net.send({ k: 'hero', sub: 'deploy', x: Math.round(p.x), y: Math.round(p.y) });
        game.heroPlacing = false;
        return;
      }
      if (game.selectedSpell) {
        TD.net.send({ k: 'spell', s: game.selectedSpell, x: Math.round(p.x), y: Math.round(p.y) });
        game.selectedSpell = null;
        return;
      }
      const cell = M.cellAt(p.x, p.y);

      if (game.selectedVillager && game.selectedVillager.dead) game.selectedVillager = null;
      // un villageois est sélectionné : ce clic est une COMMANDE (nœud précis ou
      // chantier), pas une nouvelle sélection — cf. game.js commandGather/assignBuild.
      if (game.selectedVillager) {
        const vid = game.selectedVillager.id;
        let node = null, bd = 26 * 26;
        for (const n of game.nodes) { const dd = U.dist2(n.x, n.y, p.x, p.y); if (dd <= bd) { bd = dd; node = n; } }
        const site = M.inGrid(cell.c, cell.r) ? game.towerCells.get(cellKey(cell.c, cell.r)) : null;
        game.selectedVillager = null;
        if (node) { TD.net.send({ k: 'villager', sub: 'gather', id: vid, c: node.c, r: node.r }); TD.audio.sfx('click'); return; }
        if (site && site.underConstruction) { TD.net.send({ k: 'villager', sub: 'build', id: vid, c: site.c, r: site.r }); TD.audio.sfx('click'); return; }
        return;   // clic ailleurs : désélection simple, pas d'autre action ce clic-ci
      }

      // sélection d'un villageois (hit-test par distance) — pas pendant une pose de tour
      if (!game.selectedShop) {
        let picked = null, pd = 18 * 18;
        for (const u of game.units) {
          if (u.dead || u.key !== 'villager') continue;
          const dd = U.dist2(u.x, u.y, p.x, p.y);
          if (dd <= pd) { pd = dd; picked = u; }
        }
        if (picked) {
          game.selectedVillager = picked;
          game.selectedTower = null;
          TD.ui.hideTowerPanel();
          TD.audio.sfx('click');
          return;
        }
      }

      if (game.selectedShop && M.inGrid(cell.c, cell.r)) {
        const d = TD.towers.DEFS[game.selectedShop];
        const ok = M.isBuildable(cell.c, cell.r) && !game.towerCells.has(cellKey(cell.c, cell.r))
          && game.gold >= d.cost && game.wood >= (d.wood || 0) && game.stone >= (d.stone || 0);
        if (ok) TD.net.send({ k: 'build', key: game.selectedShop, c: cell.c, r: cell.r });
        else TD.audio.sfx('error');
        return;
      }
      // sélection de tour
      const tw = game.towerCells.get(cellKey(cell.c, cell.r));
      if (tw) {
        game.selectedTower = tw;
        game.selectedShop = null;
        TD.audio.sfx('click');
        TD.ui.showTowerPanel(tw);
      } else {
        deselect();
      }
    });
    canvas.addEventListener('contextmenu', ev => { ev.preventDefault(); deselect(); });
    window.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        if (TD.ui.modalOpen()) { TD.ui.closeModal(); game.modalPause = false; }
        else if (game.selectedShop || game.selectedTower || game.selectedVillager) deselect();
        else if (game.state === 'playing') TD.ui.showPause();
        return;
      }
      if ((ev.key === 'c' || ev.key === 'C') && game.state === 'playing') { TD.ui.showCodex(); return; }
      if (game.state !== 'playing' || game.modalPause) return;
      if (ev.code === 'Space') { ev.preventDefault(); TD.net.send({ k: 'wave' }); }
      if (/^[0-9]$/.test(ev.key)) {
        const idx = ev.key === '0' ? 9 : parseInt(ev.key, 10) - 1;
        if (idx < TD.towers.ORDER.length) selectShop(TD.towers.ORDER[idx]);
      }
      if (ev.key === 'u' && game.selectedTower) TD.net.send({ k: 'upgrade', id: game.selectedTower.id });
      if (ev.key === 'v' && game.selectedTower) TD.net.send({ k: 'sell', id: game.selectedTower.id });
      if (ev.key === 'q') armSpell('meteor');
      if (ev.key === 'w') armSpell('freeze');
      if (ev.key === 'e') armSpell('heal');
      if (ev.key === 'h' || ev.key === 'H') armHero();
      if (ev.key === 't' || ev.key === 'T') TD.ui.showHeroTalents();
    });
  }

  // ── acteurs du menu (balade kawaii) ──────────────────────
  function spawnMenuActors() {
    menuActors = [];
    const types = ['kodama', 'kappa', 'tanuki', 'kitsune', 'oni'];
    for (let i = 0; i < 6; i++) {
      const e = new TD.enemies.Enemy(types[i % types.length], { pathT: i * M.totalLen / 6 });
      menuActors.push(e);
    }
  }

  // ── boucle principale ────────────────────────────────────
  let last = 0, acc = 0;
  const STEP = 1 / 60;

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    const realDt = Math.min(0.05, (ts - last) / 1000);
    last = ts;

    if (game.state === 'menu') {
      game.time += realDt;
      TD.bg.update(realDt, game.time);
      TD.fx.update(realDt, realDt);
      for (const a of menuActors) {
        a.pathT += a.def.speed * 0.55 * realDt;
        if (a.pathT >= M.totalLen) a.pathT = 0;
        a.updatePos();
      }
      render();
      return;
    }

    const paused = game.modalPause || game.state !== 'playing';
    if (paused) {
      TD.bg.update(realDt, game.time);
      TD.fx.update(realDt, realDt);
      if (fwActive) {
        fwTimer -= realDt;
        if (fwTimer <= 0) { fwTimer = U.rand(0.3, 0.8); firework(); }
      }
      // Co-op : continuer d'émettre les snapshots même sur une modale hôte
      // (choix d'Omamori, pause, codex) — sinon les invités sont gelés sans
      // explication jusqu'à ce que l'hôte clique. La sim reste figée (pas de
      // step()), mais le lien reste vivant et reprend dès la fermeture.
      if (TD.net.role === 'host') TD.net.hostTick(realDt);
      render();
      TD.ui.update();
      return;
    }

    // ── invité : pas de simulation, on interpole les snapshots de l'hôte ──
    if (TD.net.role === 'guest') {
      game.time += realDt;
      TD.net.guestUpdate(realDt);
      TD.bg.update(realDt, game.time);
      TD.fx.update(realDt, realDt);
      render();
      TD.ui.update();
      return;
    }

    const effDt = realDt * game.speed * TD.fx.timescale;
    acc += effDt;
    let iter = 0;
    while (acc >= STEP && iter < 8) {
      step(STEP);
      acc -= STEP; iter++;
    }
    if (iter === 8) acc = 0;
    if (TD.net.role === 'host') TD.net.hostTick(realDt);
    TD.bg.update(effDt, game.time);
    TD.fx.update(effDt, realDt);
    render();
    TD.ui.update();
  }

  function step(dt) {
    game.time += dt;
    game.stats.time += dt;
    if (game.mana < game.maxMana) game.mana = Math.min(game.maxMana, game.mana + game.manaRegen * dt);
    for (const k in game.spellCd) if (game.spellCd[k] > 0) game.spellCd[k] = Math.max(0, game.spellCd[k] - dt);
    if (TD.ai && TD.ai.active) TD.ai.update(dt);   // bot allié (co-op, côté hôte)
    synergyT -= dt;
    if (synergyT <= 0) { synergyT = 0.4; TD.synergy.recompute(); }   // buffs d'aura/adjacence
    TD.weather.update(dt);                                            // éclairs d'orage (hôte/solo)
    TD.waves.update(dt);
    for (const tw of game.towers) tw.update(dt, game.time);
    TD.towers.updateAll(dt);
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      e.update(dt);
      if (e.dead) game.enemies.splice(i, 1);
    }
    TD.units.updateAll(dt);
    TD.hero.update(dt);
    // feux d'artifice de victoire
    if (fwActive) {
      fwTimer -= dt;
      if (fwTimer <= 0) {
        fwTimer = U.rand(0.3, 0.8);
        firework();
      }
    }
  }

  function firework() {
    const x = U.rand(150, 1130), y = U.rand(90, 320);
    const col = U.choice(['#ff9ec7', '#ffd24a', '#7adcff', '#c79bff', '#8ee06a']);
    TD.fx.explosion(x, y, col, 70, false);
    TD.fx.petalBurst(x, y, col, 12);
    TD.audio.sfx('taiko');
  }

  // ── rendu ────────────────────────────────────────────────
  function buildVignette() {
    vignette = document.createElement('canvas');
    vignette.width = M.W; vignette.height = M.H;
    const g = vignette.getContext('2d');
    const cx = M.W / 2, cy = M.H / 2;
    const gr = g.createRadialGradient(cx, cy - 20, 480, cx, cy, 980);
    gr.addColorStop(0, 'rgba(20,10,40,0)');
    gr.addColorStop(1, 'rgba(20,10,40,0.38)');
    g.fillStyle = gr; g.fillRect(0, 0, M.W, M.H);
  }

  function render() {
    if (!vignette) buildVignette();
    const t = game.time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sh = TD.fx.shakeOffset(t);
    ctx.translate(sh.x, sh.y);

    TD.bg.draw(ctx, t);
    drawPlacement();
    if (game.state !== 'menu') drawRelics(ctx, t);
    if (game.state !== 'menu') TD.synergy.drawAuras(ctx, t);

    // tours puis ennemis (tri vertical pour le chevauchement)
    for (const tw of game.towers) tw.draw(ctx, t);
    const list = game.state === 'menu' ? menuActors : game.enemies;
    const sorted = [...list].sort((a, b) => a.y - b.y);
    for (const e of sorted) e.draw(ctx, t);
    if (game.state !== 'menu') { TD.units.drawAll(ctx, t); TD.hero.draw(ctx, t); }
    // anneau de surbrillance du villageois sélectionné (prochain clic = commande)
    if (game.selectedVillager && !game.selectedVillager.dead) {
      const sv = game.selectedVillager;
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 6);
      ctx.beginPath(); ctx.arc(sv.x, sv.y + 4, 16, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    TD.towers.drawEffects(ctx, t, game.towers);
    TD.fx.draw(ctx, 0);
    TD.fx.draw(ctx, 1);
    TD.bg.applyLight(ctx);
    TD.bg.drawGlows(ctx, t);
    TD.fx.draw(ctx, 2);
    if (game.state !== 'menu') TD.weather.draw(ctx, t);

    // vignette + flash de fuite
    ctx.drawImage(vignette, 0, 0);
    if (game.leakFlash > 0) {
      game.leakFlash = Math.max(0, game.leakFlash - 0.025);
      ctx.fillStyle = `rgba(255,60,60,${game.leakFlash * 0.3})`;
      ctx.fillRect(-30, -30, 1340, 780);
    }
    // curseurs des coéquipiers (co-op)
    if (game.state === 'playing' && TD.net.isMP()) {
      ctx.font = '700 12px "Segoe UI", sans-serif';
      for (const cu of TD.net.cursors()) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cu.x, cu.y); ctx.lineTo(cu.x + 11, cu.y + 4); ctx.lineTo(cu.x + 4, cu.y + 11);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#ffe9a0';
        ctx.fillText(cu.name || '', cu.x + 13, cu.y + 18);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPlacement() {
    if (game.state !== 'playing') return;
    // portée de la tour sélectionnée
    const showRange = (x, y, range, color) => {
      ctx.fillStyle = U.withAlpha(color, 0.08);
      ctx.beginPath(); ctx.arc(x, y, range, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = U.withAlpha(color, 0.45);
      ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(x, y, range, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]);
    };
    if (game.heroPlacing) {
      showRange(game.mouse.x, game.mouse.y, 78, '#ffd24a');
      ctx.font = '20px serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText('🗡️', game.mouse.x, game.mouse.y + 7); ctx.textAlign = 'start';
      return;
    }
    if (game.selectedSpell) {
      const sp = SPELLS[game.selectedSpell];
      const ready = game.mana >= sp.cost && game.spellCd[game.selectedSpell] <= 0;
      showRange(game.mouse.x, game.mouse.y, sp.radius, ready ? '#ffd24a' : '#ff5d5d');
      return;
    }
    if (game.selectedTower) {
      const tw = game.selectedTower;
      showRange(tw.x, tw.y, tw.stats().range || (tw.stats().aura ? tw.stats().aura.range : 100), tw.def.color);
      ctx.strokeStyle = U.withAlpha('#ffffff', 0.7);
      ctx.lineWidth = 2.5;
      U.rr(ctx, M.OX + tw.c * M.CELL + 3, M.OY + tw.r * M.CELL + 3, M.CELL - 6, M.CELL - 6, 10);
      ctx.stroke();
    }
    // fantôme de construction
    if (game.selectedShop && game.hover) {
      const d = TD.towers.DEFS[game.selectedShop];
      const { c, r } = game.hover;
      const ok = M.isBuildable(c, r) && !game.towerCells.has(cellKey(c, r)) && game.gold >= d.cost && game.wood >= (d.wood || 0) && game.stone >= (d.stone || 0);
      const ctr = M.cellCenter(c, r);
      showRange(ctr.x, ctr.y, d.levels[0].range, ok ? d.color : '#ff5d5d');
      ctx.fillStyle = ok ? 'rgba(140,255,150,0.25)' : 'rgba(255,80,80,0.3)';
      U.rr(ctx, M.OX + c * M.CELL + 2, M.OY + r * M.CELL + 2, M.CELL - 4, M.CELL - 4, 10);
      ctx.fill();
      // silhouette
      ctx.globalAlpha = 0.55;
      const ghost = new TD.towers.Tower(game.selectedShop, c, r);
      ghost.placedT = 0;
      ghost.draw(ctx, game.time);
      ctx.globalAlpha = 1;
    } else if (game.hover && !game.selectedShop && !game.selectedTower) {
      const tw = game.towerCells.get(cellKey(game.hover.c, game.hover.r));
      if (tw) showRange(tw.x, tw.y, tw.stats().range || 100, tw.def.color);
    }
  }

  // ── API debug (console / tests) ──────────────────────────
  TD.debug = {
    gold: n => addGold(n || 1000),
    age: n => { game.age = U.clamp(n, 0, 3); },
    killAll: () => { for (const e of [...game.enemies]) e.die(); },
    wave: n => { game.wave = n - 1; },
    fast: () => { game.speed = 3; },
  };

  return Object.assign(game, {
    boot, start, startAsGuest, toMenu, gameOver, onVictory, goEndless,
    addGold, addResource, dealDamage, spawnEnemy, spawnUnit, claimRelic, waveHpMul, onEnemyKilled, onEnemyLeaked,
    selectShop, deselect, placeTower, completeConstruction, upgradeTower, sellTower, ageUp,
    armSpell, castSpell, spellFx, armHero, objectiveEvent, cmd, towerById, unitById, cellKey,
    applySettings, saveSettings, selectMap,
    setDifficulty, humanCount, DIFFS, DIFF_ORDER,
    depleteNode, respawnNodes,
    assignBuild, commandGather, tryAutoAssign, recruitVillager, recruitCost, countVillagersOf, MAX_BUILDERS,
  });
})();

window.addEventListener('load', () => TD.game.boot());

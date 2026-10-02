// ============================================================
// AgeOfTD V2 — net.js : multijoueur co-op hôte-autoritaire
// ------------------------------------------------------------
// Modèle : un joueur HÔTE fait tourner la simulation telle quelle
// (zéro contrainte de déterminisme). Les INVITÉS envoient leurs
// commandes (build/upgrade/sell/age/wave) et n'affichent que les
// snapshots reçus ~20×/s, reconstruits en entités dessinables.
// Transport : WebSocket natif (client) ⇄ petit relais Node (ws).
// ============================================================
'use strict';

TD.net = (() => {
  const SNAP_DT = 1 / 20;                 // 20 snapshots/seconde
  const ENEMY_KEYS = Object.keys(TD.enemies.DEFS);
  const TOWER_KEYS = TD.towers.ORDER;
  const UNIT_KEYS = Object.keys(TD.units.DEFS);
  const MODES = TD.towers.MODES;
  const DIFF_KEYS = ['facile', 'normal', 'difficile'];   // même ordre que game.js DIFF_ORDER
  const EI = {}, TI = {}, UI = {};
  ENEMY_KEYS.forEach((k, i) => EI[k] = i);
  TOWER_KEYS.forEach((k, i) => TI[k] = i);
  UNIT_KEYS.forEach((k, i) => UI[k] = i);

  let role = 'solo';                      // solo | host | guest
  let sock = null;
  let selfId = null, roomCode = '', peers = [], myName = 'Joueur';
  let lobbyCb = null, connReady = null, connErr = null;
  let lastSnap = null, prevState = 'menu';
  let snapAcc = 0, curLast = 0;
  let lastVictoryToken = null;   // null = pas encore de référence (1er snapshot après 'start')
  const remoteCursors = new Map();        // id -> { x, y, name }

  const eProx = new Map();                // id -> proxy ennemi (invité)
  const tProx = new Map();                // id -> proxy tour (invité)
  const uProx = new Map();                // id -> proxy unité (invité)

  // VFX de sorts à rejouer chez les invités : l'hôte les bufferise à
  // l'incantation, le snapshot suivant les transporte (`sx`), l'invité les
  // rejoue via TD.game.spellFx — sinon il ne voyait aucun retour de son sort.
  const SPELL_FX_KEYS = ['meteor', 'freeze', 'heal'];
  let _spellFxBuf = [];
  function recordSpellFx(key, x, y) {
    const i = SPELL_FX_KEYS.indexOf(key);
    if (i >= 0) _spellFxBuf.push([i, x | 0, y | 0]);
  }
  function _flushSpellFx() { const b = _spellFxBuf; _spellFxBuf = []; return b.length ? b : 0; }

  // ── helpers connexion ────────────────────────────────────
  const _raw = obj => { if (sock && sock.readyState === 1) sock.send(JSON.stringify(obj)); };
  const defaultUrl = () => `ws://${location.hostname || 'localhost'}:8787`;

  function _open(url, joinMsg, onReady, onErr) {
    connReady = onReady; connErr = onErr;
    try { sock = new WebSocket(url); }
    catch (e) { role = 'solo'; onErr && onErr('URL invalide'); return; }
    let settled = false;
    sock.onopen = () => _raw(joinMsg);
    sock.onmessage = ev => { settled = true; _onMessage(ev.data); };
    sock.onerror = () => { if (!settled) { role = 'solo'; connErr && connErr('Connexion impossible — le relais tourne-t-il ?'); } };
    sock.onclose = () => _onClose();
  }

  function host(url, name, onReady, onErr) {
    myName = name || 'Hôte';
    role = 'pending'; _open(url, { k: 'join', room: '', name: myName }, onReady, onErr);
  }
  function join(url, code, name, onReady, onErr) {
    myName = name || 'Invité';
    role = 'pending'; _open(url, { k: 'join', room: (code || '').toUpperCase(), name: myName }, onReady, onErr);
  }

  function _onMessage(data) {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    switch (m.k) {
      case 'welcome':
        selfId = m.id; roomCode = m.room; peers = m.peers || [];
        role = m.isHost ? 'host' : 'guest';
        connReady && connReady(role);
        _emitLobby();
        break;
      case 'err':
        role = 'solo'; connErr && connErr(m.msg || 'Partie introuvable'); _emitLobby(m.msg);
        break;
      case 'peer_join':
        peers.push({ id: m.id, name: m.name }); _emitLobby();
        if (role === 'host') {
          TD.ui.banner('🤝 ' + m.name + ' a rejoint', (peers.length + 1) + ' défenseurs', 'clear', 2200);
          // arrivant en cours de partie : on le resynchronise (carte comprise)
          if (TD.game.state === 'playing') broadcastStart(TD.game.difficulty, TD.game.mapId);
        }
        break;
      case 'peer_leave':
        peers = peers.filter(p => p.id !== m.id); remoteCursors.delete(m.id); _emitLobby();
        break;
      case 'cursor':
        if (m.id !== selfId) remoteCursors.set(m.id, { x: m.x, y: m.y, name: m.name });
        break;
      case 'start':
        // Le relais rediffuse 'start' à TOUTE la salle quand un joueur arrive
        // (resync de l'arrivant). Un invité DÉJÀ en partie doit l'ignorer, sinon
        // son affichage (towers/enemies/units) est réinitialisé à chaque arrivée.
        if (role === 'guest' && prevState !== 'playing') { prevState = 'playing'; lastVictoryToken = null; if (m.map) TD.game.selectMap(m.map); TD.game.startAsGuest(m.diff); }
        break;
      case 'input':
        if (role === 'host') TD.game.cmd(m.cmd, { remote: true });
        break;
      case 'snap':
        if (role === 'guest') _applySnapshot(m);
        break;
      case 'host_left':
        if (role === 'guest') { TD.ui.banner('🚪 Hôte parti', 'Partie terminée', 'boss', 4000); reset(); TD.game.toMenu(); }
        break;
    }
  }

  function _onClose() {
    if (role === 'guest') TD.ui.banner('📡 Déconnecté', 'Lien avec l\'hôte rompu', 'boss', 3500);
    if (role !== 'solo') { role = 'solo'; _emitLobby('Déconnecté'); }
    sock = null;
  }

  function reset() {
    if (sock) { try { sock.onclose = null; sock.close(); } catch (e) {} }
    sock = null; role = 'solo'; selfId = null; roomCode = ''; peers = [];
    lastSnap = null; eProx.clear(); tProx.clear(); uProx.clear(); remoteCursors.clear(); snapAcc = 0;
    _spellFxBuf = []; lastVictoryToken = null;
  }

  // ── lobby (UI) ───────────────────────────────────────────
  function onLobby(cb) { lobbyCb = cb; }
  function _emitLobby(err) { lobbyCb && lobbyCb({ role, roomCode, peers, selfId, error: err || null }); }

  function broadcastStart(diff, map) { _raw({ k: 'start', diff, map: map || TD.game.mapId }); }

  // ── envoi de commande ────────────────────────────────────
  function send(cmd) {
    if (role === 'guest') { _raw({ k: 'input', cmd }); return; }
    TD.game.cmd(cmd, { remote: false });   // solo + hôte : autorité locale
  }

  // ── curseurs partagés (présence) ─────────────────────────
  function sendCursor(x, y) {
    if (role === 'solo' || !sock) return;
    const now = (typeof performance !== 'undefined') ? performance.now() : 0;
    if (now - curLast < 80) return;        // ~12 envois/s max
    curLast = now;
    _raw({ k: 'cursor', id: selfId, x: x | 0, y: y | 0, name: myName });
  }
  const cursors = () => [...remoteCursors.values()];

  // ── HÔTE : construction + émission des snapshots ─────────
  function hostTick(realDt) {
    if (role !== 'host') return;
    snapAcc += realDt;
    if (snapAcc < SNAP_DT) return;
    snapAcc = 0;
    _raw(buildSnapshot());
  }

  function buildSnapshot() {
    const g = TD.game;
    const en = [];
    for (const e of g.enemies) {
      let f = 0;
      if (e.elite) f |= 1; if (e.fly) f |= 2; if (e.phased > 0) f |= 4; if (e.freeze > 0) f |= 8;
      if (e.shock > 0) f |= 16; if (e.slow && e.slow.pct > 0) f |= 32; if (e.enraged) f |= 64;
      if (e.vuln && e.vuln.t > 0) f |= 128;   // malédiction Ofuda (halo violet)
      en.push([e.id, EI[e.key], e.x | 0, e.y | 0, Math.max(0, Math.ceil(e.hp)), e.maxHp, e.size | 0, f,
        Math.ceil(e.shieldHp || 0), e.shieldMax || 0]);
    }
    const tw = [];
    for (const t of g.towers) {
      const live = t.target && !t.target.dead;
      const b = t._buff;
      tw.push([t.id, TI[t.key], t.c, t.r, t.level, MODES.indexOf(t.mode),
        +t.turretAng.toFixed(2), +t.recoil.toFixed(2), +(t.beamRamp || 0).toFixed(2),
        live ? t.target.x | 0 : 0, live ? t.target.y | 0 : 0,
        // panneau de tour invité : revente (invested), éliminations, synergie
        t.invested | 0, t.kills | 0,
        b ? [+b.dmgMul.toFixed(2), +b.rateMul.toFixed(2), +b.rangeMul.toFixed(2)] : 0,
        (t._buffLabels && t._buffLabels.length) ? t._buffLabels : 0,
        // chantier : -1 = tour finie, sinon 0..1 = progression (cf. game.js placeTower)
        t.underConstruction ? +t.buildProgress.toFixed(2) : -1,
        t.builders.size]);   // nb de bâtisseurs actuels (juste pour l'affichage panneau invité)
    }
    return {
      k: 'snap', t: +g.time.toFixed(2), spd: g.speed,
      go: g.gold, li: g.lives, ml: g.maxLives, wv: g.wave, ag: g.age, ed: g.endless ? 1 : 0, st: g.state,
      df: DIFF_KEYS.indexOf(g.difficulty),
      // méta-progression invité (succès/pétales) : sans ces 4 champs, l'invité ne peut
      // pas calculer sa propre fin de partie (cf. _applySnapshot + onGameEnd côté invité)
      ngp: g.ngPlus || 0, mdr: g.minDiffRank != null ? g.minDiffRank : DIFF_KEYS.indexOf(g.difficulty),
      stt: g.stats, vt: g.victoryToken || 0,
      wd: Math.round(g.wood), sn: Math.round(g.stone),
      // rendu cosmétique invité des nœuds de ressource (souches/gravats + réapparitions) : la
      // récolte elle-même reste simulée côté hôte, ceci ne sert qu'à ce que bg.js dessine pareil.
      dt: [...g.depletedTreeCells], dr: [...g.depletedRockCells],
      xn: g.extraNodes.map(n => [n.type === 'wood' ? 0 : 1, n.c, n.r]),
      mn: Math.round(g.mana), scd: { meteor: +g.spellCd.meteor.toFixed(1), freeze: +g.spellCd.freeze.toFixed(1), heal: +g.spellCd.heal.toFixed(1) },
      md: Object.assign({}, TD.mods), ch: TD.charms.ownedKeys(),
      wst: TD.waves.state, cd: +TD.waves.countdown.toFixed(1), rem: TD.waves.remaining,
      en, tw, un: buildUnits(), rl: TD.game.relics.map(r => [r.id, r.type, r.x | 0, r.y | 0]),
      ob: TD.game.objectives.map(o => [o.desc, o.done ? 1 : 0, o.failed ? 1 : 0]),
      hr: TD.hero.snapshot(),
      wx: TD.weather.id(),
      fx: TD.towers.snapshotFx(),
      sx: _flushSpellFx(),
    };
  }

  function buildUnits() {
    const out = [];
    for (const u of TD.game.units)
      out.push([u.id, UI[u.key], u.x | 0, u.y | 0, Math.max(0, Math.ceil(u.hp)), u.maxHp, u.target ? 1 : 0, u.face, u.carry > 0 ? 1 : 0]);
    return out;
  }

  // ── INVITÉ : application des snapshots ───────────────────
  function _applySnapshot(s) {
    lastSnap = s;
    const g = TD.game;
    g.gold = s.go; g.lives = s.li; g.maxLives = s.ml; g.wave = s.wv; g.age = s.ag; g.endless = !!s.ed;
    if (s.df !== undefined) {
      const id = DIFF_KEYS[s.df];
      // annonce seulement si l'hôte a changé la difficulté en pause (pas au 1er snapshot)
      if (id && id !== g.difficulty) {
        g.difficulty = id; g.diff = TD.game.DIFFS[id] || g.diff;
        TD.ui.banner('🎚️ Difficulté : ' + g.diff.name, "Ajustée par l'hôte", 'clear', 2400);
      }
    }
    if (s.mn !== undefined) g.mana = s.mn;
    if (s.wd !== undefined) g.wood = s.wd;
    if (s.sn !== undefined) g.stone = s.sn;
    if (s.ngp !== undefined) g.ngPlus = s.ngp;
    if (s.mdr !== undefined) g.minDiffRank = s.mdr;
    if (s.stt) g.stats = s.stt;
    // victoire (le state hôte reste 'playing', modalPause+victoryToken en tiennent lieu) :
    // un token qui change signale une victoire à l'invité (fin de partie + succès/pétales).
    if (s.vt !== undefined) {
      if (lastVictoryToken === null) lastVictoryToken = s.vt;
      else if (s.vt !== lastVictoryToken) { lastVictoryToken = s.vt; _guestOnVictory(); }
    }
    if (s.dt) g.depletedTreeCells = new Set(s.dt);
    if (s.dr) g.depletedRockCells = new Set(s.dr);
    if (s.xn) g.extraNodes = s.xn.map(([ty, c, r]) => { const p = TD.map.cellCenter(c, r); return { type: ty === 0 ? 'wood' : 'stone', x: p.x, y: p.y, c, r }; });
    if (s.spd) g.speed = s.spd;   // vitesse de sim partagée (boutons ×1/×2/×3)
    if (s.scd) g.spellCd = s.scd;
    Object.assign(TD.mods, s.md);
    if (TD.charms.ownedKeys().join() !== s.ch.join()) TD.charms.setOwned(s.ch);
    _reconcileEnemies(s.en);
    _reconcileTowers(s.tw);
    _reconcileUnits(s.un || []);
    g.relics = (s.rl || []).map(a => ({ id: a[0], type: a[1], x: a[2], y: a[3], claimed: false }));
    g.objectives = (s.ob || []).map(a => ({ desc: a[0], done: !!a[1], failed: !!a[2] }));
    TD.hero.applySnapshot(s.hr);
    TD.weather.setRemote(s.wx);
    TD.towers.applyFx(s.fx);
    if (Array.isArray(s.sx)) for (const a of s.sx) TD.game.spellFx(SPELL_FX_KEYS[a[0]], a[1], a[2]);
    if (s.st !== prevState) { _applyState(s.st); prevState = s.st; }
  }

  function _reconcileEnemies(rows) {
    const g = TD.game, seen = new Set(), list = [];
    for (const row of rows) {
      const id = row[0];
      let p = eProx.get(id);
      if (!p) { p = _enemyProxy(row); eProx.set(id, p); }
      else _enemyUpdate(p, row);
      seen.add(id); list.push(p);
    }
    for (const [id, p] of eProx) {
      if (seen.has(id)) continue;
      // disparu : mort (ou fuite). Petit éclat de pétales pour le feedback.
      if (p.hp > 0 && p.x < 1240) { TD.fx.petalBurst(p.x, p.y, p.def.body, p.def.boss ? 22 : 8); TD.audio.sfx('death'); }
      eProx.delete(id);
    }
    g.enemies = list;
  }

  function _enemyProxy(row) {
    const key = ENEMY_KEYS[row[1]], def = TD.enemies.DEFS[key];
    const p = Object.create(TD.enemies.Enemy.prototype);
    p.id = row[0]; p.key = key; p.def = def;
    p.x = p.tx = row[2]; p.y = p.ty = row[3];
    p._prevHp = row[4];
    p.seed = Math.random() * 6.283; p.flash = 0; p.ang = 0;
    p.slow = { pct: 0, t: 0 }; p.burn = { dps: 0, t: 0 }; p.poison = { dps: 0, t: 0 };
    p.dashing = 0; p.speedMul = 1;
    p.vuln = { mul: 1, t: 0 };   // CRITIQUE : Enemy.draw() lit this.vuln.t → crash invité si absent
    p.trail = []; p.dead = false;
    // décode hp / taille / TOUS les flags / bouclier (symétrie stricte avec _enemyUpdate :
    // sans ça, le 1er snapshot d'un ennemi perdait phased/freeze/shock/slow/enraged/vuln)
    _enemyUpdate(p, row);
    return p;
  }

  function _enemyUpdate(p, row) {
    p.tx = row[2]; p.ty = row[3];
    const hp = row[4];
    if (hp < p._prevHp - 0.5) {
      p.flash = 1;
      TD.fx.floatText(p.x + (Math.random() * 8 - 4), p.y - p.size - 14, String(Math.round(p._prevHp - hp)), '#ffffff', 14);
    }
    p._prevHp = hp; p.hp = hp; p.maxHp = row[5]; p.size = row[6];
    const f = row[7];
    p.elite = !!(f & 1); p.fly = !!(f & 2);
    p.phased = (f & 4) ? 0.9 : 0; p.freeze = (f & 8) ? 1 : 0; p.shock = (f & 16) ? 1 : 0;
    p.slow.pct = (f & 32) ? 0.4 : 0; p.enraged = !!(f & 64);
    p.vuln.t = (f & 128) ? 1 : 0;
    p.shieldHp = row[8]; p.shieldMax = row[9];
  }

  function _reconcileTowers(rows) {
    const g = TD.game, list = [], cells = new Map(), seen = new Set();
    for (const row of rows) {
      const id = row[0];
      let t = tProx.get(id);
      if (!t) { t = _towerProxy(row); tProx.set(id, t); }
      else _towerUpdate(t, row);
      seen.add(id); list.push(t); cells.set(g.cellKey(t.c, t.r), t);
    }
    for (const id of tProx.keys()) if (!seen.has(id)) tProx.delete(id);
    g.towers = list; g.towerCells = cells;
    if (g.selectedTower && !seen.has(g.selectedTower.id)) g.deselect();
  }

  function _towerProxy(row) {
    const key = TOWER_KEYS[row[1]], def = TD.towers.DEFS[key];
    const t = Object.create(TD.towers.Tower.prototype);
    t.id = row[0]; t.key = key; t.def = def; t.c = row[2]; t.r = row[3];
    const ctr = TD.map.cellCenter(t.c, t.r); t.x = ctr.x; t.y = ctr.y;
    t.level = row[4]; t.mode = MODES[row[5]] || 'premier';
    t.turretAng = row[6]; t.recoil = row[7]; t.beamRamp = row[8] || 0;
    t.placedT = 1; t.cooldown = 0;
    t.freezeCounter = 0; t.auraT = 0; t.beamSoundT = 0; t.target = null;
    t.invested = row[11] != null ? row[11] : def.cost;   // revente correcte (et pas juste le coût de base)
    t.kills = row[12] || 0;
    _towerBuff(t, row);
    _towerTarget(t, row);
    _towerConstruction(t, row);
    return t;
  }
  function _towerUpdate(t, row) {
    t.level = row[4]; t.mode = MODES[row[5]] || t.mode;
    t.turretAng = row[6]; t.recoil = row[7]; t.beamRamp = row[8] || 0;
    if (row[11] != null) t.invested = row[11];
    t.kills = row[12] || 0;
    _towerBuff(t, row);
    _towerTarget(t, row);
    _towerConstruction(t, row);
  }
  // chantier : underConstruction/buildProgress pour l'overlay de Tower.draw() côté
  // invité (cf. game.js placeTower/completeConstruction). `builderCount` (nombre, pas
  // le Set `builders` de l'hôte — l'invité n'a pas besoin des identités, juste du
  // compte pour le panneau) alimente le texte "N villageois au travail".
  function _towerConstruction(t, row) {
    const bp = row[15];
    t.underConstruction = bp != null && bp >= 0;
    t.buildProgress = t.underConstruction ? bp : 1;
    t.builderCount = row[16] || 0;
  }
  // Synergie (aura/adjacence) : sans ça le panneau de tour invité affichait
  // toujours « pas de buff » et stats() ignorait le bonus (dégâts/portée).
  function _towerBuff(t, row) {
    const b = row[13];
    t._buff = (Array.isArray(b) && b.length) ? { dmgMul: b[0], rateMul: b[1], rangeMul: b[2] } : null;
    t._buffLabels = Array.isArray(row[14]) ? row[14] : null;
  }
  function _towerTarget(t, row) {
    if (t.def.kind === 'beam' && (row[9] || row[10])) t.target = { x: row[9], y: row[10], dead: false };
    else t.target = null;
  }

  function _reconcileUnits(rows) {
    const g = TD.game, list = [], seen = new Set();
    for (const row of rows) {
      const id = row[0];
      let u = uProx.get(id);
      if (!u) { u = _unitProxy(row); uProx.set(id, u); }
      else _unitUpdate(u, row);
      seen.add(id); list.push(u);
    }
    for (const [id, u] of uProx) {
      if (seen.has(id)) continue;
      if (u.hp > 0) TD.fx.petalBurst(u.x, u.y, u.def.color, 6);
      uProx.delete(id);
    }
    g.units = list;
    if (g.selectedVillager && !seen.has(g.selectedVillager.id)) g.selectedVillager = null;
  }
  function _unitProxy(row) {
    const key = UNIT_KEYS[row[1]], def = TD.units.DEFS[key];
    const u = Object.create(TD.units.Unit.prototype);
    u.id = row[0]; u.key = key; u.def = def;
    u.x = u.tx = row[2]; u.y = u.ty = row[3];
    u.hp = u._prevHp = row[4]; u.maxHp = row[5];
    u.target = row[6] ? {} : null; u.face = row[7] || 1;
    u.carry = row[8] || 0;   // villageois portant bois/pierre (sac dessiné)
    u.recoil = 0; u.flash = 0; u.seed = Math.random() * 6.283; u.spawnT = 1; u.bob = 0; u.dead = false;
    return u;
  }
  function _unitUpdate(u, row) {
    u.tx = row[2]; u.ty = row[3];
    if (row[4] < u._prevHp - 0.5) u.flash = 1;
    u._prevHp = row[4]; u.hp = row[4]; u.maxHp = row[5];
    u.target = row[6] ? {} : null; u.face = row[7] || u.face;
    u.carry = row[8] || 0;
  }

  // `st` ne vaut jamais 'victory' (l'hôte reste en 'playing' + modalPause à la victoire,
  // cf. onVictory) — seule la défaite transite par un vrai changement d'état.
  function _applyState(st) {
    TD.game.state = st;
    if (st === 'over') {
      TD.ui.banner('💔 Le sanctuaire est tombé…', 'Partie terminée', 'boss', 5000);
      TD.meta.onGameEnd(false);   // succès/pétales de l'invité, jusque-là jamais crédités
    }
  }

  // pendant de _applyState('over') pour la victoire, déclenché par victoryToken
  // (cf. _applySnapshot) puisque le state hôte ne change pas dans ce cas.
  function _guestOnVictory() {
    TD.meta.onGameEnd(true);
    TD.ui.banner('🎆 VICTOIRE ! 🎆', 'Le hanami est sauvé 🌸', 'clear', 5000);
  }

  // ── INVITÉ : interpolation visuelle entre snapshots ──────
  function guestUpdate(realDt) {
    const g = TD.game, k = Math.min(1, realDt * 16);
    for (const p of g.enemies) {
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
      p.flash = Math.max(0, p.flash - realDt * 8);
      if (p.def.serpent) { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 26) p.trail.shift(); }
    }
    for (const t of g.towers) {
      if (t.placedT > 0) t.placedT = Math.max(0, t.placedT - realDt * 2.4);
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - realDt * 5);
    }
    for (const u of g.units) {
      u.x += (u.tx - u.x) * k;
      u.y += (u.ty - u.y) * k;
      u.flash = Math.max(0, u.flash - realDt * 8);
      if (u.spawnT > 0) u.spawnT = Math.max(0, u.spawnT - realDt * 2.4);
      if (u.recoil > 0) u.recoil = Math.max(0, u.recoil - realDt * 5);
      u.bob += realDt;
    }
    TD.hero.guestDecay(realDt);   // résorbe recul/flash/apparition du héros (pas de sim hôte ici)
  }

  // ── état exposé pour le HUD invité ───────────────────────
  function guestHud() {
    if (role !== 'guest' || !lastSnap) return null;
    return { wst: lastSnap.wst, cd: lastSnap.cd, rem: lastSnap.rem };
  }

  return {
    SNAP_DT, defaultUrl,
    host, join, reset, onLobby, broadcastStart, send,
    hostTick, guestUpdate, guestHud, sendCursor, cursors, recordSpellFx,
    buildSnapshot, applySnapshot: _applySnapshot,
    get role() { return role; },
    get roomCode() { return roomCode; },
    get peers() { return peers; },
    isHost: () => role === 'host',
    isGuest: () => role === 'guest',
    isMP: () => role === 'host' || role === 'guest',
  };
})();

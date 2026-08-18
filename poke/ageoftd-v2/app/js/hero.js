// ============================================================
// AgeOfTD V2 — hero.js : Héros Samouraï persistant (port V1)
// ------------------------------------------------------------
// UN seul héros par partie. Déployé au clic, il garde son XP / son
// niveau / ses talents toute la partie et RÉAPPARAÎT après un délai
// s'il tombe. Gagne de l'XP sur les kills (lvl 1→10) ; aux paliers
// 3/6/9 un talent se débloque (choix de 3) puis s'active à l'or.
// Hôte-autoritaire : l'invité ne fait que l'afficher (applySnapshot).
// ============================================================
'use strict';

TD.hero = (() => {
  const U = TD.util;

  const BASE = { hp: 280, dmg: 45, range: 78, atkCd: 0.8, speed: 132, aggro: 250, size: 18 };
  const MAX_LEVEL = 10;
  const RESPAWN = 16;                         // secondes avant réapparition
  const xpForLevel = lvl => 100 * lvl;        // XP requise pour passer le niveau `lvl`
  const TIERS = [3, 6, 9];

  // 9 talents (3 par palier), fidèles à la V1 + coût en or (« niveau + or »)
  const TALENTS = {
    berserk:   { tier: 3, icon: '🩸', name: 'Berserk',     cost: 150, desc: '+30% dégâts, −20% PV max', dmgMul: 1.3, hpMul: 0.8 },
    guardian:  { tier: 3, icon: '🛡️', name: 'Gardien',     cost: 150, desc: '+30% PV max, −10% vitesse', hpMul: 1.3, speedMul: 0.9 },
    // seule option du palier 3 sans aucun gain de puissance nette (juste la portée
    // d'engagement) à coût identique à Berserk/Gardien qui, eux, ont un vrai
    // compromis offense/défense — on lui ajoute une cadence d'attaque en plus,
    // cohérente avec son thème (engage plus tôt ET frappe plus souvent).
    scout:     { tier: 3, icon: '🦅', name: 'Éclaireur',   cost: 150, desc: "+50% de portée d'engagement, +15% cadence d'attaque", aggroMul: 1.5, atkCdMul: 0.87 },
    whirlwind: { tier: 6, icon: '🌀', name: 'Tourbillon',  cost: 320, desc: 'Frappe de zone autour de la cible', cleave: 64 },
    fleet:     { tier: 6, icon: '💨', name: 'Fulgurant',   cost: 320, desc: '+25% vitesse de déplacement', speedMul: 1.25 },
    lifesteal: { tier: 6, icon: '🧛', name: 'Vol de vie',  cost: 320, desc: 'Soigne 12% des dégâts infligés', lifesteal: 0.12 },
    execute:   { tier: 9, icon: '☠️', name: 'Exécution',   cost: 520, desc: 'Achève les yokai sous 12% PV', execute: 0.12 },
    immortal:  { tier: 9, icon: '♾️', name: 'Immortel',    cost: 520, desc: 'Réapparition 2× + sursaut à 60% PV', immortal: true },
    storm:     { tier: 9, icon: '⚡', name: 'Porte-Foudre', cost: 520, desc: 'Éclair en chaîne (2 cibles)', chain: 2, chainRange: 130 },
  };
  const tierOptions = tier => Object.keys(TALENTS).filter(k => TALENTS[k].tier === tier);

  const h = {
    deployed: false, dead: false, respawnT: 0,
    x: 0, y: 0, holdX: 0, holdY: 0,
    level: 1, xp: 0, talents: {},
    hp: 0, maxHp: 0, target: null, atk: 0, recoil: 0, face: 1, flash: 0, seed: 0, spawnT: 0,
    // multiplicateurs/effets dérivés des talents
    _dmgMul: 1, _hpMul: 1, _speedMul: 1, _aggroMul: 1, _atkCdMul: 1,
    _cleave: 0, _lifesteal: 0, _execute: 0, _chain: 0, _chainRange: 130, _immortal: false, _usedImmortal: false,
    bolts: [],     // éclairs Porte-Foudre (visuel, décroît)
  };

  // ── stats dérivées (niveau × talents) ────────────────────
  const statHp    = () => Math.round(BASE.hp  * Math.pow(1.10, h.level - 1) * h._hpMul);
  const statDmg   = () => Math.round(BASE.dmg * Math.pow(1.06, h.level - 1) * h._dmgMul);
  const statSpeed = () => BASE.speed * h._speedMul;
  const statAggro = () => BASE.aggro * h._aggroMul;
  const statAtkCd = () => BASE.atkCd * h._atkCdMul;

  function recomputeMults() {
    h._dmgMul = h._hpMul = h._speedMul = h._aggroMul = h._atkCdMul = 1;
    h._cleave = h._lifesteal = h._execute = h._chain = 0; h._chainRange = 130; h._immortal = false;
    for (const id of Object.values(h.talents)) {
      const d = TALENTS[id]; if (!d) continue;
      if (d.dmgMul) h._dmgMul *= d.dmgMul;
      if (d.hpMul) h._hpMul *= d.hpMul;
      if (d.speedMul) h._speedMul *= d.speedMul;
      if (d.aggroMul) h._aggroMul *= d.aggroMul;
      if (d.atkCdMul) h._atkCdMul *= d.atkCdMul;
      if (d.cleave) h._cleave = d.cleave;
      if (d.lifesteal) h._lifesteal = d.lifesteal;
      if (d.execute) h._execute = d.execute;
      if (d.chain) { h._chain = d.chain; h._chainRange = d.chainRange || 130; }
      if (d.immortal) h._immortal = true;
    }
  }

  const availableTiers = () => TIERS.filter(t => h.level >= t && !h.talents[t]);

  // ── déploiement / déplacement (hôte + solo) ──────────────
  function deploy(x, y) {
    h.holdX = x; h.holdY = y;
    if (!h.deployed) {
      h.deployed = true; h.dead = false;
      recomputeMults(); h.maxHp = statHp(); h.hp = h.maxHp;
      h.x = x; h.y = y; h.spawnT = 1; h.target = null; h.atk = 0;
      TD.fx.ring(x, y, '#ffd24a', 60, 0.5, 6); TD.fx.petalBurst(x, y, '#ff6b8d', 12);
      TD.audio.sfx('ageup');
      TD.ui.banner('🗡️ Samouraï déployé', 'Il combat à tes côtés et gagne en puissance', 'clear', 2200);
    }
  }

  // ── progression ──────────────────────────────────────────
  function addXp(n) {
    if (h.level >= MAX_LEVEL || n <= 0) return;
    h.xp += n;
    while (h.level < MAX_LEVEL && h.xp >= xpForLevel(h.level)) { h.xp -= xpForLevel(h.level); levelUp(); }
    if (h.level >= MAX_LEVEL) h.xp = 0;
  }
  function levelUp() {
    h.level++;
    const ratio = h.maxHp > 0 ? h.hp / h.maxHp : 1;
    recomputeMults(); h.maxHp = statHp(); h.hp = Math.max(1, Math.round(h.maxHp * ratio));
    TD.fx.ring(h.x, h.y - 10, '#ffe27a', 48, 0.5, 5);
    TD.fx.floatText(h.x, h.y - 32, 'NIVEAU ' + h.level, '#ffe27a', 15);
    TD.audio.sfx('upgrade');
    if (TIERS.includes(h.level)) {
      TD.ui.banner('✨ Talent disponible !', `Le Samouraï atteint le niveau ${h.level}`, 'age', 2600);
    }
  }

  // choix d'un talent : nécessite niveau ≥ palier ET l'or (hôte/solo)
  function chooseTalent(tier, id) {
    const d = TALENTS[id];
    if (!d || d.tier !== tier) return false;
    if (h.talents[tier] || h.level < tier) return false;
    if (TD.game.gold < d.cost) { TD.audio.sfx('error'); return false; }
    TD.game.addGold(-d.cost);
    h.talents[tier] = id;
    const ratio = h.maxHp > 0 ? h.hp / h.maxHp : 1;
    recomputeMults(); h.maxHp = statHp(); h.hp = Math.max(1, Math.round(h.maxHp * ratio));
    TD.fx.ring(h.x, h.y - 10, '#c79bff', 64, 0.6, 6); TD.fx.sparks(h.x, h.y - 16, '#c79bff', 12, 180, 4);
    TD.audio.sfx('charm');
    TD.ui.banner(d.icon + ' ' + d.name, 'Talent activé', 'clear', 2200);
    return true;
  }

  // ── combat ───────────────────────────────────────────────
  function creditKill(e) { if (!e.leaked) addXp(Math.max(2, Math.round((e.gold || 0) / 4))); }

  function hit(e, dmg) {
    if (e.dead) return;
    // Exécution : achève les non-boss sous le seuil
    if (h._execute > 0 && !e.def.boss && e.maxHp > 0 && e.hp < e.maxHp && e.hp / e.maxHp <= h._execute) {
      TD.fx.sparks(e.x, e.y, '#ff5d5d', 8, 160, 4);
      TD.game.dealDamage(e, e.maxHp * 10, 'phys', { tag: 'hero', quiet: true });
      if (e.dead) creditKill(e);
      return;
    }
    const dealt = TD.game.dealDamage(e, dmg, 'phys', { tag: 'hero' });
    if (h._lifesteal > 0 && dealt > 0 && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + Math.max(1, Math.round(dealt * h._lifesteal)));
    if (e.dead) creditKill(e);
  }

  function attack() {
    const t = h.target; if (!t) return;
    h.atk = statAtkCd(); h.recoil = 1; h.face = t.x < h.x ? -1 : 1;
    const dmg = statDmg();
    hit(t, dmg);
    // Tourbillon : cleave autour de la cible
    if (h._cleave > 0) {
      const r2 = h._cleave * h._cleave;
      for (const e of TD.game.enemies) { if (e === t || e.dead || e.fly) continue; if (U.dist2(t.x, t.y, e.x, e.y) <= r2) hit(e, dmg * 0.6); }
      TD.fx.ring(t.x, t.y, '#fff2c0', h._cleave, 0.3, 4);
    }
    // Porte-Foudre : éclair en chaîne
    if (h._chain > 0) {
      const r2 = h._chainRange * h._chainRange; const used = new Set([t]); let from = t, n = 0;
      while (n < h._chain) {
        let best = null, bd = r2;
        for (const e of TD.game.enemies) { if (used.has(e) || e.dead || e.fly) continue; const dd = U.dist2(from.x, from.y, e.x, e.y); if (dd < bd) { bd = dd; best = e; } }
        if (!best) break;
        h.bolts.push({ x1: from.x, y1: from.y, x2: best.x, y2: best.y, t: 0.22 });
        hit(best, dmg * 0.5); used.add(best); from = best; n++;
      }
    }
    TD.fx.sparks(t.x, t.y, '#fff2c0', 5, 140, 3); TD.audio.sfx('shoot');
  }

  function hurt(d) {
    if (h.dead || !h.deployed) return;
    h.hp -= d; h.flash = 1;
    if (h.hp <= 0) die();
  }

  function die() {
    if (h.dead) return;
    if (h._immortal && !h._usedImmortal) {   // sursaut Immortel : revive instantané
      h._usedImmortal = true; h.hp = Math.round(h.maxHp * 0.6);
      TD.fx.ring(h.x, h.y, '#ffe27a', 72, 0.6, 7); TD.fx.floatText(h.x, h.y - 30, 'IMMORTEL !', '#ffe27a', 16); TD.audio.sfx('charm');
      return;
    }
    h.dead = true; h.target = null;
    // le sursaut instantané (ligne au-dessus) est déjà l'avantage d'Immortel — un
    // délai de réapparition perpétuellement réduit en plus (même après l'avoir
    // consommé) l'aurait rendu strictement supérieur à Exécution/Porte-Foudre,
    // sans aucune contrepartie contrairement aux talents du palier 3.
    h.respawnT = RESPAWN;
    TD.fx.petalBurst(h.x, h.y, '#e06a78', 16); TD.fx.ghostRise(h.x, h.y - 6, '#ffffff'); TD.fx.ring(h.x, h.y, '#ff6b5d', 50, 0.5, 5);
    TD.audio.sfx('death');
    TD.ui.banner('🗡️ Héros tombé', 'Réapparition imminente…', 'boss', 2000);
  }

  function respawn() {
    h.dead = false; h._usedImmortal = false;
    recomputeMults(); h.maxHp = statHp(); h.hp = h.maxHp;
    h.x = h.holdX; h.y = h.holdY; h.spawnT = 1; h.target = null; h.atk = 0;
    TD.fx.ring(h.x, h.y, '#ffd24a', 60, 0.6, 6); TD.fx.petalBurst(h.x, h.y, '#ff6b8d', 12); TD.audio.sfx('ageup');
  }

  // ── update (hôte / solo uniquement) ──────────────────────
  function update(dt) {
    for (let i = h.bolts.length - 1; i >= 0; i--) { h.bolts[i].t -= dt; if (h.bolts[i].t <= 0) h.bolts.splice(i, 1); }
    if (!h.deployed) return;
    if (h.dead) { h.respawnT -= dt; if (h.respawnT <= 0) respawn(); return; }
    if (h.spawnT > 0) h.spawnT = Math.max(0, h.spawnT - dt * 2.4);
    h.flash = Math.max(0, h.flash - dt * 8);
    if (h.recoil > 0) h.recoil = Math.max(0, h.recoil - dt * 5);
    if (TD.mods.unitRegen && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + TD.mods.unitRegen * dt);

    if (h.target && h.target.dead) h.target = null;
    const aggro2 = statAggro() * statAggro();
    if (h.target && U.dist2(h.holdX, h.holdY, h.target.x, h.target.y) > aggro2 * 1.6) h.target = null;
    if (!h.target) {
      let best = null, bd = 1e9;
      for (const e of TD.game.enemies) { if (e.dead || e.fly) continue; const dd = U.dist2(h.holdX, h.holdY, e.x, e.y); if (dd < bd && dd <= aggro2) { bd = dd; best = e; } }
      h.target = best;
    }
    const tx = h.target ? h.target.x : h.holdX, ty = h.target ? h.target.y : h.holdY;
    const dist = U.dist(h.x, h.y, tx, ty) || 0.001;
    const stop = h.target ? BASE.range : 5;
    if (dist > stop) {
      const sp = statSpeed() * dt;
      h.x += (tx - h.x) / dist * Math.min(sp, dist);
      h.y += (ty - h.y) / dist * Math.min(sp, dist);
      h.face = tx < h.x ? -1 : 1;
    } else if (h.target) {
      h.target._blockedT = 0.25; h.target._blocker = h;
      h.atk -= dt;
      if (h.atk <= 0) attack();
    }
  }

  // ── rendu ────────────────────────────────────────────────
  function drawBolts(ctx) {
    for (const b of h.bolts) {
      ctx.globalAlpha = Math.min(1, b.t * 4); ctx.strokeStyle = '#9fdcff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      const segs = 4;
      for (let i = 1; i <= segs; i++) { const k = i / segs; const mx = U.lerp(b.x1, b.x2, k) + (i < segs ? U.rand(-7, 7) : 0); const my = U.lerp(b.y1, b.y2, k) + (i < segs ? U.rand(-7, 7) : 0); ctx.lineTo(mx, my); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function draw(ctx, t) {
    drawBolts(ctx);
    if (!h.deployed) return;
    const s = BASE.size;
    // marqueur de réapparition pendant la mort
    if (h.dead) {
      ctx.globalAlpha = 0.5 + 0.3 * U.pulse(t * 1.5);
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(h.holdX, h.holdY, 22, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe27a'; ctx.font = '700 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🗡️ ' + Math.ceil(h.respawnT) + 's', h.holdX, h.holdY + 4); ctx.textAlign = 'start';
      return;
    }
    const pop = h.spawnT > 0 ? U.easeOutBack(1 - h.spawnT) : 1;
    const walking = !h.target;
    const bob = walking ? Math.abs(Math.sin(t * 8.5 + h.seed)) * 3 : 0;
    const x = h.x, y = h.y - bob;
    const pal = (TD.meta && TD.meta.heroSkin) ? TD.meta.heroSkin() : { body: '#c0414f', dark: '#8f2f3e', crest: '#ffd24a', aura: '#ffd98a' };
    // aura (couleur du skin)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32 + 0.12 * U.pulse(t * 1.1);
    ctx.drawImage(TD.fx.glowSprite(pal.aura), x - s * 1.5, y - s * 1.5, s * 3, s * 3);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // ombre
    ctx.fillStyle = 'rgba(40,30,40,0.28)';
    ctx.beginPath(); ctx.ellipse(h.x, h.y + s * 0.7, s * 0.85, s * 0.32, 0, 0, U.TAU); ctx.fill();
    ctx.save();
    ctx.translate(x, y); ctx.scale(pop * h.face, pop);
    // corps (armure — couleur du skin)
    ctx.fillStyle = pal.body;
    U.rr(ctx, -s * 0.75, -s * 0.2, s * 1.5, s * 1.4, s * 0.42); ctx.fill();
    ctx.fillStyle = pal.dark;
    U.rr(ctx, -s * 0.75, s * 0.5, s * 1.5, s * 0.7, s * 0.3); ctx.fill();      // jupe d'armure
    // tête
    ctx.fillStyle = '#ffe1c4';
    ctx.beginPath(); ctx.arc(0, -s * 0.55, s * 0.55, 0, U.TAU); ctx.fill();
    // casque kabuto + crête
    ctx.fillStyle = '#3a2f44';
    ctx.beginPath(); ctx.moveTo(-s * 0.72, -s * 0.55); ctx.lineTo(0, -s * 1.45); ctx.lineTo(s * 0.72, -s * 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.crest;
    ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 1.2); ctx.lineTo(0, -s * 1.75); ctx.lineTo(s * 0.18, -s * 1.2); ctx.closePath(); ctx.fill();
    // yeux
    ctx.fillStyle = '#2f2a3a';
    ctx.beginPath(); ctx.arc(-s * 0.2, -s * 0.55, s * 0.1, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.55, s * 0.1, 0, U.TAU); ctx.fill();
    // katana
    ctx.save(); ctx.translate(s * 0.7, -s * 0.3); ctx.rotate(-0.6 + h.recoil * 1.3);
    ctx.strokeStyle = '#eef4fb'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 1.4, -s * 0.5); ctx.stroke();
    ctx.fillStyle = '#caa46a'; ctx.fillRect(-2.5, -2.5, 6, 6);
    ctx.restore();
    // flash d'impact
    if (h.flash > 0.05) { ctx.globalAlpha = h.flash * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 1.1, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
    // badge de niveau
    ctx.fillStyle = '#1c1430'; ctx.beginPath(); ctx.arc(h.x + s * 0.8, y - s * 1.2, 9, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.font = '700 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(h.level, h.x + s * 0.8, y - s * 1.2);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    // barre de vie
    if (h.hp < h.maxHp) {
      const w = s * 2.2, bx = h.x - w / 2, by = y - s * 1.75;
      ctx.fillStyle = 'rgba(30,25,40,0.7)'; U.rr(ctx, bx - 1, by - 1, w + 2, 6, 2); ctx.fill();
      const pct = Math.max(0, h.hp / h.maxHp);
      ctx.fillStyle = pct > 0.5 ? '#8fd17a' : (pct > 0.25 ? '#ffd24a' : '#ff6b5d');
      U.rr(ctx, bx, by, w * pct, 4, 1.5); ctx.fill();
    }
  }

  // ── infos HUD ─────────────────────────────────────────────
  function info() {
    return {
      deployed: h.deployed, dead: h.dead, level: h.level, xp: Math.round(h.xp),
      xpNeed: h.level >= MAX_LEVEL ? 0 : xpForLevel(h.level), maxLevel: MAX_LEVEL,
      respawnT: h.respawnT, available: availableTiers(), talents: { ...h.talents },
    };
  }
  const talentInfo = () => ({ defs: TALENTS, tierOptions, tiers: TIERS });

  // ── co-op : snapshot (hôte) / application (invité) ───────
  function snapshot() {
    if (!h.deployed) return null;
    return {
      x: h.x | 0, y: h.y | 0, lv: h.level, xp: Math.round(h.xp),
      hp: Math.max(0, Math.ceil(h.hp)), mhp: h.maxHp, fc: h.face,
      rc: +Math.max(0, h.recoil).toFixed(2), dead: h.dead ? 1 : 0, rt: +h.respawnT.toFixed(1),
      tal: { ...h.talents }, sp: +h.spawnT.toFixed(2),
    };
  }
  function applySnapshot(hr) {
    if (!hr) { h.deployed = false; h.dead = false; return; }
    const prevHp = h.hp;
    h.deployed = true;
    h.x = hr.x; h.y = hr.y; h.holdX = hr.x; h.holdY = hr.y;
    h.level = hr.lv; h.xp = hr.xp; h.hp = hr.hp; h.maxHp = hr.mhp; h.face = hr.fc;
    h.dead = !!hr.dead; h.respawnT = hr.rt; h.talents = hr.tal || {}; h.spawnT = hr.sp || 0;
    h.recoil = hr.rc || 0;
    if (h.hp < prevHp - 0.5) h.flash = 1;
    recomputeMults();
  }

  // Invité : la sim hôte ne tourne pas localement → on résorbe nous-mêmes les
  // timers visuels (recul / flash / apparition) entre deux snapshots, sinon le
  // héros reste figé en pose de tir. Mêmes cadences que towers/units côté net.
  function guestDecay(dt) {
    if (!h.deployed) return;
    if (h.recoil > 0) h.recoil = Math.max(0, h.recoil - dt * 5);
    if (h.flash > 0) h.flash = Math.max(0, h.flash - dt * 8);
    if (h.spawnT > 0) h.spawnT = Math.max(0, h.spawnT - dt * 2.4);
  }

  function reset() {
    Object.assign(h, {
      deployed: false, dead: false, respawnT: 0, x: 0, y: 0, holdX: 0, holdY: 0,
      level: 1, xp: 0, talents: {}, target: null, atk: 0, recoil: 0, face: 1, flash: 0, spawnT: 0, _usedImmortal: false,
    });
    h.seed = U.rand(U.TAU); h.bolts = [];
    recomputeMults(); h.maxHp = statHp(); h.hp = h.maxHp;
  }

  // niveau de départ (amélioration permanente méta) — avant déploiement
  function setStartLevel(n) {
    h.level = U.clamp(n | 0, 1, MAX_LEVEL);
    recomputeMults(); h.maxHp = statHp(); h.hp = h.maxHp;
  }

  // l'ennemi bloqué riposte via `this._blocker.hurt(...)` (cf. enemies.js) :
  // `h` est posé comme _blocker, il doit donc porter `hurt` et `dead`.
  h.hurt = hurt;

  reset();
  return { deploy, addXp, chooseTalent, hurt, update, draw, info, talentInfo, snapshot, applySnapshot, guestDecay, reset, setStartLevel, isDeployed: () => h.deployed };
})();

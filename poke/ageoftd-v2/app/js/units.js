// ============================================================
// AgeOfTD V2 — units.js : unités alliées déployables (port RTS V1)
// ------------------------------------------------------------
// Les casernes (towers.js, kind 'barracks') produisent des unités
// qui rejoignent un point de ralliement et combattent les yokai au
// sol sur le chemin : elles BLOQUENT et frappent. Les ennemis
// ripostent (enemies.js). Les volants leur échappent.
// ============================================================
'use strict';

TD.units = (() => {
  const U = TD.util;

  const DEFS = {
    ashigaru: { name: 'Ashigaru', hp: 120, dmg: 14, atkCd: 0.9, range: 34, speed: 70, melee: true, color: '#e0bd66', accent: '#9c7a2e', size: 13 },
    yumi:     { name: 'Archère Yumi', hp: 55, dmg: 18, atkCd: 1.2, range: 150, speed: 78, melee: false, color: '#86c2e6', accent: '#3f7fa0', size: 12 },
    samurai:  { name: 'Samouraï', hp: 175, dmg: 30, atkCd: 1.0, range: 36, speed: 96, melee: true, color: '#e06a78', accent: '#8f2f3e', size: 14 },
    villager: { name: 'Villageois', hp: 50, dmg: 0, atkCd: 1, range: 20, speed: 74, gatherer: true, carry: 14, gatherTime: 2.2, color: '#bfa06a', accent: '#7a5e34', size: 12 },
  };

  let nextId = 1;
  const arrows = [];   // flèches des archères (visuel + impact)

  class Unit {
    constructor(key, x, y, homeId) {
      this.id = nextId++;
      this.key = key; this.def = DEFS[key];
      this.homeId = homeId;
      this.x = x; this.y = y; this.holdX = x; this.holdY = y;
      this.hp = this.maxHp = this.def.hp;
      this.target = null; this.atk = 0;
      this.dead = false; this.flash = 0; this.recoil = 0;
      this.face = 1; this.seed = U.rand(U.TAU); this.spawnT = 1;
      this.bob = 0;
      this.node = null; this.gstate = 'toNode'; this.gtimer = 0; this.carry = 0;   // récolte (villageois)
      // job villageois (commandé par le joueur ou auto-assigné, cf. game.js) :
      // buildTask (référence Tower en chantier) prime sur commandedNode (nœud imposé,
      // au lieu du plus proche) qui prime sur le comportement par défaut (nœud le plus
      // proche, inchangé si aucun des deux n'est défini).
      this.commandedNode = null;
      this.buildTask = null;
    }

    setHold(x, y) { this.holdX = x; this.holdY = y; }
    hurt(d) { this.hp -= d; this.flash = 1; if (this.hp <= 0) this.die(); }
    die() {
      if (this.dead) return;
      this.dead = true;
      // se retire du chantier qu'il construisait, sinon il resterait compté comme
      // bâtisseur actif pour toujours (cf. game.js assignBuild / MAX_BUILDERS).
      if (this.buildTask) this.buildTask.builders.delete(this.id);
      TD.fx.petalBurst(this.x, this.y, this.def.color, 7);
      TD.fx.ghostRise(this.x, this.y - 4, '#ffffff');
      TD.audio.sfx('death');
    }

    update(dt) {
      if (this.dead) return;
      const d = this.def;
      if (this.spawnT > 0) this.spawnT = Math.max(0, this.spawnT - dt * 2.4);
      this.flash = Math.max(0, this.flash - dt * 8);
      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 5);
      this.bob += dt;
      if (TD.mods.unitRegen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + TD.mods.unitRegen * dt);  // relique de vie

      if (this.def.gatherer) { this._gather(dt); return; }   // villageois : récolte, pas de combat

      // cible perdue ?
      if (this.target && this.target.dead) this.target = null;
      if (this.target && U.dist2(this.holdX, this.holdY, this.target.x, this.target.y) > 240 * 240) this.target = null;
      // (re)ciblage : yokai au sol le plus proche du point de ralliement
      if (!this.target) {
        let best = null, bd = 1e9;
        const aggro = (d.melee ? 150 : d.range + 20);
        const aggro2 = aggro * aggro;
        for (const e of TD.game.enemies) {
          if (e.dead || e.fly) continue;
          const dd = U.dist2(this.holdX, this.holdY, e.x, e.y);
          if (dd < bd && dd <= aggro2) { bd = dd; best = e; }
        }
        this.target = best;
      }

      // pas d'ennemi : une unité oisive va réclamer la relique la plus proche
      let relic = null;
      if (!this.target && TD.game.relics.length) {
        let bd = 240 * 240;
        for (const rl of TD.game.relics) { if (rl.claimed) continue; const dd = U.dist2(this.x, this.y, rl.x, rl.y); if (dd < bd) { bd = dd; relic = rl; } }
      }

      const dmgMul = TD.mods.unitDmgMul || 1;
      const tx = this.target ? this.target.x : (relic ? relic.x : this.holdX);
      const ty = this.target ? this.target.y : (relic ? relic.y : this.holdY);
      const dist = U.dist(this.x, this.y, tx, ty) || 0.001;
      const stop = this.target ? d.range : (relic ? 16 : 5);

      if (dist > stop) {
        const sp = d.speed * dt;
        this.x += (tx - this.x) / dist * Math.min(sp, dist);
        this.y += (ty - this.y) / dist * Math.min(sp, dist);
        this.face = tx < this.x ? -1 : 1;
      } else if (this.target) {
        if (d.melee) { this.target._blockedT = 0.2; this.target._blocker = this; }   // bloque l'avancée
        this.atk -= dt;
        if (this.atk <= 0) {
          this.atk = d.atkCd; this.recoil = 1;
          this.face = this.target.x < this.x ? -1 : 1;
          if (d.melee) {
            TD.game.dealDamage(this.target, d.dmg * dmgMul, 'phys', { tag: 'unit' });
            TD.fx.sparks(this.target.x, this.target.y, '#fff2c0', 4, 120, 3);
            TD.audio.sfx('shoot');
          } else {
            arrows.push({ x: this.x, y: this.y - 6, tx: this.target.x, ty: this.target.y, t: 0, target: this.target, dmg: d.dmg * dmgMul, color: this.def.accent });
            TD.audio.sfx('shoot');
          }
        }
      } else if (relic) {
        TD.game.claimRelic(relic);
      }
    }

    _gather(dt) {
      if (this.buildTask) { this._build(dt); return; }   // chantier assigné : prime sur la récolte
      if (!this.node || !TD.game.nodes.includes(this.node)) {
        // nœud imposé par le joueur (commandGather) : prioritaire sur le choix "plus
        // proche" tant qu'il existe encore ; épuisé/retiré → retour au comportement par
        // défaut (comme si aucune commande n'avait été donnée).
        if (this.commandedNode && TD.game.nodes.includes(this.commandedNode)) {
          this.node = this.commandedNode;
        } else {
          this.commandedNode = null;
          let bd = 1e18;
          for (const n of TD.game.nodes) { const dd = U.dist2(this.x, this.y, n.x, n.y); if (dd < bd) { bd = dd; this.node = n; } }
        }
        this.gstate = 'toNode';
      }
      if (!this.node) return;
      if (this.gstate === 'gathering') {
        this.gtimer -= dt;
        if (this.gtimer <= 0) { this.carry = this.def.carry; this.gstate = 'toBase'; }
        return;
      }
      const tgt = this.gstate === 'toBase' ? TD.game.basePoint : this.node;
      const dist = U.dist(this.x, this.y, tgt.x, tgt.y) || 0.001;
      if (dist > 14) {
        const sp = this.def.speed * dt;
        this.x += (tgt.x - this.x) / dist * Math.min(sp, dist);
        this.y += (tgt.y - this.y) / dist * Math.min(sp, dist);
        this.face = tgt.x < this.x ? -1 : 1;
      } else if (this.gstate === 'toBase') {
        TD.game.addResource(this.node.type, this.carry);
        TD.fx.floatText(this.x, this.y - 18, '+' + this.carry + (this.node.type === 'wood' ? '🪵' : '🪨'), '#cde6a0', 12);
        this.node.supply -= this.carry;
        if (this.node.supply <= 0) TD.game.depleteNode(this.node);
        this.carry = 0; this.gstate = 'toNode';
        // fin d'un cycle de dépôt : sans commande explicite, un chantier en attente
        // prime sur le prochain voyage de récolte (auto-assignation).
        if (!this.commandedNode) TD.game.tryAutoAssign(this);
      } else {
        this.gstate = 'gathering'; this.gtimer = this.def.gatherTime;
      }
    }

    // marche jusqu'au chantier assigné (buildTask) puis y travaille jusqu'à buildTime —
    // plusieurs villageois peuvent être sur le MÊME chantier (game.js MAX_BUILDERS),
    // chacun ajoute alors dt/buildTime en parallèle → construction plus rapide, comme
    // dans Age of Empires.
    _build(dt) {
      const tw = this.buildTask;
      if (!tw || !tw.underConstruction || !TD.game.towers.includes(tw)) {   // annulé/vendu/déjà fini
        if (tw) tw.builders.delete(this.id);
        this.buildTask = null; return;
      }
      const dist = U.dist(this.x, this.y, tw.x, tw.y) || 0.001;
      if (dist > 18) {
        const sp = this.def.speed * dt;
        this.x += (tw.x - this.x) / dist * Math.min(sp, dist);
        this.y += (tw.y - this.y) / dist * Math.min(sp, dist);
        this.face = tw.x < this.x ? -1 : 1;
      } else {
        tw.buildProgress = Math.min(1, tw.buildProgress + dt / tw.buildTime);
        if (tw.buildProgress >= 1) {
          TD.game.completeConstruction(tw);
          this.buildTask = null;
          this.node = null;   // repart sur un choix de nœud frais au prochain cycle
        }
      }
    }

    draw(ctx, t) {
      const s = this.def.size;
      const pop = this.spawnT > 0 ? U.easeOutBack(1 - this.spawnT) : 1;
      const walking = !this.target;
      const bob = walking ? Math.abs(Math.sin(this.bob * 9 + this.seed)) * 2.5 : 0;
      const x = this.x, y = this.y - bob;
      // ombre
      ctx.fillStyle = 'rgba(40,60,40,0.22)';
      ctx.beginPath(); ctx.ellipse(this.x, this.y + s * 0.7, s * 0.7, s * 0.28, 0, 0, U.TAU); ctx.fill();
      ctx.save();
      ctx.translate(x, y); ctx.scale(pop * this.face, pop);
      const d = this.def, body = d.color, accent = d.accent;
      // corps (kimono)
      ctx.fillStyle = body;
      U.rr(ctx, -s * 0.7, -s * 0.2, s * 1.4, s * 1.3, s * 0.4); ctx.fill();
      // tête
      ctx.fillStyle = '#ffe1c4';
      ctx.beginPath(); ctx.arc(0, -s * 0.55, s * 0.55, 0, U.TAU); ctx.fill();
      // casque / chapeau conique
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.6); ctx.lineTo(0, -s * 1.5); ctx.lineTo(s * 0.7, -s * 0.6); ctx.closePath(); ctx.fill();
      // yeux
      ctx.fillStyle = '#2f2a3a';
      ctx.beginPath(); ctx.arc(-s * 0.18, -s * 0.55, s * 0.09, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.55, s * 0.09, 0, U.TAU); ctx.fill();
      // arme
      const rec = this.recoil;
      if (this.key === 'yumi') {
        ctx.strokeStyle = '#7a4a2e'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(s * 0.8, -s * 0.1, s * 0.7, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        const pull = s * 0.8 - rec * s * 0.5;
        ctx.beginPath(); ctx.moveTo(s * 0.8 + Math.cos(-1.1) * s * 0.7, -s * 0.1 + Math.sin(-1.1) * s * 0.7);
        ctx.lineTo(pull, -s * 0.1); ctx.lineTo(s * 0.8 + Math.cos(1.1) * s * 0.7, -s * 0.1 + Math.sin(1.1) * s * 0.7); ctx.stroke();
      } else if (this.key === 'samurai') {
        ctx.save(); ctx.translate(s * 0.7, -s * 0.3); ctx.rotate(-0.6 + rec * 1.2);
        ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 1.2, -s * 0.4); ctx.stroke();
        ctx.fillStyle = '#caa46a'; ctx.fillRect(-2, -2, 5, 5);
        ctx.restore();
      } else if (this.key !== 'villager') {
        ctx.save(); ctx.translate(s * 0.7, -s * 0.2); ctx.rotate(-0.3 + rec * 0.9);
        ctx.strokeStyle = '#9b9b9b'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 1.1); ctx.stroke();
        ctx.fillStyle = '#cfcfcf'; ctx.beginPath(); ctx.moveTo(-3, -s * 1.1); ctx.lineTo(0, -s * 1.4); ctx.lineTo(3, -s * 1.1); ctx.fill();
        ctx.restore();
      }
      if (this.key === 'villager') {
        if (this.carry > 0) { ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.arc(-s * 0.7, -s * 0.3, s * 0.4, 0, U.TAU); ctx.fill(); }
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s * 0.6, s * 0.2); ctx.lineTo(s * 0.6, -s * 1.0); ctx.stroke();
        ctx.fillStyle = '#b9c4cc'; ctx.fillRect(s * 0.45, -s * 1.15, s * 0.45, s * 0.25);
      }
      // flash
      if (this.flash > 0.05) { ctx.globalAlpha = this.flash * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s * 0.2, s, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.restore();
      // barre de vie
      if (this.hp < this.maxHp) {
        const w = s * 1.8, bx = this.x - w / 2, by = y - s * 1.6;
        ctx.fillStyle = 'rgba(30,25,40,0.7)'; U.rr(ctx, bx - 1, by - 1, w + 2, 5, 2); ctx.fill();
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = pct > 0.5 ? '#8fd17a' : (pct > 0.25 ? '#ffd24a' : '#ff6b5d');
        U.rr(ctx, bx, by, w * pct, 3, 1.5); ctx.fill();
      }
    }
  }

  // ── flèches des archères ─────────────────────────────────
  function updateArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      if (a.target && !a.target.dead) { a.tx = a.target.x; a.ty = a.target.y; }
      a.t += dt * 4;
      a.x = U.lerp(a.x, a.tx, Math.min(1, dt * 18));
      a.y = U.lerp(a.y, a.ty, Math.min(1, dt * 18));
      if (a.t >= 1 || U.dist2(a.x, a.y, a.tx, a.ty) < 100) {
        if (a.target && !a.target.dead) TD.game.dealDamage(a.target, a.dmg, 'phys', { tag: 'unit' });
        TD.fx.sparks(a.tx, a.ty, '#fff2c0', 3, 90, 3);
        arrows.splice(i, 1);
      }
    }
  }
  function drawArrows(ctx) {
    for (const a of arrows) {
      const ang = Math.atan2(a.ty - a.y, a.tx - a.x);
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
      ctx.strokeStyle = a.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(9, 0); ctx.lineTo(5, 2); ctx.fill();
      ctx.restore();
    }
  }

  function updateAll(dt) {
    const list = TD.game.units;
    for (let i = list.length - 1; i >= 0; i--) {
      const u = list[i];
      u.update(dt);
      if (u.dead) list.splice(i, 1);
    }
    updateArrows(dt);
  }
  function drawAll(ctx, t) {
    const sorted = [...TD.game.units].sort((a, b) => a.y - b.y);
    for (const u of sorted) u.draw(ctx, t);
    drawArrows(ctx);
  }
  function reset() { arrows.length = 0; nextId = 1; }

  return { DEFS, Unit, updateAll, drawAll, reset };
})();

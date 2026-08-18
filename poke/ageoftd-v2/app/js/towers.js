// ============================================================
// AgeOfTD V2 — towers.js : 6 tours débloquées par âge
// Flèche Sakura, Tambour Taiko, Yuki-Onna, Jardin Vénéneux,
// Sanctuaire Kitsune, Lanterne Céleste.
// ============================================================
'use strict';

TD.towers = (() => {
  const U = TD.util;

  const DEFS = {
    archer: {
      key: 'archer', name: 'Flèche Sakura', jp: '桜', icon: '🏹', age: 0, cost: 80,
      kind: 'bullet', dmgType: 'phys', color: '#ff8fb8',
      desc: 'Tirs rapides de pétales. La base fiable, abordable et mignonne.',
      levels: [
        // DPS/or nettement au-dessus des autres tours de dégâts purs à coût
        // équivalent (0% bois/pierre en plus) ; dmg réduit ~15-20%/palier pour
        // la ramener près de kitsune (2e plus efficace) sans la rendre médiocre.
        { dmg: 7, rate: 2.2, range: 150 },
        { dmg: 12, rate: 2.6, range: 160, cost: 90 },
        { dmg: 18, rate: 3.0, range: 170, cost: 170, double: true },
      ],
    },
    taiko: {
      key: 'taiko', name: 'Tambour Taiko', jp: '太鼓', icon: '🥁', age: 0, cost: 140,
      kind: 'aoe', dmgType: 'phys', color: '#ff9d5c',
      desc: 'Ondes de choc en zone. Place-le près des virages serrés.',
      levels: [
        { dmg: 18, rate: 0.75, range: 130, splash: 58 },
        { dmg: 30, rate: 0.80, range: 140, splash: 68, cost: 150 },
        { dmg: 48, rate: 0.85, range: 150, splash: 82, cost: 260, burn: { dps: 10, dur: 2.5 } },
      ],
    },
    yuki: {
      key: 'yuki', name: 'Yuki-Onna', jp: '雪女', icon: '❄️', age: 1, cost: 130, wood: 30,
      kind: 'frost', dmgType: 'magic', color: '#7adcff',
      desc: 'Ralentit les yokai. Au max : gèle et émet une aura givrante.',
      levels: [
        { dmg: 6, rate: 1.4, range: 140, slowPct: 0.35, slowDur: 2.0 },
        { dmg: 10, rate: 1.5, range: 150, slowPct: 0.45, slowDur: 2.2, cost: 130 },
        { dmg: 16, rate: 1.6, range: 160, slowPct: 0.50, slowDur: 2.5, cost: 240, freezeEvery: 3, aura: { pct: 0.2, range: 110 } },
      ],
    },
    poison: {
      key: 'poison', name: 'Jardin Vénéneux', jp: '毒', icon: '🌿', age: 1, cost: 140, wood: 25,
      kind: 'poison', dmgType: 'magic', color: '#8ee06a',
      desc: 'Lobe des nuages toxiques qui rongent tout ce qui les traverse.',
      levels: [
        { dmg: 4, rate: 0.55, range: 145, cloud: { r: 52, dps: 9, dur: 3.2 } },
        { dmg: 6, rate: 0.60, range: 155, cloud: { r: 60, dps: 16, dur: 3.6 }, cost: 150 },
        { dmg: 8, rate: 0.65, range: 165, cloud: { r: 72, dps: 26, dur: 4.0, slow: 0.15 }, cost: 270 },
      ],
    },
    kitsune: {
      key: 'kitsune', name: 'Sanctuaire Kitsune', jp: '狐', icon: '⚡', age: 2, cost: 170, stone: 30,
      kind: 'chain', dmgType: 'magic', color: '#ffd24a',
      desc: 'Foudre en chaîne entre les ennemis. Au max : électrocute.',
      levels: [
        { dmg: 12, rate: 1.0, range: 165, jumps: 3, falloff: 0.8 },
        { dmg: 19, rate: 1.1, range: 175, jumps: 4, falloff: 0.8, cost: 180 },
        { dmg: 30, rate: 1.2, range: 185, jumps: 6, falloff: 0.82, cost: 320, shock: 0.3 },
      ],
    },
    lantern: {
      key: 'lantern', name: 'Lanterne Céleste', jp: '光', icon: '🔆', age: 3, cost: 240, stone: 40,
      kind: 'beam', dmgType: 'magic', color: '#c79bff',
      desc: 'Rayon continu qui monte en puissance sur une même cible.',
      levels: [
        { dps: 22, range: 175, rampMax: 2.0, rampTime: 2.5 },
        { dps: 36, range: 185, rampMax: 2.0, rampTime: 2.5, cost: 260 },
        { dps: 58, range: 200, rampMax: 2.5, rampTime: 2.2, cost: 460 },
      ],
    },
    // ── tours portées de la V1 ──
    tsuru: {
      key: 'tsuru', name: 'Grue Tsuru', jp: '鶴', icon: '🕊️', age: 1, cost: 150,
      kind: 'bullet', dmgType: 'phys', color: '#cfe6ff',
      desc: 'Plumes perçantes. Redoutable contre les yokai volants (×2).',
      levels: [
        { dmg: 14, rate: 1.6, range: 200, flyBonus: 2 },
        { dmg: 22, rate: 1.8, range: 215, flyBonus: 2, cost: 150 },
        { dmg: 34, rate: 2.0, range: 230, flyBonus: 2.5, double: true, cost: 260 },
      ],
    },
    kitsunebi: {
      key: 'kitsunebi', name: 'Kitsunebi', jp: '狐火', icon: '🔥', age: 1, cost: 150, stone: 20,
      kind: 'bullet', dmgType: 'phys', color: '#ff7a3c',
      desc: 'Feux follets qui enflamment les yokai (brûlure persistante).',
      levels: [
        { dmg: 8, rate: 1.8, range: 150, burn: { dps: 8, dur: 2.5 } },
        { dmg: 13, rate: 2.0, range: 160, burn: { dps: 13, dur: 2.8 }, cost: 150 },
        { dmg: 20, rate: 2.2, range: 170, burn: { dps: 20, dur: 3.2 }, cost: 270 },
      ],
    },
    ozutsu: {
      key: 'ozutsu', name: 'Grand Mortier', jp: '大筒', icon: '💣', age: 2, cost: 300, stone: 60,
      kind: 'aoe', dmgType: 'phys', color: '#9a8aa8',
      desc: 'Obus dévastateur : énorme zone, longue portée, cadence lente.',
      levels: [
        { dmg: 60, rate: 0.35, range: 300, splash: 120 },
        { dmg: 95, rate: 0.38, range: 320, splash: 135, cost: 300 },
        { dmg: 150, rate: 0.42, range: 340, splash: 155, burn: { dps: 14, dur: 2.5 }, cost: 520 },
      ],
    },
    grandarc: {
      key: 'grandarc', name: 'Grand Arc', jp: '弓', icon: '🎯', age: 2, cost: 250, wood: 60,
      kind: 'bullet', dmgType: 'phys', color: '#caa06a',
      desc: 'Flèche-lance à portée extrême, dégâts perforants massifs.',
      levels: [
        { dmg: 80, rate: 0.5, range: 420 },
        { dmg: 130, rate: 0.55, range: 450, cost: 250 },
        { dmg: 200, rate: 0.6, range: 480, cost: 430 },
      ],
    },
    fujin: {
      key: 'fujin', name: 'Sanctuaire du Vent', jp: '風', icon: '🌀', age: 2, cost: 220, wood: 25,
      kind: 'wind', dmgType: 'phys', color: '#9fe0d2',
      desc: 'Bourrasques périodiques : repoussent les yokai et brisent leur élan.',
      levels: [
        { range: 150, rate: 0.5, dmg: 6, knock: 42 },
        { range: 162, rate: 0.55, dmg: 10, knock: 56, cost: 230 },
        { range: 176, rate: 0.6, dmg: 16, knock: 78, cost: 400 },
      ],
    },
    ofuda: {
      key: 'ofuda', name: 'Talisman Maudit', jp: '呪', icon: '📜', age: 3, cost: 260, wood: 20,
      kind: 'curse', dmgType: 'magic', color: '#c08af0',
      desc: "Maudit les yokai proches : ils subissent davantage de dégâts de TOUTES tes tours.",
      levels: [
        { range: 150, rate: 0.7, dmg: 2, vuln: 1.20, vulnDur: 2.8 },
        { range: 162, rate: 0.8, dmg: 3, vuln: 1.28, vulnDur: 3.2, cost: 240 },
        { range: 176, rate: 0.9, dmg: 4, vuln: 1.40, vulnDur: 3.6, cost: 420 },
      ],
    },
    // ── casernes : produisent des unités alliées (port RTS V1) ──
    townhall: {
      key: 'townhall', name: 'Hôtel de Ville', jp: '町', icon: '🏠', age: 0, cost: 130, wood: 10,
      kind: 'barracks', unit: 'villager', dmgType: 'phys', color: '#caa46a',
      desc: 'Forme des villageois qui récoltent le bois et la pierre.',
      levels: [
        { maxUnits: 3, spawn: 9, range: 160 },
        { maxUnits: 5, spawn: 8, range: 170, cost: 120 },
        { maxUnits: 7, spawn: 7, range: 180, cost: 220 },
      ],
    },
    dojo: {
      key: 'dojo', name: 'Caserne Ashigaru', jp: '兵', icon: '🛡️', age: 0, cost: 120, wood: 40,
      kind: 'barracks', unit: 'ashigaru', dmgType: 'phys', color: '#e0bd66',
      desc: 'Forme des ashigaru qui bloquent et frappent les yokai au corps-à-corps.',
      levels: [
        { maxUnits: 2, spawn: 7, range: 160 },
        { maxUnits: 3, spawn: 6, range: 170, cost: 140 },
        { maxUnits: 4, spawn: 5, range: 180, cost: 240 },
      ],
    },
    yumiba: {
      key: 'yumiba', name: 'Stand de Tir', jp: '弓兵', icon: '🎴', age: 1, cost: 160, wood: 50,
      kind: 'barracks', unit: 'yumi', dmgType: 'phys', color: '#86c2e6',
      desc: 'Déploie des archères qui tirent à distance sur les yokai au sol.',
      levels: [
        { maxUnits: 2, spawn: 8, range: 170 },
        { maxUnits: 3, spawn: 7, range: 180, cost: 160 },
        { maxUnits: 4, spawn: 6, range: 190, cost: 280 },
      ],
    },
    bushido: {
      key: 'bushido', name: 'Dojo Samouraï', jp: '侍', icon: '⚔️', age: 2, cost: 260, wood: 40, stone: 30,
      kind: 'barracks', unit: 'samurai', dmgType: 'phys', color: '#e06a78',
      desc: "Entraîne des samouraïs d'élite, rapides et dévastateurs.",
      levels: [
        { maxUnits: 2, spawn: 10, range: 170 },
        { maxUnits: 3, spawn: 9, range: 180, cost: 240 },
        { maxUnits: 3, spawn: 7, range: 190, cost: 420 },
      ],
    },
  };
  const ORDER = ['archer', 'taiko', 'townhall', 'dojo', 'yuki', 'poison', 'tsuru', 'kitsunebi', 'yumiba', 'kitsune', 'ozutsu', 'grandarc', 'fujin', 'bushido', 'lantern', 'ofuda'];
  const MODES = ['premier', 'dernier', 'costaud', 'fragile', 'proche'];

  const projectiles = [], bolts = [], clouds = [];
  let nextTowerId = 1;

  function computeDps(def, lv) {
    const s = def.levels[lv];
    if (def.kind === 'barracks') { const ud = TD.units.DEFS[def.unit]; return Math.round(ud.dmg / ud.atkCd * s.maxUnits); }
    if (def.kind === 'beam') return s.dps * (1 + s.rampMax) / 2;
    if (def.kind === 'poison') return s.cloud.dps;
    if (def.kind === 'chain') return s.dmg * s.rate * (1 + s.jumps * 0.6);
    if (def.kind === 'aoe') return s.dmg * s.rate;
    return s.dmg * s.rate * (s.double ? 2 : 1);
  }

  class Tower {
    constructor(key, c, r) {
      this.id = nextTowerId++;
      this.key = key; this.def = DEFS[key];
      this.c = c; this.r = r;
      const ctr = TD.map.cellCenter(c, r);
      this.x = ctr.x; this.y = ctr.y;
      this.level = 0;
      this.cooldown = 0;
      this.target = null;
      this.mode = 'premier';
      this.invested = this.def.cost;
      this.placedT = 1;
      this.recoil = 0;
      this.turretAng = -Math.PI / 2;
      this.freezeCounter = 0;
      this.auraT = 0;
      this.beamRamp = 0;
      this.beamSoundT = 0;
      this.kills = 0;
      this.prodT = 1.2;        // casernes : minuterie de production
      this._hold = null;       // point de ralliement (proche du chemin)
      this._buff = null;       // bonus de synergie/aura (TD.synergy) : { dmgMul, rateMul, rangeMul }
      this._buffLabels = null; // libellés des buffs actifs (panneau)
      // chantier : posé par placeTower() en state "en construction" — ne tire/produit/
      // pulse pas tant qu'aucun villageois assigné (builders) n'a fini buildTime secondes
      // de travail dessus (cf. units.js). Faux par défaut : une instanciation directe
      // (ex. le fantôme de pose dans drawPlacement()) reste une tour normale.
      this.underConstruction = false;
      this.buildProgress = 0;   // 0..1
      this.buildTime = 0;       // secondes de travail nécessaires À UN SEUL bâtisseur
      // ids des villageois qui construisent actuellement (comme dans Age of Empires :
      // plusieurs villageois sur le même chantier accélèrent la construction, plafonné
      // à MAX_BUILDERS dans game.js). Set = concept hôte uniquement ; l'invité n'a
      // besoin que d'un compte (cf. net.js builderCount).
      this.builders = new Set();
    }

    stats() {
      const s = this.def.levels[this.level];
      const m = TD.mods;
      const b = this._buff;
      const wRange = TD.weather.rangeMul(), wRate = TD.weather.rateMul();
      const out = Object.assign({}, s, {
        dmg: (s.dmg || 0) * m.dmgMul * (b ? b.dmgMul : 1),
        dps: (s.dps || 0) * m.dmgMul * (b ? b.dmgMul : 1),
        rate: (s.rate || 0) * m.rateMul * (b ? b.rateMul : 1) * wRate,
        range: (s.range || 0) * (b ? b.rangeMul : 1) * wRange * (m.towerRangeMul || 1),
        jumps: (s.jumps || 0) + (s.jumps ? m.chainBonus : 0),
      });
      // co-op : un Hôtel de Ville peut nourrir un peu plus de villageois par joueur
      // en plus (contention sur les nœuds bois/pierre sinon, cf. game.js nodeCoopMul)
      if (this.key === 'townhall' && s.maxUnits) out.maxUnits = Math.round(s.maxUnits * (1 + 0.3 * (TD.game.humanCount() - 1)));
      return out;
    }
    upgradeCost() {
      if (this.underConstruction || this.level >= 2) return null;
      return Math.round(this.def.levels[this.level + 1].cost * TD.mods.upgCostMul);
    }
    // un chantier revend le coût engagé en entier (il n'a jamais tourné) ; une tour
    // finie garde le remboursement à 70% habituel.
    sellValue() { return this.underConstruction ? this.invested : Math.round(this.invested * 0.7); }

    inRange(e, range) {
      return U.dist2(this.x, this.y, e.x, e.y) <= range * range;
    }

    pickTarget(range) {
      const list = TD.game.enemies;
      let best = null, bestV = -Infinity;
      for (const e of list) {
        if (e.dead || e.phased > 0) continue;
        if (!this.inRange(e, range)) continue;
        let v;
        switch (this.mode) {
          case 'dernier': v = -e.pathT; break;
          case 'costaud': v = e.hp; break;
          case 'fragile': v = -e.hp; break;
          case 'proche': v = -U.dist2(this.x, this.y, e.x, e.y); break;
          default: v = e.pathT + (e.fly ? 10000 : 0) * 0; break;
        }
        if (v > bestV) { bestV = v; best = e; }
      }
      return best;
    }

    _holdPoint() {
      if (this._hold) return this._hold;
      const M = TD.map; let best = null, bd = 1e9;
      for (let tt = 0; tt < M.totalLen; tt += 24) {
        const p = M.pointAt(tt); const d = U.dist2(this.x, this.y, p.x, p.y);
        if (d < bd) { bd = d; best = p; }
      }
      this._hold = best || { x: this.x, y: this.y };
      return this._hold;
    }
    _produce(dt, s) {
      let count = 0;
      for (const u of TD.game.units) if (u.homeId === this.id && !u.dead) count++;
      if (count >= s.maxUnits) { this.prodT = Math.min(this.prodT, 1.5); return; }
      this.prodT -= dt;
      if (this.prodT <= 0) {
        this.prodT = s.spawn;
        const hp = this._holdPoint();
        const u = TD.game.spawnUnit(this.def.unit, this.x + U.rand(-8, 8), this.y + 8, this.id);
        if (u) { u.setHold(hp.x + U.rand(-20, 20), hp.y + U.rand(-14, 14)); TD.fx.ring(this.x, this.y, this.def.color, 36, 0.35, 2); }
      }
    }
    // pulsation de zone : vent (repousse) ou malédiction (vulnérabilité)
    _pulse(s) {
      let any = false;
      for (const e of TD.game.enemies) {
        if (e.dead || !this.inRange(e, s.range)) continue;
        any = true;
        if (this.def.kind === 'wind') {
          if (s.dmg) TD.game.dealDamage(e, s.dmg, 'phys', { source: this.key, tower: this });
          if (!e.dead) { e.pathT = Math.max(0, e.pathT - s.knock * (e.def.boss ? 0.28 : 1)); e.updatePos(); }
        } else {
          if (s.dmg) TD.game.dealDamage(e, s.dmg, 'magic', { source: this.key, tower: this });
          if (!e.dead) e.applyVuln(s.vuln, s.vulnDur);
        }
      }
      if (any) {
        this.recoil = 1;
        if (this.def.kind === 'wind') { TD.fx.ring(this.x, this.y - 20, '#cfeee6', s.range, 0.4, 4); TD.audio.sfx('ice'); }
        else { TD.fx.ring(this.x, this.y - 20, '#c08af0', s.range, 0.35, 3); TD.audio.sfx('zap'); }
      }
    }

    update(dt, t) {
      // chantier : aucun tir/production/pulsation tant qu'il n'est pas achevé — la
      // progression est avancée par le villageois assigné (units.js _gather), pas ici.
      if (this.underConstruction) return;
      if (this.placedT > 0) this.placedT = Math.max(0, this.placedT - dt * 2.4);
      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 5);
      const s = this.stats();

      // l'Hôtel de Ville ne produit plus de villageois tout seul (recrutement manuel
      // payant, cf. game.js cmd 'recruit') — les autres casernes gardent leur
      // auto-production d'unités de combat inchangée.
      if (this.def.kind === 'barracks') { if (this.key !== 'townhall') this._produce(dt, s); return; }

      // aura givrante (yuki L3)
      if (s.aura) {
        this.auraT -= dt;
        if (this.auraT <= 0) {
          this.auraT = 0.3;
          for (const e of TD.game.enemies) {
            if (!e.dead && this.inRange(e, s.aura.range)) e.applySlow(s.aura.pct, 0.45);
          }
        }
      }

      // tours à pulsation (vent / malédiction) — sans cible ni projectile
      if (this.def.kind === 'wind' || this.def.kind === 'curse') {
        this.turretAng += dt * 1.2;
        this.cooldown -= dt;
        if (this.cooldown <= 0) { this.cooldown = 1 / s.rate; this._pulse(s); }
        return;
      }

      // rayon continu
      if (this.def.kind === 'beam') {
        if (this.target && (this.target.dead || this.target.phased > 0 || !this.inRange(this.target, s.range))) {
          this.target = null; this.beamRamp *= 0.4;
        }
        if (!this.target) {
          this.target = this.pickTarget(s.range);
          if (this.target) this.beamRamp *= 0.5;
        }
        if (this.target) {
          const rampSpeed = (s.rampMax / s.rampTime) * (TD.mods.beamRampMul || 1);
          this.beamRamp = Math.min(s.rampMax, this.beamRamp + rampSpeed * dt);
          const dps = s.dps * (1 + this.beamRamp);
          TD.game.dealDamage(this.target, dps * dt, 'magic', { source: this.key, quiet: true, tower: this });
          this.turretAng = Math.atan2(this.target.y - this.y, this.target.x - this.x);
          this.beamSoundT -= dt;
          if (this.beamSoundT <= 0) { this.beamSoundT = 0.5; TD.audio.sfx('beam'); }
          if (U.chance(dt * 22)) {
            TD.fx.sparks(this.target.x + U.rand(-6, 6), this.target.y + U.rand(-6, 6), this.def.color, 1, 110, 3.5);
          }
        }
        return;
      }

      // ciblage + tir discret
      if (this.target && (this.target.dead || this.target.phased > 0 || !this.inRange(this.target, s.range))) this.target = null;
      if (!this.target) this.target = this.pickTarget(s.range);
      if (this.target) {
        const ta = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.turretAng = U.angleLerp(this.turretAng, ta, Math.min(1, dt * 12));
      }
      this.cooldown -= dt;
      if (this.cooldown <= 0 && this.target) {
        this.cooldown = 1 / s.rate;
        this.fire(s);
      }
    }

    fire(s) {
      this.recoil = 1;
      const tgt = this.target;
      switch (this.def.kind) {
        case 'bullet': {
          TD.audio.sfx('shoot');
          const n = s.double ? 2 : 1;
          const kind = this.def.dmgType === 'magic' ? 'magic' : 'phys';
          for (let i = 0; i < n; i++) {
            projectiles.push({
              type: 'homing', x: this.x + Math.cos(this.turretAng) * 14 + U.rand(-3, 3), y: this.y - 26 + Math.sin(this.turretAng) * 14 + U.rand(-3, 3),
              speed: 480, target: tgt, lx: tgt.x, ly: tgt.y,
              color: this.def.color, kind: 'petal', life: 2,
              onHit: e => {
                let dm = s.dmg;
                if (s.flyBonus && e.fly) dm *= s.flyBonus;
                TD.game.dealDamage(e, dm, kind, { source: this.key, tower: this });
                if (s.burn) e.applyBurn(s.burn.dps, s.burn.dur);
              },
            });
          }
          break;
        }
        case 'aoe': {
          TD.audio.sfx('taiko');
          TD.fx.ring(this.x, this.y - 24, '#ffd9b0', 36, 0.3, 3);
          const lead = U.clamp(U.dist(this.x, this.y, tgt.x, tgt.y) / 260, 0, 1.2);
          const sp = tgt.currentSpeed();
          const fut = (tgt.fly ? TD.map.flyPointAt : TD.map.pointAt)(Math.min(tgt.pathT + sp * lead, tgt.totalLen - 1));
          projectiles.push({
            type: 'ballistic', x0: this.x, y0: this.y - 30, x1: fut.x, y1: fut.y,
            T: lead, t: 0, arc: 70, color: '#5a4a6a', kind: 'drum',
            onLand: (x, y) => {
              TD.fx.explosion(x, y, '#ff9d5c', s.splash);
              TD.audio.sfx('taiko');
              for (const e of TD.game.enemies) {
                if (e.dead || U.dist2(x, y, e.x, e.y) > s.splash * s.splash) continue;
                TD.game.dealDamage(e, s.dmg, 'phys', { source: this.key, tower: this });
                if (s.burn) e.applyBurn(s.burn.dps, s.burn.dur);
              }
            },
          });
          break;
        }
        case 'frost': {
          TD.audio.sfx('ice');
          this.freezeCounter++;
          const doFreeze = s.freezeEvery && this.freezeCounter % s.freezeEvery === 0;
          projectiles.push({
            type: 'homing', x: this.x, y: this.y - 34, speed: 560, target: tgt, lx: tgt.x, ly: tgt.y,
            color: '#bfeaff', kind: 'shard', life: 2,
            onHit: e => {
              TD.game.dealDamage(e, s.dmg, 'magic', { source: this.key, tower: this });
              e.applySlow(s.slowPct, s.slowDur);
              if (doFreeze) e.applyFreeze(0.8);
              TD.fx.sparks(e.x, e.y, '#bfeaff', 5, 120, 3.5);
            },
          });
          break;
        }
        case 'chain': {
          TD.audio.sfx('zap');
          const hit = [tgt];
          let cur = tgt, dmg = s.dmg;
          const pts = [{ x: this.x, y: this.y - 40 }, { x: tgt.x, y: tgt.y }];
          TD.game.dealDamage(cur, dmg, 'magic', { source: this.key, tower: this });
          if (s.shock) cur.applyShock(s.shock);
          for (let j = 0; j < s.jumps; j++) {
            let nxt = null, bd = 120 * 120;
            for (const e of TD.game.enemies) {
              if (e.dead || e.phased > 0 || hit.includes(e)) continue;
              const d2 = U.dist2(cur.x, cur.y, e.x, e.y);
              if (d2 < bd) { bd = d2; nxt = e; }
            }
            if (!nxt) break;
            dmg *= s.falloff;
            TD.game.dealDamage(nxt, dmg, 'magic', { source: this.key, tower: this });
            if (s.shock) nxt.applyShock(s.shock);
            hit.push(nxt);
            pts.push({ x: nxt.x, y: nxt.y });
            cur = nxt;
          }
          bolts.push({ pts, life: 0.22, maxLife: 0.22, color: '#ffe35e' });
          for (const e of hit) TD.fx.sparks(e.x, e.y, '#ffe35e', 4, 130, 3.5);
          break;
        }
        case 'poison': {
          TD.audio.sfx('poison');
          const lead = U.clamp(U.dist(this.x, this.y, tgt.x, tgt.y) / 230, 0, 1.4);
          const fut = (tgt.fly ? TD.map.flyPointAt : TD.map.pointAt)(Math.min(tgt.pathT + tgt.currentSpeed() * lead, tgt.totalLen - 1));
          projectiles.push({
            type: 'ballistic', x0: this.x, y0: this.y - 30, x1: fut.x, y1: fut.y,
            T: lead, t: 0, arc: 90, color: '#8ee06a', kind: 'blob',
            onLand: (x, y) => {
              const cl = s.cloud;
              const r = cl.r * (TD.mods.cloudMul || 1);
              // Le nuage applique aussi le buff de synergie (aura/adjacence) sur son DPS,
              // comme les dégâts directs (cf. stats() qui multiplie déjà par this._buff).
              const buffMul = this._buff ? this._buff.dmgMul : 1;
              clouds.push({ x, y, r, dur: cl.dur, t: 0, dps: cl.dps * TD.mods.dmgMul * buffMul, slow: cl.slow || 0, tick: 0, src: this });
              TD.fx.ring(x, y, '#8ee06a', r, 0.5, 3);
              for (const e of TD.game.enemies) {
                if (!e.dead && U.dist2(x, y, e.x, e.y) <= r * r)
                  TD.game.dealDamage(e, s.dmg, 'magic', { source: this.key, tower: this });
              }
            },
          });
          break;
        }
      }
    }

    // ── dessin ─────────────────────────────────────────────
    draw(ctx, t) {
      const pop = this.placedT > 0 ? U.easeOutBack(1 - this.placedT) : 1;
      const rec = this.recoil;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(pop, pop);
      // ombre + socle
      ctx.fillStyle = 'rgba(40,60,40,0.25)';
      ctx.beginPath(); ctx.ellipse(0, 16, 24, 9, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#d8cdb8';
      ctx.beginPath(); ctx.ellipse(0, 12, 23, 11, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#efe6d4';
      ctx.beginPath(); ctx.ellipse(0, 9, 20, 9, 0, 0, U.TAU); ctx.fill();

      const lv = this.level;
      switch (this.key) {
        case 'archer': {
          // tronc sakura
          ctx.fillStyle = '#8a6248';
          ctx.fillRect(-4, -22, 8, 32);
          // canopée (grossit avec le niveau)
          const cs = 1 + lv * 0.18;
          for (const [bx, by, r] of [[-10, -30, 12], [10, -32, 11], [0, -42, 14]]) {
            ctx.fillStyle = '#ff9ec7';
            ctx.beginPath(); ctx.arc(bx * cs, by * cs + 6, r * cs, 0, U.TAU); ctx.fill();
            ctx.fillStyle = '#ffc2db';
            ctx.beginPath(); ctx.arc(bx * cs - 2, by * cs + 4, r * cs * 0.85, 0, U.TAU); ctx.fill();
          }
          // arc tournant
          ctx.save();
          ctx.translate(0, -26);
          ctx.rotate(this.turretAng);
          ctx.translate(-rec * 4, 0);
          ctx.strokeStyle = '#7a4a2e'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(6, 0, 13, -1.15, 1.15); ctx.stroke();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          const pull = 4 - rec * 7;
          ctx.beginPath();
          ctx.moveTo(6 + Math.cos(-1.15) * 13, Math.sin(-1.15) * 13);
          ctx.lineTo(pull, 0);
          ctx.lineTo(6 + Math.cos(1.15) * 13, Math.sin(1.15) * 13);
          ctx.stroke();
          ctx.restore();
          if (lv >= 2) { // petits lampions dorés
            ctx.fillStyle = '#ffd24a';
            ctx.beginPath(); ctx.arc(-16, -18, 4, 0, U.TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(16, -20, 4, 0, U.TAU); ctx.fill();
          }
          break;
        }
        case 'taiko': {
          const squash = 1 + rec * 0.16;
          // support
          ctx.strokeStyle = '#6d5230'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(-16, 8); ctx.lineTo(-10, -16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(10, -16); ctx.stroke();
          // fût du tambour
          ctx.save();
          ctx.translate(0, -24);
          ctx.scale(squash, 2 - squash);
          ctx.fillStyle = '#b8503e';
          U.rr(ctx, -17, -13, 34, 26, 8); ctx.fill();
          ctx.fillStyle = '#f5e8d8';
          ctx.beginPath(); ctx.ellipse(0, 0, 14, 12.5, 0, 0, U.TAU); ctx.fill();
          // tomoe
          ctx.fillStyle = '#b8503e';
          for (let i = 0; i < 3; i++) {
            const a = t * 0.5 + i * U.TAU / 3;
            ctx.beginPath(); ctx.arc(Math.cos(a) * 5, Math.sin(a) * 5, 3.2, 0, U.TAU); ctx.fill();
          }
          ctx.restore();
          // baguettes
          ctx.strokeStyle = '#f5e8d8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          const ba = rec * 0.9;
          ctx.beginPath(); ctx.moveTo(-22, -44 + ba * 14); ctx.lineTo(-9, -32 + ba * 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(22, -44 + ba * 14); ctx.lineTo(9, -32 + ba * 6); ctx.stroke();
          if (lv >= 1) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -44, 4, 0, U.TAU); ctx.fill(); }
          if (lv >= 2) { // mini torii au-dessus
            ctx.fillStyle = '#e84e4e';
            ctx.fillRect(-14, -62, 4, 12); ctx.fillRect(10, -62, 4, 12);
            ctx.fillRect(-18, -64, 36, 4);
          }
          break;
        }
        case 'yuki': {
          // pic de glace
          const grd = ctx.createLinearGradient(0, -54, 0, 6);
          grd.addColorStop(0, '#e8f8ff'); grd.addColorStop(1, '#8fd4f0');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.moveTo(-14, 6); ctx.lineTo(-7, -30 - lv * 4); ctx.lineTo(0, -48 - lv * 6);
          ctx.lineTo(7, -28 - lv * 4); ctx.lineTo(14, 6);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-2, -34); ctx.lineTo(2, -34); ctx.lineTo(0, 0); ctx.fill();
          // cristal flottant
          ctx.save();
          ctx.translate(0, -58 - lv * 6 + Math.sin(t * 2.2) * 3);
          ctx.rotate(t * 1.2);
          ctx.fillStyle = '#bfeaff';
          ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0); ctx.fill();
          ctx.restore();
          if (this.stats().aura) {
            ctx.strokeStyle = U.withAlpha('#9fdcff', 0.25 + 0.15 * U.pulse(t));
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, this.stats().aura.range * (0.9 + 0.1 * U.pulse(t * 0.7)), 0, U.TAU); ctx.stroke();
          }
          if (U.chance(0.06)) TD.fx.spawn({ x: this.x + U.rand(-14, 14), y: this.y - U.rand(20, 50), vy: 14, life: 1.2, size: 2.5, endSize: 0, color: '#e8f8ff', type: 'snow' });
          break;
        }
        case 'poison': {
          // pot
          ctx.fillStyle = '#7a5a9e';
          U.rr(ctx, -14, -14, 28, 22, 7); ctx.fill();
          ctx.fillStyle = '#9b7ec4';
          U.rr(ctx, -16, -18, 32, 8, 4); ctx.fill();
          // glycine retombante
          for (let i = -2; i <= 2; i++) {
            const sway = Math.sin(t * 1.6 + i) * 3;
            ctx.strokeStyle = '#5da04e'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(i * 6, -18);
            ctx.quadraticCurveTo(i * 9 + sway, -34, i * 11 + sway, -44 - lv * 5);
            ctx.stroke();
            ctx.fillStyle = i % 2 ? '#c79bff' : '#8ee06a';
            for (let j = 0; j < 3 + lv; j++) {
              ctx.beginPath();
              ctx.arc(i * 10 + sway * (j / 3), -40 - lv * 5 + j * 7, 4 - j * 0.5, 0, U.TAU);
              ctx.fill();
            }
          }
          if (U.chance(0.05)) TD.fx.spawn({ x: this.x + U.rand(-10, 10), y: this.y - 20, vy: -20, life: 1, size: 3, color: '#8ee06a', type: 'bubble' });
          break;
        }
        case 'kitsune': {
          // torii
          ctx.fillStyle = '#e84e4e';
          ctx.fillRect(-18, -38, 6, 46);
          ctx.fillRect(12, -38, 6, 46);
          ctx.fillRect(-22, -40, 44, 5);
          ctx.beginPath();
          ctx.moveTo(-26, -50); ctx.quadraticCurveTo(0, -58, 26, -50);
          ctx.lineTo(26, -44); ctx.quadraticCurveTo(0, -52, -26, -44);
          ctx.fill();
          // shide papiers
          ctx.fillStyle = '#fff';
          for (const sx of [-9, 3]) {
            ctx.save(); ctx.translate(sx, -38); ctx.rotate(Math.sin(t * 2 + sx) * 0.12);
            ctx.fillRect(0, 0, 5, 9); ctx.fillRect(1.5, 9, 5, 8);
            ctx.restore();
          }
          // statue renard
          ctx.fillStyle = '#ff9d5c';
          ctx.beginPath(); ctx.arc(0, -14, 9, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-7, -19); ctx.lineTo(-4, -28); ctx.lineTo(-1, -20); ctx.fill();
          ctx.beginPath(); ctx.moveTo(7, -19); ctx.lineTo(4, -28); ctx.lineTo(1, -20); ctx.fill();
          // orbe foudre
          const oy = -62 + Math.sin(t * 2.6) * 3;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.7 + 0.3 * U.pulse(t * 2);
          ctx.drawImage(TD.fx.glowSprite('#ffe35e'), -14, oy - 14, 28, 28);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff7cf';
          ctx.beginPath(); ctx.arc(0, oy, 5 + lv, 0, U.TAU); ctx.fill();
          if (lv >= 2) {
            ctx.strokeStyle = '#ffe35e'; ctx.lineWidth = 1.5;
            const a1 = t * 7;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a1) * 12, oy + Math.sin(a1) * 12);
            ctx.lineTo(Math.cos(a1 + 2) * 12, oy + Math.sin(a1 + 2) * 12);
            ctx.stroke();
          }
          break;
        }
        case 'lantern': {
          // pilier
          ctx.fillStyle = '#8d959f';
          ctx.fillRect(-5, -26, 10, 36);
          // boîte de lumière
          const ly = -40 - lv * 4;
          ctx.fillStyle = lv >= 2 ? '#ffd24a' : '#c4ccd6';
          U.rr(ctx, -13, ly - 12, 26, 22, 5); ctx.fill();
          ctx.fillStyle = '#6b7280';
          ctx.beginPath(); ctx.moveTo(-17, ly - 11); ctx.lineTo(0, ly - 24); ctx.lineTo(17, ly - 11); ctx.fill();
          // flamme
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.8 + 0.2 * U.pulse(t * 3.1);
          ctx.drawImage(TD.fx.glowSprite(this.def.color), -20, ly - 22, 40, 40);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fff1d6';
          ctx.beginPath(); ctx.arc(0, ly - 1, 6, 0, U.TAU); ctx.fill();
          if (lv >= 2) {
            // rayons tournants
            ctx.save();
            ctx.translate(0, ly - 1);
            ctx.rotate(t * 0.8);
            ctx.strokeStyle = U.withAlpha('#ffe8b0', 0.5);
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
              ctx.rotate(Math.PI / 2);
              ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, 17); ctx.stroke();
            }
            ctx.restore();
          }
          break;
        }
        case 'tsuru': {
          ctx.fillStyle = '#8a6248'; ctx.fillRect(-3, -20, 6, 30);
          ctx.save(); ctx.translate(0, -30); ctx.rotate(Math.sin(t * 2) * 0.06);
          const flap = Math.sin(t * 4) * 0.2;
          ctx.fillStyle = '#dfeefc';
          for (const sd of [-1, 1]) { ctx.save(); ctx.rotate(sd * (0.4 + flap)); ctx.beginPath(); ctx.ellipse(sd * 12, 2, 10, 5, 0, 0, U.TAU); ctx.fill(); ctx.restore(); }
          ctx.fillStyle = '#f4fbff';
          ctx.beginPath(); ctx.ellipse(0, 0, 12, 16, 0, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(0, -14, 6, 0, U.TAU); ctx.fill();
          ctx.save(); ctx.translate(0, -14); ctx.rotate(this.turretAng);
          ctx.fillStyle = '#ffb84a'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(16 - rec * 5, 0); ctx.lineTo(0, 2); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#e84e4e'; ctx.beginPath(); ctx.arc(0, -18, 2.5, 0, U.TAU); ctx.fill();
          ctx.restore();
          if (lv >= 2) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -50, 3.5, 0, U.TAU); ctx.fill(); }
          break;
        }
        case 'kitsunebi': {
          ctx.fillStyle = '#b5402f'; ctx.fillRect(-15, -20, 30, 7);
          ctx.fillStyle = '#caa46a'; ctx.fillRect(-11, -13, 22, 23);
          ctx.fillStyle = '#2a1f2e'; ctx.fillRect(-5, -6, 10, 16);
          const fy = -34 + Math.sin(t * 4) * 3 - lv * 2;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.8 + 0.2 * U.pulse(t * 4);
          ctx.drawImage(TD.fx.glowSprite('#ff7a3c'), -16, fy - 16, 32, 32);
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.moveTo(0, fy - 11); ctx.quadraticCurveTo(7, fy + 1, 0, fy + 7); ctx.quadraticCurveTo(-7, fy + 1, 0, fy - 11); ctx.fill();
          ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.arc(0, fy + 1, 2.5, 0, U.TAU); ctx.fill();
          break;
        }
        case 'ozutsu': {
          ctx.fillStyle = '#5a5266'; U.rr(ctx, -16, -6, 32, 18, 5); ctx.fill();
          ctx.save(); ctx.translate(0, -8); ctx.rotate(this.turretAng - rec * 0.2);
          ctx.fillStyle = '#3a3450'; U.rr(ctx, -6.5, -32, 13, 36, 5); ctx.fill();
          ctx.fillStyle = '#6a6480'; ctx.beginPath(); ctx.ellipse(0, -32, 6.5, 3.5, 0, 0, U.TAU); ctx.fill();
          ctx.restore();
          ctx.fillStyle = '#ffd24a'; ctx.fillRect(-14, 2, 28, 3);
          if (lv >= 2) { ctx.fillStyle = '#e84e4e'; ctx.beginPath(); ctx.arc(0, -2, 4, 0, U.TAU); ctx.fill(); }
          break;
        }
        case 'grandarc': {
          ctx.fillStyle = '#6d5230'; ctx.fillRect(-4, -18, 8, 28);
          ctx.save(); ctx.translate(0, -22); ctx.rotate(this.turretAng); ctx.translate(-rec * 5, 0);
          ctx.strokeStyle = '#8a5a2e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(2, 0, 20, -1.3, 1.3); ctx.stroke();
          const pull = 2 - rec * 10;
          ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(2 + Math.cos(-1.3) * 20, Math.sin(-1.3) * 20);
          ctx.lineTo(pull, 0);
          ctx.lineTo(2 + Math.cos(1.3) * 20, Math.sin(1.3) * 20);
          ctx.stroke();
          ctx.strokeStyle = '#caa06a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(24, 0); ctx.stroke();
          ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(24, -3); ctx.lineTo(32, 0); ctx.lineTo(24, 3); ctx.fill();
          ctx.restore();
          if (lv >= 2) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(-12, -14, 3, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.arc(12, -14, 3, 0, U.TAU); ctx.fill(); }
          break;
        }
        case 'dojo': {
          ctx.fillStyle = '#8a6248'; ctx.fillRect(-16, -8, 32, 18);
          ctx.fillStyle = this.def.color; ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(0, -28); ctx.lineTo(18, -8); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#2a1f2e'; ctx.fillRect(-5, -4, 10, 14);
          ctx.strokeStyle = '#6d5230'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -26); ctx.lineTo(14, -46); ctx.stroke();
          ctx.fillStyle = '#e0bd66'; const wv = Math.sin(t * 3) * 2;
          ctx.beginPath(); ctx.moveTo(14, -46); ctx.lineTo(28 + wv, -43); ctx.lineTo(14, -38); ctx.fill();
          if (lv >= 2) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -30, 3, 0, U.TAU); ctx.fill(); }
          break;
        }
        case 'yumiba': {
          ctx.fillStyle = '#8a6248'; ctx.fillRect(-15, -6, 30, 16);
          ctx.fillStyle = this.def.color; ctx.beginPath(); ctx.moveTo(-17, -6); ctx.lineTo(0, -24); ctx.lineTo(17, -6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -14, 7, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = '#e84e4e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -14, 5, 0, U.TAU); ctx.stroke();
          ctx.fillStyle = '#e84e4e'; ctx.beginPath(); ctx.arc(0, -14, 2, 0, U.TAU); ctx.fill();
          if (lv >= 2) { ctx.strokeStyle = '#7a4a2e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(14, -20, 8, -1, 1); ctx.stroke(); }
          break;
        }
        case 'bushido': {
          ctx.fillStyle = '#5a4250'; ctx.fillRect(-16, -8, 32, 18);
          ctx.fillStyle = this.def.color; ctx.beginPath(); ctx.moveTo(-19, -8); ctx.lineTo(0, -30); ctx.lineTo(19, -8); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -24); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(-10, -24); ctx.stroke();
          ctx.fillStyle = '#caa46a'; ctx.beginPath(); ctx.arc(0, -13, 3, 0, U.TAU); ctx.fill();
          if (lv >= 2) { ctx.fillStyle = '#ffd24a'; ctx.fillRect(-14, -34, 28, 3); }
          break;
        }
        case 'fujin': {
          // mât + moulinet à vent (kazaguruma) qui tourne
          ctx.fillStyle = '#6b7a86'; ctx.fillRect(-3, -26, 6, 36);
          ctx.save(); ctx.translate(0, -30); ctx.rotate(this.turretAng * (1.5 + lv * 0.4));
          for (let k = 0; k < 4; k++) {
            ctx.rotate(U.TAU / 4);
            ctx.fillStyle = k % 2 ? '#bdeee2' : '#7fd0c0';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, -3); ctx.quadraticCurveTo(14, 5, 4, 8); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, U.TAU); ctx.fill();
          ctx.restore();
          // rafales (traits de vent) selon le recul
          if (rec > 0.2) {
            ctx.strokeStyle = U.withAlpha('#cfeee6', rec * 0.7); ctx.lineWidth = 2; ctx.lineCap = 'round';
            for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(0, -18, 16 + k * 5, -0.6, 0.6); ctx.stroke(); }
          }
          break;
        }
        case 'ofuda': {
          // pieu + talisman papier qui flotte + halo de sutra
          ctx.fillStyle = '#7a5a3c'; ctx.fillRect(-3, -24, 6, 32);
          ctx.save(); ctx.translate(0, -30); ctx.rotate(Math.sin(t * 3 + this.id) * 0.12);
          ctx.fillStyle = '#f3ead8'; U.rr(ctx, -7, -16, 14, 26, 2); ctx.fill();
          ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 7); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-3, -7); ctx.lineTo(3, -7); ctx.moveTo(-3, -1); ctx.lineTo(3, -1); ctx.moveTo(-3, 5); ctx.lineTo(3, 5); ctx.stroke();
          ctx.restore();
          ctx.globalAlpha = 0.45 + 0.3 * U.pulse(t * 1.6);
          ctx.strokeStyle = '#c08af0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, -30, 17 + lv * 2, 0, U.TAU); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
      }
      // étoiles de niveau
      ctx.fillStyle = '#ffd24a';
      ctx.strokeStyle = '#a8761a'; ctx.lineWidth = 1;
      for (let i = 0; i < this.level; i++) {
        const sx = (i - (this.level - 1) / 2) * 11;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + k * U.TAU / 5;
          const a2 = a + U.TAU / 10;
          ctx.lineTo(sx + Math.cos(a) * 4.5, 22 + Math.sin(a) * 4.5);
          ctx.lineTo(sx + Math.cos(a2) * 2, 22 + Math.sin(a2) * 2);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // chantier en cours : voile sombre par-dessus la silhouette + anneau de
      // progression + marteau — dessiné après tout le reste, indépendant du kind.
      if (this.underConstruction) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#1c1c1c';
        ctx.beginPath(); ctx.arc(0, -6, 30, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(120,100,80,0.6)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -6, 26, 0, U.TAU); ctx.stroke();
        ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, -6, 26, -Math.PI / 2, -Math.PI / 2 + U.TAU * Math.min(1, this.buildProgress));
        ctx.stroke();
        ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔨', 0, -6);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }
  }

  // ── projectiles / bolts / nuages ─────────────────────────
  function updateAll(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      if (p.type === 'homing') {
        p.life -= dt;
        if (p.target && !p.target.dead) { p.lx = p.target.x; p.ly = p.target.y; }
        const dx = p.lx - p.x, dy = p.ly - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 14 || p.life <= 0) {
          if (p.target && !p.target.dead && d < 26) p.onHit(p.target);
          else TD.fx.sparks(p.x, p.y, p.color, 3, 80, 3);
          projectiles.splice(i, 1);
          continue;
        }
        p.x += dx / d * p.speed * dt;
        p.y += dy / d * p.speed * dt;
        p.rot = Math.atan2(dy, dx);
        if (p.kind === 'petal' && U.chance(dt * 18)) TD.fx.spawn({ x: p.x, y: p.y, life: 0.3, size: 3, endSize: 0, color: p.color, type: 'glow' });
        if (p.kind === 'shard' && U.chance(dt * 20)) TD.fx.spawn({ x: p.x, y: p.y, life: 0.35, size: 2.5, endSize: 0, color: '#dff4ff', type: 'glow' });
      } else { // ballistic
        p.t += dt;
        const k = Math.min(1, p.t / p.T);
        p.x = U.lerp(p.x0, p.x1, k);
        p.y = U.lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * p.arc;
        if (p.kind === 'drum' && U.chance(dt * 14)) TD.fx.spawn({ x: p.x, y: p.y, life: 0.5, size: 4, endSize: 9, color: '#9a8aa8', alpha: 0.4, type: 'smoke' });
        if (k >= 1) { p.onLand(p.x1, p.y1); projectiles.splice(i, 1); }
      }
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.t += dt; c.tick -= dt;
      if (c.tick <= 0) {
        c.tick = 0.4;
        for (const e of TD.game.enemies) {
          if (e.dead || U.dist2(c.x, c.y, e.x, e.y) > c.r * c.r) continue;
          e.applyPoison(c.dps, 1.4);
          if (c.slow) e.applySlow(c.slow, 0.6);
        }
        TD.fx.spawn({ x: c.x + U.rand(-c.r * 0.7, c.r * 0.7), y: c.y + U.rand(-c.r * 0.5, c.r * 0.5), vy: -16, life: 1, size: U.rand(3, 5), color: '#8ee06a', type: 'bubble' });
      }
      if (c.t >= c.dur) clouds.splice(i, 1);
    }
  }

  function drawEffects(ctx, t, towers) {
    // nuages toxiques
    for (const c of clouds) {
      const k = 1 - c.t / c.dur;
      ctx.globalAlpha = 0.22 * Math.min(1, k * 3);
      ctx.fillStyle = '#79c95c';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * (0.9 + 0.1 * U.pulse(t * 1.2)), 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.3 * Math.min(1, k * 3);
      ctx.strokeStyle = '#a4e878'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, U.TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // rayons des lanternes
    for (const tw of towers) {
      if (tw.def.kind !== 'beam' || !tw.target || tw.target.dead) continue;
      const x0 = tw.x, y0 = tw.y - 41 - tw.level * 4, x1 = tw.target.x, y1 = tw.target.y;
      const ramp = tw.beamRamp / tw.stats().rampMax;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.strokeStyle = U.withAlpha(tw.def.color, 0.35);
      ctx.lineWidth = 10 + ramp * 10 + Math.sin(t * 17) * 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = U.withAlpha('#ffffff', 0.85);
      ctx.lineWidth = 2.5 + ramp * 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.drawImage(TD.fx.glowSprite(tw.def.color), x1 - 22, y1 - 22, 44, 44);
      ctx.globalCompositeOperation = 'source-over';
    }
    // éclairs
    for (const b of bolts) {
      const a = b.life / b.maxLife;
      ctx.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? U.withAlpha(b.color, a * 0.5) : U.withAlpha('#ffffff', a * 0.9);
        ctx.lineWidth = pass === 0 ? 6 : 2;
        ctx.beginPath();
        for (let i = 0; i < b.pts.length - 1; i++) {
          const p1 = b.pts[i], p2 = b.pts[i + 1];
          ctx.moveTo(p1.x, p1.y);
          const segs = 4;
          for (let sgi = 1; sgi <= segs; sgi++) {
            const k = sgi / segs;
            const jx = sgi === segs ? 0 : U.rand(-7, 7);
            const jy = sgi === segs ? 0 : U.rand(-7, 7);
            ctx.lineTo(U.lerp(p1.x, p2.x, k) + jx, U.lerp(p1.y, p2.y, k) + jy);
          }
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // projectiles
    for (const p of projectiles) {
      if (p.type === 'ballistic') {
        // ombre au sol
        ctx.fillStyle = 'rgba(40,60,40,0.2)';
        const k = Math.min(1, p.t / p.T);
        const gy = U.lerp(p.y0, p.y1, k);
        ctx.beginPath(); ctx.ellipse(p.x, gy + 6, 7, 3, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'drum' ? 7 : 6, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, 2.5, 0, U.TAU); ctx.fill();
      } else if (p.kind === 'petal') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
        ctx.drawImage(TD.fx.petalSprite(p.color), -8, -6, 16, 12);
        ctx.restore();
      } else { // shard
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate((p.rot || 0) + Math.PI / 2);
        ctx.fillStyle = '#dff4ff';
        ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 2); ctx.lineTo(0, 8); ctx.lineTo(-4, 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  function reset() { projectiles.length = 0; bolts.length = 0; clouds.length = 0; nextTowerId = 1; }

  // ── sync co-op : effets visuels (hôte → invités) ─────────
  // On ne sérialise que ce qui est dessinable (pas les callbacks).
  function snapshotFx() {
    const P = projectiles.slice(0, 80).map(p => p.type === 'homing'
      ? [0, p.x | 0, p.y | 0, p.kind === 'shard' ? 1 : 0, +(p.rot || 0).toFixed(2), p.color]
      : [1, p.x | 0, p.y | 0, p.x0 | 0, p.y0 | 0, p.x1 | 0, p.y1 | 0, +p.t.toFixed(2), +p.T.toFixed(2), p.kind === 'drum' ? 0 : 1, p.color]);
    const B = bolts.slice(0, 24).map(b => [+b.life.toFixed(2), +b.maxLife.toFixed(2), b.color, b.pts.map(pt => [pt.x | 0, pt.y | 0])]);
    const C = clouds.slice(0, 40).map(c => [c.x | 0, c.y | 0, c.r | 0, +c.t.toFixed(2), +c.dur.toFixed(2)]);
    return { P, B, C };
  }
  function applyFx(fx) {
    projectiles.length = 0; bolts.length = 0; clouds.length = 0;
    if (!fx) return;
    for (const a of fx.P) {
      if (a[0] === 0) projectiles.push({ type: 'homing', x: a[1], y: a[2], kind: a[3] === 1 ? 'shard' : 'petal', rot: a[4], color: a[5], life: 1 });
      else projectiles.push({ type: 'ballistic', x: a[1], y: a[2], x0: a[3], y0: a[4], x1: a[5], y1: a[6], t: a[7], T: a[8], kind: a[9] === 0 ? 'drum' : 'blob', color: a[10], arc: 0 });
    }
    for (const b of fx.B) bolts.push({ life: b[0], maxLife: b[1], color: b[2], pts: b[3].map(pt => ({ x: pt[0], y: pt[1] })) });
    for (const c of fx.C) clouds.push({ x: c[0], y: c[1], r: c[2], t: c[3], dur: c[4] });
  }

  return { DEFS, ORDER, MODES, Tower, updateAll, drawEffects, reset, computeDps, snapshotFx, applyFx };
})();

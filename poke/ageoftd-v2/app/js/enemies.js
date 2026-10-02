// ============================================================
// AgeOfTD V2 — enemies.js : yokai chibi + boss
// Tous les ennemis sont dessinés en vectoriel (corps rond, yeux, blush).
// ============================================================
'use strict';

TD.enemies = (() => {
  const U = TD.util, M = TD.map;

  const DEFS = {
    kodama:  { name: 'Kodama',  hp: 30,  speed: 55, gold: 6,  size: 15, lives: 1, body: '#8fd17a', accent: '#5cab4e' },
    tanukin: { name: 'Tanukin', hp: 16,  speed: 72, gold: 3,  size: 11, lives: 1, body: '#c99a6b', accent: '#8a6242' },
    kappa:   { name: 'Kappa',   hp: 26,  speed: 98, gold: 7,  size: 14, lives: 1, body: '#5fc9b0', accent: '#379c86' },
    tanuki:  { name: 'Tanuki',  hp: 52,  speed: 60, gold: 9,  size: 17, lives: 1, body: '#a97c4f', accent: '#7a5634', split: 2 },
    oni:     { name: 'Oni',     hp: 140, speed: 33, gold: 14, size: 21, lives: 2, body: '#e06557', accent: '#b03d31', armor: 0.30 },
    tengu:   { name: 'Tengu',   hp: 42,  speed: 78, gold: 9,  size: 15, lives: 1, body: '#5d6b8f', accent: '#3c4866', fly: true },
    kitsune: { name: 'Kitsune', hp: 58,  speed: 72, gold: 11, size: 15, lives: 1, body: '#ff9d5c', accent: '#e0762e', dash: true },
    yurei:   { name: 'Yūrei',   hp: 75,  speed: 48, gold: 11, size: 16, lives: 1, body: '#cfe3f2', accent: '#9fc2dd', mres: 0.35, phase: true },
    daruma:  { name: 'Daruma',  hp: 175, speed: 44, gold: 13, size: 19, lives: 1, body: '#e23d3d', accent: '#b02525', armor: 0.45 },
    // ── yokai portés de la V1 ──
    gashadokuro: { name: 'Gashadokuro', hp: 90,  speed: 60, gold: 16, size: 17, lives: 1, body: '#cdc8da', accent: '#6a6480', deathSpawn: { key: 'tanukin', n: 2 } },
    miko:        { name: 'Miko Spectrale', hp: 70, speed: 64, gold: 18, size: 15, lives: 1, body: '#ffe0ec', accent: '#e88ab0', healAura: { hps: 7, range: 95 } },
    onryo:       { name: 'Onryō',     hp: 80,  speed: 70, gold: 16, size: 16, lives: 1, body: '#cdb8e8', accent: '#8f6fc0', mres: 0.20, teleport: { dist: 62, every: 4 } },
    shuten:      { name: 'Shuten-dōji', hp: 140, speed: 54, gold: 20, size: 19, lives: 2, body: '#e0564a', accent: '#9c2b22', berserk: true },
    nurikabe:    { name: 'Nurikabe',  hp: 260, speed: 30, gold: 22, size: 22, lives: 2, body: '#9a8c78', accent: '#6b5f4e', armor: 0.25, regenRate: 14 },
    jorogumo:    { name: 'Jorōgumo',  hp: 70,  speed: 92, gold: 14, size: 16, lives: 1, body: '#b07ad0', accent: '#6e3f97', poisonImmune: true, spider: true },
    nopperabo:   { name: 'Nopperabō', hp: 120, speed: 50, gold: 18, size: 17, lives: 1, body: '#f1e7d9', accent: '#b6a48e', spawner: { key: 'tanukin', n: 1, every: 4.5 } },
    itsumade:    { name: 'Itsumade',  hp: 130, speed: 64, gold: 17, size: 17, lives: 2, body: '#7a8db0', accent: '#45567a', fly: true, armor: 0.35 },
    boss_oni:    { name: 'Oni Daimyō',        hp: 2300,  speed: 26, gold: 160, size: 38, lives: 10, body: '#d6453a', accent: '#8f2118', armor: 0.15, cls: 'heavy', boss: true, summon: true },
    boss_ryu:    { name: 'Ryūjin',            hp: 6200,  speed: 34, gold: 260, size: 30, lives: 10, body: '#4fc7b8', accent: '#2a8d80', mres: 0.20, cls: 'flying', boss: true, serpent: true },
    boss_shogun: { name: 'Shōgun des Ombres', hp: 14500, speed: 24, gold: 420, size: 40, lives: 20, body: '#4a4460', accent: '#2b2740', armor: 0.25, mres: 0.25, boss: true, shielded: true },
    boss_kappa:  { name: 'Kappa Géant',       hp: 5200,  speed: 30, gold: 340, size: 36, lives: 14, body: '#56b89e', accent: '#2f7d68', armor: 0.20, cls: 'heavy', boss: true, regenRate: 18, deathBoom: true },
    boss_king:   { name: 'Yokai Suprême',     hp: 16000, speed: 24, gold: 600, size: 42, lives: 20, body: '#7a47a0', accent: '#3d2160', armor: 0.20, mres: 0.20, boss: true, phase2: true },
  };

  const AFFIXES = [
    { key: 'swift',  name: 'Véloce',  apply: e => e.speedMul *= 1.32 },
    { key: 'regen',  name: 'Régénérant', apply: e => e.regen = e.maxHp * 0.013 },
    { key: 'armored', name: 'Blindé', apply: e => { e.armor = Math.min(0.7, e.armor + 0.22); e.mres = Math.min(0.7, e.mres + 0.22); } },
  ];

  // ── matrice de dégâts (port V1) : type de tour × classe d'armure ──
  const TOWER_CLASS = {
    archer: 'pierce', tsuru: 'pierce', grandarc: 'pierce',
    taiko: 'blunt', ozutsu: 'blunt', fujin: 'blunt',
    yuki: 'magic', poison: 'magic', kitsune: 'magic', lantern: 'magic', ofuda: 'magic',
    kitsunebi: 'fire',
  };
  const MATRIX = {
    pierce: { light: 1.2,  heavy: 0.8,  flying: 1.15, spirit: 1.0 },
    blunt:  { light: 0.95, heavy: 1.25, flying: 0.7,  spirit: 0.95 },
    magic:  { light: 1.0,  heavy: 0.9,  flying: 1.1,  spirit: 1.2 },
    fire:   { light: 1.1,  heavy: 1.0,  flying: 1.15, spirit: 1.0 },
  };
  const CLASS_LABEL = {
    pierce: 'Perforant — fort vs légers/volants, faible vs blindés',
    blunt:  'Contondant — fort vs blindés, faible vs volants',
    magic:  'Magique — fort vs esprits',
    fire:   'Feu — fort vs légers/volants + brûlure',
  };
  function classify(d) {
    if (d.cls) return d.cls;
    if (d.fly) return 'flying';
    if ((d.mres || 0) >= 0.2 || d.phase) return 'spirit';
    if ((d.armor || 0) >= 0.25) return 'heavy';
    return 'light';
  }
  const towerClassInfo = key => CLASS_LABEL[TOWER_CLASS[key]] || '';

  let nextId = 1;

  class Enemy {
    constructor(key, opts = {}) {
      const d = DEFS[key];
      this.id = nextId++;
      this.key = key; this.def = d;
      this.elite = !!opts.elite;
      this.maxHp = Math.round(d.hp * (opts.hpMul || 1) * (this.elite ? 4 : 1));
      this.hp = this.maxHp;
      this.speedMul = this.elite ? 0.92 : 1;
      this.size = d.size * (this.elite ? 1.32 : 1);
      this.gold = Math.round(d.gold * (this.elite ? 2.2 : 1));
      this.livesCost = d.lives;
      this.armor = d.armor || 0; this.mres = d.mres || 0;
      this.armorClass = classify(d);
      this.fly = !!d.fly;
      this.pathT = opts.pathT || 0;
      this.dead = false; this.leaked = false;
      this.x = 0; this.y = 0; this.ang = 0;
      this.seed = U.rand(U.TAU);
      this.flash = 0;
      this.slow = { pct: 0, t: 0 };
      this.burn = { dps: 0, t: 0 };
      this.poison = { dps: 0, t: 0 };
      this.shock = 0; this.freeze = 0;
      this.dotAcc = 0; this.dotT = 0;
      this.lastImmune = -9;
      // spécifiques
      this.dashT = U.rand(1, 2.5); this.dashing = 0;
      this.phaseT = U.rand(2, 4); this.phased = 0;
      this.trail = [];                                  // afterimages / segments serpent
      this.summonT = 5;
      this.vuln = { mul: 1, t: 0 };                     // malédiction Ofuda (+dégâts subis)
      this.spawnerT = d.spawner ? d.spawner.every : 0;  // invocation périodique (Nopperabō)
      this.shieldHp = 0; this.shieldMax = 0; this.shieldThresholds = [];
      this.enraged = false;
      if (d.shielded) {
        this.shieldMax = Math.round(this.maxHp * 0.11);
        this.shieldHp = this.shieldMax;
        this.shieldThresholds = [0.75, 0.5, 0.25];
      }
      if (d.regenRate) this.regen = d.regenRate;   // troll/nurikabe/kappa boss
      this.healT = U.rand(0, 0.5);                 // shaman
      this.tpT = d.teleport ? d.teleport.every : 0; // wraith
      this.phase2Done = false;                     // boss 2 phases
      this.atk = d.boss ? 28 : Math.max(3, Math.round(d.hp * 0.05));  // riposte vs unités
      this._blockedT = 0; this._blocker = null; this._eatk = 0;
      if (this.elite) {
        this.affix = U.choice(AFFIXES);
        this.affix.apply(this);
      }
      this.updatePos();
    }

    get totalLen() { return this.fly ? M.flyLen : M.totalLen; }

    updatePos() {
      const p = this.fly ? M.flyPointAt(this.pathT) : M.pointAt(this.pathT);
      this.x = p.x; this.y = p.y; this.ang = p.ang;
    }

    currentSpeed() {
      if (this.freeze > 0 || this.shock > 0 || this._blockedT > 0) return 0;
      let s = this.def.speed * this.speedMul;
      if (this.dashing > 0) s *= 3;
      if (this.enraged) s *= 1.6;
      s *= (1 - Math.min(0.85, this.slow.pct));
      s *= TD.weather.enemySpeedMul();   // météo (pluie/neige ralentit, vent accélère)
      s *= (TD.mods.enemySpeedMul || 1); // défi du jour (Course-poursuite)
      return s;
    }

    update(dt) {
      if (this.dead) return;
      const t = TD.game.time;
      // statuts
      if (this.slow.t > 0) { this.slow.t -= dt; if (this.slow.t <= 0) this.slow.pct = 0; }
      if (this.shock > 0) this.shock -= dt;
      if (this.freeze > 0) this.freeze -= dt;
      if (this.vuln.t > 0) { this.vuln.t -= dt; if (this.vuln.t <= 0) this.vuln.mul = 1; }
      let dot = 0;
      if (this.burn.t > 0) { this.burn.t -= dt; dot += this.burn.dps * dt; if (U.chance(dt * 6)) TD.fx.sparks(this.x + U.rand(-6, 6), this.y - 6, '#ff9445', 1, 60, 3); }
      if (this.poison.t > 0) { this.poison.t -= dt; dot += this.poison.dps * dt; if (U.chance(dt * 5)) TD.fx.spawn({ x: this.x + U.rand(-8, 8), y: this.y - this.size, vy: -28, life: 0.7, size: 3.5, color: '#8ee06a', type: 'bubble' }); }
      if (dot > 0) {
        this.hp -= dot; this.dotAcc += dot; this.dotT += dt;
        if (this.dotT > 0.55) {
          TD.fx.floatText(this.x, this.y - this.size - 12, String(Math.round(this.dotAcc)), this.burn.t > 0 ? '#ffab66' : '#a4e878', 13);
          this.dotAcc = 0; this.dotT = 0;
        }
        if (this.hp <= 0) { this.die(); return; }
      }
      if (this.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
      this.flash = Math.max(0, this.flash - dt * 8);

      // bloqué par une unité alliée au corps-à-corps → stoppe et riposte
      if (this._blockedT > 0) {
        this._blockedT -= dt;
        this._eatk -= dt;
        if (this._eatk <= 0 && this._blocker && !this._blocker.dead) { this._eatk = 1.0; this._blocker.hurt(this.atk); }
      }

      // comportements
      if (this.def.dash) {
        if (this.dashing > 0) {
          this.dashing -= dt;
          this.trail.push({ x: this.x, y: this.y, a: 0.5 });
        } else {
          this.dashT -= dt;
          if (this.dashT <= 0) { this.dashing = 0.4; this.dashT = U.rand(2.2, 3); }
        }
      }
      if (this.def.phase) {
        if (this.phased > 0) this.phased -= dt;
        else { this.phaseT -= dt; if (this.phaseT <= 0) { this.phased = 0.9; this.phaseT = U.rand(3.5, 4.5); TD.fx.ring(this.x, this.y, '#cfe3f2', 30, 0.4); } }
      }
      if (this.def.summon) {
        this.summonT -= dt;
        if (this.summonT <= 0) {
          this.summonT = 7;
          TD.fx.shake(0.35);
          TD.fx.ring(this.x, this.y, '#ff6b5d', 90, 0.55, 6);
          TD.audio.sfx('boss');
          for (let i = 1; i <= 3; i++)
            TD.game.spawnEnemy('kodama', { pathT: Math.max(0, this.pathT - i * 34), hpMul: TD.game.waveHpMul() * 0.6 });
        }
      }
      // invocation périodique tant qu'il est en vie (Nopperabō)
      if (this.def.spawner) {
        this.spawnerT -= dt;
        if (this.spawnerT <= 0) {
          this.spawnerT = this.def.spawner.every;
          for (let i = 0; i < this.def.spawner.n; i++)
            TD.game.spawnEnemy(this.def.spawner.key, { pathT: Math.max(0, this.pathT - 20 - i * 16), hpMul: TD.game.waveHpMul() * 0.7 });
          TD.fx.ring(this.x, this.y, this.def.accent, 28, 0.4, 3);
        }
      }
      if (this.def.serpent) {
        if (this.dashing > 0) this.dashing -= dt;
        else { this.dashT -= dt; if (this.dashT <= 0) { this.dashing = 1.1; this.dashT = 6; TD.fx.ring(this.x, this.y, '#7adcff', 60, 0.4); } }
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 26) this.trail.shift();
      }
      if (this.def.shielded) {
        const hpPct = this.hp / this.maxHp;
        if (this.shieldThresholds.length && hpPct <= this.shieldThresholds[0]) {
          this.shieldThresholds.shift();
          this.shieldHp = this.shieldMax;
          TD.audio.sfx('shield');
          TD.fx.ring(this.x, this.y, '#7aa8ff', 80, 0.5, 5);
        }
        if (!this.enraged && hpPct < 0.2) {
          this.enraged = true;
          TD.fx.shake(0.4);
          TD.fx.floatText(this.x, this.y - 60, 'ENRAGÉ !', '#ff5d5d', 22, true);
        }
      }
      // soin de zone (Miko)
      if (this.def.healAura) {
        this.healT -= dt;
        if (this.healT <= 0) {
          this.healT = 0.5;
          const a = this.def.healAura;
          let healed = false;
          for (const o of TD.game.enemies) {
            if (o === this || o.dead || o.hp >= o.maxHp) continue;
            if (U.dist2(this.x, this.y, o.x, o.y) <= a.range * a.range) {
              o.hp = Math.min(o.maxHp, o.hp + a.hps * 0.5);
              healed = true;
            }
          }
          if (healed) TD.fx.ring(this.x, this.y, '#7ade9e', a.range, 0.28, 2);
        }
      }
      // téléportation vers l'avant (Onryō)
      if (this.def.teleport) {
        this.tpT -= dt;
        if (this.tpT <= 0) {
          this.tpT = this.def.teleport.every;
          TD.fx.ring(this.x, this.y, '#c9b3ff', 26, 0.4);
          this.pathT = Math.min(this.totalLen - 1, this.pathT + this.def.teleport.dist);
          this.updatePos();
          TD.fx.ring(this.x, this.y, '#c9b3ff', 26, 0.4);
          TD.audio.sfx('freeze');
        }
      }
      // berserk : enrage sous 30 % de vie (Shuten-dōji)
      if (this.def.berserk && !this.enraged && this.hp / this.maxHp < 0.3) {
        this.enraged = true;
        TD.fx.floatText(this.x, this.y - this.size - 20, 'ENRAGÉ !', '#ff5d5d', 16, true);
        TD.fx.ring(this.x, this.y, '#ff6b5d', 40, 0.4);
      }
      // boss à 2 phases (Yokai Suprême) : à 50 %, se soigne + invoque
      if (this.def.phase2 && !this.phase2Done && this.hp / this.maxHp <= 0.5) {
        this.phase2Done = true;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
        for (let i = 1; i <= 6; i++)
          TD.game.spawnEnemy('onryo', { pathT: Math.max(0, this.pathT - i * 30), hpMul: TD.game.waveHpMul() * 0.5 });
        TD.fx.shake(0.5);
        TD.fx.ring(this.x, this.y, '#ff5d8a', 120, 0.6, 6);
        TD.fx.floatText(this.x, this.y - 70, 'PHASE 2 !', '#ff5d8a', 24, true);
        TD.audio.sfx('boss');
      }
      // afterimages fade
      if (this.trail.length && !this.def.serpent) {
        for (const tr of this.trail) tr.a -= dt * 2.4;
        while (this.trail.length && this.trail[0].a <= 0) this.trail.shift();
      }

      // avance
      this.pathT += this.currentSpeed() * dt;
      if (this.pathT >= this.totalLen) { this.leak(); return; }
      this.updatePos();
    }

    // amount brut, kind: 'phys' | 'magic' | 'true'
    takeDamage(amount, kind = 'phys', opts = {}) {
      if (this.dead) return 0;
      if (this.phased > 0) {
        if (TD.game.time - this.lastImmune > 0.5) {
          this.lastImmune = TD.game.time;
          TD.fx.floatText(this.x, this.y - this.size - 12, 'IMMUNISÉ', '#bcd9ee', 12);
        }
        return 0;
      }
      let dmg = amount;
      if (kind === 'phys') dmg *= (1 - this.armor);
      if (kind === 'magic') dmg *= (1 - this.mres);
      if (this.shock > 0) dmg *= 1.15;
      dmg = Math.max(1, dmg);
      // ── combos de statut (port V1) ──
      let combo = null;
      const tag = opts.tag;
      if (tag === 'taiko' && (this.freeze > 0 || this.slow.pct > 0)) { dmg *= 2; combo = '💥 BRISÉ !'; }
      else if ((tag === 'kitsune' || tag === 'lantern') && this.slow.pct > 0) { dmg *= 1.5; combo = '⚡ SURCHARGE'; }
      if (combo && !opts.quiet) {
        TD.fx.floatText(this.x, this.y - this.size - 28, combo, '#ffe35e', 15, true);
        if (this.freeze > 0) TD.fx.sparks(this.x, this.y, '#bfeaff', 8, 160, 4);
      }
      // ── matrice de dégâts (type de tour vs classe d'armure) ──
      const tcls = TOWER_CLASS[tag];
      if (tcls) dmg *= (MATRIX[tcls][this.armorClass] || 1);
      if (this.vuln.t > 0) dmg *= this.vuln.mul;   // malédiction Ofuda
      // bouclier du shogun
      if (this.shieldHp > 0) {
        const absorbed = Math.min(this.shieldHp, dmg);
        this.shieldHp -= absorbed;
        dmg -= absorbed;
        TD.fx.floatText(this.x, this.y - this.size - 12, Math.round(absorbed) + '', '#9cc2ff', 13);
        if (this.shieldHp <= 0) {
          TD.fx.explosion(this.x, this.y, '#7aa8ff', 60);
          TD.fx.floatText(this.x, this.y - this.size - 26, 'BOUCLIER BRISÉ', '#cfe2ff', 16, true);
        }
        if (dmg <= 0) { this.flash = 1; return absorbed; }
      }
      this.hp -= dmg;
      this.flash = 1;
      if (!opts.quiet) {
        TD.fx.floatText(this.x + U.rand(-6, 6), this.y - this.size - 14, String(Math.round(dmg)), opts.crit ? '#ffb347' : '#ffffff', opts.crit ? 17 : 14, opts.crit);
      }
      if (this.hp <= 0) this.die();
      return dmg;
    }

    applySlow(pct, dur) {
      pct = Math.min(0.85, pct + (TD.mods.slowBonus || 0));
      if (pct >= this.slow.pct) { this.slow.pct = pct; this.slow.t = Math.max(this.slow.t, dur); }
    }
    applyBurn(dps, dur) { this.burn.dps = Math.max(this.burn.dps, dps); this.burn.t = Math.max(this.burn.t, dur); }
    applyPoison(dps, dur) { if (this.def.poisonImmune) return; this.poison.dps = Math.max(this.poison.dps, dps); this.poison.t = Math.max(this.poison.t, dur); }
    applyVuln(mul, dur) { if (mul > this.vuln.mul) this.vuln.mul = mul; this.vuln.t = Math.max(this.vuln.t, dur); }
    applyShock(dur) { this.shock = Math.max(this.shock, dur); }
    applyFreeze(dur) {
      if (this.def.boss) dur *= 0.4;
      this.freeze = Math.max(this.freeze, dur);
      TD.audio.sfx('freeze');
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      const c = this.def.body;
      TD.fx.petalBurst(this.x, this.y, c, this.def.boss ? 26 : 9);
      TD.fx.sparks(this.x, this.y, '#ffe9a0', this.def.boss ? 18 : 5, 180);
      TD.fx.ghostRise(this.x, this.y - 6, '#ffffff');
      TD.fx.coinFly(this.x, this.y, this.def.boss ? 6 : 1);
      TD.audio.sfx('death');
      if (this.def.boss) {
        TD.fx.explosion(this.x, this.y, c, 110, true);
        TD.fx.hitstop(0.3);
        TD.fx.shake(0.7);
      }
      if (this.def.split) {
        for (let i = 0; i < this.def.split; i++)
          TD.game.spawnEnemy('tanukin', { pathT: this.pathT + U.rand(-16, 16), hpMul: TD.game.waveHpMul() });
      }
      if (this.def.deathSpawn) {
        for (let i = 0; i < this.def.deathSpawn.n; i++)
          TD.game.spawnEnemy(this.def.deathSpawn.key, { pathT: this.pathT + U.rand(-14, 14), hpMul: TD.game.waveHpMul() });
      }
      if (this.def.deathBoom) { TD.fx.explosion(this.x, this.y, '#7adcff', 150, true); TD.fx.shake(0.5); }
      TD.game.onEnemyKilled(this);
    }

    leak() {
      this.dead = true; this.leaked = true;
      TD.game.onEnemyLeaked(this);
    }

    // ── dessin chibi ───────────────────────────────────────
    draw(ctx, t) {
      const s = this.size;
      const moving = this.currentSpeed() > 1;
      const bob = moving ? Math.abs(Math.sin(t * 9 + this.seed)) * 3.5 : 0;
      const breath = 1 + Math.sin(t * 5 + this.seed) * 0.035;
      const x = this.x, y = this.y - bob - (this.fly ? 16 + Math.sin(t * 3 + this.seed) * 5 : 0) - (this.def.serpent ? 14 : 0);

      // ombre
      ctx.fillStyle = 'rgba(40,60,40,0.25)';
      ctx.beginPath(); ctx.ellipse(this.x, this.y + s * 0.72, s * 0.8, s * 0.3, 0, 0, U.TAU); ctx.fill();

      // afterimages kitsune
      if (this.def.dash && this.trail.length) {
        for (const tr of this.trail) {
          ctx.globalAlpha = Math.max(0, tr.a) * 0.5;
          ctx.fillStyle = this.def.body;
          ctx.beginPath(); ctx.arc(tr.x, tr.y - bob, s * 0.8, 0, U.TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // corps du serpent ryujin
      if (this.def.serpent && this.trail.length > 2) {
        for (let i = 0; i < this.trail.length - 1; i += 3) {
          const tr = this.trail[i];
          const k = i / this.trail.length;
          ctx.fillStyle = U.lerpColor(this.def.accent, this.def.body, k);
          ctx.beginPath(); ctx.arc(tr.x, tr.y - 14 + Math.sin(t * 5 + i) * 4, s * (0.4 + k * 0.4), 0, U.TAU); ctx.fill();
        }
        // nageoires dorsales
        ctx.fillStyle = '#ffd24a';
        for (let i = 3; i < this.trail.length - 3; i += 6) {
          const tr = this.trail[i];
          ctx.beginPath();
          ctx.moveTo(tr.x - 4, tr.y - 22); ctx.lineTo(tr.x, tr.y - 34 - Math.sin(t * 5 + i) * 3); ctx.lineTo(tr.x + 4, tr.y - 22);
          ctx.fill();
        }
      }

      ctx.save();
      ctx.translate(x, y);
      if (this.key === 'daruma' || this.key === 'boss_shogun') ctx.rotate(Math.sin(t * 4 + this.seed) * 0.1);
      if (this.phased > 0) ctx.globalAlpha = 0.38;
      ctx.scale(breath, 2 - breath);

      this.drawBody(ctx, t, s);

      // flash blanc à l'impact
      if (this.flash > 0.05) {
        ctx.globalAlpha = this.flash * 0.65;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, s, 0, U.TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // gelé : bloc de glace
      if (this.freeze > 0) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#bfe6ff';
        U.rr(ctx, -s - 3, -s - 5, s * 2 + 6, s * 2 + 8, 6); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.6); ctx.lineTo(0, 0); ctx.lineTo(-s * 0.3, s * 0.4); ctx.stroke();
      }
      ctx.restore();

      // statuts (icônes au-dessus)
      if (this.slow.pct > 0 && this.freeze <= 0) {
        ctx.fillStyle = '#9fdcff';
        ctx.beginPath();
        ctx.moveTo(x - s - 5, y - s + 2); ctx.lineTo(x - s - 1, y - s + 9); ctx.lineTo(x - s - 9, y - s + 9);
        ctx.fill();
      }
      if (this.shock > 0) {
        ctx.strokeStyle = '#ffe35e'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + s + 3, y - s); ctx.lineTo(x + s + 8, y - s + 6); ctx.lineTo(x + s + 3, y - s + 7); ctx.lineTo(x + s + 9, y - s + 14);
        ctx.stroke();
      }
      // maudit (Ofuda) : halo violet
      if (this.vuln.t > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22 + 0.14 * U.pulse(t * 2.5);
        ctx.drawImage(TD.fx.glowSprite('#c08af0'), this.x - s * 1.35, y - s * 1.35, s * 2.7, s * 2.7);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }

      // élite : couronne + anneau
      if (this.elite) {
        ctx.strokeStyle = U.withAlpha('#ffd24a', 0.5 + 0.3 * U.pulse(t * 1.5));
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, s + 7, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        const cy = y - s - 12;
        ctx.moveTo(x - 9, cy + 6); ctx.lineTo(x - 9, cy); ctx.lineTo(x - 4.5, cy + 3.5); ctx.lineTo(x, cy - 2);
        ctx.lineTo(x + 4.5, cy + 3.5); ctx.lineTo(x + 9, cy); ctx.lineTo(x + 9, cy + 6);
        ctx.fill();
      }

      // barre de vie
      if (this.hp < this.maxHp) {
        const w = Math.max(26, s * 2), h = 5;
        const bx = this.x - w / 2, by = y - s - (this.elite ? 22 : 10);
        ctx.fillStyle = 'rgba(30,25,40,0.7)';
        U.rr(ctx, bx - 1, by - 1, w + 2, h + 2, 3); ctx.fill();
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = pct > 0.5 ? '#7ade6e' : (pct > 0.25 ? '#ffd24a' : '#ff6b5d');
        U.rr(ctx, bx, by, w * pct, h, 2.5); ctx.fill();
        if (this.shieldHp > 0) {
          ctx.fillStyle = '#8ab4ff';
          U.rr(ctx, bx, by - 4, w * (this.shieldHp / this.shieldMax), 3, 1.5); ctx.fill();
        }
      }
    }

    drawFace(ctx, s, opts = {}) {
      const blink = (Math.sin(TD.game.time * 0.9 + this.seed * 3) > 0.97);
      const ex = s * 0.34, ey = -s * 0.1;
      ctx.fillStyle = opts.eye || '#2f2a3a';
      if (blink) {
        ctx.lineWidth = 2; ctx.strokeStyle = opts.eye || '#2f2a3a';
        ctx.beginPath(); ctx.moveTo(-ex - 3, ey); ctx.lineTo(-ex + 3, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 3, ey); ctx.lineTo(ex + 3, ey); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(-ex, ey, s * 0.13, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, s * 0.13, 0, U.TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(-ex + 1, ey - 1.5, s * 0.045, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + 1, ey - 1.5, s * 0.045, 0, U.TAU); ctx.fill();
      }
      // blush
      ctx.fillStyle = 'rgba(255,120,150,0.4)';
      ctx.beginPath(); ctx.ellipse(-ex - s * 0.18, ey + s * 0.28, s * 0.14, s * 0.08, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex + s * 0.18, ey + s * 0.28, s * 0.14, s * 0.08, 0, 0, U.TAU); ctx.fill();
      // bouche
      ctx.strokeStyle = opts.eye || '#2f2a3a'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (opts.angry) { ctx.arc(0, ey + s * 0.45, s * 0.14, Math.PI * 1.15, Math.PI * 1.85); }
      else { ctx.arc(0, ey + s * 0.3, s * 0.13, 0.3, Math.PI - 0.3); }
      ctx.stroke();
      if (opts.angry) {
        // sourcils
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-ex - 4, ey - s * 0.3); ctx.lineTo(-ex + 3, ey - s * 0.16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + 4, ey - s * 0.3); ctx.lineTo(ex - 3, ey - s * 0.16); ctx.stroke();
      }
      if (opts.fang) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(-3, ey + s * 0.42); ctx.lineTo(-1, ey + s * 0.56); ctx.lineTo(1, ey + s * 0.42); ctx.fill();
      }
    }

    drawBody(ctx, t, s) {
      const d = this.def, body = d.body, accent = d.accent;
      const ball = (fill, r = s, dy = 0) => {
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(0, dy, r, 0, U.TAU); ctx.fill();
      };
      switch (this.key) {
        case 'kodama': case 'tanukin': {
          ball(body);
          ball(U.withAlpha('#ffffff', 0.25), s * 0.7, -s * 0.25);
          if (this.key === 'kodama') {
            // pousse sur la tête
            ctx.strokeStyle = '#4e9344'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(2, -s - 8, 6, -s - 10); ctx.stroke();
            ctx.fillStyle = '#6ec25c';
            ctx.beginPath(); ctx.ellipse(8, -s - 11, 6, 3.5, -0.5, 0, U.TAU); ctx.fill();
          } else {
            ctx.fillStyle = accent;
            ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.7); ctx.lineTo(-s * 0.3, -s - 5); ctx.lineTo(-s * 0.05, -s * 0.75); ctx.fill();
            ctx.beginPath(); ctx.moveTo(s * 0.6, -s * 0.7); ctx.lineTo(s * 0.3, -s - 5); ctx.lineTo(s * 0.05, -s * 0.75); ctx.fill();
          }
          this.drawFace(ctx, s);
          break;
        }
        case 'kappa': {
          ball(body);
          // assiette d'eau
          ctx.fillStyle = '#3d8a76';
          ctx.beginPath(); ctx.ellipse(0, -s * 0.82, s * 0.55, s * 0.22, 0, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#bdebff';
          ctx.beginPath(); ctx.ellipse(0, -s * 0.85, s * 0.42, s * 0.15, 0, 0, U.TAU); ctx.fill();
          // bec
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(0, 7); ctx.lineTo(4, 2); ctx.fill();
          this.drawFace(ctx, s);
          // lignes de vitesse
          ctx.strokeStyle = U.withAlpha('#ffffff', 0.5); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-s - 10, -4); ctx.lineTo(-s - 3, -4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-s - 14, 3); ctx.lineTo(-s - 5, 3); ctx.stroke();
          break;
        }
        case 'tanuki': {
          ball(body);
          ball('#e8cfa8', s * 0.62, s * 0.18);            // ventre
          ctx.fillStyle = accent;                          // oreilles
          ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 0.55); ctx.lineTo(-s * 0.35, -s - 6); ctx.lineTo(-s * 0.05, -s * 0.7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.7, -s * 0.55); ctx.lineTo(s * 0.35, -s - 6); ctx.lineTo(s * 0.05, -s * 0.7); ctx.fill();
          // masque
          ctx.fillStyle = U.withAlpha(accent, 0.55);
          ctx.beginPath(); ctx.ellipse(-s * 0.34, -s * 0.1, s * 0.24, s * 0.17, -0.2, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(s * 0.34, -s * 0.1, s * 0.24, s * 0.17, 0.2, 0, U.TAU); ctx.fill();
          this.drawFace(ctx, s);
          break;
        }
        case 'oni': {
          ball(body);
          // cornes
          ctx.fillStyle = '#fff3dd';
          ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.65); ctx.lineTo(-s * 0.75, -s - 8); ctx.lineTo(-s * 0.25, -s * 0.8); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.55, -s * 0.65); ctx.lineTo(s * 0.75, -s - 8); ctx.lineTo(s * 0.25, -s * 0.8); ctx.fill();
          // pagne tigré
          ctx.fillStyle = '#ffc94a';
          ctx.beginPath(); ctx.ellipse(0, s * 0.62, s * 0.72, s * 0.3, 0, 0, Math.PI); ctx.fill();
          ctx.fillStyle = '#6b4a12';
          ctx.fillRect(-s * 0.4, s * 0.52, 4, s * 0.34);
          ctx.fillRect(s * 0.15, s * 0.52, 4, s * 0.34);
          this.drawFace(ctx, s, { angry: true, fang: true });
          break;
        }
        case 'tengu': {
          // ailes
          const flap = Math.sin(t * 12 + this.seed) * 0.5;
          ctx.fillStyle = accent;
          for (const sd of [-1, 1]) {
            ctx.save();
            ctx.translate(sd * s * 0.75, -s * 0.15);
            ctx.rotate(sd * (0.5 + flap));
            ctx.beginPath();
            ctx.ellipse(sd * s * 0.55, 0, s * 0.75, s * 0.3, sd * 0.25, 0, U.TAU);
            ctx.fill();
            ctx.restore();
          }
          ball(body);
          // long nez
          ctx.fillStyle = '#ff8a5c';
          ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(s + 9, 3); ctx.lineTo(0, 7); ctx.fill();
          // calotte
          ctx.fillStyle = '#d94f4f';
          ctx.beginPath(); ctx.arc(0, -s * 0.62, s * 0.4, Math.PI, 0); ctx.fill();
          this.drawFace(ctx, s, { angry: true });
          break;
        }
        case 'kitsune': {
          // queues
          const n = 3;
          for (let i = 0; i < n; i++) {
            const a = Math.PI / 2 + (i - 1) * 0.55 + Math.sin(t * 4 + i) * 0.12;
            ctx.save();
            ctx.translate(-Math.cos(a) * s * 0.5, s * 0.3);
            ctx.rotate(-a);
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.ellipse(0, s * 0.75, s * 0.3, s * 0.78, 0, 0, U.TAU); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(0, s * 1.25, s * 0.2, s * 0.3, 0, 0, U.TAU); ctx.fill();
            ctx.restore();
          }
          ball(body);
          ball('#fff5ec', s * 0.55, s * 0.25);
          // oreilles
          ctx.fillStyle = body;
          ctx.beginPath(); ctx.moveTo(-s * 0.65, -s * 0.5); ctx.lineTo(-s * 0.4, -s - 9); ctx.lineTo(-s * 0.05, -s * 0.7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.65, -s * 0.5); ctx.lineTo(s * 0.4, -s - 9); ctx.lineTo(s * 0.05, -s * 0.7); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.62); ctx.lineTo(-s * 0.4, -s - 4); ctx.lineTo(-s * 0.2, -s * 0.72); ctx.fill();
          this.drawFace(ctx, s);
          break;
        }
        case 'yurei': {
          // corps fantôme ondulé
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.arc(0, -s * 0.15, s, Math.PI, 0);
          const w = Math.sin(t * 6 + this.seed) * 3;
          ctx.quadraticCurveTo(s, s * 0.6, s * 0.65, s * 0.9 + w);
          ctx.quadraticCurveTo(s * 0.4, s * 0.55, s * 0.15, s * 0.95 - w);
          ctx.quadraticCurveTo(-s * 0.1, s * 0.55, -s * 0.4, s * 0.9 + w);
          ctx.quadraticCurveTo(-s * 0.7, s * 0.6, -s, -s * 0.15 + 8);
          ctx.closePath(); ctx.fill();
          // flamme hitodama
          ctx.fillStyle = U.withAlpha('#9fdcff', 0.8);
          const fy = -s - 10 + Math.sin(t * 5) * 2;
          ctx.beginPath();
          ctx.moveTo(-12, fy); ctx.quadraticCurveTo(-12, fy - 9, -4, fy - 8);
          ctx.quadraticCurveTo(-7, fy - 3, -12, fy);
          ctx.fill();
          this.drawFace(ctx, s, { eye: '#46688a' });
          break;
        }
        case 'daruma': {
          ball(body, s * 1.05);
          // visage blanc
          ctx.fillStyle = '#fff5e6';
          ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.62, s * 0.68, 0, 0, U.TAU); ctx.fill();
          // déco or
          ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, s * 0.4, s * 0.5, 0.3, Math.PI - 0.3); ctx.stroke();
          this.drawFace(ctx, s * 0.9, { angry: true });
          break;
        }
        case 'boss_oni': {
          ball(body);
          ball(U.withAlpha('#ffffff', 0.12), s * 0.75, -s * 0.2);
          // grosses cornes
          ctx.fillStyle = '#fff3dd';
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.6); ctx.lineTo(-s * 0.85, -s - 20); ctx.lineTo(-s * 0.15, -s * 0.8); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.6); ctx.lineTo(s * 0.85, -s - 20); ctx.lineTo(s * 0.15, -s * 0.8); ctx.fill();
          // massue kanabo
          ctx.save();
          ctx.rotate(Math.sin(t * 2) * 0.15 + 0.5);
          ctx.fillStyle = '#4a3a52';
          U.rr(ctx, s * 0.7, -s * 1.4, 13, s * 1.6, 6); ctx.fill();
          ctx.fillStyle = '#ffd24a';
          for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(s * 0.7 + 6.5, -s * 1.2 + i * 14, 2.5, 0, U.TAU); ctx.fill(); }
          ctx.restore();
          // ceinture
          ctx.fillStyle = '#ffc94a';
          ctx.beginPath(); ctx.ellipse(0, s * 0.66, s * 0.78, s * 0.28, 0, 0, Math.PI); ctx.fill();
          this.drawFace(ctx, s, { angry: true, fang: true });
          break;
        }
        case 'boss_ryu': {
          // tête de dragon (corps dessiné via trail)
          ball(body, s * 0.9);
          // cornes de cerf
          ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(sd * s * 0.3, -s * 0.7);
            ctx.quadraticCurveTo(sd * s * 0.7, -s - 14, sd * s * 0.45, -s - 22);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sd * s * 0.55, -s - 6); ctx.lineTo(sd * s * 0.85, -s - 12);
            ctx.stroke();
          }
          // moustaches
          ctx.strokeStyle = '#e8fff9'; ctx.lineWidth = 2;
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(sd * s * 0.5, s * 0.2);
            ctx.quadraticCurveTo(sd * s * 1.3, s * 0.1 + Math.sin(t * 4) * 6, sd * s * 1.7, s * 0.5);
            ctx.stroke();
          }
          // museau
          ctx.fillStyle = '#7adcc9';
          ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.45, s * 0.28, 0, 0, U.TAU); ctx.fill();
          this.drawFace(ctx, s, { angry: true });
          break;
        }
        case 'boss_shogun': {
          ball(body);
          // armure plastron
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.85, s * 0.55, 0, 0, Math.PI); ctx.fill();
          ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.85, s * 0.55, 0, 0.2, Math.PI - 0.2); ctx.stroke();
          // kabuto + croissant doré
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.arc(0, -s * 0.55, s * 0.62, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.95);
          ctx.quadraticCurveTo(-s * 0.75, -s * 1.5, -s * 0.35, -s * 1.75);
          ctx.quadraticCurveTo(-s * 0.05, -s * 1.3, 0, -s * 1.05);
          ctx.quadraticCurveTo(s * 0.05, -s * 1.3, s * 0.35, -s * 1.75);
          ctx.quadraticCurveTo(s * 0.75, -s * 1.5, 0, -s * 0.95);
          ctx.fill();
          // masque menpo
          ctx.fillStyle = '#1d1a2c';
          ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.5, s * 0.32, 0, 0, Math.PI); ctx.fill();
          this.drawFace(ctx, s, { angry: true, eye: this.enraged ? '#ff5d5d' : '#cfd4ff' });
          if (this.enraged) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.3 + 0.2 * U.pulse(t * 3);
            ctx.drawImage(TD.fx.glowSprite('#ff4040'), -s * 1.5, -s * 1.5, s * 3, s * 3);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 'gashadokuro': {
          ball(body);
          ball(U.withAlpha('#ffffff', 0.4), s * 0.7, -s * 0.2);
          ctx.fillStyle = '#2a2536';
          ctx.beginPath(); ctx.arc(-s * 0.34, -s * 0.05, s * 0.2, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(s * 0.34, -s * 0.05, s * 0.2, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#9be7ff';
          ctx.beginPath(); ctx.arc(-s * 0.34, -s * 0.05, s * 0.08, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(s * 0.34, -s * 0.05, s * 0.08, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.4); ctx.lineTo(s * 0.3, s * 0.4); ctx.stroke();
          for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.14, s * 0.34); ctx.lineTo(i * s * 0.14, s * 0.46); ctx.stroke(); }
          break;
        }
        case 'miko': {
          ball(body);
          ball('#fff', s * 0.5, s * 0.15);
          ctx.strokeStyle = U.withAlpha('#fff', 0.85); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(0, -s - 4, s * 0.7, s * 0.22, 0, 0, U.TAU); ctx.stroke();
          this.drawFace(ctx, s, { eye: '#9c4a6a' });
          break;
        }
        case 'onryo': {
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.arc(0, -s * 0.15, s, Math.PI, 0);
          const w = Math.sin(t * 6 + this.seed) * 3;
          ctx.quadraticCurveTo(s, s * 0.6, s * 0.55, s * 0.9 + w);
          ctx.quadraticCurveTo(s * 0.2, s * 0.5, -s * 0.1, s * 0.9 - w);
          ctx.quadraticCurveTo(-s * 0.5, s * 0.55, -s, -s * 0.15 + 8);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.7); ctx.lineTo(-s * 0.7, -s - 6); ctx.lineTo(-s * 0.2, -s * 0.75); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.7); ctx.lineTo(s * 0.7, -s - 6); ctx.lineTo(s * 0.2, -s * 0.75); ctx.fill();
          this.drawFace(ctx, s, { angry: true, eye: '#5a3a7a' });
          break;
        }
        case 'shuten': {
          ball(body);
          ctx.fillStyle = '#fff3dd';
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.6); ctx.lineTo(-s * 0.7, -s - 10); ctx.lineTo(-s * 0.2, -s * 0.8); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.6); ctx.lineTo(s * 0.7, -s - 10); ctx.lineTo(s * 0.2, -s * 0.8); ctx.fill();
          ctx.fillStyle = '#caa46a';
          ctx.beginPath(); ctx.ellipse(s * 0.85, s * 0.25, s * 0.22, s * 0.3, 0.3, 0, U.TAU); ctx.fill();
          this.drawFace(ctx, s, { angry: true, fang: true, eye: this.enraged ? '#ffe14a' : '#2f2a3a' });
          if (this.enraged) {
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + 0.2 * U.pulse(t * 3);
            ctx.drawImage(TD.fx.glowSprite('#ff5530'), -s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          }
          break;
        }
        case 'nurikabe': {
          ctx.fillStyle = body;
          U.rr(ctx, -s, -s * 0.9, s * 2, s * 1.9, 8); ctx.fill();
          ctx.fillStyle = U.withAlpha('#ffffff', 0.12);
          U.rr(ctx, -s * 0.8, -s * 0.7, s * 1.6, s * 0.5, 5); ctx.fill();
          ctx.strokeStyle = accent; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.9); ctx.lineTo(-s * 0.1, -s * 0.2); ctx.lineTo(-s * 0.35, s * 0.4); ctx.stroke();
          this.drawFace(ctx, s * 0.9, { angry: true });
          break;
        }
        case 'boss_kappa': {
          ball(body);
          ball(U.withAlpha('#ffffff', 0.1), s * 0.72, -s * 0.2);
          ctx.fillStyle = accent;
          ctx.beginPath(); ctx.ellipse(0, s * 0.5, s * 0.85, s * 0.5, 0, 0, Math.PI); ctx.fill();
          ctx.fillStyle = '#2f7d68';
          ctx.beginPath(); ctx.ellipse(0, -s * 0.85, s * 0.6, s * 0.24, 0, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#bdebff';
          ctx.beginPath(); ctx.ellipse(0, -s * 0.88, s * 0.46, s * 0.16, 0, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(0, 12); ctx.lineTo(6, 4); ctx.fill();
          this.drawFace(ctx, s, { angry: true });
          break;
        }
        case 'boss_king': {
          ball(body);
          ball(U.withAlpha('#ffffff', 0.1), s * 0.72, -s * 0.2);
          ctx.fillStyle = '#2b1a3a';
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.6); ctx.lineTo(-s * 0.9, -s - 24); ctx.lineTo(-s * 0.15, -s * 0.8); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.5, -s * 0.6); ctx.lineTo(s * 0.9, -s - 24); ctx.lineTo(s * 0.15, -s * 0.8); ctx.fill();
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath();
          ctx.moveTo(-s * 0.5, -s * 0.55); ctx.lineTo(-s * 0.5, -s * 0.95); ctx.lineTo(-s * 0.2, -s * 0.7);
          ctx.lineTo(0, -s * 1.05); ctx.lineTo(s * 0.2, -s * 0.7); ctx.lineTo(s * 0.5, -s * 0.95); ctx.lineTo(s * 0.5, -s * 0.55);
          ctx.fill();
          ctx.fillStyle = '#ffc94a';
          ctx.beginPath(); ctx.ellipse(0, s * 0.62, s * 0.8, s * 0.3, 0, 0, Math.PI); ctx.fill();
          this.drawFace(ctx, s, { angry: true, fang: true, eye: this.phase2Done ? '#ff4a6a' : '#ffe14a' });
          if (this.phase2Done) {
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + 0.2 * U.pulse(t * 3);
            ctx.drawImage(TD.fx.glowSprite('#ff4070'), -s * 1.5, -s * 1.5, s * 3, s * 3);
            ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          }
          break;
        }
        case 'jorogumo': {
          // pattes d'araignée animées
          ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.lineCap = 'round';
          for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
            const ay = -s * 0.18 + i * s * 0.3, sw = Math.sin(t * 8 + this.seed + i) * 2;
            ctx.beginPath();
            ctx.moveTo(sd * s * 0.5, ay);
            ctx.quadraticCurveTo(sd * (s * 1.1 + sw), ay - 3, sd * (s * 1.3 + sw), ay + s * 0.42);
            ctx.stroke();
          }
          ball(body);
          ball(U.withAlpha('#ffffff', 0.18), s * 0.6, -s * 0.2);
          ctx.fillStyle = '#2a2030';
          for (const ox of [-0.42, -0.16, 0.16, 0.42]) { ctx.beginPath(); ctx.arc(ox * s, -s * 0.05, s * 0.08, 0, U.TAU); ctx.fill(); }
          ctx.fillStyle = '#ff5da0';
          ctx.beginPath(); ctx.arc(-s * 0.42, -s * 0.07, s * 0.045, 0, U.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.07, s * 0.045, 0, U.TAU); ctx.fill();
          break;
        }
        case 'nopperabo': {
          ball(body);
          ball(U.withAlpha('#ffffff', 0.3), s * 0.66, -s * 0.18);
          // visage LISSE (sans yeux) — juste une fente et un voile pâle
          ctx.strokeStyle = U.withAlpha(accent, 0.55); ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(0, s * 0.14, s * 0.22, 0.2, Math.PI - 0.2); ctx.stroke();
          ctx.fillStyle = U.withAlpha('#ffffff', 0.45);
          U.rr(ctx, -s * 0.92, -s, s * 1.84, s * 0.5, 6); ctx.fill();
          break;
        }
        case 'itsumade': {
          // ailes blindées battantes
          const flap = Math.sin(t * 10 + this.seed) * 0.45;
          ctx.fillStyle = accent;
          for (const sd of [-1, 1]) {
            ctx.save(); ctx.translate(sd * s * 0.7, -s * 0.1); ctx.rotate(sd * (0.55 + flap));
            ctx.beginPath(); ctx.ellipse(sd * s * 0.55, 0, s * 0.8, s * 0.28, sd * 0.2, 0, U.TAU); ctx.fill();
            ctx.restore();
          }
          ball(body);
          ctx.fillStyle = U.withAlpha('#2a3550', 0.55);
          ctx.beginPath(); ctx.ellipse(0, s * 0.22, s * 0.6, s * 0.5, 0, 0, U.TAU); ctx.fill();
          ctx.strokeStyle = '#cdd6e8'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-s * 0.38, s * 0.12); ctx.lineTo(s * 0.38, s * 0.12); ctx.stroke();
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(s * 0.72, 2); ctx.lineTo(0, 6); ctx.fill();
          this.drawFace(ctx, s, { angry: true, eye: '#cfd9ee' });
          break;
        }
        default:
          ball(body);
          this.drawFace(ctx, s);
      }
    }
  }

  return { DEFS, Enemy, towerClassInfo, classify };
})();
